/**
 * Smart Routes Interface Module
 *
 * Route ranking that accounts for data-age confidence, ship/wallet
 * constraints, travel+loading time, and system risk - built incrementally
 * per docs/smart-routes-plan.md.
 *
 * Milestone 2: data-age confidence discount (see calculateSmartRoutes/
 * confidenceBadge history for that logic - unchanged here).
 * Milestone 3 (current): ship + wallet constraints. A route is only shown
 * if the chosen ship can physically reach both terminals and load/unload
 * there, and the traded amount is capped by wallet, ship SCU, terminal
 * stock, and terminal demand capacity. Adds Investment and ROI% columns
 * and a profit/ROI sort toggle.
 */

const { shell } = require('./touchportal.js');
const { escapeHtml, readable_number, dataAgeConfidence, estimateMaxInventory } = require('../utils/formatters.js');

const MAX_ROUTES_SHOWN = 30;

/**
 * Pick the ship to use for feasibility/capacity constraints: the one
 * matching shipSlug if it exists in the cached vehicle list, otherwise the
 * smallest-SCU ship as a conservative default (always feasible everywhere,
 * unlike a hardcoded slug that could vanish if UEX renames/removes a ship).
 * @param {Object} cache - Data cache instance
 * @param {string} shipSlug - Validated ship slug from the query string
 * @returns {Object|null} Ship object, or null if no vehicles are cached yet
 */
function resolveShip(cache, shipSlug) {
    const vehicles = cache.getVehicles();
    if (vehicles.length === 0) return null;
    const found = shipSlug ? vehicles.find(v => v.slug === shipSlug) : null;
    return found || vehicles[0]; // vehicles is sorted ascending by SCU
}

/**
 * Can this ship physically reach and use this terminal at all?
 * @param {Object} terminalInit - cachedInitData[terminal_name]
 * @param {Object} ship - { canLand, needsAutoLoad, ... }
 * @returns {boolean}
 */
function terminalReachable(terminalInit, ship) {
    // XL-pad / non-landing capital ships need either a space station or a
    // docking port - ground terminals without either are unreachable.
    if (!ship.canLand) {
        if (terminalInit?.space_station_name) return true;
        if (terminalInit?.has_docking_port) return true;
        return false;
    }
    // Ships that need auto-load can't function at manual-load terminals -
    // moving 400+ SCU by hand isn't practical.
    if (ship.needsAutoLoad && !terminalInit?.is_auto_load) return false;
    return true;
}

/**
 * Do the ship's accepted SCU box sizes overlap with what the terminal
 * accepts? Both are CSV strings like "1,2,4,8".
 * @param {string} shipSizesCsv - ship.container_sizes
 * @param {Object} terminalRow - raw commodity price row (has container_sizes)
 * @returns {boolean}
 */
function containerSizesCompatible(shipSizesCsv, terminalRow) {
    if (!shipSizesCsv || !terminalRow?.container_sizes) return true; // unknown -> assume ok
    const shipSizes = new Set(shipSizesCsv.split(',').map(s => s.trim()));
    return terminalRow.container_sizes.split(',').some(s => shipSizes.has(s.trim()));
}

/**
 * Build every viable buy/sell route pair, apply ship feasibility + capacity
 * constraints and wallet affordability, and rank by discounted profit or ROI.
 *
 * Field semantics (see CLAUDE.md "UEX field semantics" before touching this):
 *   sell row = acquisition terminal (player BUYS here, pays price_sell... )
 *   wait - see below: "sell" rows are where price_sell > 0, meaning the
 *   PLAYER SELLS there and RECEIVES price_sell (revenue/disposal terminal).
 *   "buy" rows are where price_buy > 0, meaning the PLAYER BUYS there and
 *   PAYS price_buy (cost/acquisition terminal). Profit = sell.price_sell
 *   (revenue) - buy.price_buy (cost). This matches the legacy
 *   calculateBestRoutes in touchportal.js - verified against UEX's own
 *   website, not backward.
 *
 * @param {Object} cache - Data cache instance
 * @param {Object} filters - { shipSlug, wallet, sort }
 * @returns {{routes: Array, ship: Object|null}} Ranked routes (capped at
 *   MAX_ROUTES_SHOWN) plus the resolved ship used for the constraints
 */
