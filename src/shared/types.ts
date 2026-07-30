export type Locale = 'id_ID' | 'en_SG' | 'en_US';

export interface LocaleOption {
    value: Locale;
    label: string;
    flag: string;
}

export const LOCALE_OPTIONS: LocaleOption[] = [
    { value: 'id_ID', label: 'Indonesian (ID)', flag: '🇮🇩' },
    { value: 'en_SG', label: 'Singapore (SG)', flag: '🇸🇬' },
    { value: 'en_US', label: 'American (US)', flag: '🇺🇸' },
];

export interface Identity {
    locale: Locale;
    fullName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    bankAccount: string;
    createdAt: number;
    nik?: string;
    npwp?: string;
    nomorKK?: string;    // Nomor Kartu Keluarga (16 digit, Privacy-Safe Dummy)
    bankName?: string;
    birthDate?: string;
    password?: string;
    company?: string;
    jobTitle?: string;
    website?: string;
    bio?: string;
    city?: string;
    province?: string;
    zipCode?: string;
    kecamatan?: string;
    kelurahan?: string;
}

export interface FieldMapping {
    id: string;
    selector: string;         // CSS selector or input name
    dataSource: string;        // e.g. 'Faker.js (ID - Name)'
    fakerCategory: string;     // e.g. 'person.fullName'
    fakerLocale: Locale;
    livePreview?: string;
}

export interface Template {
    id: string;
    name: string;
    isActive: boolean;
    fields: FieldMapping[];
}

export interface AppSettings {
    autoSubmit: boolean;
    safeMode: boolean;
    selectedLocale: Locale;
}

export interface InjectedLog {
    id: string;
    timestamp: number;
    url: string;
    templateName: string;
    injectedData: Record<string, string>;
}

export interface TestSession {
    id: string;
    startTime: number;
    isActive: boolean;
    logs: InjectedLog[];
}

