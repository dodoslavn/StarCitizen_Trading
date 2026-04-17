/**
 * Touchportal Interface Module
 * Simplified trading interface for touchscreen displays
 */

const { readable_number } = require('../utils/formatters.js');

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
            let amount = Math.min(sell.scu_sell_avg, buy.scu_buy_avg, scu);
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

    return `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="60"><style>
        body { background-color: black; color: white; font-family: Arial, sans-serif; margin: 0; padding: 1rem; }
        body div#top { text-align: center; margin-bottom: 1rem; }
        body div#top a { border-radius: 5px; text-align: center; padding: 0.5rem 0.8rem; margin: 0.2rem; display: inline-block; }
        body div#top div.button-group { display: inline-block; margin: 0.2rem 0.5rem; }
        h2 { text-align: center; color: #4ab8ff; }
        table { width: 100%; border-collapse: collapse; margin: auto; }
        table tr th { background-color: #006fdd; border-radius: 3px; text-align: center; padding: 0.5rem; }
        table tr td { text-align: center; padding: 0.3rem; border-bottom: 1px solid #333; }
        a { text-decoration: none; color: white; }
    </style></head><body>
    <div id="top">
        <div class="button-group">
            ${systemButtons}
            <a href="/touchportal/${scu}/" style="${allSystemsStyle}">All systems</a>
        </div>
        <div class="button-group">
            ${scu > 10 ? `<a href='/touchportal/${Number(scu) - 10}/${solar_system}' style='background-color: #006fdd;'>-10 SCU</a>` : ''}
            <a href="/touchportal/${Number(scu) + 10}/${solar_system}" style='background-color: #006fdd;'>+10 SCU</a>
            ${scu > 100 ? `<a href='/touchportal/${Number(scu) - 100}/${solar_system}' style='background-color: #006fdd;'>-100 SCU</a>` : ''}
            <a href="/touchportal/${Number(scu) + 100}/${solar_system}" style='background-color: #006fdd;'>+100 SCU</a>
        </div>
    </div>
    <h2>Best Trading Routes - ${scu} SCU${solar_system ? ` - ${solar_system}` : ''}</h2>
    <table>
        <tr>
            <th>Commodity</th>
            <th>Buy at</th>
            <th>Sell at</th>
            <th>Profit</th>
            <th>Amount</th>
        </tr>
        ${routeRows || '<tr><td colspan="5">No routes available</td></tr>'}
    </table>
    </body></html>`;
}

module.exports = {
    touchportal
};