function calculateSmartRoutes(cache, filters = {}) {
    const { shipSlug = '', wallet = 0, sort = 'profit' } = filters;
    const ship = resolveShip(cache, shipSlug);

    const cachedData = cache.getData();
    const cachedInitData = cache.getInitData();
    const routes = [];

    const sellRows = cachedData.data.filter(t => t.price_sell > 0 && t.scu_sell_stock > 0);
    const buyRows = cachedData.data.filter(t => t.price_buy > 0 && t.scu_buy > 0);

    sellRows.forEach(sell => {
        buyRows.forEach(buy => {
            if (sell.commodity_name !== buy.commodity_name) return;

            const priceDelta = sell.price_sell - buy.price_buy; // revenue - cost
            if (priceDelta <= 0) return;

            const sellInit = cachedInitData?.[sell.terminal_name];
            const buyInit = cachedInitData?.[buy.terminal_name];

            if (ship) {
                if (!terminalReachable(sellInit, ship)) return;
                if (!terminalReachable(buyInit, ship)) return;
                if (!containerSizesCompatible(ship.container_sizes, sell)) return;
                if (!containerSizesCompatible(ship.container_sizes, buy)) return;
            }

            // How much stock is available to acquire at the sell terminal.
            const stockCap = sell.scu_sell_stock;

            // How much the buy (disposal) terminal can absorb before it's
            // full - same confirmed/estimated max logic as generateBuyData.
            const buyMaxRaw = cache.getConfirmedMax(`${buy.id_commodity}_${buy.id_terminal}`, 'buy')
                ?? estimateMaxInventory(buy.scu_buy, buy.status_buy);
            const demandCap = buyMaxRaw > 0 ? buyMaxRaw : Infinity;

            const shipCap = ship ? ship.scu : Infinity;
            const walletCap = wallet > 0 ? Math.floor(wallet / buy.price_buy) : Infinity;

            const amount = Math.min(stockCap, demandCap, shipCap, walletCap);
            if (amount <= 0) return;

            const rawProfit = priceDelta * amount;
            const confidence = Math.min(
                dataAgeConfidence(sell.date_modified),
                dataAgeConfidence(buy.date_modified)
            );
            const investment = amount * buy.price_buy;

            routes.push({
                commodity: sell.commodity_name,
                buyTerminal: buy.terminal_name,
                buyCode: buyInit?.code || '?',
                sellTerminal: sell.terminal_name,
                sellCode: sellInit?.code || '?',
                priceDelta,
                amount,
                rawProfit,
                confidence,
                discountedProfit: rawProfit * confidence,
                investment,
                roi: (priceDelta / buy.price_buy) * 100
            });
        });
    });

    const sortKey = sort === 'roi' ? 'roi' : 'discountedProfit';
    routes.sort((a, b) => b[sortKey] - a[sortKey]);

    return { routes: routes.slice(0, MAX_ROUTES_SHOWN), ship };
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
 * Render the ship <select>, grouped into rough SCU brackets since the
 * cached vehicle list runs 100+ ships.
 * @param {Array} vehicles - cache.getVehicles()
 * @param {Object|null} selectedShip - currently resolved ship
 * @returns {string}
 */
function renderShipOptions(vehicles, selectedShip) {
    const brackets = [
        { label: 'Small (< 50 SCU)', max: 50 },
        { label: 'Medium (50-150 SCU)', max: 150 },
        { label: 'Large (150-500 SCU)', max: 500 },
        { label: 'Very Large (500+ SCU)', max: Infinity }
    ];

    let cursor = 0;
    return brackets.map(bracket => {
        const options = [];
        while (cursor < vehicles.length && vehicles[cursor].scu < bracket.max) {
            const v = vehicles[cursor];
            const selected = selectedShip && v.slug === selectedShip.slug ? ' selected' : '';
            options.push(`<option value="${escapeHtml(v.slug)}"${selected}>${escapeHtml(v.name)} (${v.scu} SCU)</option>`);
            cursor += 1;
        }
        return options.length
            ? `<optgroup label="${escapeHtml(bracket.label)}">${options.join('')}</optgroup>`
            : '';
    }).join('');
}

/**
 * Generate the smart routes page.
 * @param {Object} cache - Data cache instance
 * @param {Object} filters - { shipSlug, wallet, sort } (already validated by the handler)
 * @returns {string} Complete HTML page
 */
function touchportalSmart(cache, filters = {}) {
    if (!cache.hasData()) {
        const body = `
        <a class="back-hub" href="/touchportal">&larr; Hub</a>
        <h2>Smart Routes</h2>
        <p style="text-align: center; color: #888;">Waiting for commodity data to load...</p>`;
        return shell('Smart Routes', body, false);
    }

    const { shipSlug = '', wallet = 0, sort = 'profit' } = filters;
    const { routes, ship } = calculateSmartRoutes(cache, filters);
    const vehicles = cache.getVehicles();

    const shipInfo = ship
        ? `Pad: ${escapeHtml(ship.pad_type || 'n/a')} &middot; Boxes: ${escapeHtml(ship.container_sizes || 'n/a')} SCU`
        : 'Vehicle data not loaded yet - showing unconstrained routes.';

    const rows = routes.map(r => {
        const badge = confidenceBadge(r.confidence);
        return `
        <tr>
            <td>${escapeHtml(r.commodity)}</td>
            <td>(${escapeHtml(r.buyCode)}) ${escapeHtml(r.buyTerminal)}</td>
            <td>(${escapeHtml(r.sellCode)}) ${escapeHtml(r.sellTerminal)}</td>
            <td>${readable_number(r.priceDelta)} aUEC</td>
            <td>${readable_number(r.amount)} SCU</td>
            <td>${readable_number(Math.round(r.investment))} aUEC</td>
            <td title="Raw profit before confidence discount: ${readable_number(r.rawProfit)} aUEC">${readable_number(Math.round(r.discountedProfit))} aUEC</td>
            <td>${r.roi.toFixed(1)}%</td>
            <td><span style="color: ${badge.color};">${badge.label}</span></td>
        </tr>`;
    }).join('');

    const walletQuery = wallet > 0 ? `&wallet=${wallet}` : '';
    const shipQuery = shipSlug ? `&ship=${encodeURIComponent(shipSlug)}` : '';
    const sortLink = targetSort => {
        const isActive = sort === targetSort;
        const style = isActive ? 'background-color: #4ab8ff; font-weight: bold;' : 'background-color: #006fdd;';
        const label = targetSort === 'roi' ? 'Sort by ROI' : 'Sort by profit';
        return `<a href="/touchportal/smart?sort=${targetSort}${shipQuery}${walletQuery}" style="${style}">${label}</a>`;
    };

    const body = `
    <a class="back-hub" href="/touchportal">&larr; Hub</a>
    <h2>Smart Routes</h2>
    <p style="text-align: center; color: #888;">Ranked by profit (discounted for data age) or ROI, filtered to routes your ship can actually fly and afford. Travel time and risk filters land in later milestones.</p>
    <div id="top">
        <div class="button-group">
            <form method="get" action="/touchportal/smart" style="display: inline-block;">
                <input type="hidden" name="sort" value="${escapeHtml(sort)}">
                <select name="ship" onchange="this.form.submit()" style="padding: 0.4rem; border-radius: 5px;">
                    ${renderShipOptions(vehicles, ship)}
                </select>
                <input type="number" name="wallet" placeholder="Wallet (aUEC, blank = unlimited)" value="${wallet > 0 ? wallet : ''}" min="0" style="padding: 0.4rem; border-radius: 5px; width: 14rem;">
                <button type="submit" style="padding: 0.4rem 0.8rem; border-radius: 5px; background-color: #006fdd; color: white; border: none;">Apply</button>
            </form>
        </div>
        <div class="button-group">
            ${sortLink('profit')}
            ${sortLink('roi')}
        </div>
    </div>
    <p style="text-align: center; color: #666; font-size: 0.85rem;">${shipInfo}</p>
    <table>
        <tr>
            <th>Commodity</th>
            <th>Buy at</th>
            <th>Sell at</th>
            <th>&Delta;</th>
            <th>Amount</th>
            <th>Investment</th>
            <th title="Raw profit x confidence multiplier">Discounted profit</th>
            <th>ROI</th>
            <th>Confidence</th>
        </tr>
        ${rows || '<tr><td colspan="9">No routes available for this ship/wallet combination</td></tr>'}
    </table>`;

    return shell('Smart Routes', body, true);
}

module.exports = {
    touchportalSmart,
    calculateSmartRoutes,
    confidenceBadge,
    resolveShip,
    terminalReachable,
    containerSizesCompatible
};
