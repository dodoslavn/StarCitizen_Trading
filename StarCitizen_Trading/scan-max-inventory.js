/**
 * Max Inventory History Scanner
 *
 * Standalone script that scans UEX commodity price history to find the
 * highest SCU stock ever observed per terminal+commodity pair, and persists
 * the results to max_inventory.json for the server to read on startup.
 *
 * Runs to completion (one full pass) and exits - intended to run before the
 * server starts (e.g. a systemd ExecStartPre step), not inside the running
 * server, so this slow scan never competes with serving live traffic.
 *
 * Safe to run repeatedly: it resumes from wherever it left off, and exits
 * immediately if a completed scan already exists for the current game version.
 */

const logger = require('./logger.js');
const DataCache = require('./dataCache.js');
const trading = require('./services/trading.js');
const { loadConfig } = require('./config.js');

const PROGRESS_LOG_INTERVAL = 20;

// If more than this fraction of per-pair fetches fail (UEX outage, rate
// limit, network blip mid-run), the resulting scan is unreliable enough
// that we'd rather fail the CI run than commit an incomplete file.
const MAX_ACCEPTABLE_FAILURE_RATE = 0.1;

async function main() {
    const config = loadConfig();
    logger.info('Configuration file loaded successfully');

    const cache = new DataCache();

    const gameVersion = await trading.fetchLiveGameVersion(config);
    cache.setGameVersion(gameVersion);
    logger.info(`Live game version: ${gameVersion || 'unknown'}`);

    trading.loadConfirmedMaxInventory(cache);

    if (cache.isMaxInventoryScanComplete()) {
        logger.info('Max inventory scan already complete for this game version, nothing to do');
        return 0;
    }

    logger.info('Fetching commodity price data to determine scan scope...');
    await trading.refreshData(config, cache);

    let batches = 0;
    let totalFailures = 0;
    let progress;

    do {
        progress = await trading.refreshConfirmedMaxInventory(config, cache);
        batches += 1;
        totalFailures += progress.failures;

        if (batches % PROGRESS_LOG_INTERVAL === 0) {
            logger.info(`Scan progress: ${progress.cursor} / ${progress.total} (failures: ${totalFailures})`);
        }
    } while (!progress.complete);

    const failureRate = progress.total > 0 ? totalFailures / progress.total : 0;
    if (failureRate > MAX_ACCEPTABLE_FAILURE_RATE) {
        logger.error(
            `Max inventory scan finished but ${totalFailures} of ${progress.total} pairs ` +
            `failed to fetch (${(failureRate * 100).toFixed(1)}% > ${(MAX_ACCEPTABLE_FAILURE_RATE * 100).toFixed(0)}% threshold). ` +
            'Refusing to treat this run as authoritative - do not commit max_inventory.json from this run.'
        );
        return 1;
    }

    if (totalFailures > 0) {
        logger.warn(`Max inventory scan finished with ${totalFailures} of ${progress.total} pairs failed (below threshold)`);
    } else {
        logger.info('Max inventory scan finished');
    }
    return 0;
}

main()
    .then(code => process.exit(code))
    .catch(error => {
        logger.error('Max inventory scan failed:', error);
        process.exit(1);
    });
