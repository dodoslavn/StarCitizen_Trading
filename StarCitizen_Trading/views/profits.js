/**
 * Profit Tables Module
 * Generates best profit summaries
 */

const { readable_number } = require('../utils/formatters.js');

/**
 * Generate profit table sorted by aUEC
 * @param {Object} cache - Data cache instance
 * @returns {string} HTML table
 */
function profit_uec(cache) {
    const profit = cache.getProfit();
    const profit_sorted = profit.sort((a, b) => b.profit_uec - a.profit_uec);

    const header = '<tr><th>Commodity</th><th>Profit aUEC/SCU</th></tr>';
    const data = profit_sorted.map(item => {
        return `<tr>
            <td><a href="#comm-${item.commodity}">${item.commodity}</a></td>
            <td>${readable_number(item.profit_uec_real)} (up to ${readable_number(item.profit_uec)})</td>
        </tr>`;
    }).join('');

    return '<table class="best">' + header + data + '</table> <br> ' +
        '<a class="about-link" href="/about">About this website</a>';
}

/**
 * Generate profit table sorted by percentage
 * @param {Object} cache - Data cache instance
 * @returns {string} HTML table
 */
function profit_perc(cache) {
    const profit = cache.getProfit();
    const profit_sorted = profit.sort((a, b) => b.profit_perc - a.profit_perc);

    const header = '<tr><th>Commodity</th><th>Profit %</th></tr>';
    const data = profit_sorted.map(item => {
        return `<tr>
            <td><a href="#comm-${item.commodity}">${item.commodity}</a></td>
            <td>${item.profit_perc_real} (up to ${item.profit_perc})</td>
        </tr>`;
    }).join('');

    return '<table class="best">' + header + data + '</table>';
}

module.exports = {
    profit_uec,
    profit_perc
};
