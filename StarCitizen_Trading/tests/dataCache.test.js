/**
 * Tests for DataCache class
 */

const DataCache = require('../dataCache.js');

describe('DataCache', () => {
    let cache;

    beforeEach(() => {
        cache = new DataCache();
    });

    test('should initialize with null data', () => {
        expect(cache.getData()).toBeNull();
        expect(cache.getInitData()).toBeNull();
        expect(cache.getProfit()).toEqual([]);
    });

    test('should set and get data', () => {
        const testData = { data: [{ commodity_name: 'Aluminum' }] };
        cache.setData(testData);
        expect(cache.getData()).toEqual(testData);
    });

    test('should set and get init data', () => {
        const testInit = { 'ARC-L1': { name: 'Stanton', code: 'STN' } };
        cache.setInitData(testInit);
        expect(cache.getInitData()).toEqual(testInit);
    });

    test('should manage profit data', () => {
        const profitEntry = {
            commodity: 'Aluminum',
            profit_uec: 100,
            profit_perc: 10
        };

        cache.addProfit(profitEntry);
        expect(cache.getProfit()).toContainEqual(profitEntry);

        cache.clearProfit();
        expect(cache.getProfit()).toEqual([]);
    });

    test('hasData should return false initially', () => {
        expect(cache.hasData()).toBe(false);
    });

    test('hasData should return true after setting both data types', () => {
        cache.setData({ data: [] });
        cache.setInitData({});
        expect(cache.hasData()).toBe(true);
    });

    test('should track cache age', () => {
        expect(cache.getCacheAge()).toBeNull();

        cache.setData({ data: [] });
        const age = cache.getCacheAge();

        expect(age).toBeGreaterThanOrEqual(0);
        expect(age).toBeLessThan(100); // Should be very recent
    });
});
