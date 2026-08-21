/**
 * Trip Time Estimation Utilities
 *
 * Heuristic time estimates for Smart Routes (docs/smart-routes-plan.md M4),
 * used to rank routes by aUEC/hour rather than raw profit per trip. Fixed
 * lookup tables based on terminal type and loading mechanics, not live
 * distance data - see the plan's M6 for a real-distance follow-up.
 */

const APPROACH_TIME_MIN = { station: 3, city: 8, moon: 10, outpost: 15, unknown: 8 };

const AUTO_LOAD_MIN = 4;
const MANUAL_LOAD_SETUP_MIN = 3;
const MANUAL_LOAD_MIN_PER_SCU = 0.15; // 500 SCU manual load ~= 78 min

/**
 * Classify a terminal's physical type from its location metadata, to pick
 * an approach/landing time estimate.
 * @param {Object} initEntry - cachedInitData[terminal_name]
 * @returns {'station'|'city'|'moon'|'outpost'|'unknown'}
 */
function classifyTerminal(initEntry) {
    if (initEntry?.space_station_name) return 'station';
    if (initEntry?.city_name) return 'city';
    if (initEntry?.moon_name) return 'moon';
    if (initEntry?.outpost_name) return 'outpost';
    return 'unknown';
}

/**
 * Estimated time (minutes) to load or unload scuAmount SCU at a terminal.
 * Fixed cost if the terminal supports true auto-load (cargo spawns
 * directly in the ship's hold); otherwise scales with the amount being
 * manually shuffled box by box.
 * @param {Object} terminalInit - cachedInitData[terminal_name]
 * @param {number} scuAmount - SCU being loaded/unloaded
 * @returns {number} Minutes
 */
function loadTimeMin(terminalInit, scuAmount) {
    if (terminalInit?.is_auto_load) return AUTO_LOAD_MIN;
    return MANUAL_LOAD_SETUP_MIN + scuAmount * MANUAL_LOAD_MIN_PER_SCU;
}

/**
 * Estimated QT travel time (minutes) between two terminals, based on
 * whether they share a star system/planet. No live distance data yet.
 * @param {Object} fromInit - cachedInitData[terminal_name]
 * @param {Object} toInit - cachedInitData[terminal_name]
 * @returns {number} Minutes
 */
function travelTimeMin(fromInit, toInit) {
    if (fromInit?.name !== toInit?.name) return 20; // cross-system
    if (fromInit?.planet_name !== toInit?.planet_name) return 10; // cross-planet
    return 5; // same orbit
}

/**
 * Total door-to-door trip time estimate: approach + load at the
 * acquisition (buy) terminal, travel between the two, approach + unload
 * at the disposal (sell) terminal.
 * @param {Object} buyInit - cachedInitData for the acquisition terminal
 * @param {Object} sellInit - cachedInitData for the disposal terminal
 * @param {number} amount - SCU being traded
 * @returns {number} Minutes
 */
function estimateTripTimeMin(buyInit, sellInit, amount) {
    return APPROACH_TIME_MIN[classifyTerminal(buyInit)]
        + loadTimeMin(buyInit, amount)
        + travelTimeMin(buyInit, sellInit)
        + APPROACH_TIME_MIN[classifyTerminal(sellInit)]
        + loadTimeMin(sellInit, amount);
}

module.exports = {
    classifyTerminal,
    loadTimeMin,
    travelTimeMin,
    estimateTripTimeMin
};
