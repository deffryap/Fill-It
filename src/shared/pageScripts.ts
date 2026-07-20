// ─────────────────────────────────────────────────────────────────────────────
// pageScripts.ts
//
// Self-contained functions that are injected into the BROWSER PAGE context via
// chrome.scripting.executeScript({ func: ... }).
//
// CRITICAL RULES:
//   1. These functions CANNOT use module imports or reference outer-scope variables.
//   2. All async functions MUST return a Promise (so Chrome's scripting API awaits
//      completion — fixes the `run().catch()` silent race condition bug).
//   3. TypeScript types here are for the popup-side call signature only; they are
//      compiled away before the functions are serialised for injection.
// ─────────────────────────────────────────────────────────────────────────────

export interface PageField {
    selector: string;
    label: string;
    type: string;
    placeholder: string;
    name: string;
    id: string;
}

export interface IdentitySnapshot {
    fullName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    bankAccount: string;
    bankName: string;
    nik: string;
    npwp: string;
    birthDate: string;
    password: string;
    company: string;
    jobTitle: string;
    website: string;
    bio: string;
    locale: string;
}

export type FieldOverride = { selector: string; value: string };

// ─── scanPageForm ─────────────────────────────────────────────────────────────
// Scans all visible form fields on the current page and returns their metadata.
// Used by the Form Scanner tab (step 1 of the scan → edit → inject flow).
export function scanPageForm(): PageField[] {
    const inputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input:not([type="submit"]):not([type="button"]):not([type="hidden"]):not([type="image"]):not([type="file"]), textarea, select'
    );

    const fields: PageField[] = [];

    inputs.forEach((el, index) => {
        // Build the most stable CSS selector possible
        let selector = '';
        if (el.id) {
            selector = `#${CSS.escape(el.id)}`;
        } else if (el.name) {
            selector = `${el.tagName.toLowerCase()}[name="${CSS.escape(el.name)}"]`;
        } else {
            const tempId = `fill-it-scanned-${index}`;
            el.setAttribute('data-fill-it-id', tempId);
            selector = `[data-fill-it-id="${tempId}"]`;
        }

        // Resolve label text with multiple fallback strategies
        let labelText = '';
        if (el.id) {
            const linked = document.querySelector<HTMLElement>(`label[for="${CSS.escape(el.id)}"]`);
            if (linked) labelText = linked.textContent?.trim() || '';
        }
        if (!labelText) {
            const wrapped = el.closest('label');
            if (wrapped) labelText = wrapped.textContent?.trim() || '';
        }
        if (!labelText) {
            const container = el.closest('.field, .form-group, .form-row, td, div');
            if (container) {
                const lbl = container.querySelector('label');
                if (lbl) labelText = lbl.textContent?.trim() || '';
            }
        }
        if (!labelText) labelText = el.getAttribute('placeholder')?.trim() || '';
        if (!labelText) labelText = el.name || el.id || `Field ${index + 1}`;

        labelText = labelText.replace(/[:*]/g, '').trim();
        if (labelText.length > 40) labelText = labelText.slice(0, 37) + '...';

        fields.push({
            selector,
            label: labelText,
            type: el instanceof HTMLInputElement ? el.type : el.tagName.toLowerCase(),
            placeholder: el.getAttribute('placeholder') || '',
            name: el.name || '',
            id: el.id || '',
        });
    });

    return fields;
}

// ─── Shared internal DOM setter ───────────────────────────────────────────────
// Extracted as a type alias for reuse inside the page-context functions below.
// NOTE: This is NOT exported — it's embedded inline within each injected function
// because each injected function must be fully self-contained.

