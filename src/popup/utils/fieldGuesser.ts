// ─────────────────────────────────────────────────────────────────────────────
// fieldGuesser.ts
//
// Popup-context version of the field value guesser.
// Runs inside the React popup — NOT injected into the page.
// Used by the Form Scanner tab to preview guessed values before injection.
//
// IMPORTANT: Keep the keyword matching logic in sync with the `guess()` function
// inside `pageScripts.ts#injectAndFill`. Both must produce identical results for
// the same inputs, or the Form Scanner preview will diverge from what gets injected.
// ─────────────────────────────────────────────────────────────────────────────

import type { Identity } from '../../shared/types';

export interface FieldMeta {
    label: string;
    type: string;
    placeholder: string;
    name: string;
    id: string;
}

export const guessValueForField = (field: FieldMeta, identity: Identity): string => {
    const label = field.label.toLowerCase();
    const name = field.name.toLowerCase();
    const id = field.id.toLowerCase();
    const placeholder = field.placeholder.toLowerCase();
    const c = `${label} ${name} ${id} ${placeholder}`;
    const locale = identity.locale;

    if (c.includes('email')) return identity.email;
    if (c.includes('phone') || c.includes('telepon') || c.includes('hp') || c.includes('telp') || field.type === 'tel') return identity.phone;
    if (c.includes('fullname') || c.includes('nama lengkap') || (c.includes('name') && !c.includes('first') && !c.includes('last') && !c.includes('bank') && !c.includes('company') && !c.includes('user') && !c.includes('teknik'))) return identity.fullName;
    if (c.includes('firstname') || c.includes('nama depan')) return identity.firstName;
    if (c.includes('lastname') || c.includes('nama belakang')) return identity.lastName;
    if ((c.includes('nik') || c.includes('ktp') || c.includes('induk kependudukan')) && !c.includes('teknik')) return identity.nik || '';
    if (c.includes('npwp')) return identity.npwp || '';
    if (c.includes('rekening') || c.includes('norek') || (c.includes('account') && !c.includes('bank') && !c.includes('email'))) return identity.bankAccount;
    if (c.includes('bankname') || c.includes('nama bank') || (c.includes('bank') && !c.includes('account') && !c.includes('rekening'))) return identity.bankName || '';
    if (c.includes('address') || c.includes('alamat') || c.includes('jalan')) return identity.address;
    if (c.includes('password') || c.includes('sandi') || field.type === 'password') return identity.password || 'P@ssw0rd123!';
    if (c.includes('company') || c.includes('perusahaan') || c.includes('kantor')) return identity.company || '';
    if (c.includes('job') || c.includes('pekerjaan') || c.includes('jabatan') || c.includes('occupation')) return identity.jobTitle || '';
    if (c.includes('website') || field.type === 'url') return identity.website || '';
    if (c.includes('bio') || c.includes('tentang') || c.includes('deskripsi') || c.includes('about')) return identity.bio || '';
    if (c.includes('age') || c.includes('umur') || c.includes('usia')) return String(Math.floor(Math.random() * 43) + 18);
    if (c.includes('salary') || c.includes('gaji') || c.includes('income')) return String((Math.floor(Math.random() * 17) + 4) * 500000);
    if (c.includes('birthplace') || c.includes('tempat lahir') || c.includes('tempat_lahir')) {
        const cities = ['Jakarta', 'Bandung', 'Surabaya', 'Semarang', 'Medan', 'Makassar', 'Yogyakarta', 'Malang', 'Palembang', 'Tangerang'];
        return locale === 'id_ID' ? cities[Math.floor(Math.random() * cities.length)] : 'New York';
    }
    if (c.includes('birthdate') || c.includes('tanggal lahir') || c.includes('date of birth') || c.includes('bday') || c.includes('dd-mm-yyyy')) {
        let bd = identity.birthDate || '1990-01-01';
        if (placeholder.includes('dd-mm-yyyy') || placeholder.includes('dd/mm/yyyy')) {
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
    if (field.type === 'textarea') return 'Form testing data.';
    if (field.type === 'checkbox') return 'true';
    return '';
};

// Maps a Faker category string (used by templates) to the corresponding identity field value.
export const getValueFromIdentity = (category: string, identity: Identity): string | null => {
    const key = category.toLowerCase();
    if (key.includes('fullname') || key.includes('name.fullname') || key.includes('person.fullname')) return identity.fullName;
    if (key.includes('firstname') || key.includes('name.firstname') || key.includes('person.firstname')) return identity.firstName;
    if (key.includes('lastname') || key.includes('name.lastname') || key.includes('person.lastname')) return identity.lastName;
    if (key.includes('email') || key.includes('internet.email')) return identity.email;
    if (key.includes('phone') || key.includes('phone.number')) return identity.phone;
    if (key.includes('address') || key.includes('streetaddress') || key.includes('location.streetaddress')) return identity.address;
    if (key.includes('bankaccount') || key.includes('bank.account') || key.includes('finance.accountnumber')) return identity.bankAccount;
    if (key.includes('nik') || key.includes('indonesia.nik')) return identity.nik || null;
    if (key.includes('npwp') || key.includes('indonesia.npwp')) return identity.npwp || null;
    if (key.includes('bankname') || key.includes('finance.bankname')) return identity.bankName || null;
    if (key.includes('birthdate')) return identity.birthDate || null;
    if (key.includes('password') || key.includes('internet.password')) return identity.password || null;
    if (key.includes('company') || key.includes('company.name')) return identity.company || null;
    if (key.includes('jobtitle') || key.includes('person.jobtitle')) return identity.jobTitle || null;
    if (key.includes('website') || key.includes('internet.url')) return identity.website || null;
    if (key.includes('bio') || key.includes('person.bio')) return identity.bio || null;
    return null;
};
