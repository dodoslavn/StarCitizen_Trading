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

module.exports = {
    readable_number
};
