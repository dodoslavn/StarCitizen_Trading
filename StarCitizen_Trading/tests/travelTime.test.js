/**
 * Tests for trip time estimation (Smart Routes M4)
 */

const { classifyTerminal, loadTimeMin, travelTimeMin, estimateTripTimeMin } = require('../utils/travelTime.js');

describe('classifyTerminal', () => {
    test('classifies a space station', () => {
        expect(classifyTerminal({ space_station_name: 'ARC-L1' })).toBe('station');
    });

    test('classifies a city', () => {
        expect(classifyTerminal({ city_name: 'Area 18' })).toBe('city');
    });

    test('classifies a moon', () => {
        expect(classifyTerminal({ moon_name: 'Wala' })).toBe('moon');
    });

    test('classifies an outpost', () => {
        expect(classifyTerminal({ outpost_name: 'ArcCorp 045' })).toBe('outpost');
    });

    test('falls back to unknown when no location field matches', () => {
        expect(classifyTerminal({})).toBe('unknown');
        expect(classifyTerminal(undefined)).toBe('unknown');
    });

    test('prioritises station over other fields if multiple are somehow set', () => {
        expect(classifyTerminal({ space_station_name: 'X', city_name: 'Y' })).toBe('station');
    });
});

describe('loadTimeMin', () => {
    test('is a fixed 4 minutes at an auto-load terminal regardless of amount', () => {
        expect(loadTimeMin({ is_auto_load: true }, 10)).toBe(4);
        expect(loadTimeMin({ is_auto_load: true }, 5000)).toBe(4);
    });

    test('scales linearly with SCU amount at a manual-load terminal', () => {
        expect(loadTimeMin({ is_auto_load: false }, 0)).toBe(3); // just the setup cost
        expect(loadTimeMin({ is_auto_load: false }, 100)).toBe(3 + 100 * 0.15);
        expect(loadTimeMin({}, 500)).toBe(3 + 500 * 0.15); // missing flag treated as manual
    });

    test('a large manual load takes far longer than an auto-load one', () => {
        const manual = loadTimeMin({ is_auto_load: false }, 500);
        const auto = loadTimeMin({ is_auto_load: true }, 500);
        expect(manual).toBeGreaterThan(auto * 10);
    });
});

describe('travelTimeMin', () => {
    const stanton = { name: 'Stanton', planet_name: 'ArcCorp' };
    const stantonOtherPlanet = { name: 'Stanton', planet_name: 'Hurston' };
    const stantonSamePlanet = { name: 'Stanton', planet_name: 'ArcCorp' };
    const pyro = { name: 'Pyro', planet_name: 'Bloom' };

    test('same system and planet -> 5 minutes', () => {
        expect(travelTimeMin(stanton, stantonSamePlanet)).toBe(5);
    });

    test('same system, different planet -> 10 minutes', () => {
        expect(travelTimeMin(stanton, stantonOtherPlanet)).toBe(10);
    });

    test('different system -> 20 minutes', () => {
        expect(travelTimeMin(stanton, pyro)).toBe(20);
    });

    test('cross-system is longer than same-planet', () => {
        expect(travelTimeMin(stanton, pyro)).toBeGreaterThan(travelTimeMin(stanton, stantonSamePlanet));
    });

    test('uses real distance data when both terminal IDs are found in the map (M6)', () => {
        const distances = { '12_23': 99 }; // 99 Gm, matches a real spot-checked pair
        const result = travelTimeMin(stanton, pyro, 12, 23, distances);
        // 99 Gm / 150,000,000 m/s = 660s = 11 min - should NOT be the heuristic's flat 20
        expect(result).toBeCloseTo(11, 0);
        expect(result).not.toBe(20);
    });

    test('checks both key orders in the distance map (order-independent)', () => {
        const distances = { '23_12': 99 }; // reversed key order
        const result = travelTimeMin(stanton, pyro, 12, 23, distances);
        expect(result).toBeCloseTo(11, 0);
    });

    test('falls back to the heuristic when the pair is not in the distance map', () => {
        const distances = { '999_888': 50 }; // unrelated pair
        const result = travelTimeMin(stanton, pyro, 12, 23, distances);
        expect(result).toBe(20); // heuristic cross-system value
    });

    test('falls back to the heuristic when terminal IDs are not provided at all', () => {
        expect(travelTimeMin(stanton, pyro)).toBe(20);
    });

    test('falls back to the heuristic when no distances map is provided', () => {
        expect(travelTimeMin(stanton, pyro, 12, 23)).toBe(20);
    });
});

