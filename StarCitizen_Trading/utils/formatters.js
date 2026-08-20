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
 * Check whether a UEX `date_modified` timestamp is older than a threshold
 * @param {number} unixTimestampSeconds - Unix timestamp (seconds) from the API
 * @param {number} thresholdMinutes - Age in minutes after which data is considered stale
 * @returns {boolean} True if the timestamp is older than the threshold
 */
function isStale(unixTimestampSeconds, thresholdMinutes) {
    if (!unixTimestampSeconds) return false;
    const ageMs = Date.now() - (unixTimestampSeconds * 1000);
    return ageMs > thresholdMinutes * 60 * 1000;
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
    isStale,
    formatDateTime
};
