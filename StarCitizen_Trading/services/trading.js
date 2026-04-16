/**
 * Trading Service
 * Business logic for trading data processing and calculations
 */

const logger = require('../logger.js');
const uexApi = require('./uexApi.js');

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
        const { commodity_name, container_sizes, terminal_name, price_sell, price_sell_avg, scu_sell, scu_sell_avg } = item;

        let system = cachedInitData?.[terminal_name]?.code ?? '(?) ';
        if (system !== '(?) ') system = '(' + system + ') ';

        if (price_sell === 0) return;

        if (!commodities[commodity_name]) {
            commodities[commodity_name] = [];
        }

        commodities[commodity_name].push({
            terminal_name: system + terminal_name,
            container_sizes,
            price_sell: price_sell > 0 ? price_sell : null,
            price_sell_avg: price_sell_avg > 0 ? price_sell_avg : null,
            scu_sell: scu_sell > 0 ? scu_sell : null,
            scu_sell_avg: scu_sell_avg > 0 ? scu_sell_avg : null,
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
        const { commodity_name, container_sizes, terminal_name, price_buy, price_buy_avg, scu_buy, scu_buy_avg } = item;

        let system = cachedInitData?.[terminal_name]?.code ?? '(?) ';
        if (system !== '(?) ') system = '(' + system + ') ';

        if (price_buy === 0) return;

        if (!commodities[commodity_name]) {
            commodities[commodity_name] = [];
        }

        commodities[commodity_name].push({
            terminal_name: system + terminal_name,
            container_sizes,
            price_buy: price_buy > 0 ? price_buy : null,
            price_buy_avg: price_buy_avg > 0 ? price_buy_avg : null,
            scu_buy: scu_buy > 0 ? scu_buy : null,
            scu_buy_avg: scu_buy_avg > 0 ? scu_buy_avg : null,
        });
    });

    return commodities;
}

module.exports = {
    refreshData,
    initializeData,
    getCommodities,
    generateSellData,
    generateBuyData
};
