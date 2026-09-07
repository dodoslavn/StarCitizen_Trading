/**
 * Market Depth View
 * Renders commodity-level market overview: total supply, demand, margin, and potential
 */

const { readable_number, escapeHtml } = require('../utils/formatters.js');

/**
 * Pick a CSS class for a row based on its rank position (0-indexed).
 * Top rows get a brighter highlight; the rest are neutral.
 * @param {number} rank
 * @param {number} total
 * @returns {string}
 */
function rankClass(rank, total) {
    const frac = rank / total;
    if (rank < 3) return 'md-top';
    if (frac < 0.25) return 'md-high';
    if (frac < 0.55) return 'md-mid';
    return '';
}

/**
 * Generate the Market Depth section HTML
 * @param {Array} depth - Output of trading.generateMarketDepth()
 * @returns {string} HTML
 */
function marketDepth(depth) {
    if (!depth || depth.length === 0) return '';

    const rows = depth.map((item, i) => {
        const cls = rankClass(i, depth.length);
        const rowAttr = cls ? ` class="${cls}"` : '';
        const name = escapeHtml(item.commodity);

        const bottleneck = item.totalBuySCU < item.totalSellSCU ? 'supply' : 'demand';
        const bottleneckTitle = `Bottleneck: ${bottleneck}. Buy supply: ${readable_number(item.totalBuySCU)} SCU across ${item.buyTerminals} terminal${item.buyTerminals !== 1 ? 's' : ''}. Sell demand: ${readable_number(item.totalSellSCU)} SCU across ${item.sellTerminals} terminal${item.sellTerminals !== 1 ? 's' : ''}.`;

        return `<tr${rowAttr}>
            <td class="text-left"><a href="#comm-${name}">${name}</a></td>
            <td title="${item.buyTerminals} terminal${item.buyTerminals !== 1 ? 's' : ''}">${readable_number(item.totalBuySCU)} SCU</td>
            <td title="${item.sellTerminals} terminal${item.sellTerminals !== 1 ? 's' : ''}">${readable_number(item.totalSellSCU)} SCU</td>
            <td title="${escapeHtml(bottleneckTitle)}">${readable_number(item.tradeableSCU)} SCU</td>
            <td>${readable_number(item.margin)} aUEC/SCU</td>
            <td class="md-potential">${readable_number(item.marketPotential)} aUEC</td>
        </tr>`;
    }).join('');

    return `<div id="market-depth">
        <table class="market-depth">
            <thead>
                <tr>
                    <th colspan="6" class="md-title">Market Depth</th>
                </tr>
                <tr>
                    <th class="text-left">Commodity</th>
                    <th title="Total SCU you can buy right now across all terminals">Total Supply</th>
                    <th title="Total SCU you can sell right now across all terminals">Total Demand</th>
                    <th title="How much you can actually trade — limited by the smaller side">Tradeable</th>
                    <th title="Best sell price minus best buy price">Best Margin</th>
                    <th title="Tradeable SCU × best margin — total market opportunity">Market Potential</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    </div>`;
}

module.exports = { marketDepth };
