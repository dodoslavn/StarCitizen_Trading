/**
 * Trip Time Estimation Utilities
 *
 * Time estimates for Smart Routes (docs/smart-routes-plan.md M4/M6), used
 * to rank routes by aUEC/hour rather than raw profit per trip.
 *
 * Travel between terminals uses real UEX distance data (Gigameters, from
 * terminals_distances.json - see scan-terminal-distances.js) when
 * available, falling back to the M4 same-orbit/planet/system heuristic
 * otherwise. Approach and loading time are always the fixed lookup
 * tables below - UEX has no data for either of those.
 *
 * IMPORTANT: QT_SPEED_MPS is ONE shared estimate used for every ship, not
 * a per-ship figure. UEX's /vehicles endpoint has no live QT-speed field,
 * and hardcoding ~124 unverified per-ship numbers from the wiki would
 * fabricate a precision we don't actually have. This means the Est. time
 * column changes with real route distance, but NOT with which ship is
 * selected - a deliberate accuracy-over-false-precision tradeoff.
 */

const APPROACH_TIME_MIN = { station: 3, city: 8, moon: 10, outpost: 15, unknown: 8 };

const AUTO_LOAD_MIN = 4;
const MANUAL_LOAD_SETUP_MIN = 3;
const MANUAL_LOAD_MIN_PER_SCU = 0.15; // 500 SCU manual load ~= 78 min

// Rough average QT cruise speed across common cargo ships (m/s). Real ships
// range roughly 50-200 Mm/s; this sits in the middle. See module docstring.
const QT_SPEED_MPS = 150_000_000;
const GM_TO_METERS = 1_000_000_000;

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
 * Estimated QT travel time (minutes) between two terminals. Uses the real
 * UEX distance (Gm) if both terminal IDs are given and found in the
 * distances map; otherwise falls back to the same-orbit/planet/system
 * heuristic based on location metadata.
 * @param {Object} fromInit - cachedInitData[terminal_name]
 * @param {Object} toInit - cachedInitData[terminal_name]
 * @param {number} [fromTerminalId] - Numeric UEX terminal ID (origin)
 * @param {number} [toTerminalId] - Numeric UEX terminal ID (destination)
 * @param {Object} [distances] - cache.getTerminalDistances(), keyed "id1_id2" -> Gm
 * @returns {number} Minutes
 */
function travelTimeMin(fromInit, toInit, fromTerminalId, toTerminalId, distances) {
    if (distances && fromTerminalId != null && toTerminalId != null) {
        const distanceGm = distances[`${fromTerminalId}_${toTerminalId}`]
            ?? distances[`${toTerminalId}_${fromTerminalId}`];
        if (distanceGm !== undefined) {
            const seconds = (distanceGm * GM_TO_METERS) / QT_SPEED_MPS;
            return seconds / 60;
        }
    }

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
 * @param {number} [buyTerminalId] - Numeric UEX terminal ID (acquisition)
 * @param {number} [sellTerminalId] - Numeric UEX terminal ID (disposal)
 * @param {Object} [distances] - cache.getTerminalDistances()
 * @returns {number} Minutes
 */
function estimateTripTimeMin(buyInit, sellInit, amount, buyTerminalId, sellTerminalId, distances) {
    return APPROACH_TIME_MIN[classifyTerminal(buyInit)]
        + loadTimeMin(buyInit, amount)
        + travelTimeMin(buyInit, sellInit, buyTerminalId, sellTerminalId, distances)
        + APPROACH_TIME_MIN[classifyTerminal(sellInit)]
        + loadTimeMin(sellInit, amount);
}

module.exports = {
    classifyTerminal,
    loadTimeMin,
    travelTimeMin,
    estimateTripTimeMin
};
