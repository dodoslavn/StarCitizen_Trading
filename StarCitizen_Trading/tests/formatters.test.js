/**
 * Tests for number/date formatting and estimation utilities
 */

const {
    readable_number,
    getStalenessLevel,
    formatDateTime,
    formatContainerSizes,
    estimateMaxInventory
} = require('../utils/formatters.js');

describe('readable_number', () => {
    test('groups thousands with spaces', () => {
        expect(readable_number(12345)).toBe('12 345');
    });

    test('passes through the "-" placeholder unchanged', () => {
        expect(readable_number('-')).toBe('-');
    });
});

describe('getStalenessLevel', () => {
    const thresholds = { stale: 1440, veryStale: 4320 };

    test('treats a missing timestamp as fresh', () => {
        expect(getStalenessLevel(0, thresholds)).toBe('fresh');
        expect(getStalenessLevel(null, thresholds)).toBe('fresh');
    });

    test('classifies a recent timestamp as fresh', () => {
        const now = Math.floor(Date.now() / 1000);
        expect(getStalenessLevel(now, thresholds)).toBe('fresh');
    });

    test('classifies a timestamp past the stale threshold as stale', () => {
        const twoDaysAgo = Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60;
        expect(getStalenessLevel(twoDaysAgo, thresholds)).toBe('stale');
    });

    test('classifies a timestamp past the very-stale threshold as very-stale', () => {
        const tenDaysAgo = Math.floor(Date.now() / 1000) - 10 * 24 * 60 * 60;
        expect(getStalenessLevel(tenDaysAgo, thresholds)).toBe('very-stale');
    });
});

describe('formatDateTime', () => {
    test('returns "Unknown" for a missing timestamp', () => {
        expect(formatDateTime(0)).toBe('Unknown');
        expect(formatDateTime(null)).toBe('Unknown');
    });

    test('formats a timestamp as a readable UTC string', () => {
        // 2026-01-01 00:00:00 UTC
        expect(formatDateTime(1767225600)).toBe('Jan 01, 2026, 12:00 AM UTC');
    });
});

describe('formatContainerSizes', () => {
    test('returns "Unknown" for an empty value', () => {
        expect(formatContainerSizes('')).toBe('Unknown');
        expect(formatContainerSizes(null)).toBe('Unknown');
    });

    test('spaces out the comma-separated list and appends SCU', () => {
        expect(formatContainerSizes('1,2,4,8')).toBe('1, 2, 4, 8 SCU');
    });
});

describe('estimateMaxInventory', () => {
    test('returns 0 when there is no current stock', () => {
        expect(estimateMaxInventory(0, 5)).toBe(0);
    });

    test('returns the current stock unchanged when status is missing', () => {
        expect(estimateMaxInventory(100, 0)).toBe(100);
        expect(estimateMaxInventory(100, undefined)).toBe(100);
    });

    test('scales linearly with status tier (tier/7)', () => {
        expect(estimateMaxInventory(700, 7)).toBe(700); // 100%
        expect(estimateMaxInventory(350, 7)).toBe(350);
        expect(estimateMaxInventory(100, 1)).toBe(700); // 100 / (1/7)
        expect(estimateMaxInventory(200, 2)).toBe(700); // 200 / (2/7)
    });

    test('clamps status above the max tier instead of exceeding 100%', () => {
        expect(estimateMaxInventory(500, 7)).toBe(estimateMaxInventory(500, 99));
    });
});
