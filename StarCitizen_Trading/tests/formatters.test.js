/**
 * Tests for number/date formatting and estimation utilities
 */

const {
    readable_number,
    getStalenessLevel,
    formatDateTime,
    formatContainerSizes,
    estimateMaxInventory,
    escapeHtml,
    getStockUsageClass,
    dataAgeConfidence
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

describe('dataAgeConfidence', () => {
    const daysAgo = n => Math.floor(Date.now() / 1000) - n * 24 * 60 * 60;

    test('treats a missing timestamp as lowest confidence (unlike getStalenessLevel)', () => {
        expect(dataAgeConfidence(0)).toBe(0.05);
        expect(dataAgeConfidence(null)).toBe(0.05);
    });

    test('full confidence for data under 1 day old', () => {
        expect(dataAgeConfidence(Math.floor(Date.now() / 1000))).toBe(1.0);
        expect(dataAgeConfidence(daysAgo(0.5))).toBe(1.0);
    });

    test('0.7 confidence for data 1-6 days old', () => {
        expect(dataAgeConfidence(daysAgo(3))).toBe(0.7);
        expect(dataAgeConfidence(daysAgo(6))).toBe(0.7);
    });

    test('0.3 confidence for data 7-29 days old', () => {
        expect(dataAgeConfidence(daysAgo(7))).toBe(0.3);
        expect(dataAgeConfidence(daysAgo(14))).toBe(0.3);
        expect(dataAgeConfidence(daysAgo(29))).toBe(0.3);
    });

    test('0.05 confidence for data 30+ days old', () => {
        expect(dataAgeConfidence(daysAgo(30))).toBe(0.05);
        expect(dataAgeConfidence(daysAgo(100))).toBe(0.05);
    });
});

describe('formatDateTime', () => {
    test('returns "Unknown" for a missing timestamp', () => {
        expect(formatDateTime(0)).toBe('Unknown');
        expect(formatDateTime(null)).toBe('Unknown');
    });

    test('formats a timestamp as a readable UTC string in Slovak locale', () => {
        // 2026-01-01 00:00:00 UTC
        expect(formatDateTime(1767225600)).toBe('1. 1. 2026 00:00 UTC');
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

    test('returns 0 when status is missing so the display layer omits the fabricated max', () => {
        // Rendering `100 / ~100` for status=0 would imply capacity really is 100;
        // returning 0 lets the display layer skip the suffix entirely.
        expect(estimateMaxInventory(100, 0)).toBe(0);
        expect(estimateMaxInventory(100, undefined)).toBe(0);
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

describe('getStockUsageClass', () => {
    test('returns empty string when data is stale', () => {
        expect(getStockUsageClass(10, 100, 'buy', 'stale')).toBe('');
        expect(getStockUsageClass(10, 100, 'buy', 'very-stale')).toBe('');
    });

    test('returns empty string when max is unknown', () => {
        expect(getStockUsageClass(10, 0, 'buy', 'fresh')).toBe('');
        expect(getStockUsageClass(10, null, 'buy', 'fresh')).toBe('');
    });

    test('buy side: low stock (<=30%) tinted orange, high stock (>=70%) tinted green', () => {
        expect(getStockUsageClass(10, 100, 'buy', 'fresh')).toBe('stock-orange');
        expect(getStockUsageClass(30, 100, 'buy', 'fresh')).toBe('stock-orange');
        expect(getStockUsageClass(50, 100, 'buy', 'fresh')).toBe(''); // middle
        expect(getStockUsageClass(70, 100, 'buy', 'fresh')).toBe('stock-green');
        expect(getStockUsageClass(100, 100, 'buy', 'fresh')).toBe('stock-green');
    });

    test('sell side: low stock (<=30%) tinted green, high stock (>=70%) tinted red', () => {
        expect(getStockUsageClass(10, 100, 'sell', 'fresh')).toBe('stock-green');
        expect(getStockUsageClass(30, 100, 'sell', 'fresh')).toBe('stock-green');
        expect(getStockUsageClass(50, 100, 'sell', 'fresh')).toBe(''); // middle
        expect(getStockUsageClass(70, 100, 'sell', 'fresh')).toBe('stock-red');
        expect(getStockUsageClass(100, 100, 'sell', 'fresh')).toBe('stock-red');
    });
});

describe('escapeHtml', () => {
    test('escapes the five characters that break out of HTML text and attributes', () => {
        expect(escapeHtml('a & b')).toBe('a &amp; b');
        expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
        expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
        expect(escapeHtml('it\'s')).toBe('it&#39;s');
    });

    test('neutralises a hostile terminal name that would otherwise XSS', () => {
        const hostile = 'Foo"><img src=x onerror=alert(1)>';
        const escaped = escapeHtml(hostile);
        // No unescaped '<' or unescaped '"' - the browser sees inert text, not an <img>
        expect(escaped).not.toMatch(/</);
        expect(escaped).not.toMatch(/"/);
        expect(escaped).toContain('&lt;img');
    });

    test('leaves plain alphanumeric strings unchanged', () => {
        expect(escapeHtml('Aluminum')).toBe('Aluminum');
        expect(escapeHtml('TDD Area 18')).toBe('TDD Area 18');
    });

    test('coerces nullish to empty string', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });

    test('handles non-string values by coercing to string first', () => {
        expect(escapeHtml(42)).toBe('42');
        expect(escapeHtml(0)).toBe('0');
    });
});
