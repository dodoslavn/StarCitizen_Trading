/**
 * UEX API Service
 * Handles all API calls to UEX Corp
 */

const logger = require('../logger.js');

/**
 * Build full API URL from config
 * @param {Object} config - Configuration object
 * @param {string} endpointKey - Key from config.api.endpoints
 * @returns {string} Full URL
 */
function buildApiUrl(config, endpointKey) {
    return config.api.base_url + config.api.endpoints[endpointKey];
}

/**
 * Download JSON data from URL with retry logic and timeout
 * @param {string} url - The URL to fetch from
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} The parsed JSON data
 * @throws {Error} If fetch fails after all retries
 */
async function downloadJson(url, config) {
    const maxRetries = config.api.retries || 3;
    const timeout = config.api.timeout || 10000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            logger.debug(`Fetching ${url} (attempt ${attempt}/${maxRetries})`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const result = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!result.ok) {
                throw new Error(`HTTP ${result.status}: ${result.statusText}`);
            }

            const data = await result.json();
            logger.debug(`Successfully fetched ${url}`);
            return data;

        } catch (error) {
            logger.warn(`Fetch attempt ${attempt} failed for ${url}: ${error.message}`);

            if (attempt === maxRetries) {
                logger.error(`All ${maxRetries} attempts failed for ${url}`);
                throw error;
            }

            // Exponential backoff
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
            logger.debug(`Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * Fetch commodity prices from UEX API
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} Prices data
 */
async function fetchPrices(config) {
    const url = buildApiUrl(config, 'prices_all');
    return await downloadJson(url, config);
}

/**
 * Fetch solar systems data from UEX API
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} Systems data
 */
async function fetchSolarSystems(config) {
    const url = buildApiUrl(config, 'solar_systems_all');
    return await downloadJson(url, config);
}

/**
 * Fetch terminals data from UEX API
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} Terminals data
 */
async function fetchTerminals(config) {
    const url = buildApiUrl(config, 'terminals_all');
    return await downloadJson(url, config);
}

module.exports = {
    fetchPrices,
    fetchSolarSystems,
    fetchTerminals
};