describe('estimateTripTimeMin', () => {
    test('sums approach + load at both ends plus travel between them', () => {
        const buyInit = { space_station_name: 'A', is_auto_load: true, name: 'Stanton', planet_name: 'ArcCorp' };
        const sellInit = { space_station_name: 'B', is_auto_load: true, name: 'Stanton', planet_name: 'ArcCorp' };
        // 3 (approach) + 4 (auto load) + 5 (travel) + 3 (approach) + 4 (auto load)
        expect(estimateTripTimeMin(buyInit, sellInit, 100)).toBe(19);
    });

    test('uses real distance data when terminal IDs + distances are passed through (M6)', () => {
        const buyInit = { space_station_name: 'A', is_auto_load: true, name: 'Stanton', planet_name: 'ArcCorp' };
        const sellInit = { space_station_name: 'B', is_auto_load: true, name: 'Pyro', planet_name: 'Bloom' };
        const distances = { '12_466': 99 };

        const withDistance = estimateTripTimeMin(buyInit, sellInit, 100, 12, 466, distances);
        const withoutDistance = estimateTripTimeMin(buyInit, sellInit, 100); // heuristic: cross-system 20 min travel
        // Real distance (11 min travel) should differ from the heuristic (20 min travel)
        expect(withDistance).not.toBeCloseTo(withoutDistance, 0);
    });

    test('auto-load <-> auto-load routes are shorter than manual <-> manual routes', () => {
        const autoBuy = { space_station_name: 'A', is_auto_load: true, name: 'Stanton', planet_name: 'ArcCorp' };
        const autoSell = { space_station_name: 'B', is_auto_load: true, name: 'Stanton', planet_name: 'ArcCorp' };
        const manualBuy = { outpost_name: 'C', is_auto_load: false, name: 'Stanton', planet_name: 'ArcCorp' };
        const manualSell = { outpost_name: 'D', is_auto_load: false, name: 'Stanton', planet_name: 'ArcCorp' };

        const autoTime = estimateTripTimeMin(autoBuy, autoSell, 300);
        const manualTime = estimateTripTimeMin(manualBuy, manualSell, 300);
        expect(autoTime).toBeLessThan(manualTime);
    });

    test('loading time dominates trip time for a big manual load', () => {
        const outpost = { outpost_name: 'Remote Mining Site', is_auto_load: false, name: 'Stanton', planet_name: 'ArcCorp' };
        const totalMin = estimateTripTimeMin(outpost, outpost, 2000); // e.g. a C2 full load
        // 2 x (15 approach + (3 + 2000*0.15) load) = 2 x 318 = 636
        expect(totalMin).toBeGreaterThan(600);
        // loading alone (2 x 303) should be the overwhelming majority of that
        const loadOnly = 2 * (3 + 2000 * 0.15);
        expect(loadOnly / totalMin).toBeGreaterThan(0.9);
    });

    test('cross-system routes take longer than same-system routes, all else equal', () => {
        const stantonStation = { space_station_name: 'A', is_auto_load: true, name: 'Stanton', planet_name: 'ArcCorp' };
        const stantonStation2 = { space_station_name: 'B', is_auto_load: true, name: 'Stanton', planet_name: 'ArcCorp' };
        const pyroStation = { space_station_name: 'C', is_auto_load: true, name: 'Pyro', planet_name: 'Bloom' };

        const sameSystem = estimateTripTimeMin(stantonStation, stantonStation2, 100);
        const crossSystem = estimateTripTimeMin(stantonStation, pyroStation, 100);
        expect(crossSystem).toBeGreaterThan(sameSystem);
    });
});
