/**
 * Touchportal Interface Module
 * Simplified trading interface for touchscreen displays
 */

const { readable_number, formatDateTime, escapeHtml } = require('../utils/formatters.js');

// Shared page chrome for all touchportal sub-pages so hub, routes, and stale
// look and feel like siblings under one experience.
const TOUCHPORTAL_STYLES = `
    body { background-color: black; color: white; font-family: Arial, sans-serif; margin: 0; padding: 1rem; }
    h1, h2 { text-align: center; color: #4ab8ff; }
    body div#top { text-align: center; margin-bottom: 1rem; }
    body div#top a { border-radius: 5px; text-align: center; padding: 0.5rem 0.8rem; margin: 0.2rem; display: inline-block; }
    body div#top div.button-group { display: inline-block; margin: 0.2rem 0.5rem; }
    body div.hub { max-width: 70rem; margin: 4rem auto; display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: center; }
    body div.hub a.hub-tile { flex: 1 1 20rem; padding: 2rem; background-color: #006fdd; border-radius: 0.5rem; font-size: 1.5rem; color: white; text-decoration: none; text-align: center; }
    body div.hub a.hub-tile:hover { background-color: #4ab8ff; }
    body div.hub a.hub-tile small { display: block; font-size: 1rem; opacity: 0.85; margin-top: 0.5rem; }
    body a.back-hub { display: inline-block; background-color: #444; color: white; text-decoration: none; padding: 0.5rem 1rem; border-radius: 5px; margin-bottom: 1rem; }
    body a.back-hub:hover { background-color: #666; }
    table { width: 100%; border-collapse: collapse; margin: auto; }
    table tr th { background-color: #006fdd; border-radius: 3px; text-align: center; padding: 0.5rem; }
    table tr td { text-align: center; padding: 0.3rem; border-bottom: 1px solid #333; }
    a { text-decoration: none; color: white; }
`;

/**
 * Wrap sub-page body content in the shared touchportal HTML shell.
 * @param {string} title - Browser tab title (will be prefixed with "TouchPortal - ")
 * @param {string} body - Inner HTML for the page body
 * @param {boolean} autoRefresh - Whether to include the 60s meta refresh (data pages yes, hub no)
 * @returns {string}
 */
function shell(title, body, autoRefresh = false) {
    const refresh = autoRefresh ? '<meta http-equiv="refresh" content="60">' : '';
    return `<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>TouchPortal - ${escapeHtml(title)}</title>
    ${refresh}
    <style>${TOUCHPORTAL_STYLES}</style></head><body>${body}</body></html>`;
}

/**
 * Get all available systems from cached data
 * @param {Object} cache - Data cache instance
 * @returns {Array} Sorted array of unique system names
 */
function getAvailableSystems(cache) {
    const cachedInitData = cache.getInitData();
    const systems = new Set();

    Object.values(cachedInitData).forEach(terminal => {
        if (terminal && terminal.name) {
            systems.add(terminal.name);
        }
    });

    return Array.from(systems).sort();
}

/**
 * Calculate best trading routes for given SCU capacity
 * @param {Object} cache - Data cache instance
 * @param {number} scu - SCU capacity
 * @param {string} solar_system - System filter
 * @returns {Array} Sorted array of best routes
 */
function calculateBestRoutes(cache, scu, solar_system) {
    const cachedData = cache.getData();
    const cachedInitData = cache.getInitData();
    const deals = [];

    // Get all terminals with buy/sell data
    const terminals_sell = cachedData.data.filter(t => t.price_sell_avg > 0);
    const terminals_buy = cachedData.data.filter(t => t.price_buy_avg > 0);

    // Calculate all possible deals
    terminals_sell.forEach(sell => {
        terminals_buy.forEach(buy => {
            // Must be same commodity
            if (sell.commodity_name !== buy.commodity_name) return;

            // Filter by system if specified
            if (solar_system) {
                const buySystem = cachedInitData?.[buy.terminal_name]?.name;
                const sellSystem = cachedInitData?.[sell.terminal_name]?.name;
                if (buySystem !== solar_system || sellSystem !== solar_system) return;
            }

            // Calculate trade amount limited by SCU capacity
            const amount = Math.min(sell.scu_sell_avg, buy.scu_buy_avg, scu);
            if (amount <= 0) return;

            const profit = (sell.price_sell_avg - buy.price_buy_avg) * amount;
            if (profit <= 0) return;

            deals.push({
                commodity: sell.commodity_name,
                profit: profit,
                profit_per_scu: sell.price_sell_avg - buy.price_buy_avg,
                investment: buy.price_buy_avg * amount,
                amount: amount,
                buy_location: buy.terminal_name,
                buy_system: cachedInitData?.[buy.terminal_name]?.code || '?',
                sell_location: sell.terminal_name,
                sell_system: cachedInitData?.[sell.terminal_name]?.code || '?',
                buy_price: buy.price_buy_avg,
                sell_price: sell.price_sell_avg
            });
        });
    });

    // Sort by profit and return top 20
    return deals.sort((a, b) => b.profit - a.profit).slice(0, 20);
}

/**
 * Generate touchportal interface
 * @param {number} scu - SCU capacity
 * @param {string} solar_system - System filter
 * @param {Object} cache - Data cache instance
 * @returns {string} Complete HTML page
 */
