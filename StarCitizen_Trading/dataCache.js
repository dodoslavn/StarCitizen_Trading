/**
 * DataCache - Manages cached trading data from UEX API
 * Replaces global variables with a clean class-based approach
 */
class DataCache {
    constructor() {
        this.cachedData = null;
        this.cachedInitData = null;
        this.profit = [];
        this.lastUpdate = null;
        this.maxInventory = {};
    }

    /**
     * Set the main commodities data
     * @param {Object} data - The commodities price data from API
     */
    setData(data) {
        this.cachedData = data;
        this.lastUpdate = new Date();
    }

    /**
     * Get the cached commodities data
     * @returns {Object|null} The cached data or null if not set
     */
    getData() {
        return this.cachedData;
    }

    /**
     * Set the initialization data (systems and terminals)
     * @param {Object} data - The merged systems/terminals data
     */
    setInitData(data) {
        this.cachedInitData = data;
    }

    /**
     * Get the cached init data
     * @returns {Object|null} The cached init data or null if not set
     */
    getInitData() {
        return this.cachedInitData;
    }

    /**
     * Reset profit calculations
     */
    clearProfit() {
        this.profit = [];
    }

    /**
     * Add a profit entry
     * @param {Object} profitData - The profit data to add
     */
    addProfit(profitData) {
        if (profitData && typeof profitData === 'object') {
            this.profit.push(profitData);
        }
    }

    /**
     * Get all profit calculations
     * @returns {Array} Array of profit data
     */
    getProfit() {
        return this.profit;
    }

    /**
     * Set the max SCU inventory data (historical buy/sell max per commodity+terminal)
     * @param {Object} data - Map keyed by "idCommodity_idTerminal" -> { scu_buy_max, scu_sell_max }
     */
    setMaxInventory(data) {
        this.maxInventory = data;
    }

    /**
     * Get the max SCU inventory data
     * @returns {Object} Map keyed by "idCommodity_idTerminal" -> { scu_buy_max, scu_sell_max }
     */
    getMaxInventory() {
        return this.maxInventory;
    }

    /**
     * Check if cache has valid data
     * @returns {boolean} True if data is present
     */
    hasData() {
        return this.cachedData !== null && this.cachedInitData !== null;
    }

    /**
     * Get cache age in milliseconds
     * @returns {number|null} Age in ms or null if no data
     */
    getCacheAge() {
        if (!this.lastUpdate) return null;
        return Date.now() - this.lastUpdate.getTime();
    }
}

module.exports = DataCache;
