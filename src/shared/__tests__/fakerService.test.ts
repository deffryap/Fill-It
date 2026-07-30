import { describe, it, expect } from 'vitest';
import {
    generateIndonesianPhone,
    generateIndonesianNIK,
    generateIndonesianNomorKK,
    generateIndonesianNPWP,
    generateIndonesianBankAccount,
    generateIndonesianAddressRTRW,
    generateIdentity,
    generateFieldValue
} from '../fakerService';

// Daftar 38 kode provinsi resmi Indonesia (sesuai UU No. 24/2013)
const VALID_PROVINCE_CODES = new Set([
    '11', '12', '13', '14', '15', '16', '17', '18', '19', '21', // Sumatra
    '31', '32', '33', '34', '35', '36',                         // Jawa
    '51', '52', '53',                                            // Bali & Nusa Tenggara
    '61', '62', '63', '64', '65',                               // Kalimantan
    '71', '72', '73', '74', '75', '76',                         // Sulawesi
    '81', '82',                                                  // Maluku
    '91', '92', '93', '94', '95', '96',                         // Papua
]);

describe('Indonesian Form Generator Logic', () => {

    describe('generateIndonesianPhone', () => {
        it('should generate a valid Indonesian phone number with real operator prefix (08xx) and privacy-safe 0000xxxx suffix', () => {
            const phone = generateIndonesianPhone();
            // Must start with a real Indonesian mobile operator prefix and contain 0000 test block
            expect(phone).toMatch(/^08\d{2}0000\d{4}$/);
            expect(phone).toHaveLength(12);
        });

        it('should generate a number consisting only of digits', () => {
            const phone = generateIndonesianPhone();
            expect(phone).toMatch(/^\d+$/);
        });
    });

    describe('generateIndonesianNIK', () => {
        it('should generate a 16-digit NIK', () => {
            const nik = generateIndonesianNIK();
            expect(nik).toHaveLength(16);
            expect(nik).toMatch(/^\d{16}$/);
        });

        it('should use a valid province code from 38 official Indonesian provinces', () => {
            // Jalankan beberapa kali untuk memverifikasi randomness tetap dalam set valid
            for (let i = 0; i < 20; i++) {
                const nik = generateIndonesianNIK();
                const provCode = nik.slice(0, 2);
                expect(VALID_PROVINCE_CODES.has(provCode)).toBe(true);
            }
        });

        it('should have kab/kota and kecamatan dummy codes "0101" at positions 2-5', () => {
            const nik = generateIndonesianNIK();
            // Posisi 2-5: kode kab/kota (01) + kode kecamatan (01)
            expect(nik.slice(2, 6)).toBe('0101');
        });

        it('should have privacy-safe suffix "9999999999" (impossible calendar month)', () => {
            const nik = generateIndonesianNIK();
            // 10 digit terakhir harus "9999999999" — mustahil match data Dukcapil nyata
            expect(nik.slice(6, 16)).toBe('9999999999');
        });

        it('should NOT use the old invalid region code "999999"', () => {
            for (let i = 0; i < 10; i++) {
                const nik = generateIndonesianNIK();
                expect(nik.slice(0, 6)).not.toBe('999999');
            }
        });
    });

    describe('generateIndonesianNomorKK', () => {
        it('should generate a 16-digit Nomor KK', () => {
            const kk = generateIndonesianNomorKK();
            expect(kk).toHaveLength(16);
            expect(kk).toMatch(/^\d{16}$/);
        });

        it('should use a valid province code from 38 official Indonesian provinces', () => {
            for (let i = 0; i < 20; i++) {
                const kk = generateIndonesianNomorKK();
                const provCode = kk.slice(0, 2);
                expect(VALID_PROVINCE_CODES.has(provCode)).toBe(true);
            }
        });

        it('should have kab/kota and kecamatan dummy codes "0101" at positions 2-5', () => {
            const kk = generateIndonesianNomorKK();
            expect(kk.slice(2, 6)).toBe('0101');
        });

        it('should have anti-collision suffix "8888888888" (distinct from NIK)', () => {
            const kk = generateIndonesianNomorKK();
            // 10 digit terakhir harus "8888888888" — berbeda dari NIK untuk anti cross-field collision
            expect(kk.slice(6, 16)).toBe('8888888888');
        });

        it('NIK and KK suffixes must be different to prevent cross-field collision', () => {
            const nik = generateIndonesianNIK();
            const kk = generateIndonesianNomorKK();
            expect(nik.slice(6)).not.toBe(kk.slice(6));
        });
    });

    describe('generateIndonesianNPWP', () => {
        it('should return fixed NPWP-15 raw (15 digits)', () => {
            const npwp = generateIndonesianNPWP();
            expect(npwp.raw).toHaveLength(15);
            expect(npwp.raw).toBe('999999999054000');
        });

        it('should return fixed NPWP-15 formatted string', () => {
            const npwp = generateIndonesianNPWP();
            expect(npwp.formatted).toBe('99.999.999.9-054.000');
        });

        it('should return a 16-digit NPWP-16 string', () => {
            const npwp = generateIndonesianNPWP();
            expect(npwp.npwp16).toHaveLength(16);
            expect(npwp.npwp16).toMatch(/^\d{16}$/);
        });

        it('NPWP-16 should use a valid province code from 38 provinces', () => {
            for (let i = 0; i < 20; i++) {
                const npwp = generateIndonesianNPWP();
                const provCode = npwp.npwp16.slice(0, 2);
                expect(VALID_PROVINCE_CODES.has(provCode)).toBe(true);
            }
        });

        it('NPWP-16 should have anti-collision suffix "7777777777"', () => {
            const npwp = generateIndonesianNPWP();
            expect(npwp.npwp16.slice(6)).toBe('7777777777');
        });

        it('NPWP-16 should use NIK 6-digit region code when nikRegionCode is provided', () => {
            const nikRegionCode = '610101';
            const npwp = generateIndonesianNPWP(nikRegionCode);
            expect(npwp.npwp16.slice(0, 6)).toBe('610101');
            expect(npwp.npwp16).toBe('6101017777777777');
        });

        it('all three identifiers should have different suffixes (anti cross-field collision)', () => {
            const nikSuffix = '9999999999';
            const kkSuffix = '8888888888';
            const npwp16Suffix = '7777777777';
            expect(nikSuffix).not.toBe(kkSuffix);
            expect(nikSuffix).not.toBe(npwp16Suffix);
            expect(kkSuffix).not.toBe(npwp16Suffix);
        });
    });

    describe('generateIndonesianBankAccount', () => {
        it('should generate a bank name and account with digits matching bank standard and prefix 999', () => {
            const account = generateIndonesianBankAccount();
            expect(['BCA', 'Bank Mandiri', 'BNI', 'BRI']).toContain(account.bankName);
            expect(account.accountNo.slice(0, 3)).toBe('999');

            if (account.bankName === 'BCA') {
                expect(account.accountNo).toHaveLength(10);
            } else if (account.bankName === 'Bank Mandiri') {
                expect(account.accountNo).toHaveLength(13);
            } else if (account.bankName === 'BNI') {
                expect(account.accountNo).toHaveLength(10);
            } else if (account.bankName === 'BRI') {
                expect(account.accountNo).toHaveLength(15);
            }
        });
    });

    describe('generateIndonesianAddressRTRW', () => {
        it('should generate a non-empty string starting with Jl.', () => {
            const address = generateIndonesianAddressRTRW();
            expect(typeof address).toBe('string');
            expect(address.length).toBeGreaterThan(0);
            expect(address).toContain('Jl.');
        });

        it('should contain RT and RW pattern followed by 3 digit numbers', () => {
            const address = generateIndonesianAddressRTRW();
            expect(address).toMatch(/RT \d{3}\/RW \d{3}/);
        });

        it('should contain Kel. and Kec. components', () => {
            const address = generateIndonesianAddressRTRW();
            expect(address).toContain('Kel.');
            expect(address).toContain('Kec.');
        });
    });

    describe('generateIdentity', () => {
        it('should generate a full Indonesian identity with locale id_ID including nomorKK', () => {
            const identity = generateIdentity('id_ID');
            expect(identity.locale).toBe('id_ID');
            expect(identity.fullName).toBeDefined();
            expect(identity.email).toMatch(/^[a-zA-Z0-9._%+-]+@(gmail\.com|mail\.id|yahoo\.co\.id|outlook\.co\.id)$/);
            expect(identity.address).toMatch(/^Jl\..+RT \d{3}\/RW \d{3}.+Kel\..+Kec\..+$/);

            // NIK: 16 digit, 10 digit terakhir = "9999999999"
            expect(identity.nik).toMatch(/^\d{16}$/);
            expect(identity.nik?.slice(6)).toBe('9999999999');

            // Nomor KK: 16 digit, 10 digit terakhir = "8888888888"
            expect(identity.nomorKK).toBeDefined();
            expect(identity.nomorKK).toMatch(/^\d{16}$/);
            expect(identity.nomorKK?.slice(6)).toBe('8888888888');

            // NPWP: 16-digit NPWP matching NIK region code with suffix "7777777777"
            expect(identity.npwp).toMatch(/^\d{16}$/);
            expect(identity.npwp?.slice(0, 6)).toBe(identity.nik?.slice(0, 6));
            expect(identity.npwp?.slice(6)).toBe('7777777777');

            expect(identity.bankName).toBeDefined();
            expect(identity.bankAccount).toBeDefined();
            expect(identity.city).toBeDefined();
            expect(identity.province).toBeDefined();
            expect(identity.zipCode).toMatch(/^\d{5}$/);
            expect(identity.kecamatan).toBeDefined();
            expect(identity.kelurahan).toBeDefined();

            // Verifikasi bahwa address mengandung kelurahan dan kecamatan yang sama
            expect(identity.address).toContain(`Kel. ${identity.kelurahan}`);
            expect(identity.address).toContain(`Kec. ${identity.kecamatan}`);
        });

        it('should generate standard identity fields for en_US locale without ID specific fields', () => {
            const identity = generateIdentity('en_US');
            expect(identity.locale).toBe('en_US');
            expect(identity.fullName).toBeDefined();
            expect(identity.email).toBeDefined();
            expect(identity.address).toBeDefined();
            expect(identity.address).not.toContain('RT 0');
            expect(identity.nik).toBeUndefined();
            expect(identity.npwp).toBeUndefined();
            expect(identity.nomorKK).toBeUndefined();
        });
    });

    describe('generateFieldValue', () => {
        it('should map all Indonesian ID categories correctly', () => {
            const name = generateFieldValue('person.fullName', 'id_ID');
            expect(name).toBeTypeOf('string');
            expect(name.length).toBeGreaterThan(0);

            const email = generateFieldValue('internet.email', 'id_ID');
            expect(email).toContain('@');

            const addressID = generateFieldValue('location.streetAddress', 'id_ID');
            expect(addressID).toMatch(/RT \d{3}\/RW \d{3}/);

            const cityID = generateFieldValue('location.city', 'id_ID');
            expect(cityID).toBeTypeOf('string');
            expect(cityID.length).toBeGreaterThan(0);

            const zipID = generateFieldValue('location.zipCode', 'id_ID');
            expect(zipID).toMatch(/^\d{5}$/);

            const provinceID = generateFieldValue('location.state', 'id_ID');
            expect(provinceID).toBeTypeOf('string');

            const kecID = generateFieldValue('indonesia.kecamatan', 'id_ID');
            expect(kecID).toBeTypeOf('string');

            const kelID = generateFieldValue('indonesia.kelurahan', 'id_ID');
            expect(kelID).toBeTypeOf('string');

            // NIK: 16 digit, suffix 9999999999
            const nik = generateFieldValue('indonesia.nik', 'id_ID');
            expect(nik).toHaveLength(16);
            expect(nik.slice(6)).toBe('9999999999');

            // Nomor KK: 16 digit, suffix 8888888888
            const kk = generateFieldValue('indonesia.nomorkk', 'id_ID');
            expect(kk).toHaveLength(16);
            expect(kk.slice(6)).toBe('8888888888');

            // NPWP-15: format terformat tetap
            const npwp15 = generateFieldValue('indonesia.npwp', 'id_ID');
            expect(npwp15).toBe('99.999.999.9-054.000');

            // NPWP-16: 16 digit, suffix 7777777777
            const npwp16 = generateFieldValue('indonesia.npwp16', 'id_ID');
            expect(npwp16).toHaveLength(16);
            expect(npwp16.slice(6)).toBe('7777777777');
        });

        it('should NOT generate Indonesian administrative data for non-id_ID locales (en_US, en_SG)', () => {
            expect(generateFieldValue('indonesia.nik', 'en_US')).toBe('');
            expect(generateFieldValue('indonesia.npwp', 'en_US')).toBe('');
            expect(generateFieldValue('indonesia.nomorkk', 'en_US')).toBe('');
            expect(generateFieldValue('indonesia.kecamatan', 'en_US')).toBe('');
            expect(generateFieldValue('indonesia.kelurahan', 'en_US')).toBe('');

            expect(generateFieldValue('indonesia.nik', 'en_SG')).toBe('');
            expect(generateFieldValue('indonesia.npwp', 'en_SG')).toBe('');
            expect(generateFieldValue('indonesia.nomorkk', 'en_SG')).toBe('');
            expect(generateFieldValue('indonesia.kecamatan', 'en_SG')).toBe('');
            expect(generateFieldValue('indonesia.kelurahan', 'en_SG')).toBe('');
        });
    });
});
