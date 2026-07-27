import { faker as fakerEN } from '@faker-js/faker/locale/en_US';
import { faker as fakerID } from '@faker-js/faker/locale/id_ID';
import { faker as fakerSG } from '@faker-js/faker/locale/en';
import type { Locale, Identity } from './types';

const getFaker = (locale: Locale) => {
    switch (locale) {
        case 'id_ID': return fakerID;
        case 'en_SG': return fakerSG;
        case 'en_US': return fakerEN;
        default: return fakerEN;
    }
};

// Custom generator for Indonesian phone numbers (Strictly dummy starting with 0800 toll-free prefix)
export const generateIndonesianPhone = (): string => {
    const isTwelveDigits = Math.random() > 0.5;
    const remainingLength = isTwelveDigits ? 8 : 7;
    let suffix = '';
    for (let i = 0; i < remainingLength; i++) {
        suffix += Math.floor(Math.random() * 10);
    }
    return `0800${suffix}`;
};

// Custom generator for NIK (16 digits) - Using region code 999999 (province 99 is invalid) to guarantee dummy status
export const generateIndonesianNIK = (): string => {
    const region = '999999';

    const randomYear = Math.floor(Math.random() * (2005 - 1970 + 1)) + 1970;
    const randomMonth = Math.floor(Math.random() * 12) + 1;
    let randomDay = Math.floor(Math.random() * 28) + 1;

    // 50% chance female (+40 to birth day)
    if (Math.random() > 0.5) {
        randomDay += 40;
    }

    const dayStr = String(randomDay).padStart(2, '0');
    const monthStr = String(randomMonth).padStart(2, '0');
    const yearStr = String(randomYear).slice(-2);

    const sequence = String(Math.floor(Math.random() * 99) + 1).padStart(4, '0');

    return `${region}${dayStr}${monthStr}${yearStr}${sequence}`;
};

// Custom generator for NPWP (15 digits) - Using taxpayer prefix 00 to guarantee dummy status
export const generateIndonesianNPWP = (): { raw: string; formatted: string } => {
    const p1 = '00';
    const p2 = String(Math.floor(Math.random() * 900) + 100);
    const p3 = String(Math.floor(Math.random() * 900) + 100);
    const p4 = String(Math.floor(Math.random() * 9));
    const p5 = String(Math.floor(Math.random() * 900) + 100);
    const p6 = '000';

    const raw = `${p1}${p2}${p3}${p4}${p5}${p6}`;
    const formatted = `${p1}.${p2}.${p3}.${p4}-${p5}.${p6}`;

    return { raw, formatted };
};

// Custom generator for Indonesian bank account - Prefixing with 999 to guarantee dummy status
export const generateIndonesianBankAccount = (): { bankName: string; accountNo: string } => {
    const banks = [
        { name: 'BCA', digits: 10 },
        { name: 'Bank Mandiri', digits: 13 },
        { name: 'BNI', digits: 10 },
        { name: 'BRI', digits: 15 }
    ];
    const bank = banks[Math.floor(Math.random() * banks.length)];
    const prefix = '999';
    let suffix = '';
    for (let i = 0; i < bank.digits - prefix.length; i++) {
        suffix += Math.floor(Math.random() * 10);
    }
    const accountNo = `${prefix}${suffix}`;
    return { bankName: bank.name, accountNo };
};

export interface IndonesianRegion {
    kelurahan: string;
    kecamatan: string;
    city: string;
    province: string;
    postalCode: string;
}

