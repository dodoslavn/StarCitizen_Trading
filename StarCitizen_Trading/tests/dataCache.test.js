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

    test('should set and get game version', () => {
        expect(cache.getGameVersion()).toBeNull();
        cache.setGameVersion('4.9');
        expect(cache.getGameVersion()).toBe('4.9');
    });

    test('should record and retrieve confirmed max inventory per side', () => {
        expect(cache.getConfirmedMax('60_252', 'sell')).toBeUndefined();

        cache.setConfirmedMax('60_252', 'sell', 1866);
        cache.setConfirmedMax('60_252', 'buy', 500);

        expect(cache.getConfirmedMax('60_252', 'sell')).toBe(1866);
        expect(cache.getConfirmedMax('60_252', 'buy')).toBe(500);
        expect(cache.getConfirmedMax('unknown_key', 'sell')).toBeUndefined();
    });

    test('should track the max inventory scan cursor and completion flag', () => {
        expect(cache.getMaxInventoryCursor()).toBe(0);
        expect(cache.isMaxInventoryScanComplete()).toBe(false);

        cache.setMaxInventoryCursor(120);
        cache.setMaxInventoryScanComplete(true);

        expect(cache.getMaxInventoryCursor()).toBe(120);
        expect(cache.isMaxInventoryScanComplete()).toBe(true);
    });

    test('should round-trip max inventory scan state through export/import', () => {
        cache.setGameVersion('4.9');
        cache.setConfirmedMax('60_252', 'sell', 1866);
        cache.setMaxInventoryCursor(2593);
        cache.setMaxInventoryScanComplete(true);

        const exported = cache.exportMaxInventoryState();
        expect(exported).toEqual({
            gameVersion: '4.9',
            data: { '60_252': { sell: 1866 } },
            cursor: 2593,
            complete: true
        });

        const fresh = new DataCache();
        fresh.importMaxInventoryState(exported);

        expect(fresh.getConfirmedMax('60_252', 'sell')).toBe(1866);
        expect(fresh.getMaxInventoryCursor()).toBe(2593);
        expect(fresh.isMaxInventoryScanComplete()).toBe(true);
        // importMaxInventoryState intentionally does not restore gameVersion -
        // callers set it independently from the live API before comparing/importing
        expect(fresh.getGameVersion()).toBeNull();
    });

    test('importMaxInventoryState should default missing fields safely', () => {
        cache.importMaxInventoryState({});

        expect(cache.getConfirmedMax('any', 'sell')).toBeUndefined();
        expect(cache.getMaxInventoryCursor()).toBe(0);
        expect(cache.isMaxInventoryScanComplete()).toBe(false);
    });

    test('should set and get vehicles', () => {
        expect(cache.getVehicles()).toEqual([]);
        const ships = [{ slug: 'drak-cutlass-black', scu: 46 }];
        cache.setVehicles(ships);
        expect(cache.getVehicles()).toBe(ships);
    });

    test('should set and get terminal distances', () => {
        expect(cache.getTerminalDistances()).toEqual({});
        const distances = { '12_23': 42 };
        cache.setTerminalDistances(distances);
        expect(cache.getTerminalDistances()).toBe(distances);
    });
});
