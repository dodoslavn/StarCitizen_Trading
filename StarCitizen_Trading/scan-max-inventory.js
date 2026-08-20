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
        return;
    }

    logger.info('Fetching commodity price data to determine scan scope...');
    await trading.refreshData(config, cache);

    let batches = 0;
    let progress = { complete: false, cursor: cache.getMaxInventoryCursor(), total: 0 };

    while (!progress.complete) {
        progress = await trading.refreshConfirmedMaxInventory(config, cache);
        batches += 1;

        if (batches % PROGRESS_LOG_INTERVAL === 0) {
            logger.info(`Scan progress: ${progress.cursor} / ${progress.total}`);
        }
    }

    logger.info('Max inventory scan finished');
}

main().catch(error => {
    logger.error('Max inventory scan failed:', error);
    process.exit(1);
});