export const INDONESIAN_REGIONS: IndonesianRegion[] = [
    { kelurahan: 'Menteng', kecamatan: 'Menteng', city: 'Kota Jakarta Pusat', province: 'DKI Jakarta', postalCode: '10310' },
    { kelurahan: 'Senayan', kecamatan: 'Kebayoran Baru', city: 'Kota Jakarta Selatan', province: 'DKI Jakarta', postalCode: '12190' },
    { kelurahan: 'Duren Sawit', kecamatan: 'Duren Sawit', city: 'Kota Jakarta Timur', province: 'DKI Jakarta', postalCode: '13440' },
    { kelurahan: 'Kebon Jeruk', kecamatan: 'Kebon Jeruk', city: 'Kota Jakarta Barat', province: 'DKI Jakarta', postalCode: '11530' },
    { kelurahan: 'Sunter Agung', kecamatan: 'Tanjung Priok', city: 'Kota Jakarta Utara', province: 'DKI Jakarta', postalCode: '14350' },
    { kelurahan: 'Dago', kecamatan: 'Coblong', city: 'Kota Bandung', province: 'Jawa Barat', postalCode: '40135' },
    { kelurahan: 'Sukasari', kecamatan: 'Sukasari', city: 'Kota Bandung', province: 'Jawa Barat', postalCode: '40151' },
    { kelurahan: 'Margahayu', kecamatan: 'Bekasi Timur', city: 'Kota Bekasi', province: 'Jawa Barat', postalCode: '17113' },
    { kelurahan: 'Pondok Cina', kecamatan: 'Beji', city: 'Kota Depok', province: 'Jawa Barat', postalCode: '16424' },
    { kelurahan: 'Babakan Pasar', kecamatan: 'Bogor Tengah', city: 'Kota Bogor', province: 'Jawa Barat', postalCode: '16126' },
    { kelurahan: 'Serpong', kecamatan: 'Serpong', city: 'Kota Tangerang Selatan', province: 'Banten', postalCode: '15310' },
    { kelurahan: 'Karawaci', kecamatan: 'Karawaci', city: 'Kota Tangerang', province: 'Banten', postalCode: '15115' },
    { kelurahan: 'Gubeng', kecamatan: 'Gubeng', city: 'Kota Surabaya', province: 'Jawa Timur', postalCode: '60281' },
    { kelurahan: 'Mojoroto', kecamatan: 'Mojoroto', city: 'Kota Kediri', province: 'Jawa Timur', postalCode: '64112' },
    { kelurahan: 'Lowokwaru', kecamatan: 'Lowokwaru', city: 'Kota Malang', province: 'Jawa Timur', postalCode: '65141' },
    { kelurahan: 'Simpang Lima', kecamatan: 'Semarang Selatan', city: 'Kota Semarang', province: 'Jawa Tengah', postalCode: '50241' },
    { kelurahan: 'Banjarsari', kecamatan: 'Banjarsari', city: 'Kota Surakarta', province: 'Jawa Tengah', postalCode: '57136' },
    { kelurahan: 'Suryodiningratan', kecamatan: 'Mantrijeron', city: 'Kota Yogyakarta', province: 'DI Yogyakarta', postalCode: '55141' },
    { kelurahan: 'Caturtunggal', kecamatan: 'Depok', city: 'Kabupaten Sleman', province: 'DI Yogyakarta', postalCode: '55281' },
    { kelurahan: 'Kesawan', kecamatan: 'Medan Barat', city: 'Kota Medan', province: 'Sumatera Utara', postalCode: '20111' },
    { kelurahan: 'Losari', kecamatan: 'Ujung Pandang', city: 'Kota Makassar', province: 'Sulawesi Selatan', postalCode: '90111' },
    { kelurahan: 'Sanur', kecamatan: 'Denpasar Selatan', city: 'Kota Denpasar', province: 'Bali', postalCode: '80228' },
    { kelurahan: 'Kuta', kecamatan: 'Kuta', city: 'Kabupaten Badung', province: 'Bali', postalCode: '80361' },
    { kelurahan: 'Air Hitam', kecamatan: 'Samarinda Ulu', city: 'Kota Samarinda', province: 'Kalimantan Timur', postalCode: '75124' },
    { kelurahan: 'Pekanbaru Kota', kecamatan: 'Pekanbaru Kota', city: 'Kota Pekanbaru', province: 'Riau', postalCode: '28111' },
    { kelurahan: 'Padang Barat', kecamatan: 'Padang Barat', city: 'Kota Padang', province: 'Sumatera Barat', postalCode: '25112' }
];

