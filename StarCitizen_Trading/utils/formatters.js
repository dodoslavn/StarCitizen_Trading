/**
 * Number Formatting Utilities
 */

/**
 * Format number with thousand separators
 * @param {number|string} num - Number to format
 * @returns {string} Formatted number
 */
function readable_number(num) {
    if (num === '-') return num;
    return new Intl.NumberFormat('en-US', { useGrouping: true })
        .format(num)
        .replace(/,/g, ' ');
}

/**
 * Classify how stale a UEX `date_modified` timestamp is
 * @param {number} unixTimestampSeconds - Unix timestamp (seconds) from the API
 * @param {Object} thresholds - Staleness thresholds in minutes
 * @param {number} thresholds.stale - Age after which data is considered stale
 * @param {number} thresholds.veryStale - Age after which data is considered very stale
 * @returns {'fresh'|'stale'|'very-stale'} Staleness level
 */
function getStalenessLevel(unixTimestampSeconds, thresholds) {
    if (!unixTimestampSeconds) return 'fresh';
    const ageMinutes = (Date.now() - (unixTimestampSeconds * 1000)) / 60000;
    if (ageMinutes > thresholds.veryStale) return 'very-stale';
    if (ageMinutes > thresholds.stale) return 'stale';
    return 'fresh';
}

/**
 * Format a UEX unix timestamp (seconds) as a readable UTC date/time
 * @param {number} unixTimestampSeconds - Unix timestamp (seconds) from the API
 * @returns {string} Formatted date/time, or 'Unknown' if not available
 */
function formatDateTime(unixTimestampSeconds) {
    if (!unixTimestampSeconds) return 'Unknown';
    return new Date(unixTimestampSeconds * 1000).toLocaleString('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }) + ' UTC';
}

/**
 * UEX stock status is an 8-tier scale (0-7). 0 means out of stock (no estimate
 * possible); 7 is treated as effectively full (100%). The rest are spaced
 * linearly between them, so tier N represents N/7 of capacity.
 */
const STOCK_STATUS_MAX_TIER = 7;

/**
 * Estimate a terminal's max SCU capacity from its current stock and stock status tier
 * @param {number} currentStock - Current SCU stock (scu_sell_stock or scu_buy)
 * @param {number} status - UEX stock status tier (0-7)
 * @returns {number} Estimated max capacity, or the current stock if no estimate is possible
 */
function estimateMaxInventory(currentStock, status) {
    if (!currentStock) return 0;
    if (!status) return currentStock;
    const fraction = Math.min(status, STOCK_STATUS_MAX_TIER) / STOCK_STATUS_MAX_TIER;
    return Math.round(currentStock / fraction);
}

/**
 * Format a UEX `container_sizes` string into a readable SCU box size list
 * @param {string} containerSizes - Comma-separated SCU box sizes, e.g. "1,2,4,8,16,24,32"
 * @returns {string} Formatted list, e.g. "1, 2, 4, 8, 16, 24, 32 SCU", or 'Unknown' if not available
 */
function formatContainerSizes(containerSizes) {
    if (!containerSizes) return 'Unknown';
    return containerSizes.split(',').join(', ') + ' SCU';
}

module.exports = {
    readable_number,
    getStalenessLevel,
    formatDateTime,
    formatContainerSizes,
    estimateMaxInventory
};
