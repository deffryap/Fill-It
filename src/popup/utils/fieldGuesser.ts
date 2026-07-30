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
    // Haystack: gabungkan semua sumber teks yang tersedia
    const c = `${label} ${name} ${id} ${placeholder}`;
    const locale = identity.locale;

    if (/\b(email|e-mail|mail)\b/i.test(c)) return identity.email;
    if (/\b(phone|telepon|telp|handphone|hp|nohp|no_hp|mobile)\b/i.test(c) || field.type === 'tel') return identity.phone;
    if (/\b(fullname|nama_lengkap|namalengkap|nama_wajib_pajak|namawajibpajak|taxpayername|taxpayer_name)\b/i.test(c) || (/\b(name|nama)\b/i.test(c) && !/\b(first|last|bank|company|user|teknik|mother|ibu|gadis)\b/i.test(c))) return identity.fullName;
    if (/\b(firstname|nama_depan|namadepan)\b/i.test(c)) return identity.firstName;
    if (/\b(lastname|nama_belakang|namabelakang)\b/i.test(c)) return identity.lastName;

    // ── Nama Ibu Kandung ──────────────────────────────────────────────
    if (/\b(mother|mothersname|mother_name|ibu_kandung|ibukandung|nama_ibu|nama\s*ibu|nama_ibu_kandung|nama\s*ibu\s*kandung|gadis_ibu_kandung)\b/i.test(c) || /\b(ibu)\b/i.test(c)) {
        if (locale !== 'id_ID') return '';
        const fn = ['Siti', 'Dewi', 'Sri', 'Mega', 'Putri', 'Indah', 'Lestari', 'Kartika', 'Rini', 'Wati'];
        const ln = ['Suryani', 'Puspitasari', 'Utami', 'Lestari', 'Wulandari', 'Hidayah', 'Rahayu', 'Wijaya'];
        return `${fn[Math.floor(Math.random() * fn.length)]} ${ln[Math.floor(Math.random() * ln.length)]}`;
    }

    // ── NPWP (diutamakan sebelum NIK agar tidak tumpang tindih) ──────────
    if (/\b(npwp|no_npwp|no\.?\s*npwp|nomor_npwp|nomor\s*npwp|tax_id|tax_number|tin|pajak)\b/i.test(c)) {
        if (locale !== 'id_ID') return '';
        const isFormatted15 = placeholder.includes('.') || placeholder.includes('-');
        if (isFormatted15) {
            if (identity.npwp && (identity.npwp.includes('.') || identity.npwp.length === 15)) {
                return identity.npwp;
            }
            return '99.999.999.9-054.000';
        }
        return identity.npwp || `${(identity.nik && identity.nik.length >= 6) ? identity.nik.slice(0, 6) : '310101'}7777777777`;
    }

    // ── Nomor KK ─────────────────────────────────────────────────────────
    if (/\b(kk|no_kk|nokk|no\.?\s*kk|nomor_kk|nomor\s*kk|kartu_keluarga|kartu\s*keluarga|no_kartu_keluarga|no\.?\s*kartu\s*keluarga|nomor_kartu_keluarga|nomor\s*kartu\s*keluarga|family_card|family_card_number|familycardnumber)\b/i.test(c)) {
        if (locale !== 'id_ID') return '';
        return identity.nomorKK || '3401018888888888';
    }

    // ── NIK ───────────────────────────────────────────────────────────────
    if (/\b(nik|no_nik|no\.?\s*nik|nomor_nik|nomor\s*nik|no_ktp|no\.?\s*ktp|nomor_ktp|nomor\s*ktp|noktp|no_identitas|no\.?\s*identitas|nomor_identitas|nomor\s*identitas|national_id)\b/i.test(c)) {
        if (locale !== 'id_ID') return '';
        return identity.nik || '';
    }

    // ── Tempat Lahir ──────────────────────────────────────────────────
    if (/\b(birthplace|birth_place|place_of_birth|placeofbirth|tempat_lahir|tempat\s*lahir|tempatlahir|tplahir|tpt_lahir)\b/i.test(c)) {
        const cities = ['Kota Jakarta Utara', 'Kota Bandung', 'Kota Surabaya', 'Kota Semarang', 'Kota Medan', 'Kota Makassar', 'Kota Yogyakarta', 'Kota Malang', 'Kota Tangerang Selatan'];
        return locale === 'id_ID' ? cities[Math.floor(Math.random() * cities.length)] : 'New York';
    }

    // ── Tanggal Lahir ─────────────────────────────────────────────────
    if (/\b(birthdate|birth\s*date|date\s*of\s*birth|date_of_birth|dateofbirth|tanggal_lahir|tanggal\s*lahir|tanggallahir|tgl_lahir|tgl\s*lahir|tgllahir|bday)\b/i.test(c) || placeholder.includes('dd-mm-yyyy') || placeholder.includes('dd/mm/yyyy') || placeholder.includes('tanggal lahir') || placeholder.includes('date of birth') || c.toLowerCase().includes('tanggal lahir') || c.toLowerCase().includes('date of birth') || c.toLowerCase().includes('tgl lahir')) {
        const bd = identity.birthDate || '1990-01-15';
        const pts = bd.split('-');
        if (pts.length === 3) {
            if (placeholder.includes('dd-mm-yyyy') || placeholder.includes('dd-mm')) {
                return `${pts[2]}-${pts[1]}-${pts[0]}`;
            }
            return `${pts[2]}/${pts[1]}/${pts[0]}`;
        }
        return bd;
    }

    // ── Status Perkawinan ─────────────────────────────────────────────
    if (/\b(marriage|marital|pernikahan|kawin|status_perkawinan|status\s*perkawinan|statusperkawinan|status_kawin|marriagestatus)\b/i.test(c)) {
        const st = ['Belum Kawin', 'Kawin', 'Cerai Hidup', 'Cerai Mati'];
        return st[Math.floor(Math.random() * st.length)];
    }

    // ── Status Hubungan Keluarga ──────────────────────────────────────
    if (/\b(familystatus|family_status|family_member|family_member_status|familymemberstatus|hubungan_keluarga|hubungan\s*keluarga|status_hubungan_keluarga|status\s*hubungan\s*keluarga)\b/i.test(c)) {
        const fs = ['Kepala Keluarga', 'Suami', 'Istri', 'Anak', 'Mertua', 'Orang Tua'];
        return fs[Math.floor(Math.random() * fs.length)];
    }

    // ── Jenis Pekerjaan ───────────────────────────────────────────────
    if (/\b(worktype|work_type|jenis_pekerjaan|jenis\s*pekerjaan|jenispekerjaan|job|pekerjaan|jabatan|occupation)\b/i.test(c)) {
        const jobs = ['Karyawan Swasta', 'PNS', 'Wiraswasta', 'Profesional', 'Industri', 'Lainnya'];
        return jobs[Math.floor(Math.random() * jobs.length)];
    }

    // ── Jenis Wajib Pajak ─────────────────────────────────────────────
    if (/\b(taxpayertype|taxpayer_type|jenis_wajib_pajak|jenis\s*wajib\s*pajak|jeniswajibpajak)\b/i.test(c)) return 'Orang Pribadi atau Warisan Belum Terbagi';

    // ── Negara Asal ───────────────────────────────────────────────────
    if (/\b(countryoforigin|country_of_origin|negara_asal|negara\s*asal|negaraasal|country)\b/i.test(c)) return 'Indonesia';

    // ── Kategori Individu ─────────────────────────────────────────────
    if (/\b(individualcategory|individual_category|kategori_individu|kategori\s*individu|kategoriindividu)\b/i.test(c)) return 'Orang Pribadi';

    if (/\b(rekening|norek|no_rek|accountnumber)\b/i.test(c) || (/\baccount\b/i.test(c) && !/\b(bank|email)\b/i.test(c))) return identity.bankAccount;
    if (/\b(bankname|nama_bank|namabank)\b/i.test(c) || (/\bbank\b/i.test(c) && !/\b(account|rekening)\b/i.test(c))) return identity.bankName || '';
    if (/\b(address|alamat|jalan)\b/i.test(c)) return identity.address;
    if (/\b(city|kota|kabupaten)\b/i.test(c)) return identity.city || '';
    if (/\b(province|provinsi|state)\b/i.test(c)) return identity.province || '';
    if (/\b(postal|zip|zipcode|zip_code|kodepos|kode_pos|kode\s*pos|postcode|post_code|post\s*code)\b/i.test(c)) return identity.zipCode || '';
    if (/\bkecamatan\b|\bdistrict\b/i.test(c)) return identity.kecamatan || '';
    if (/\bkelurahan\b|\bsubdistrict\b|\bdesa\b/i.test(c)) return identity.kelurahan || '';
    if (/\b(password|sandi)\b/i.test(c) || field.type === 'password') return identity.password || 'P@ssw0rd123!';
    if (/\b(company|perusahaan|kantor)\b/i.test(c)) return identity.company || '';
    if (/\b(job|pekerjaan|jabatan|occupation)\b/i.test(c)) return identity.jobTitle || '';
    if (/\bwebsite\b/i.test(c) || field.type === 'url') return identity.website || '';
    if (/\b(bio|tentang|deskripsi|about)\b/i.test(c)) return identity.bio || '';
    if (/\b(age|umur|usia)\b/i.test(c)) return String(Math.floor(Math.random() * 43) + 18);
    if (/\b(salary|gaji|income)\b/i.test(c)) return String((Math.floor(Math.random() * 17) + 4) * 500000);
    if (/\b(agama|religion)\b/i.test(c)) {
        const rel = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Khonghucu'];
        return rel[Math.floor(Math.random() * rel.length)];
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
    if (key.includes('city') || key.includes('location.city')) return identity.city || null;
    if (key.includes('province') || key.includes('state') || key.includes('location.state')) return identity.province || null;
    if (key.includes('zipcode') || key.includes('postalcode') || key.includes('location.zipcode')) return identity.zipCode || null;
    if (key.includes('kecamatan') || key.includes('indonesia.kecamatan')) return identity.kecamatan || null;
    if (key.includes('kelurahan') || key.includes('indonesia.kelurahan')) return identity.kelurahan || null;
    if (key.includes('bankaccount') || key.includes('bank.account') || key.includes('finance.accountnumber')) return identity.bankAccount;
    if (key.includes('nik') || key.includes('indonesia.nik')) return identity.nik || null;
    if (key.includes('nomorkk') || key.includes('indonesia.nomorkk')) return identity.nomorKK || null;
    if (key.includes('npwp16') || key.includes('indonesia.npwp16')) {
        const regionCode = (identity.nik && identity.nik.length >= 6) ? identity.nik.slice(0, 6) : '310101';
        return `${regionCode}7777777777`;
    }
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
