/**
 * TouchPortal Market Depth Page
 * All commodities ranked by total market potential (tradeable SCU × best margin)
 */

const { readable_number, escapeHtml } = require('../utils/formatters.js');
const { shell } = require('./touchportal.js');

/**
 * Generate the market depth TouchPortal page.
 * @param {Array} depth - Output of trading.generateMarketDepth()
 * @returns {string} Complete HTML page
 */
function touchportalMarket(depth) {
    const rows = depth.map((item, i) => {
        const name = escapeHtml(item.commodity);
        const buyMaxStr = item.buyMax > 0 ? ` / ${readable_number(item.buyMax)}` : '';
        const sellMaxStr = item.sellMax > 0 ? ` / ${readable_number(item.sellMax)}` : '';
        const tradeableMaxStr = item.tradeableMax > 0 ? ` / ${readable_number(item.tradeableMax)}` : '';
        const potentialMaxStr = item.potentialMax > 0 ? ` / ${readable_number(item.potentialMax)}` : '';

        const rowStyle = i < 3 ? ' style="color: #7ecf7e;"' : (i < Math.ceil(depth.length * 0.25) ? ' style="color: #b0d4a0;"' : '');

        return `<tr${rowStyle}>
            <td><a href="/#comm-${name}">${name}</a></td>
            <td title="${item.buyTerminals} terminal${item.buyTerminals !== 1 ? 's' : ''}">${readable_number(item.buyCurrent)}${buyMaxStr}</td>
            <td title="${item.sellTerminals} terminal${item.sellTerminals !== 1 ? 's' : ''}">${readable_number(item.sellCurrent)}${sellMaxStr}</td>
            <td>${readable_number(item.tradeableCurrent)}${tradeableMaxStr}</td>
            <td>${readable_number(item.margin)}</td>
            <td>${readable_number(item.potentialCurrent)}${potentialMaxStr}</td>
        </tr>`;
    }).join('');

    const body = `
    <div id="top">
        <a href="/touchportal" style="background-color: #006fdd;">← Hub</a>
    </div>
    <h2>Market Depth</h2>
    <p style="text-align:center; color:#888; margin-top:-0.5rem; font-size:0.85rem;">All commodities ranked by current market potential. SCU columns: current / max.</p>
    <table>
        <tr>
            <th>Commodity</th>
            <th title="Total SCU you can buy across all terminals">Supply SCU</th>
            <th title="Total SCU demand across all sell terminals">Demand SCU</th>
            <th title="min(supply, demand) — how much you can actually trade">Tradeable SCU</th>
            <th title="Best sell price minus best buy price">Margin aUEC/SCU</th>
            <th title="Tradeable SCU × margin — total market size">Potential aUEC</th>
        </tr>
        ${rows || '<tr><td colspan="6">No data available</td></tr>'}
    </table>`;

    return shell('Market Depth', body, true);
}

module.exports = { touchportalMarket };
