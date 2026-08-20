/**
 * Trading Service
 * Business logic for trading data processing and calculations
 */

const fs = require('fs');
const logger = require('../logger.js');
const uexApi = require('./uexApi.js');
const { estimateMaxInventory } = require('../utils/formatters.js');

const MAX_INVENTORY_FILE = './max_inventory.json';

/**
 * Normalize price data to numbers with validation
 * @param {Object} item - Data item to normalize
 */
function normalizeDataItem(item) {
    // Convert to numbers, defaulting to 0 if invalid
    item.price_buy = Number(item.price_buy) || 0;
    item.price_buy_avg = Number(item.price_buy_avg) || 0;
    item.price_sell = Number(item.price_sell) || 0;
    item.price_sell_avg = Number(item.price_sell_avg) || 0;
    item.scu_buy = Number(item.scu_buy) || 0;
    item.scu_buy_avg = Number(item.scu_buy_avg) || 0;
    item.scu_sell_stock = Number(item.scu_sell_stock) || 0;
    item.scu_sell_stock_avg = Number(item.scu_sell_stock_avg) || 0;
    item.scu_sell = Number(item.scu_sell) || 0;
    item.scu_sell_avg = Number(item.scu_sell_avg) || 0;

    // Ensure no negative values
    Object.keys(item).forEach(key => {
        if (key.startsWith('price_') || key.startsWith('scu_')) {
            if (item[key] < 0) item[key] = 0;
        }
    });
}

/**
 * Refresh commodity price data from API
 * @param {Object} config - Configuration object
 * @param {Object} cache - DataCache instance
 * @returns {Promise<void>}
 */
async function refreshData(config, cache) {
    try {
        logger.info('Refreshing commodity data from UEX API...');
        const resp = await uexApi.fetchPrices(config);

        if (!resp || !Array.isArray(resp.data)) {
            throw new Error('Invalid API response structure');
        }

        if (resp.data.length === 0) {
            logger.warn('API returned empty data set');
        }

        resp.data.forEach(normalizeDataItem);
        cache.setData(resp);

        logger.info(`Data refreshed successfully (${resp.data.length} commodities)`);
    } catch (error) {
        logger.error('Failed to refresh data:', error);
        throw error;
    }
}

const CONFIRMED_MAX_BATCH_SIZE = 10;

/**
 * Fetch the current live Star Citizen game version
 * @param {Object} config - Configuration object
 * @returns {Promise<string|null>} The live version string, or null if unavailable
 */
async function fetchLiveGameVersion(config) {
    try {
        const resp = await uexApi.fetchGameVersion(config);
        return resp?.data?.live || null;
    } catch (error) {
        logger.warn(`Failed to fetch live game version: ${error.message}`);
        return null;
    }
}

/**
 * Load previously scanned confirmed max inventory data from disk, if present.
 * Discarded if it was scanned on a different game version than cache.getGameVersion(),
 * since a patch can change terminal capacities/locations and invalidate old data.
 * @param {Object} cache - DataCache instance (must have its game version set first)
 */
function loadConfirmedMaxInventory(cache) {
    let raw;
    try {
        raw = fs.readFileSync(MAX_INVENTORY_FILE, 'utf8');
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.info('No saved max inventory data found, will scan from scratch');
        } else {
            logger.warn(`Could not read ${MAX_INVENTORY_FILE}, will scan from scratch: ${error.message}`);
        }
        return;
    }

    let state;
    try {
        state = JSON.parse(raw);
    } catch (error) {
        logger.warn(`Saved max inventory data is corrupted, will scan from scratch: ${error.message}`);
        return;
    }

    const currentVersion = cache.getGameVersion();

    if (currentVersion && state.gameVersion && state.gameVersion !== currentVersion) {
        logger.info(`Discarding saved max inventory data (scanned on game version ${state.gameVersion}, current live version is ${currentVersion})`);
        return;
    }

    cache.importMaxInventoryState(state);
    if (!currentVersion && state.gameVersion) {
        // Couldn't verify the live version this run (e.g. API unavailable) - keep the
        // file's existing tag instead of losing it to a null on the next save.
        cache.setGameVersion(state.gameVersion);
    }

    const pairCount = Object.keys(state.data || {}).length;
    logger.info(`Loaded confirmed max inventory from disk (${pairCount} pairs, cursor ${state.cursor || 0}, complete=${!!state.complete}, game version ${state.gameVersion || 'unknown'})`);
}

/**
 * Persist the current confirmed max inventory scan state to disk.
 * Writes to a temp file and renames into place so a crash mid-write cannot
 * leave the target truncated (rename is atomic on POSIX).
 * Pretty-printed with 2-space indent so CI-committed diffs are reviewable.
 * @param {Object} cache - DataCache instance
 */