// ─── injectCustomFieldsData ──────────────────────────────────────────────────
// Injects a pre-resolved list of { selector, value } pairs into the page.
// Used by the Form Scanner tab (step 3: inject edited values).
// Returns a Promise so chrome.scripting.executeScript awaits completion.
export async function injectCustomFieldsData(fields: FieldOverride[]): Promise<void> {
    const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
    const filled = new Set<HTMLElement>();

    const setVal = async (el: HTMLElement, value: string): Promise<void> => {
        if (!value) return;
        filled.add(el);

        // PrimeNG / custom overlay dropdown
        const pDrop = el.closest('p-dropdown, .p-dropdown');
        if (pDrop) {
            const trigger = pDrop.querySelector<HTMLElement>('.p-dropdown-trigger') || (pDrop as HTMLElement);
            trigger.click();
            await delay(150);
            const items = Array.from(document.querySelectorAll<HTMLElement>(
                '.p-dropdown-panel .p-dropdown-item, .p-dropdown-items .p-dropdown-item, li[role="option"]'
            ));
            let match = items.find(i => i.textContent?.trim().toLowerCase() === value.toLowerCase())
                || items.find(i => i.textContent?.trim().toLowerCase().includes(value.toLowerCase()));
            if (!match) {
                const valid = items.filter(i => {
                    const t = i.textContent?.trim().toLowerCase() || '';
                    return t && !t.includes('pilih') && !t.includes('choose') && !t.includes('--');
                });
                match = valid[Math.floor(Math.random() * valid.length)];
            }
            if (match) match.click();
            await delay(100);
            return;
        }

        // Native <select>
        if (el instanceof HTMLSelectElement) {
            const opt = Array.from(el.options).find(o =>
                o.value.toLowerCase() === value.toLowerCase() ||
                o.text.toLowerCase() === value.toLowerCase()
            );
            if (opt) opt.selected = true;
            else {
                const valid = Array.from(el.options).filter((o, i) => i > 0 && !!o.value);
                if (valid.length) valid[Math.floor(Math.random() * valid.length)].selected = true;
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }

        // Checkbox
        if (el instanceof HTMLInputElement && el.type === 'checkbox') {
            const boolVal = value === 'true' || value === '1';
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
            if (setter) setter.call(el, boolVal); else el.checked = boolVal;
            el.dispatchEvent(new Event('click', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }

        // Text / number / tel / email / textarea / password
        const proto = Object.getPrototypeOf(el);
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
            || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(proto), 'value')?.set;
        if (setter) setter.call(el, value);
        else (el as HTMLInputElement | HTMLTextAreaElement).value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // Inject each pre-resolved field
    for (const f of fields) {
        try {
            const el = document.querySelector<HTMLElement>(f.selector);
            if (el) {
                el.focus();
                await setVal(el, f.value);
            }
        } catch (e) {
            console.error('[Fill-It] Failed to inject selector:', f.selector, e);
        }
    }

    // Fallback: agreement checkboxes
    document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(cb => {
        if (cb.checked) return;
        const txt = (cb.closest('label')?.textContent || cb.parentElement?.textContent || '').toLowerCase();
        if (txt.includes('setuju') || txt.includes('agree') || txt.includes('syarat') || txt.includes('terms') || txt.includes('kebijakan') || txt.includes('privacy')) {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
            if (setter) setter.call(cb, true); else cb.checked = true;
            cb.dispatchEvent(new Event('click', { bubbles: true }));
            cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });

    // Fallback: empty radio groups
    const radios = document.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    const radioGroups: Record<string, HTMLInputElement[]> = {};
    radios.forEach(r => { const n = r.name || '_unnamed'; if (!radioGroups[n]) radioGroups[n] = []; radioGroups[n].push(r); });
    Object.values(radioGroups).forEach(g => {
        if (!g.some(r => r.checked)) {
            const r = g[Math.floor(Math.random() * g.length)];
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
            if (setter) setter.call(r, true); else r.checked = true;
            r.dispatchEvent(new Event('click', { bubbles: true }));
            r.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });

    // Fallback: empty native selects
    for (const sel of Array.from(document.querySelectorAll<HTMLSelectElement>('select'))) {
        if (filled.has(sel)) continue;
        const opts = Array.from(sel.options).filter((o, i) =>
            i > 0 && !!o.value &&
            !o.text.toLowerCase().includes('pilih') &&
            !o.text.toLowerCase().includes('select') &&
            !o.text.includes('--')
        );
        if (opts.length > 0) {
            const picked = opts[Math.floor(Math.random() * opts.length)];
            sel.value = picked.value;
            sel.dispatchEvent(new Event('input', { bubbles: true }));
            sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
}

// ─── injectAndFill ────────────────────────────────────────────────────────────
// THE unified one-shot injector for the Identity Profile tab.
// Scans the page, guesses values from the identity snapshot, merges template
// overrides, then injects everything in a single browser-context execution.
// Returns a Promise so chrome.scripting.executeScript awaits full completion.
export async function injectAndFill(
    identity: IdentitySnapshot,
    overrides: FieldOverride[],
    autoSubmit: boolean
): Promise<void> {
    const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
    const filled = new Set<HTMLElement>();

    // --- Internal DOM setter (same logic as injectCustomFieldsData) ---
    const setVal = async (el: HTMLElement, value: string): Promise<void> => {
        if (!value) return;
        filled.add(el);

        const pDrop = el.closest('p-dropdown, .p-dropdown');
        if (pDrop) {
            const trigger = pDrop.querySelector<HTMLElement>('.p-dropdown-trigger') || (pDrop as HTMLElement);
            trigger.click();
            await delay(150);
            const items = Array.from(document.querySelectorAll<HTMLElement>(
                '.p-dropdown-panel .p-dropdown-item, .p-dropdown-items .p-dropdown-item, li[role="option"]'
            ));
            let match = items.find(i => i.textContent?.trim().toLowerCase() === value.toLowerCase())
                || items.find(i => i.textContent?.trim().toLowerCase().includes(value.toLowerCase()));
            if (!match) {
                const valid = items.filter(i => {
                    const t = i.textContent?.trim().toLowerCase() || '';
                    return t && !t.includes('pilih') && !t.includes('choose') && !t.includes('--');
                });
                match = valid[Math.floor(Math.random() * valid.length)];
            }
            if (match) match.click();
            await delay(100);
            return;
        }

        if (el instanceof HTMLSelectElement) {
            const opt = Array.from(el.options).find(o =>
                o.value.toLowerCase() === value.toLowerCase() ||
                o.text.toLowerCase() === value.toLowerCase()
            );
            if (opt) opt.selected = true;
            else {
                const valid = Array.from(el.options).filter((o, i) => i > 0 && !!o.value);
                if (valid.length) valid[Math.floor(Math.random() * valid.length)].selected = true;
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }

        if (el instanceof HTMLInputElement && el.type === 'checkbox') {
            const boolVal = value === 'true' || value === '1';
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
            if (setter) setter.call(el, boolVal); else el.checked = boolVal;
            el.dispatchEvent(new Event('click', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }

        const proto = Object.getPrototypeOf(el);
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
            || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(proto), 'value')?.set;
        if (setter) setter.call(el, value);
        else (el as HTMLInputElement | HTMLTextAreaElement).value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // --- Field value guesser (canonical, single-source-of-truth) ---
    const guess = (label: string, type: string, placeholder: string, name: string, id: string): string => {
        const c = `${label} ${name} ${id} ${placeholder}`.toLowerCase();
        const p = placeholder.toLowerCase();
        const locale = identity.locale;

        if (c.includes('email')) return identity.email;
        if (c.includes('phone') || c.includes('telepon') || c.includes('hp') || c.includes('telp') || type === 'tel') return identity.phone;
        if (c.includes('fullname') || c.includes('nama lengkap') || (c.includes('name') && !c.includes('first') && !c.includes('last') && !c.includes('bank') && !c.includes('company') && !c.includes('user') && !c.includes('teknik'))) return identity.fullName;
        if (c.includes('firstname') || c.includes('nama depan')) return identity.firstName;
        if (c.includes('lastname') || c.includes('nama belakang')) return identity.lastName;
        if ((c.includes('nik') || c.includes('ktp') || c.includes('induk kependudukan')) && !c.includes('teknik')) return identity.nik;
        if (c.includes('npwp')) return identity.npwp;
        if (c.includes('rekening') || c.includes('norek') || (c.includes('account') && !c.includes('bank') && !c.includes('email'))) return identity.bankAccount;
        if (c.includes('bankname') || c.includes('nama bank') || (c.includes('bank') && !c.includes('account') && !c.includes('rekening') && !c.includes('account'))) return identity.bankName;
        if (c.includes('address') || c.includes('alamat') || c.includes('jalan')) return identity.address;
        if (c.includes('password') || c.includes('sandi') || type === 'password') return identity.password || 'P@ssw0rd123!';
        if (c.includes('company') || c.includes('perusahaan') || c.includes('kantor')) return identity.company;
        if (c.includes('job') || c.includes('pekerjaan') || c.includes('jabatan') || c.includes('occupation')) return identity.jobTitle;
        if (c.includes('website') || type === 'url') return identity.website;
        if (c.includes('bio') || c.includes('tentang') || c.includes('deskripsi') || c.includes('about')) return identity.bio;
        if (c.includes('age') || c.includes('umur') || c.includes('usia')) return String(Math.floor(Math.random() * 43) + 18);
        if (c.includes('salary') || c.includes('gaji') || c.includes('income')) return String((Math.floor(Math.random() * 17) + 4) * 500000);
        if (c.includes('birthplace') || c.includes('tempat lahir') || c.includes('tempat_lahir')) {
            const cities = ['Jakarta', 'Bandung', 'Surabaya', 'Semarang', 'Medan', 'Makassar', 'Yogyakarta', 'Malang', 'Palembang', 'Tangerang'];
            return locale === 'id_ID' ? cities[Math.floor(Math.random() * cities.length)] : 'New York';
        }
        if (c.includes('birthdate') || c.includes('tanggal lahir') || c.includes('date of birth') || c.includes('bday') || c.includes('dd-mm-yyyy')) {
            let bd = identity.birthDate || '1990-01-01';
            if (p.includes('dd-mm-yyyy') || p.includes('dd/mm/yyyy')) {
                const pts = bd.split('-');
                if (pts.length === 3) bd = `${pts[2]}-${pts[1]}-${pts[0]}`;
            }
            return bd;
        }
        if (c.includes('agama') || c.includes('religion')) {
            const rel = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Khonghucu'];
            return rel[Math.floor(Math.random() * rel.length)];
        }
        if (c.includes('gender') || c.includes('jenis kelamin') || c.includes('sex') || c.includes('kelamin')) {
            return Math.random() > 0.5 ? 'Laki-laki' : 'Perempuan';
        }
        if (c.includes('marriage') || c.includes('pernikahan') || c.includes('marital') || c.includes('kawin') || c.includes('status perkawinan')) {
            const st = ['Belum Kawin', 'Kawin', 'Cerai Hidup', 'Cerai Mati'];
            return st[Math.floor(Math.random() * st.length)];
        }
        if (c.includes('ibu kandung') || c.includes('ibu') || c.includes('mother')) {
            const fn = ['Siti', 'Dewi', 'Sri', 'Mega', 'Putri', 'Indah', 'Lestari', 'Kartika', 'Rini', 'Wati'];
            const ln = ['Suryani', 'Puspitasari', 'Utami', 'Lestari', 'Wulandari', 'Hidayah', 'Rahayu', 'Wijaya'];
            return `${fn[Math.floor(Math.random() * fn.length)]} ${ln[Math.floor(Math.random() * ln.length)]}`;
        }
        if (c.includes('familycard') || c.includes('kartu keluarga') || c.includes('familycardnumber') || (c.includes('kk') && (c.includes('nomor') || c.includes('no ')))) {
            let kk = '999999';
            for (let i = 0; i < 10; i++) kk += Math.floor(Math.random() * 10);
            return kk;
        }
        if (c.includes('familystatus') || c.includes('hubungan keluarga') || c.includes('family member') || c.includes('familystatus')) {
            const fs = ['Kepala Keluarga', 'Suami', 'Istri', 'Anak', 'Mertua', 'Orang Tua'];
            return fs[Math.floor(Math.random() * fs.length)];
        }
        if (c.includes('taxpayertype') || c.includes('jenis wajib pajak') || c.includes('taxpayer type')) return 'Orang Pribadi atau Warisan Belum Terbagi';
        if (c.includes('countryoforigin') || c.includes('negara asal') || c.includes('country of origin')) return 'Indonesia';
        if (c.includes('worktype') || c.includes('jenis pekerjaan') || c.includes('work type')) {
            const jobs = ['Karyawan Swasta', 'PNS', 'Wiraswasta', 'Profesional', 'Lainnya'];
            return jobs[Math.floor(Math.random() * jobs.length)];
        }
        if (type === 'textarea') return 'Form testing data.';
        return '';
    };

    // --- Main execution ---
    const run = async () => {
        // Step 1: Inject template overrides first (they take priority)
        for (const ov of overrides) {
            if (!ov.value) continue;
            try {
                const el = document.querySelector<HTMLElement>(ov.selector);
                if (el) {
                    el.focus();
                    await setVal(el, ov.value);
                    await delay(20);
                }
            } catch (e) {
                console.error('[Fill-It] Override injection failed:', ov.selector, e);
            }
        }

        // Step 2: Scan and fill all remaining inputs
        const inputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
            'input:not([type="submit"]):not([type="button"]):not([type="hidden"]):not([type="image"]):not([type="file"]), textarea, select'
        );

        for (const el of Array.from(inputs)) {
            if (filled.has(el)) continue;

            // Resolve label text
            let labelText = '';
            if (el.id) {
                const lbl = document.querySelector<HTMLElement>(`label[for="${CSS.escape(el.id)}"]`);
                if (lbl) labelText = lbl.textContent?.trim() || '';
            }
            if (!labelText) {
                const pLbl = el.closest('label');
                if (pLbl) labelText = pLbl.textContent?.trim() || '';
            }
            if (!labelText) {
                const cont = el.closest('.field, .form-group, .form-row, td, div');
                if (cont) {
                    const lbl = cont.querySelector('label');
                    if (lbl) labelText = lbl.textContent?.trim() || '';
                }
            }
            if (!labelText) labelText = el.getAttribute('placeholder')?.trim() || '';
            if (!labelText) labelText = el.name || el.id || '';
            labelText = labelText.replace(/[:*]/g, '').trim();

            const type = el instanceof HTMLInputElement ? el.type : el.tagName.toLowerCase();
            const val = guess(labelText, type, el.getAttribute('placeholder') || '', el.name || '', el.id || '');

            if (val) {
                el.focus();
                await setVal(el, val);
                await delay(30);
            }
        }

        // Step 3: Fill unchecked agreement checkboxes
        document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(cb => {
            if (cb.checked) return;
            const txt = (cb.closest('label')?.textContent || cb.parentElement?.textContent || '').toLowerCase();
            if (txt.includes('setuju') || txt.includes('agree') || txt.includes('syarat') || txt.includes('terms') || txt.includes('kebijakan') || txt.includes('privacy')) {
                const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
                if (setter) setter.call(cb, true); else cb.checked = true;
                cb.dispatchEvent(new Event('click', { bubbles: true }));
                cb.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        // Step 4: Fill empty radio groups (random selection)
        const radios = document.querySelectorAll<HTMLInputElement>('input[type="radio"]');
        const groups: Record<string, HTMLInputElement[]> = {};
        radios.forEach(r => { const n = r.name || '_unnamed'; if (!groups[n]) groups[n] = []; groups[n].push(r); });
        Object.values(groups).forEach(g => {
            if (!g.some(r => r.checked)) {
                const r = g[Math.floor(Math.random() * g.length)];
                const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
                if (setter) setter.call(r, true); else r.checked = true;
                r.dispatchEvent(new Event('click', { bubbles: true }));
                r.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        // Step 5: Fill empty native selects
        for (const sel of Array.from(document.querySelectorAll<HTMLSelectElement>('select'))) {
            if (filled.has(sel)) continue;
            const opts = Array.from(sel.options).filter((o, i) =>
                i > 0 && !!o.value &&
                !o.text.toLowerCase().includes('pilih') &&
                !o.text.toLowerCase().includes('select') &&
                !o.text.includes('--')
            );
            if (opts.length > 0) {
                const picked = opts[Math.floor(Math.random() * opts.length)];
                sel.value = picked.value;
                sel.dispatchEvent(new Event('input', { bubbles: true }));
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        // Step 6: Auto-submit (if enabled)
        if (autoSubmit) {
            await delay(300);
            const form = document.querySelector<HTMLFormElement>('form');
            if (form) {
                const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')
                    || form.querySelector<HTMLInputElement>('input[type="submit"]');
                if (submitBtn) submitBtn.click();
                else form.submit();
            }
        }
    };

    // Return the promise so Chrome's scripting API awaits full completion
    return run();
}

// ─── injectLoginFields ────────────────────────────────────────────────────────
// Directly injects email and password fields for login pages.
export async function injectLoginFields(email: string, password: string): Promise<void> {
    const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

    const setVal = (el: HTMLElement, value: string) => {
        const proto = Object.getPrototypeOf(el);
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
            || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(proto), 'value')?.set;
        if (setter) setter.call(el, value);
        else (el as HTMLInputElement).value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const emailSelectors = [
        'input[type="email"]',
        'input[name*="email" i]',
        'input[id*="email" i]',
        'input[placeholder*="email" i]',
        'input[name*="username" i]',
        'input[name*="user" i]',
    ];

    for (const sel of emailSelectors) {
        const el = document.querySelector<HTMLInputElement>(sel);
        if (el) { setVal(el, email); break; }
    }

    await delay(60);

    const pwdEl = document.querySelector<HTMLInputElement>('input[type="password"]');
    if (pwdEl) setVal(pwdEl, password);
}
