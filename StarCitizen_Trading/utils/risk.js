/**
 * Route Risk Estimation Utilities
 *
 * Hand-curated per-system survival multipliers for Smart Routes
 * (docs/smart-routes-plan.md M5). These are folklore, not measured data -
 * adjust based on community feedback. Crusader is a planet within
 * Stanton, not its own star system, so it does not get a separate entry
 * here; it inherits Stanton's multiplier.
 */

const SYSTEM_SURVIVAL = {
    Stanton: 0.98,
    Pyro: 0.60,
    Nyx: 0.65
};

const DEFAULT_SURVIVAL = 0.90;

/**
 * Estimated probability of completing a route without being destroyed/
 * losing cargo, based on the riskier of the two systems touched.
 * @param {Object} buyInit - cachedInitData for the acquisition terminal
 * @param {Object} sellInit - cachedInitData for the disposal terminal
 * @returns {number} 0-1
 */
function routeSurvival(buyInit, sellInit) {
    const buySurvival = SYSTEM_SURVIVAL[buyInit?.name] ?? DEFAULT_SURVIVAL;
    const sellSurvival = SYSTEM_SURVIVAL[sellInit?.name] ?? DEFAULT_SURVIVAL;
    return Math.min(buySurvival, sellSurvival);
}

module.exports = {
    SYSTEM_SURVIVAL,
    DEFAULT_SURVIVAL,
    routeSurvival
};