function saveConfirmedMaxInventory(cache) {
    const tempFile = `${MAX_INVENTORY_FILE}.tmp`;
    try {
        fs.writeFileSync(tempFile, JSON.stringify(cache.exportMaxInventoryState(), null, 2));
        fs.renameSync(tempFile, MAX_INVENTORY_FILE);
    } catch (error) {
        logger.warn(`Failed to save max inventory data: ${error.message}`);
        try { fs.unlinkSync(tempFile); } catch { /* nothing to clean up */ }
    }
}

/**
 * Process one batch of the commodity+terminal price history scan, replacing
 * estimated max SCU values with confirmed ones (the highest stock actually
 * observed in the last ~30 days). Remembers its position via the cache's
 * cursor and persists results to disk after every batch, so callers can call
 * this repeatedly (in a tight loop, or spread over time) and safely stop or
 * resume at any point without redoing work already done.
 * @param {Object} config - Configuration object
 * @param {Object} cache - DataCache instance
 * @returns {Promise<{complete: boolean, cursor: number, total: number, failures: number}>}
 *   Scan progress. `failures` counts pairs in this batch that couldn't be fetched
 *   (network error, HTTP 5xx after retries, etc); the standalone scanner
 *   aggregates these across the whole run so a transient UEX outage doesn't
 *   silently produce a mostly-empty file.
 */
async function refreshConfirmedMaxInventory(config, cache) {
    const cachedData = cache.getData();
    if (!cachedData) {
        // Data hasn't been loaded yet - not done, just not ready. Distinct from an
        // empty pair list below, which really does mean "nothing to scan."
        return { complete: false, cursor: cache.getMaxInventoryCursor(), total: 0, failures: 0 };
    }

    const pairs = [...new Set(cachedData.data.map(item => `${item.id_commodity}_${item.id_terminal}`))];

    if (cache.isMaxInventoryScanComplete() || pairs.length === 0) {
        return { complete: true, cursor: cache.getMaxInventoryCursor(), total: pairs.length, failures: 0 };
    }

    const cursor = cache.getMaxInventoryCursor();
    if (cursor >= pairs.length) {
        cache.setMaxInventoryScanComplete(true);
        saveConfirmedMaxInventory(cache);
        logger.info(`Confirmed max inventory scan complete (${pairs.length} pairs)`);
        return { complete: true, cursor, total: pairs.length, failures: 0 };
    }

    const batchKeys = pairs.slice(cursor, cursor + CONFIRMED_MAX_BATCH_SIZE);
    let failures = 0;

    await Promise.all(batchKeys.map(async key => {
        const [idCommodity, idTerminal] = key.split('_').map(Number);

        try {
            const resp = await uexApi.fetchStockHistory(idCommodity, idTerminal, config);
            if (!resp || !Array.isArray(resp.data) || resp.data.length === 0) return;

            const maxSell = Math.max(...resp.data.map(r => Number(r.scu_sell_stock) || 0));
            const maxBuy = Math.max(...resp.data.map(r => Number(r.scu_buy) || 0));

            if (maxSell > 0) cache.setConfirmedMax(key, 'sell', maxSell);
            if (maxBuy > 0) cache.setConfirmedMax(key, 'buy', maxBuy);
        } catch (error) {
            failures += 1;
            logger.debug(`Failed to fetch stock history for ${key}: ${error.message}`);
        }
    }));

    const newCursor = cursor + batchKeys.length;
    cache.setMaxInventoryCursor(newCursor);

    const complete = newCursor >= pairs.length;
    if (complete) {
        cache.setMaxInventoryScanComplete(true);
        logger.info(`Confirmed max inventory scan complete (${pairs.length} pairs)`);
    }

    saveConfirmedMaxInventory(cache);

    return { complete, cursor: newCursor, total: pairs.length, failures };
}

/**
 * Process solar systems data
 * @param {Object} rawData - Raw API response
 * @returns {Object} Processed systems data
 */
function processSolarSystems(rawData) {
    if (!rawData || !Array.isArray(rawData.data)) {
        logger.warn('Invalid solar systems data structure');
        return {};
    }

    return rawData.data.reduce((acc, item) => {
        if (item && item.id && item.name && item.code) {
            acc[item.id] = { name: item.name, code: item.code };
        }
        return acc;
    }, {});
}

/**
 * Process terminals data
 * @param {Object} rawData - Raw API response
 * @returns {Object} Processed terminals data
 */
