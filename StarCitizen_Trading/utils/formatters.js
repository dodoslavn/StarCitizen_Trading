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

module.exports = {
    readable_number,
    getStalenessLevel,
    formatDateTime
};