// Custom generator for Indonesian address with RT/RW format
export const generateIndonesianAddressRTRW = (regionInput?: IndonesianRegion): string => {
    const region = regionInput || INDONESIAN_REGIONS[Math.floor(Math.random() * INDONESIAN_REGIONS.length)];
    const flowerStreets = [
        'Mawar', 'Melati', 'Anggrek', 'Kamboja', 'Dahlia', 'Flamboyan',
        'Kenanga', 'Cempaka', 'Tulip', 'Seroja', 'Teratai', 'Asoka',
        'Bougenville', 'Sakura', 'Lily', 'Lavender', 'Sedap Malam',
        'Sudirman', 'Gajah Mada', 'Diponegoro', 'Gatot Subroto', 'Ahmad Yani'
    ];
    const street = flowerStreets[Math.floor(Math.random() * flowerStreets.length)];
    const houseNum = Math.floor(Math.random() * 200) + 1;
    const rt = String(Math.floor(Math.random() * 20) + 1).padStart(3, '0');
    const rw = String(Math.floor(Math.random() * 20) + 1).padStart(3, '0');

    return `Jl. ${street}, No. ${houseNum}, RT ${rt}/RW ${rw}, Kel. ${region.kelurahan}, Kec. ${region.kecamatan}`;
};

export const generateIdentity = (locale: Locale): Identity => {
    const f = getFaker(locale);
    const firstName = f.person.firstName();
    const lastName = f.person.lastName();

    let email = f.internet.email({ firstName, lastName }).toLowerCase();
    if (locale === 'id_ID') {
        const idDomains = ['gmail.com', 'mail.id', 'yahoo.co.id', 'outlook.co.id'];
        const randomDom = idDomains[Math.floor(Math.random() * idDomains.length)];
        const emailUser = email.split('@')[0];
        email = `${emailUser}@${randomDom}`;
    }

    const phone = locale === 'id_ID' ? generateIndonesianPhone() : f.phone.number();

    const baseIdentity: Identity = {
        locale,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        email,
        phone,
        address: f.location.streetAddress(true),
        bankAccount: f.finance.accountNumber(),
        createdAt: Date.now(),
        birthDate: f.date.birthdate({ min: 18, max: 65, mode: 'age' }).toISOString().split('T')[0],
        password: f.internet.password({ length: 12 }),
        company: f.company.name(),
        jobTitle: f.person.jobTitle(),
        website: f.internet.url(),
        bio: f.person.bio(),
    };

    if (locale === 'id_ID') {
        const bank = generateIndonesianBankAccount();
        const npwp = generateIndonesianNPWP();
        const region = INDONESIAN_REGIONS[Math.floor(Math.random() * INDONESIAN_REGIONS.length)];
        return {
            ...baseIdentity,
            address: generateIndonesianAddressRTRW(region),
            city: region.city,
            province: region.province,
            zipCode: region.postalCode,
            kecamatan: region.kecamatan,
            kelurahan: region.kelurahan,
            nik: generateIndonesianNIK(),
            npwp: npwp.formatted,
            bankName: bank.bankName,
            bankAccount: bank.accountNo,
        };
    }

    return {
        ...baseIdentity,
        city: f.location.city(),
        province: f.location.state(),
        zipCode: f.location.zipCode(),
    };
};

