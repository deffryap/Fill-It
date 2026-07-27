import { describe, it, expect } from 'vitest';
import {
    generateIndonesianPhone,
    generateIndonesianNIK,
    generateIndonesianNPWP,
    generateIndonesianBankAccount,
    generateIndonesianAddressRTRW,
    generateIdentity,
    generateFieldValue
} from '../fakerService';

describe('Indonesian Form Generator Logic', () => {
    
    describe('generateIndonesianPhone', () => {
        it('should generate a valid Indonesian phone number starting with 0800', () => {
            const phone = generateIndonesianPhone();
            expect(phone).toMatch(/^0800\d{7,8}$/);
            expect(phone.length).toBeGreaterThanOrEqual(11);
            expect(phone.length).toBeLessThanOrEqual(12);
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

        it('should contain a dummy region code prefix (999999)', () => {
            const nik = generateIndonesianNIK();
            const prefix = nik.slice(0, 6);
            expect(prefix).toBe('999999');
        });

        it('should have a valid day of birth including female offset', () => {
            const nik = generateIndonesianNIK();
            const day = parseInt(nik.slice(6, 8), 10);
            // Day must be between 1..31 (male) or 41..71 (female)
            const isValidMaleDay = day >= 1 && day <= 31;
            const isValidFemaleDay = day >= 41 && day <= 71;
            expect(isValidMaleDay || isValidFemaleDay).toBe(true);
        });
    });

    describe('generateIndonesianNPWP', () => {
        it('should generate a valid 15-digit dummy NPWP structure starting with 00', () => {
            const npwp = generateIndonesianNPWP();
            expect(npwp.raw).toHaveLength(15);
            expect(npwp.raw).toMatch(/^00\d{13}$/);
            expect(npwp.formatted).toMatch(/^00\.\d{3}\.\d{3}\.\d{1}-\d{3}\.000$/);
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
        it('should generate a full indonesian identity with locale id_ID and aligned location fields', () => {
            const identity = generateIdentity('id_ID');
            expect(identity.locale).toBe('id_ID');
            expect(identity.fullName).toBeDefined();
            expect(identity.email).toMatch(/^[a-zA-Z0-9._%+-]+@(gmail\.com|mail\.id|yahoo\.co\.id|outlook\.co\.id)$/);
            expect(identity.address).toMatch(/^Jl\..+RT \d{3}\/RW \d{3}.+Kel\..+Kec\..+$/);
            expect(identity.nik).toMatch(/^\d{16}$/);
            expect(identity.npwp).toMatch(/^\d{2}\.\d{3}\.\d{3}\.\d{1}-\d{3}\.\d{3}$/);
            expect(identity.bankName).toBeDefined();
            expect(identity.bankAccount).toBeDefined();
            expect(identity.city).toBeDefined();
            expect(identity.province).toBeDefined();
            expect(identity.zipCode).toMatch(/^\d{5}$/);
            expect(identity.kecamatan).toBeDefined();
            expect(identity.kelurahan).toBeDefined();

            // Verify that address contains the generated kelurahan and kecamatan
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
        });
    });

    describe('generateFieldValue', () => {
        it('should map categories correctly', () => {
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

            const nik = generateFieldValue('indonesia.nik', 'id_ID');
            expect(nik).toHaveLength(16);
        });
    });
});