function touchportal(scu, solar_system = '', cache) {
    const routes = calculateBestRoutes(cache, scu, solar_system);
    const systems = getAvailableSystems(cache);

    // Generate system filter buttons
    const systemButtons = systems.map(system => {
        const isActive = solar_system === system;
        const style = isActive ? 'background-color: #4ab8ff; font-weight: bold;' : 'background-color: #006fdd;';
        return `<a href="/touchportal/${scu}/${system}" style="${style}">${system}</a>`;
    }).join('\n        ');

    // All systems button
    const allSystemsStyle = !solar_system ? 'background-color: #4ab8ff; font-weight: bold;' : 'background-color: #006fdd;';

    const routeRows = routes.map(route => `
        <tr>
            <td>${route.commodity}</td>
            <td>(${route.buy_system}) ${route.buy_location}</td>
            <td>(${route.sell_system}) ${route.sell_location}</td>
            <td>${readable_number(route.profit)} aUEC</td>
            <td>${readable_number(route.amount)} SCU</td>
        </tr>
    `).join('');

    const body = `
    <a class="back-hub" href="/touchportal">&larr; Hub</a>
    <div id="top">
        <div class="button-group">
            ${systemButtons}
            <a href="/touchportal/${scu}/" style="${allSystemsStyle}">All systems</a>
        </div>
        <div class="button-group">
            ${scu > 10 ? `<a href='/touchportal/${Number(scu) - 10}/${escapeHtml(solar_system)}' style='background-color: #006fdd;'>-10 SCU</a>` : ''}
            <a href="/touchportal/${Number(scu) + 10}/${escapeHtml(solar_system)}" style='background-color: #006fdd;'>+10 SCU</a>
            ${scu > 100 ? `<a href='/touchportal/${Number(scu) - 100}/${escapeHtml(solar_system)}' style='background-color: #006fdd;'>-100 SCU</a>` : ''}
            <a href="/touchportal/${Number(scu) + 100}/${escapeHtml(solar_system)}" style='background-color: #006fdd;'>+100 SCU</a>
        </div>
    </div>
    <h2>Best Trading Routes - ${scu} SCU${solar_system ? ` - ${escapeHtml(solar_system)}` : ''}</h2>
    <table>
        <tr>
            <th>Commodity</th>
            <th>Buy at</th>
            <th>Sell at</th>
            <th>Profit</th>
            <th>Amount</th>
        </tr>
        ${routeRows || '<tr><td colspan="5">No routes available</td></tr>'}
    </table>`;

    return shell('Best Routes', body, true);
}

/**
 * Generate the touchportal hub page - a landing page with links to each
 * sub-page (best routes, stale terminals).
 * @returns {string} Complete HTML page
 */
function touchportalHub() {
    const body = `
    <h1>TouchPortal</h1>
    <div class="hub">
        <a class="hub-tile" href="/touchportal/50">
            Best Trading Routes
            <small>Sorted by profit, pick your SCU capacity and system</small>
        </a>
        <a class="hub-tile" href="/touchportal/stale">
            Oldest Terminal Data
            <small>Terminals whose prices haven't been updated in a while - good candidates to visit and report</small>
        </a>
    </div>`;
    return shell('Hub', body, false);
}

/**
 * Generate the "oldest terminal data" page - one row per terminal, showing
 * the most recent date_modified across all commodities at that terminal.
 * Sorted ascending, so terminals with the most-neglected data appear first
 * (i.e. even their newest data point is old, meaning no one has visited in
 * a while). Optionally filtered to a single star system.
 * @param {Object} cache - Data cache instance
 * @param {string} solar_system - Optional system name filter
 * @returns {string} Complete HTML page
 */
function touchportalStale(cache, solar_system = '') {
    const cachedData = cache.getData();
    const cachedInitData = cache.getInitData();

    // Aggregate by terminal: keep the most recent date_modified per terminal.
    const perTerminal = new Map();
    cachedData.data.forEach(item => {
        if (!item.date_modified) return;
        if (solar_system) {
            const systemName = cachedInitData?.[item.terminal_name]?.name;
            if (systemName !== solar_system) return;
        }
        const prev = perTerminal.get(item.terminal_name);
        if (!prev || item.date_modified > prev) {
            perTerminal.set(item.terminal_name, item.date_modified);
        }
    });

    const terminals = [...perTerminal.entries()]
        .sort((a, b) => a[1] - b[1])
        .slice(0, 100);

    // System filter buttons - reuse the same set of systems as the routes page.
    const systems = getAvailableSystems(cache);
    const systemButtons = systems.map(system => {
        const isActive = solar_system === system;
        const style = isActive ? 'background-color: #4ab8ff; font-weight: bold;' : 'background-color: #006fdd;';
        return `<a href="/touchportal/stale/${encodeURIComponent(system)}" style="${style}">${escapeHtml(system)}</a>`;
    }).join('\n        ');
    const allSystemsStyle = !solar_system ? 'background-color: #4ab8ff; font-weight: bold;' : 'background-color: #006fdd;';

    const rows = terminals.map(([terminalName, dateModified]) => {
        const systemCode = cachedInitData?.[terminalName]?.code ?? '?';
        return `<tr>
            <td>${formatDateTime(dateModified)}</td>
            <td>(${escapeHtml(systemCode)}) ${escapeHtml(terminalName)}</td>
        </tr>`;
    }).join('');

    const body = `
    <a class="back-hub" href="/touchportal">&larr; Hub</a>
    <div id="top">
        <div class="button-group">
            ${systemButtons}
            <a href="/touchportal/stale" style="${allSystemsStyle}">All systems</a>
        </div>
    </div>
    <h2>Oldest Terminal Data (top 100${solar_system ? ` - ${escapeHtml(solar_system)}` : ''})</h2>
    <table>
        <tr>
            <th>Last updated</th>
            <th>Terminal</th>
        </tr>
        ${rows || '<tr><td colspan="2">No data available</td></tr>'}
    </table>`;

    return shell('Oldest Data', body, true);
}

module.exports = {
    touchportal,
    touchportalHub,
    touchportalStale
};
