/**
 * Tests for route risk estimation (Smart Routes M5)
 */

const { routeSurvival, SYSTEM_SURVIVAL, DEFAULT_SURVIVAL } = require('../utils/risk.js');

describe('routeSurvival', () => {
    test('returns the known survival rate for a same-system route', () => {
        expect(routeSurvival({ name: 'Stanton' }, { name: 'Stanton' })).toBe(SYSTEM_SURVIVAL.Stanton);
    });

    test('returns the lower (riskier) of the two sides survival rate', () => {
        expect(routeSurvival({ name: 'Stanton' }, { name: 'Pyro' })).toBe(SYSTEM_SURVIVAL.Pyro);
        expect(routeSurvival({ name: 'Pyro' }, { name: 'Stanton' })).toBe(SYSTEM_SURVIVAL.Pyro);
        expect(routeSurvival({ name: 'Nyx' }, { name: 'Pyro' })).toBe(Math.min(SYSTEM_SURVIVAL.Nyx, SYSTEM_SURVIVAL.Pyro));
    });

    test('falls back to DEFAULT_SURVIVAL for an unknown/missing system', () => {
        expect(routeSurvival({ name: 'SomeNewSystem' }, { name: 'Stanton' })).toBe(DEFAULT_SURVIVAL);
        expect(routeSurvival(undefined, { name: 'Stanton' })).toBe(DEFAULT_SURVIVAL);
        expect(routeSurvival({}, {})).toBe(DEFAULT_SURVIVAL);
    });
});