function processTerminals(rawData) {
    if (!rawData || !Array.isArray(rawData.data)) {
        logger.warn('Invalid terminals data structure');
        return {};
    }

    return rawData.data.reduce((acc, item) => {
        if (item && item.nickname && item.id_star_system) {
            acc[item.nickname] = item.id_star_system;
        }
        return acc;
    }, {});
}

/**
 * Initialize systems and terminals data
 * @param {Object} config - Configuration object
 * @param {Object} cache - DataCache instance
 * @returns {Promise<void>}
 */
async function initializeData(config, cache) {
    try {
        logger.info('Fetching initialization data...');

        const [systemsResp, terminalsResp] = await Promise.all([
            uexApi.fetchSolarSystems(config),
            uexApi.fetchTerminals(config)
        ]);

        const systems = processSolarSystems(systemsResp);
        const terminals = processTerminals(terminalsResp);

        const mergedDict = [];
        Object.entries(terminals).forEach(([key, value]) => {
            mergedDict[key] = systems[value];
        });

        cache.setInitData(mergedDict);
        logger.info('Initialization data processed successfully');
    } catch (error) {
        logger.error('Failed to fetch init data:', error);
        throw error;
    }
}

/**
 * Get unique commodity names
 * @param {Object} cache - DataCache instance
 * @returns {Array<string>} Array of commodity names
 */
function getCommodities(cache) {
    cache.clearProfit();
    const data = cache.getData();
    return [...new Set(data.data.map(item => item.commodity_name))];
}

/**
 * Generate sell price data organized by commodity
 * @param {Object} cache - DataCache instance
 * @returns {Object} Commodities with sell data
 */
function generateSellData(cache) {
    const commodities = {};
    const cachedData = cache.getData();
    const cachedInitData = cache.getInitData();

    cachedData.data.forEach(item => {
        const { commodity_name, container_sizes, terminal_name, price_sell, price_sell_avg, scu_sell_stock, scu_sell_stock_avg, status_sell, date_modified, id_commodity, id_terminal } = item;

        let system = cachedInitData?.[terminal_name]?.code ?? '(?) ';
        if (system !== '(?) ') system = '(' + system + ') ';

        if (price_sell === 0) return;

        if (!commodities[commodity_name]) {
            commodities[commodity_name] = [];
        }

        const confirmedMax = cache.getConfirmedMax(`${id_commodity}_${id_terminal}`, 'sell');

        commodities[commodity_name].push({
            terminal_name: system + terminal_name,
            container_sizes,
            price_sell: price_sell > 0 ? price_sell : null,
            price_sell_avg: price_sell_avg > 0 ? price_sell_avg : null,
            scu_sell: scu_sell_stock > 0 ? scu_sell_stock : null,
            scu_sell_avg: scu_sell_stock_avg > 0 ? scu_sell_stock_avg : null,
            scu_sell_max: confirmedMax ?? estimateMaxInventory(scu_sell_stock, status_sell),
            scu_sell_max_is_estimate: confirmedMax === undefined,
            date_modified,
        });
    });

    return commodities;
}

/**
 * Generate buy price data organized by commodity
 * @param {Object} cache - DataCache instance
 * @returns {Object} Commodities with buy data
 */
function generateBuyData(cache) {
    const commodities = {};
    const cachedData = cache.getData();
    const cachedInitData = cache.getInitData();

    cachedData.data.forEach(item => {
        const { commodity_name, container_sizes, terminal_name, price_buy, price_buy_avg, scu_buy, scu_buy_avg, status_buy, date_modified, id_commodity, id_terminal } = item;

        let system = cachedInitData?.[terminal_name]?.code ?? '(?) ';
        if (system !== '(?) ') system = '(' + system + ') ';

        if (price_buy === 0) return;

        if (!commodities[commodity_name]) {
            commodities[commodity_name] = [];
        }

        const confirmedMax = cache.getConfirmedMax(`${id_commodity}_${id_terminal}`, 'buy');

        commodities[commodity_name].push({
            terminal_name: system + terminal_name,
            container_sizes,
            price_buy: price_buy > 0 ? price_buy : null,
            price_buy_avg: price_buy_avg > 0 ? price_buy_avg : null,
            scu_buy: scu_buy > 0 ? scu_buy : null,
            scu_buy_avg: scu_buy_avg > 0 ? scu_buy_avg : null,
            scu_buy_max: confirmedMax ?? estimateMaxInventory(scu_buy, status_buy),
            scu_buy_max_is_estimate: confirmedMax === undefined,
            date_modified,
        });
    });

    return commodities;
}

module.exports = {
    refreshData,
    refreshConfirmedMaxInventory,
    loadConfirmedMaxInventory,
    fetchLiveGameVersion,
    initializeData,
    getCommodities,
    generateSellData,
    generateBuyData
};
