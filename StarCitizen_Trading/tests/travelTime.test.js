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
});

describe('estimateTripTimeMin', () => {
    test('sums approach + load at both ends plus travel between them', () => {
        const buyInit = { space_station_name: 'A', is_auto_load: true, name: 'Stanton', planet_name: 'ArcCorp' };
        const sellInit = { space_station_name: 'B', is_auto_load: true, name: 'Stanton', planet_name: 'ArcCorp' };
        // 3 (approach) + 4 (auto load) + 5 (travel) + 3 (approach) + 4 (auto load)
        expect(estimateTripTimeMin(buyInit, sellInit, 100)).toBe(19);
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
