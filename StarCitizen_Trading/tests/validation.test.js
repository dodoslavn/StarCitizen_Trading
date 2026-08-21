/**
 * Tests for input validation utilities (validateShipId, validateWallet -
 * added for Smart Routes M3; other validators here predate this file)
 */

const { validateShipId, validateWallet } = require('../utils/validation.js');

describe('validateShipId', () => {
    test('lowercases and strips characters outside [a-z0-9-]', () => {
        expect(validateShipId('Drak-Cutlass_Black!')).toBe('drak-cutlassblack');
    });

    test('returns empty string for non-string input', () => {
        expect(validateShipId(null)).toBe('');
        expect(validateShipId(undefined)).toBe('');
        expect(validateShipId(123)).toBe('');
    });

    test('returns empty string for an empty input', () => {
        expect(validateShipId('')).toBe('');
    });

    test('caps length at 50 characters', () => {
        const long = 'a'.repeat(100);
        expect(validateShipId(long)).toHaveLength(50);
    });

    test('passes through an already-valid slug unchanged', () => {
        expect(validateShipId('drak-cutlass-black')).toBe('drak-cutlass-black');
    });
});

describe('validateWallet', () => {
    test('treats missing/empty input as 0 (unlimited)', () => {
        expect(validateWallet(undefined)).toBe(0);
        expect(validateWallet(null)).toBe(0);
        expect(validateWallet('')).toBe(0);
    });

    test('treats invalid/negative input as 0 (unlimited)', () => {
        expect(validateWallet('not-a-number')).toBe(0);
        expect(validateWallet(-500)).toBe(0);
        expect(validateWallet(NaN)).toBe(0);
    });

    test('parses a valid numeric string', () => {
        expect(validateWallet('100000')).toBe(100000);
    });

    test('floors fractional values', () => {
        expect(validateWallet(1500.75)).toBe(1500);
    });

    test('clamps to the max', () => {
        expect(validateWallet(5000000000, 1000000000)).toBe(1000000000);
    });
});
