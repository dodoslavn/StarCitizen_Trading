/**
 * Profit Tables Module
 * Generates best profit summaries
 */

const { readable_number, escapeHtml } = require('../utils/formatters.js');

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
        const name = escapeHtml(item.commodity);
        return `<tr>
            <td><a href="#comm-${name}">${name}</a></td>
            <td>${readable_number(item.profit_uec_real)} (up to ${readable_number(item.profit_uec)})</td>
        </tr>`;
    }).join('');

    return '<table class="best">' + header + data + '</table>' +
        '<div style="text-align: center; margin-top: 1rem;">' +
        '<a class="about-link" href="/about">About this website</a>' +
        '<br>' +
        '<a class="about-link" href="/touchportal">TouchPortal interface</a>' +
        '</div>';
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
        const name = escapeHtml(item.commodity);
        return `<tr>
            <td><a href="#comm-${name}">${name}</a></td>
            <td>${escapeHtml(item.profit_perc_real)} (up to ${escapeHtml(item.profit_perc)})</td>
        </tr>`;
    }).join('');

    return '<table class="best">' + header + data + '</table>';
}

module.exports = {
    profit_uec,
    profit_perc
};
