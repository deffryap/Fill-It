import { describe, it, expect } from 'vitest';
import {
    generateIndonesianPhone,
    generateIndonesianNIK,
    generateIndonesianNPWP,
    generateIndonesianBankAccount,
    generateIdentity,
    generateFieldValue
} from '../fakerService';

describe('Indonesian Form Generator Logic', () => {
    
    describe('generateIndonesianPhone', () => {
        it('should generate a valid Indonesian phone number starting with 08', () => {
            const phone = generateIndonesianPhone();
            expect(phone).toMatch(/^08\d{9,10}$/);
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

        it('should contain a valid region code prefix', () => {
            const regionCodes = ['317401', '327301', '357801', '517101', '127101'];
            const nik = generateIndonesianNIK();
            const prefix = nik.slice(0, 6);
            expect(regionCodes).toContain(prefix);
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
        it('should generate a valid 15-digit NPWP structure', () => {
            const npwp = generateIndonesianNPWP();
            expect(npwp.raw).toHaveLength(15);
            expect(npwp.raw).toMatch(/^\d{15}$/);
            expect(npwp.formatted).toMatch(/^\d{2}\.\d{3}\.\d{3}\.\d{1}-\d{3}\.\d{3}$/);
        });
    });

    describe('generateIndonesianBankAccount', () => {
        it('should generate a bank name and account with digits matching bank standard', () => {
            const account = generateIndonesianBankAccount();
            expect(['BCA', 'Bank Mandiri', 'BNI', 'BRI']).toContain(account.bankName);
            
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

    describe('generateIdentity', () => {
        it('should generate a full indonesian identity with locale id_ID', () => {
            const identity = generateIdentity('id_ID');
            expect(identity.locale).toBe('id_ID');
            expect(identity.fullName).toBeDefined();
            expect(identity.email).toMatch(/^[a-zA-Z0-9._%+-]+@(gmail\.com|mail\.id|yahoo\.co\.id|outlook\.co\.id)$/);
            expect(identity.nik).toMatch(/^\d{16}$/);
            expect(identity.npwp).toMatch(/^\d{2}\.\d{3}\.\d{3}\.\d{1}-\d{3}\.\d{3}$/);
            expect(identity.bankName).toBeDefined();
            expect(identity.bankAccount).toBeDefined();
        });

        it('should generate standard identity fields for en_US locale without ID specific fields', () => {
            const identity = generateIdentity('en_US');
            expect(identity.locale).toBe('en_US');
            expect(identity.fullName).toBeDefined();
            expect(identity.email).toBeDefined();
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

            const nik = generateFieldValue('indonesia.nik', 'id_ID');
            expect(nik).toHaveLength(16);
        });
    });
});
