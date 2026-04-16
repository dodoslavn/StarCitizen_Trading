/**
 * Main Page Handler
 * Displays all trading data with commodity tables and profit summaries
 */

const html = require('../html.js');
const trading = require('../services/trading.js');

/**
 * Handle main page request
 * @param {Object} req - HTTP request
 * @param {Object} res - HTTP response
 * @param {Object} cache - DataCache instance
 */
function handle(req, res, cache) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.write(html.header);

    const unique_commodities = trading.getCommodities(cache);
    const sell_prices = trading.generateSellData(cache);
    const buy_prices = trading.generateBuyData(cache);

    const tables = unique_commodities
        .map(commodity => html.displayCommodity(commodity, buy_prices[commodity], sell_prices[commodity], cache))
        .join('');

    const profit_uec = html.profit_uec(cache);
    const profit_perc = html.profit_perc(cache);

    res.write('<div id="content"> <div id="panel_l">');
    res.write(profit_uec);
    res.write('</div> <div id="panel_r">');
    res.write(profit_perc);
    res.write('</div> <div id="main">');
    res.write(tables);
    res.write('</div></div>');
    res.write(html.footer);
    res.end();
}

module.exports = { handle };
