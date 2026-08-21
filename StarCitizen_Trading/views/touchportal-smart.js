/**
 * Smart Routes Interface Module
 *
 * Route ranking that accounts for data-age confidence, ship/wallet
 * constraints, travel+loading time, and system risk - built incrementally
 * per docs/smart-routes-plan.md.
 *
 * Milestone 2 (current): ranks routes by profit discounted for how stale
 * the underlying buy/sell data is, so month-old ghost quotes don't
 * dominate the list the way they do on the legacy /touchportal/{scu} page.
 * Ship/wallet constraints, travel time, and risk land in later milestones.
 */

const { shell } = require('./touchportal.js');
const { escapeHtml, readable_number, dataAgeConfidence } = require('../utils/formatters.js');

const MAX_ROUTES_SHOWN = 30;

/**
 * Build every viable buy/sell route pair for the currently cached data and
 * rank by discounted profit. Mirrors calculateBestRoutes in touchportal.js
 * (same O(sellRows x buyRows) per-commodity pairing) but works off the
 * live/current fields (price_sell, price_buy, scu_sell_stock, scu_buy)
 * rather than rolling averages, since each route's confidence is tied to a
 * single date_modified timestamp per side.
 * @param {Object} cache - Data cache instance
 * @returns {Array} Routes sorted by discountedProfit desc, capped at MAX_ROUTES_SHOWN
 */
function calculateSmartRoutes(cache) {
    const cachedData = cache.getData();
    const cachedInitData = cache.getInitData();
    const routes = [];

    // scu_sell_stock is the terminal's real current inventory (what you can
    // buy from them); scu_buy is a player-reported transaction size (the
    // only "current" figure UEX exposes for the buy side - see CLAUDE.md).
    const sellRows = cachedData.data.filter(t => t.price_sell > 0 && t.scu_sell_stock > 0);
    const buyRows = cachedData.data.filter(t => t.price_buy > 0 && t.scu_buy > 0);

    sellRows.forEach(sell => {
        buyRows.forEach(buy => {
            if (sell.commodity_name !== buy.commodity_name) return;

            const priceDelta = sell.price_sell - buy.price_buy;
            if (priceDelta <= 0) return;

            const amount = Math.min(sell.scu_sell_stock, buy.scu_buy);
            if (amount <= 0) return;

            const rawProfit = priceDelta * amount;
            const confidence = Math.min(
                dataAgeConfidence(sell.date_modified),
                dataAgeConfidence(buy.date_modified)
            );

            routes.push({
                commodity: sell.commodity_name,
                buyTerminal: buy.terminal_name,
                buyCode: cachedInitData?.[buy.terminal_name]?.code || '?',
                sellTerminal: sell.terminal_name,
                sellCode: cachedInitData?.[sell.terminal_name]?.code || '?',
                priceDelta,
                amount,
                rawProfit,
                confidence,
                discountedProfit: rawProfit * confidence
            });
        });
    });

    return routes.sort((a, b) => b.discountedProfit - a.discountedProfit).slice(0, MAX_ROUTES_SHOWN);
}

/**
 * Map a confidence multiplier to a short label + colour for the badge.
 * Tiers line up with dataAgeConfidence's own thresholds (1d / 7d / 30d).
 * @param {number} confidence - 0.05 - 1.0
 * @returns {{label: string, color: string}}
 */
function confidenceBadge(confidence) {
    if (confidence >= 1.0) return { label: 'Fresh', color: '#8fd68f' };
    if (confidence >= 0.7) return { label: 'Recent', color: '#c2e08a' };
    if (confidence >= 0.3) return { label: 'Aging', color: '#ffb366' };
    return { label: 'Stale', color: '#ff8080' };
}

/**
 * Generate the smart routes page.
 * @param {Object} cache - Data cache instance
 * @param {Object} query - Parsed query-string params (ship, wallet, sort, etc. - unused until M3+)
 * @returns {string} Complete HTML page
 */
function touchportalSmart(cache, query = {}) {
    if (!cache.hasData()) {
        const body = `
        <a class="back-hub" href="/touchportal">&larr; Hub</a>
        <h2>Smart Routes</h2>
        <p style="text-align: center; color: #888;">Waiting for commodity data to load...</p>`;
        return shell('Smart Routes', body, false);
    }

    const routes = calculateSmartRoutes(cache);

    const rows = routes.map(r => {
        const badge = confidenceBadge(r.confidence);
        return `
        <tr>
            <td>${escapeHtml(r.commodity)}</td>
            <td>(${escapeHtml(r.buyCode)}) ${escapeHtml(r.buyTerminal)}</td>
            <td>(${escapeHtml(r.sellCode)}) ${escapeHtml(r.sellTerminal)}</td>
            <td>${readable_number(r.priceDelta)} aUEC</td>
            <td>${readable_number(r.amount)} SCU</td>
            <td title="Raw profit before confidence discount: ${readable_number(r.rawProfit)} aUEC">${readable_number(Math.round(r.discountedProfit))} aUEC</td>
            <td><span style="color: ${badge.color};">${badge.label}</span></td>
        </tr>`;
    }).join('');

    const queryDebug = Object.keys(query).length
        ? `<p style="text-align: center; color: #444; font-size: 0.8rem;">query: ${escapeHtml(JSON.stringify(query))} (not applied yet - lands in a later milestone)</p>`
        : '';

    const body = `
    <a class="back-hub" href="/touchportal">&larr; Hub</a>
    <h2>Smart Routes</h2>
    <p style="text-align: center; color: #888;">Ranked by profit, discounted for how old the underlying price data is. Ship, wallet, and travel time filters land in later milestones.</p>
    ${queryDebug}
    <table>
        <tr>
            <th>Commodity</th>
            <th>Buy at</th>
            <th>Sell at</th>
            <th>&Delta;</th>
            <th>Amount</th>
            <th title="Raw profit x confidence multiplier">Discounted profit</th>
            <th>Confidence</th>
        </tr>
        ${rows || '<tr><td colspan="7">No routes available</td></tr>'}
    </table>`;

    return shell('Smart Routes', body, true);
}

module.exports = {
    touchportalSmart,
    calculateSmartRoutes,
    confidenceBadge
};
