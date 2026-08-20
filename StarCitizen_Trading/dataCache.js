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
        this.confirmedMaxInventory = {};
        this.maxInventoryCursor = 0;
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
     * Record a confirmed max SCU value observed in a terminal+commodity's price history
     * @param {string} key - "idCommodity_idTerminal"
     * @param {'sell'|'buy'} side - Which side this max applies to
     * @param {number} value - The confirmed max SCU value
     */
    setConfirmedMax(key, side, value) {
        if (!this.confirmedMaxInventory[key]) this.confirmedMaxInventory[key] = {};
        this.confirmedMaxInventory[key][side] = value;
    }

    /**
     * Get the confirmed max SCU value for a terminal+commodity, if one has been observed
     * @param {string} key - "idCommodity_idTerminal"
     * @param {'sell'|'buy'} side - Which side to look up
     * @returns {number|undefined} The confirmed max value, or undefined if never observed
     */
    getConfirmedMax(key, side) {
        return this.confirmedMaxInventory[key]?.[side];
    }

    /**
     * Get the cursor position for the background history scan (which batch to process next)
     * @returns {number} Current cursor position
     */
    getMaxInventoryCursor() {
        return this.maxInventoryCursor;
    }

    /**
     * Advance the cursor position for the background history scan
     * @param {number} value - New cursor position
     */
    setMaxInventoryCursor(value) {
        this.maxInventoryCursor = value;
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