export const generateFieldValue = (category: string, locale: Locale): string => {
    const f = getFaker(locale);
    switch (category) {
        case 'person.fullName': return f.person.fullName();
        case 'person.firstName': return f.person.firstName();
        case 'person.lastName': return f.person.lastName();
        case 'internet.email': {
            let email = f.internet.email().toLowerCase();
            if (locale === 'id_ID') {
                const idDomains = ['gmail.com', 'mail.id', 'yahoo.co.id'];
                const randomDom = idDomains[Math.floor(Math.random() * idDomains.length)];
                email = `${email.split('@')[0]}@${randomDom}`;
            }
            return email;
        }
        case 'phone.number': return locale === 'id_ID' ? generateIndonesianPhone() : f.phone.number();
        case 'location.streetAddress': return locale === 'id_ID' ? generateIndonesianAddressRTRW() : f.location.streetAddress(true);
        case 'location.city': {
            if (locale === 'id_ID') {
                return INDONESIAN_REGIONS[Math.floor(Math.random() * INDONESIAN_REGIONS.length)].city;
            }
            return f.location.city();
        }
        case 'location.zipCode': {
            if (locale === 'id_ID') {
                return INDONESIAN_REGIONS[Math.floor(Math.random() * INDONESIAN_REGIONS.length)].postalCode;
            }
            return f.location.zipCode();
        }
        case 'location.state':
        case 'indonesia.province': {
            if (locale === 'id_ID') {
                return INDONESIAN_REGIONS[Math.floor(Math.random() * INDONESIAN_REGIONS.length)].province;
            }
            return f.location.state();
        }
        case 'indonesia.kecamatan': return INDONESIAN_REGIONS[Math.floor(Math.random() * INDONESIAN_REGIONS.length)].kecamatan;
        case 'indonesia.kelurahan': return INDONESIAN_REGIONS[Math.floor(Math.random() * INDONESIAN_REGIONS.length)].kelurahan;
        case 'finance.accountNumber': return locale === 'id_ID' ? generateIndonesianBankAccount().accountNo : f.finance.accountNumber();
        case 'lorem.sentence': return f.lorem.sentence();
        case 'internet.password': return f.internet.password();
        case 'internet.username': return f.internet.username();
        case 'indonesia.nik': return generateIndonesianNIK();
        case 'indonesia.npwp': return generateIndonesianNPWP().formatted;
        case 'finance.bankName': return locale === 'id_ID' ? generateIndonesianBankAccount().bankName : 'BCA';
        case 'company.name': return f.company.name();
        case 'person.jobTitle': return f.person.jobTitle();
        case 'internet.url': return f.internet.url();
        case 'person.bio': return f.person.bio();
        default: return f.lorem.word();
    }
};

export const FAKER_CATEGORIES = [
    { value: 'person.fullName', label: 'Full Name' },
    { value: 'person.firstName', label: 'First Name' },
    { value: 'person.lastName', label: 'Last Name' },
    { value: 'internet.email', label: 'Email' },
    { value: 'phone.number', label: 'Phone' },
    { value: 'location.streetAddress', label: 'Address' },
    { value: 'location.city', label: 'City / Regency' },
    { value: 'location.zipCode', label: 'Zip Code' },
    { value: 'location.state', label: 'Province' },
    { value: 'indonesia.kecamatan', label: 'Kecamatan (District)' },
    { value: 'indonesia.kelurahan', label: 'Kelurahan (Subdistrict)' },
    { value: 'finance.accountNumber', label: 'Bank Account' },
    { value: 'finance.bankName', label: 'Bank Name' },
    { value: 'indonesia.nik', label: 'NIK (Indonesian ID)' },
    { value: 'indonesia.npwp', label: 'NPWP (Indonesian Tax ID)' },
    { value: 'internet.password', label: 'Password' },
    { value: 'internet.username', label: 'Username' },
    { value: 'lorem.sentence', label: 'Random Sentence' },
    { value: 'company.name', label: 'Company Name' },
    { value: 'person.jobTitle', label: 'Job Title' },
    { value: 'internet.url', label: 'Website URL' },
    { value: 'person.bio', label: 'Bio / Description' },
];
