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
    value?: string;
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
    nomorKK: string;    // Nomor Kartu Keluarga (16 digit, Privacy-Safe Dummy)
    npwp: string;       // NPWP-15 terformat, e.g. "99.999.999.9-054.000"
    birthDate: string;
    password: string;
    company: string;
    jobTitle: string;
    website: string;
    bio: string;
    locale: string;
    city: string;
    province: string;
    zipCode: string;
    kecamatan: string;
    kelurahan: string;
}

export type FieldOverride = { selector: string; value: string };

// ─── scanPageForm ─────────────────────────────────────────────────────────────
// Scans all visible form fields on the current page and returns their metadata and current DOM values.
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
            if (linked) labelText = linked.textContent?.trim() || linked.getAttribute('arialabel') || '';
        }
        if (!labelText) {
            const wrapped = el.closest('label');
            if (wrapped) labelText = wrapped.textContent?.trim() || wrapped.getAttribute('arialabel') || '';
        }
        if (!labelText) {
            let container = el.closest('reg-form-item, ui-input-date-2, p-calendar, p-dropdown, .field, .form-group, .form-row, tr, td, fieldset');
            if (!container) {
                let par: HTMLElement | null = el.parentElement;
                for (let i = 0; i < 6 && par; i++) {
                    if (par.querySelector('label, .label, [arialabel]')) {
                        container = par;
                        break;
                    }
                    par = par.parentElement;
                }
            }
            if (container) {
                const lbl = container.querySelector('label, .label, [arialabel]');
                if (lbl) labelText = (lbl.getAttribute('arialabel') || lbl.textContent || '').replace(/\s+/g, ' ').trim();
            }
        }
        if (!labelText) labelText = (el.getAttribute('arialabel') || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim();
        if (!labelText) labelText = el.name || el.id || `Field ${index + 1}`;

        labelText = labelText.replace(/[:*]/g, '').trim();
        if (labelText.length > 45) labelText = labelText.slice(0, 42) + '...';

        let currentValue = '';
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
            currentValue = el.value || '';
        }

        fields.push({
            selector,
            label: labelText,
            type: el instanceof HTMLInputElement ? el.type : el.tagName.toLowerCase(),
            placeholder: el.getAttribute('placeholder') || '',
            name: el.name || '',
            id: el.id || '',
            value: currentValue,
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

        const isInput = el instanceof HTMLInputElement;
        if (isInput) (el as HTMLInputElement).readOnly = false;

        // PrimeNG / Custom Datepicker wrapper (Coretax ui-input-date-2, p-calendar)
        const pCal = el.closest('p-calendar, ui-input-date-2, .p-calendar');
        if (pCal) {
            const uiDate2 = el.closest('ui-input-date-2') || (pCal.tagName.toLowerCase() === 'ui-input-date-2' ? pCal : pCal.closest('ui-input-date-2'));
            const inputs = Array.from(pCal.querySelectorAll<HTMLInputElement>('input'));
            if (el instanceof HTMLInputElement && !inputs.includes(el)) {
                inputs.push(el);
            }

            const hostElements = [uiDate2, pCal, el].filter(Boolean) as HTMLElement[];

            for (const targetInput of inputs) {
                filled.add(targetInput);
                targetInput.removeAttribute('readonly');
                targetInput.readOnly = false;
                targetInput.disabled = false;
                targetInput.focus();

                // 1. Angular Component Instance Direct Injection (ui-input-date-2 and p-calendar)
                for (const hostEl of hostElements) {
                    try {
                        const win = window as unknown as { ng?: { getComponent?: (e: HTMLElement) => Record<string, unknown> } };
                        const hostObj = hostEl as unknown as Record<string, unknown>;
                        const comp = win.ng?.getComponent?.(hostEl) || (hostObj.__ngComponent__ as Record<string, unknown> | undefined);
                        if (comp) {
                            const parts = value.split(/[/.-]/);
                            let y = 1990, m = 0, d = 15;
                            if (parts.length === 3) {
                                if (parts[0].length === 4) { y = parseInt(parts[0]); m = parseInt(parts[1]) - 1; d = parseInt(parts[2]); }
                                else { d = parseInt(parts[0]); m = parseInt(parts[1]) - 1; y = parseInt(parts[2]); }
                            }
                            const dt = new Date(y, Math.max(0, Math.min(11, m)), Math.max(1, Math.min(31, d)));
                            if ('value' in comp) comp.value = dt;
                            if ('date' in comp) comp.date = dt;
                            if (typeof comp.writeValue === 'function') {
                                (comp.writeValue as (v: unknown) => void)(dt);
                                (comp.writeValue as (v: unknown) => void)(value);
                            }
                            if (typeof comp.updateInputfield === 'function') (comp.updateInputfield as () => void)();
                            if (typeof comp.onModelChange === 'function') (comp.onModelChange as (v: unknown) => void)(dt);
                            if (typeof comp.onSelect === 'function') (comp.onSelect as (v: unknown) => void)(dt);
                        }
                    } catch {
                        // Fallback
                    }
                }

                // 2. Native Value Property Setter
                const proto = Object.getPrototypeOf(targetInput);
                const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
                    || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(proto), 'value')?.set;
                if (setter) setter.call(targetInput, value);
                else targetInput.value = value;

                // 3. Dispatch Full Event Sequence to targetInput and parent custom host elements
                for (const hostEl of hostElements) {
                    hostEl.dispatchEvent(new Event('focus', { bubbles: true }));
                    hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
                    hostEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                    hostEl.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: value }));
                    hostEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                    hostEl.dispatchEvent(new CustomEvent('ngModelChange', { bubbles: true, detail: value }));
                    hostEl.dispatchEvent(new CustomEvent('onSelect', { bubbles: true, detail: value }));
                }

                // 4. Character-by-character typing fallback if input was cleared by mask
                if (!targetInput.value) {
                    targetInput.value = '';
                    for (const char of value) {
                        targetInput.value += char;
                        targetInput.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: char }));
                    }
                    targetInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                }

                targetInput.dispatchEvent(new Event('blur', { bubbles: true }));
            }

            // Close any open PrimeNG overlay panel cleanly if present
            const overlay = document.querySelector<HTMLElement>('div.p-datepicker, .p-datepicker-panel, .p-calendar-panel');
            if (overlay) {
                document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
            }
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
        el.dispatchEvent(new Event('blur', { bubbles: true }));
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
                '.p-dropdown-panel .p-dropdown-item, .p-dropdown-items .p-dropdown-item, li[role="option"], .p-element[role="option"]'
            ));
            let match = items.find(i => i.textContent?.trim().toLowerCase() === value.toLowerCase())
                || items.find(i => i.textContent?.trim().toLowerCase().includes(value.toLowerCase()));
            if (!match) {
                const valid = items.filter(i => {
                    const t = i.textContent?.trim().toLowerCase() || '';
                    return t && !t.includes('pilih') && !t.includes('choose') && !t.includes('select') && !t.includes('--');
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

        const isInput = el instanceof HTMLInputElement;
        if (isInput) (el as HTMLInputElement).readOnly = false;

        // PrimeNG / Custom Datepicker wrapper (Coretax ui-input-date-2, p-calendar)
        const pCal = el.closest('p-calendar, ui-input-date-2, .p-calendar');
        if (pCal) {
            const uiDate2 = el.closest('ui-input-date-2') || (pCal.tagName.toLowerCase() === 'ui-input-date-2' ? pCal : pCal.closest('ui-input-date-2'));
            const inputs = Array.from(pCal.querySelectorAll<HTMLInputElement>('input'));
            if (el instanceof HTMLInputElement && !inputs.includes(el)) {
                inputs.push(el);
            }

            const hostElements = [uiDate2, pCal, el].filter(Boolean) as HTMLElement[];

            for (const targetInput of inputs) {
                filled.add(targetInput);
                targetInput.removeAttribute('readonly');
                targetInput.readOnly = false;
                targetInput.disabled = false;
                targetInput.focus();

                // 1. Angular Component Instance Direct Injection (ui-input-date-2 and p-calendar)
                for (const hostEl of hostElements) {
                    try {
                        const win = window as unknown as { ng?: { getComponent?: (e: HTMLElement) => Record<string, unknown> } };
                        const hostObj = hostEl as unknown as Record<string, unknown>;
                        const comp = win.ng?.getComponent?.(hostEl) || (hostObj.__ngComponent__ as Record<string, unknown> | undefined);
                        if (comp) {
                            const parts = value.split(/[/.-]/);
                            let y = 1990, m = 0, d = 15;
                            if (parts.length === 3) {
                                if (parts[0].length === 4) { y = parseInt(parts[0]); m = parseInt(parts[1]) - 1; d = parseInt(parts[2]); }
                                else { d = parseInt(parts[0]); m = parseInt(parts[1]) - 1; y = parseInt(parts[2]); }
                            }
                            const dt = new Date(y, Math.max(0, Math.min(11, m)), Math.max(1, Math.min(31, d)));
                            if ('value' in comp) comp.value = dt;
                            if ('date' in comp) comp.date = dt;
                            if (typeof comp.writeValue === 'function') {
                                (comp.writeValue as (v: unknown) => void)(dt);
                                (comp.writeValue as (v: unknown) => void)(value);
                            }
                            if (typeof comp.updateInputfield === 'function') (comp.updateInputfield as () => void)();
                            if (typeof comp.onModelChange === 'function') (comp.onModelChange as (v: unknown) => void)(dt);
                            if (typeof comp.onSelect === 'function') (comp.onSelect as (v: unknown) => void)(dt);
                        }
                    } catch {
                        // Fallback
                    }
                }

                // 2. Native Value Property Setter
                const proto = Object.getPrototypeOf(targetInput);
                const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
                    || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(proto), 'value')?.set;
                if (setter) setter.call(targetInput, value);
                else targetInput.value = value;

                // 3. Dispatch Full Event Sequence to targetInput and parent custom host elements
                for (const hostEl of hostElements) {
                    hostEl.dispatchEvent(new Event('focus', { bubbles: true }));
                    hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
                    hostEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                    hostEl.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: value }));
                    hostEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                    hostEl.dispatchEvent(new CustomEvent('ngModelChange', { bubbles: true, detail: value }));
                    hostEl.dispatchEvent(new CustomEvent('onSelect', { bubbles: true, detail: value }));
                }

                // 4. Character-by-character typing fallback if input was cleared by mask
                if (!targetInput.value) {
                    targetInput.value = '';
                    for (const char of value) {
                        targetInput.value += char;
                        targetInput.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: char }));
                    }
                    targetInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                }

                targetInput.dispatchEvent(new Event('blur', { bubbles: true }));
            }

            // Close any open PrimeNG overlay panel cleanly if present
            const overlay = document.querySelector<HTMLElement>('div.p-datepicker, .p-datepicker-panel, .p-calendar-panel');
            if (overlay) {
                document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
            }
            return;
        }

        const proto = Object.getPrototypeOf(el);
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
            || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(proto), 'value')?.set;
        if (setter) setter.call(el, value);
        else (el as HTMLInputElement | HTMLTextAreaElement).value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
    };

    // --- Field value guesser (canonical, single-source-of-truth) ---
    const guess = (
        haystack: string, type: string, placeholder: string,
        _name: string, _id: string, el: HTMLElement,
        insideCalendar = false
    ): string => {
        const h = haystack.replace(/\s+/g, ' ').trim();
        const p = placeholder.toLowerCase();
        const locale = identity.locale;

        if (/\b(email|e-mail|mail)\b/i.test(h)) return identity.email;
        if (/\b(phone|telepon|telp|handphone|hp|nohp|no_hp|mobile)\b/i.test(h) || type === 'tel') return identity.phone;
        if (/\b(fullname|nama_lengkap|namalengkap|nama_wajib_pajak|namawajibpajak|taxpayername|taxpayer_name)\b/i.test(h) || (/\b(name|nama)\b/i.test(h) && !/\b(first|last|bank|company|user|teknik|mother|ibu|gadis)\b/i.test(h))) return identity.fullName;
        if (/\b(firstname|nama_depan|namadepan)\b/i.test(h)) return identity.firstName;
        if (/\b(lastname|nama_belakang|namabelakang)\b/i.test(h)) return identity.lastName;

        // ── Nama Ibu Kandung ──────────────────────────────────────────────
        if (/\b(mother|mothersname|mother_name|ibu_kandung|ibukandung|nama_ibu|nama\s*ibu|nama_ibu_kandung|nama\s*ibu\s*kandung|gadis_ibu_kandung)\b/i.test(h) || /\b(ibu)\b/i.test(h)) {
            const fn = ['Siti', 'Dewi', 'Sri', 'Mega', 'Putri', 'Indah', 'Lestari', 'Kartika', 'Rini', 'Wati'];
            const ln = ['Suryani', 'Puspitasari', 'Utami', 'Lestari', 'Wulandari', 'Hidayah', 'Rahayu', 'Wijaya'];
            return `${fn[Math.floor(Math.random() * fn.length)]} ${ln[Math.floor(Math.random() * ln.length)]}`;
        }

        // ── NPWP (diutamakan sebelum NIK agar tidak tumpang tindih) ──────────
        if (/\b(npwp|no_npwp|no\.?\s*npwp|nomor_npwp|nomor\s*npwp|tax_id|tax_number|tin|pajak)\b/i.test(h)) {
            const maxLen = (el as HTMLInputElement).maxLength;
            const isFormatted15 = maxLen === 15 || maxLen === 20 || p.includes('.') || p.includes('-');
            if (isFormatted15) {
                if (identity.npwp && (identity.npwp.includes('.') || identity.npwp.length === 15)) {
                    return identity.npwp;
                }
                return '99.999.999.9-054.000';
            }
            if (identity.npwp) {
                return identity.npwp;
            }
            const nikRegionCode = (identity.nik && identity.nik.length >= 6)
                ? identity.nik.slice(0, 6)
                : '310101';
            return `${nikRegionCode}7777777777`;
        }

        // ── Nomor KK ─────────────────────────────────────────────────────────
        if (/\b(kk|no_kk|nokk|no\.?\s*kk|nomor_kk|nomor\s*kk|kartu_keluarga|kartu\s*keluarga|no_kartu_keluarga|no\.?\s*kartu\s*keluarga|nomor_kartu_keluarga|nomor\s*kartu\s*keluarga|family_card|family_card_number|familycardnumber)\b/i.test(h)) {
            return identity.nomorKK || (() => {
                const _pKK = ['11','12','13','14','15','16','17','18','19','21','31','32','33','34','35','36','51','52','53','61','62','63','64','65','71','72','73','74','75','76','81','82','91','92','93','94','95','96'];
                return `${_pKK[Math.floor(Math.random() * _pKK.length)]}01018888888888`;
            })();
        }

        // ── NIK ───────────────────────────────────────────────────────────────
        if (/\b(nik|no_nik|no\.?\s*nik|nomor_nik|nomor\s*nik|no_ktp|no\.?\s*ktp|nomor_ktp|nomor\s*ktp|noktp|no_identitas|no\.?\s*identitas|nomor_identitas|nomor\s*identitas|national_id|kepala_unit_pajak_keluarga|kepala_keluarga|kepala\s*unit)\b/i.test(h)) {
            return identity.nik;
        }

        // ── Tempat Lahir ──────────────────────────────────────────────────
        if (/\b(birthplace|birth_place|place_of_birth|placeofbirth|tempat_lahir|tempat\s*lahir|tempatlahir|tplahir|tpt_lahir)\b/i.test(h)) {
            const cities = ['Kota Jakarta Utara', 'Kota Bandung', 'Kota Surabaya', 'Kota Semarang', 'Kota Medan', 'Kota Makassar', 'Kota Yogyakarta', 'Kota Malang', 'Kota Tangerang Selatan'];
            return locale === 'id_ID' ? cities[Math.floor(Math.random() * cities.length)] : 'New York';
        }

        // ── Tanggal Lahir ─────────────────────────────────────────────────
        const isDateField = insideCalendar
            || /\b(birthdate|birth\s*date|date\s*of\s*birth|date_of_birth|dateofbirth|tanggal_lahir|tanggal\s*lahir|tanggallahir|tgl_lahir|tgl\s*lahir|tgllahir|bday|dob)\b/i.test(h)
            || p.includes('dd-mm-yyyy') || p.includes('dd/mm/yyyy') || p.includes('yyyy-mm-dd')
            || h.toLowerCase().includes('tanggal lahir') || h.toLowerCase().includes('date of birth') || h.toLowerCase().includes('tgl lahir');
        if (isDateField) {
            const bd = identity.birthDate || '1990-01-15';
            const pts = bd.split('-');
            if (type === 'date' || (el instanceof HTMLInputElement && el.type === 'date')) {
                return bd;
            }
            if (pts.length === 3) {
                if (p.includes('dd-mm-yyyy') || p.includes('dd-mm') || h.includes('dd-mm')) {
                    return `${pts[2]}-${pts[1]}-${pts[0]}`;
                }
                if (p.includes('yyyy-mm-dd') || p.includes('yyyy/mm/dd')) {
                    return bd;
                }
                return `${pts[2]}/${pts[1]}/${pts[0]}`;
            }
            return bd;
        }

        // ── Status Perkawinan ─────────────────────────────────────────────
        if (/\b(marriage|marital|pernikahan|kawin|status_perkawinan|status\s*perkawinan|statusperkawinan|status_kawin|marriagestatus)\b/i.test(h)) {
            const st = ['Belum Kawin', 'Kawin', 'Cerai Hidup', 'Cerai Mati'];
            return st[Math.floor(Math.random() * st.length)];
        }

        // ── Status Hubungan Keluarga ──────────────────────────────────────
        if (/\b(familystatus|family_status|family_member|family_member_status|familymemberstatus|hubungan_keluarga|hubungan\s*keluarga|status_hubungan_keluarga|status\s*hubungan\s*keluarga)\b/i.test(h)) {
            const fs = ['Kepala Keluarga', 'Suami', 'Istri', 'Anak', 'Mertua', 'Orang Tua'];
            return fs[Math.floor(Math.random() * fs.length)];
        }

        // ── Jenis Pekerjaan ───────────────────────────────────────────────
        if (/\b(worktype|work_type|jenis_pekerjaan|jenis\s*pekerjaan|jenispekerjaan|job|pekerjaan|jabatan|occupation)\b/i.test(h)) {
            const jobs = ['Karyawan Swasta', 'PNS', 'Wiraswasta', 'Profesional', 'Industri', 'Lainnya'];
            return jobs[Math.floor(Math.random() * jobs.length)];
        }

        // ── Jenis Wajib Pajak ─────────────────────────────────────────────
        if (/\b(taxpayertype|taxpayer_type|jenis_wajib_pajak|jenis\s*wajib\s*pajak|jeniswajibpajak)\b/i.test(h)) return 'Orang Pribadi atau Warisan Belum Terbagi';

        // ── Negara Asal ───────────────────────────────────────────────────
        if (/\b(countryoforigin|country_of_origin|negara_asal|negara\s*asal|negaraasal|country)\b/i.test(h)) return 'Indonesia';

        // ── Kategori Individu ─────────────────────────────────────────────
        if (/\b(individualcategory|individual_category|kategori_individu|kategori\s*individu|kategoriindividu)\b/i.test(h)) return 'Orang Pribadi';

        if (/\b(rekening|norek|no_rek|accountnumber)\b/i.test(h) || (/\baccount\b/i.test(h) && !/\b(bank|email)\b/i.test(h))) return identity.bankAccount;
        if (/\b(bankname|nama_bank|namabank)\b/i.test(h) || (/\bbank\b/i.test(h) && !/\b(account|rekening)\b/i.test(h))) return identity.bankName;
        if (/\b(address|alamat|jalan)\b/i.test(h)) return identity.address;
        if (/\b(city|kota|kabupaten)\b/i.test(h)) return identity.city;
        if (/\b(province|provinsi|state)\b/i.test(h)) return identity.province;
        if (/\b(postal|zip|zipcode|zip_code|kodepos|kode_pos|kode\s*pos|postcode|post_code|post\s*code)\b/i.test(h)) return identity.zipCode;
        if (/\bkecamatan\b|\bdistrict\b/i.test(h)) return identity.kecamatan;
        if (/\bkelurahan\b|\bsubdistrict\b|\bdesa\b/i.test(h)) return identity.kelurahan;
        if (/\b(password|sandi)\b/i.test(h) || type === 'password') return identity.password || 'P@ssw0rd123!';
        if (/\b(company|perusahaan|kantor)\b/i.test(h)) return identity.company;
        if (/\b(job|pekerjaan|jabatan|occupation)\b/i.test(h)) return identity.jobTitle;
        if (/\bwebsite\b/i.test(h) || type === 'url') return identity.website;
        if (/\b(bio|tentang|deskripsi|about)\b/i.test(h)) return identity.bio;
        if (/\b(age|umur|usia)\b/i.test(h)) return String(Math.floor(Math.random() * 43) + 18);
        if (/\b(salary|gaji|income)\b/i.test(h)) return String((Math.floor(Math.random() * 17) + 4) * 500000);
        if (/\b(agama|religion)\b/i.test(h)) {
            const rel = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Khonghucu'];
            return rel[Math.floor(Math.random() * rel.length)];
        }
        if (/\b(gender|jenis_kelamin|kelamin|sex)\b/i.test(h)) return Math.random() > 0.5 ? 'Laki-laki' : 'Perempuan';
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

            // ── Build Haystack from 7 attributes + label text + parent context ──
            const haystackParts: string[] = [];

            // Helper: normalize multi-line/extra-space arialabel or text
            const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

            // 1. Atribut elemen utama
            const attrKeys = ['id', 'name', 'placeholder', 'aria-label', 'arialabel', 'title', 'data-testid', 'autocomplete'];
            attrKeys.forEach(k => { const v = el.getAttribute(k); if (v) haystackParts.push(norm(v)); });

            // 2. Label via for="id"
            if (el.id) {
                const linkedLbl = document.querySelector<HTMLElement>(`label[for="${CSS.escape(el.id)}"]`);
                if (linkedLbl) {
                    const lv = norm(linkedLbl.getAttribute('arialabel') || linkedLbl.textContent || '');
                    if (lv) haystackParts.push(lv);
                }
            }
            // 3. Wrapping label
            const wrapLbl = el.closest('label');
            if (wrapLbl) {
                const lv = norm(wrapLbl.getAttribute('arialabel') || wrapLbl.textContent || '');
                if (lv) haystackParts.push(lv);
            }

            // 4. Ancestor container label (reg-form-item, p-calendar, ui-input-date-2, .field, etc.)
            let formItemContainer = el.closest('reg-form-item, ui-input-date-2, p-calendar, p-dropdown, .field, .form-group, .form-row, tr, td, fieldset');
            if (!formItemContainer) {
                let par: HTMLElement | null = el.parentElement;
                for (let i = 0; i < 6 && par; i++) {
                    if (par.querySelector('label, .label, [arialabel]')) {
                        formItemContainer = par;
                        break;
                    }
                    par = par.parentElement;
                }
            }
            if (formItemContainer) {
                const cLbl = formItemContainer.querySelector('label, .label, [arialabel]');
                if (cLbl) {
                    const txt = norm(cLbl.getAttribute('arialabel') || cLbl.textContent || '');
                    if (txt) haystackParts.push(txt);
                }
                // Also grab arialabel from the container itself
                const ctxt = norm(formItemContainer.getAttribute('arialabel') || '');
                if (ctxt) haystackParts.push(ctxt);
            }

            const haystack = haystackParts.filter(Boolean).join(' ');
            const type = el instanceof HTMLInputElement ? el.type : el.tagName.toLowerCase();
            // Mark p-calendar inputs so the date guesser knows
            const isInsideCalendar = !!el.closest('p-calendar, ui-input-date-2');
            const val = guess(haystack, type, el.getAttribute('placeholder') || '', el.name || '', el.id || '', el, isInsideCalendar);

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
