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

// Custom generator for Indonesian phone numbers
export const generateIndonesianPhone = (): string => {
    const prefixes = [
        '0812', '0813', '0821', '0822', // Telkomsel
        '0856', '0857', '0858',          // Indosat
        '0818', '0819', '0878',          // XL
        '0896', '0897', '0898',          // Tri
        '0881', '0882', '0888'           // Smartfren
    ];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const isTwelveDigits = Math.random() > 0.5;
    const remainingLength = isTwelveDigits ? 8 : 7;
    let suffix = '';
    for (let i = 0; i < remainingLength; i++) {
        suffix += Math.floor(Math.random() * 10);
    }
    return `${prefix}${suffix}`;
};

// Custom generator for NIK (16 digits)
export const generateIndonesianNIK = (): string => {
    const regionCodes = ['317401', '327301', '357801', '517101', '127101'];
    const region = regionCodes[Math.floor(Math.random() * regionCodes.length)];

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

// Custom generator for NPWP (15 digits)
export const generateIndonesianNPWP = (): { raw: string; formatted: string } => {
    const p1 = String(Math.floor(Math.random() * 9) + 1).padStart(2, '0');
    const p2 = String(Math.floor(Math.random() * 900) + 100);
    const p3 = String(Math.floor(Math.random() * 900) + 100);
    const p4 = String(Math.floor(Math.random() * 9));
    const p5 = String(Math.floor(Math.random() * 900) + 100);
    const p6 = '000';

    const raw = `${p1}${p2}${p3}${p4}${p5}${p6}`;
    const formatted = `${p1}.${p2}.${p3}.${p4}-${p5}.${p6}`;

    return { raw, formatted };
};

// Custom generator for Indonesian bank account
export const generateIndonesianBankAccount = (): { bankName: string; accountNo: string } => {
    const banks = [
        { name: 'BCA', digits: 10 },
        { name: 'Bank Mandiri', digits: 13 },
        { name: 'BNI', digits: 10 },
        { name: 'BRI', digits: 15 }
    ];
    const bank = banks[Math.floor(Math.random() * banks.length)];
    let accountNo = '';
    for (let i = 0; i < bank.digits; i++) {
        accountNo += Math.floor(Math.random() * 10);
    }
    return { bankName: bank.name, accountNo };
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
        return {
            ...baseIdentity,
            nik: generateIndonesianNIK(),
            npwp: npwp.formatted,
            bankName: bank.bankName,
            bankAccount: bank.accountNo,
        };
    }

    return baseIdentity;
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
        case 'location.streetAddress': return f.location.streetAddress(true);
        case 'finance.accountNumber': return locale === 'id_ID' ? generateIndonesianBankAccount().accountNo : f.finance.accountNumber();
        case 'lorem.sentence': return f.lorem.sentence();
        case 'internet.password': return f.internet.password();
        case 'internet.username': return f.internet.username();
        case 'location.city': return f.location.city();
        case 'location.zipCode': return f.location.zipCode();
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
    { value: 'location.city', label: 'City' },
    { value: 'location.zipCode', label: 'Zip Code' },
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
