/**
 * Terminal Distance Scanner (offline backup)
 *
 * Standalone script that builds a full terminal-to-terminal distance
 * backup by calling UEX's /terminals_distances endpoint for every pair of
 * terminals that appear in commodities_prices_all (the terminals Smart
 * Routes actually trades between). Writes terminals_distances.json.
 *
 * This is an OFFLINE BACKUP ONLY - it is not wired into the running app.
 * Terminal distances change rarely (only on major map reworks), so a
 * recurring daily job the way scan-max-inventory.js runs would put a
 * disproportionate, wasteful load on UEX's free API for data that's
 * effectively static. Re-run manually whenever the game map changes.
 *
 * NOTE ON UNITS: the API's "distance" value is not documented and does
 * not appear to be literal km - a spot check found a cross-system hop
 * (ArcCorp -> Pyro Gateway, distance 17) measuring SMALLER than an
 * intra-Stanton hop (ArcCorp -> Deakins Research/Crusader, distance 42).
 * Treat this as an unverified relative routing score, not a physical
 * distance, until confirmed - do not feed it into QT-time math without
 * verifying the unit first.
 *
 * Safe to interrupt and re-run: resumes from wherever it left off via a
 * persisted cursor, and exits immediately once a full pass is complete.
 */

const fs = require('fs');
const logger = require('./logger.js');
const DataCache = require('./dataCache.js');
const trading = require('./services/trading.js');
const uexApi = require('./services/uexApi.js');
const { loadConfig } = require('./config.js');

const DISTANCES_FILE = './terminals_distances.json';
const BATCH_SIZE = 10;
const PROGRESS_LOG_INTERVAL = 20;

// If more than this fraction of pairs fail to fetch, don't mark the backup
// complete - a fresh re-run will need to happen to fill the gaps.
const MAX_ACCEPTABLE_FAILURE_RATE = 0.1;

/**
 * Load previously scanned distance data, if present.
 * @returns {{data: Object, cursor: number, complete: boolean}}
 */
function loadState() {
    try {
        const raw = fs.readFileSync(DISTANCES_FILE, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            logger.warn(`Could not read ${DISTANCES_FILE}, starting fresh: ${error.message}`);
        }
        return { data: {}, cursor: 0, complete: false };
    }
}

/**
 * Persist scan state to disk. Writes to a temp file and renames into place
 * so a crash mid-write can't leave the target truncated.
 * @param {Object} state
 */
function saveState(state) {
    const tempFile = `${DISTANCES_FILE}.tmp`;
    try {
        fs.writeFileSync(tempFile, JSON.stringify(state, null, 2));
        fs.renameSync(tempFile, DISTANCES_FILE);
    } catch (error) {
        logger.warn(`Failed to save distance data: ${error.message}`);
        try { fs.unlinkSync(tempFile); } catch { /* nothing to clean up */ }
    }
}

async function main() {
    const config = loadConfig();
    logger.info('Configuration file loaded successfully');

    const cache = new DataCache();
    logger.info('Fetching commodity price data to determine terminal scope...');
    await trading.refreshData(config, cache);

    const terminalIds = [...new Set(cache.getData().data.map(item => item.id_terminal))].sort((a, b) => a - b);
    logger.info(`${terminalIds.length} terminals in scope`);

    const pairs = [];
    for (let i = 0; i < terminalIds.length; i++) {
        for (let j = i + 1; j < terminalIds.length; j++) {
            pairs.push([terminalIds[i], terminalIds[j]]);
        }
    }
    logger.info(`${pairs.length} pairs to scan`);

    const state = loadState();
    if (state.complete) {
        logger.info(`Distance backup already complete (${Object.keys(state.data).length} pairs recorded), nothing to do`);
        return 0;
    }

    let batches = 0;
    let totalFailures = 0;

    while (state.cursor < pairs.length) {
        const batch = pairs.slice(state.cursor, state.cursor + BATCH_SIZE);

        await Promise.all(batch.map(async ([originId, destId]) => {
            try {
                const resp = await uexApi.fetchTerminalDistance(originId, destId, config);
                const distance = resp?.data?.distance;
                if (distance !== undefined && distance !== null) {
                    state.data[`${originId}_${destId}`] = Number(distance);
                }
            } catch (error) {
                totalFailures += 1;
                logger.debug(`Failed to fetch distance for ${originId}->${destId}: ${error.message}`);
            }
        }));

        state.cursor += batch.length;
        batches += 1;
        saveState(state);

        if (batches % PROGRESS_LOG_INTERVAL === 0) {
            logger.info(`Scan progress: ${state.cursor} / ${pairs.length} (failures so far: ${totalFailures})`);
        }
    }

    const failureRate = pairs.length > 0 ? totalFailures / pairs.length : 0;
    if (failureRate > MAX_ACCEPTABLE_FAILURE_RATE) {
        logger.error(
            `Distance scan finished but ${totalFailures} of ${pairs.length} pairs failed to fetch ` +
            `(${(failureRate * 100).toFixed(1)}% > ${(MAX_ACCEPTABLE_FAILURE_RATE * 100).toFixed(0)}% threshold). ` +
            'Not marking complete - re-run this script to retry.'
        );
        saveState(state);
        return 1;
    }

    state.complete = true;
    saveState(state);
    logger.info(`Distance backup complete: ${Object.keys(state.data).length} of ${pairs.length} pairs recorded (${totalFailures} failures)`);
    return 0;
}

main()
    .then(code => process.exit(code))
    .catch(error => {
        logger.error('Distance scan failed:', error);
        process.exit(1);
    });
