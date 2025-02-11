const fs = require('fs');
const html = require('./html.js');
function serverStarted() { console.log(`INFO: HTTP server started`); }

async function downloadJson() {
    const result = await fetch('https://api.uexcorp.space/2.0/commodities_prices_all');
    const data = await result.json();
    return (data);
}
async function refreshData() {
    try {
        global.cachedData = await downloadJson();
        console.log('INFO: Data refreshed successfully');
    }
    catch (error) { console.error('ERROR: Refreshing data failed:', error); }
}

function website_unknown(req, res) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Page not found');
    console.error('ERROR: Unknown URL - ' + req.url);
}

function website_showCSS(req, res) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end(html.css());
}

function website_refreshData(req, res) {
    refreshData();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('INFO: Call to refresh data sent');
}

function getComodities() {
    global.profit = [];
    return commodityNames = [...new Set(global.cachedData.data.map(item => item.commodity_name))];
}

function genData_sell() {
    const commodities = {};
    global.cachedData.data.forEach(item => {
        const { commodity_name, terminal_name, price_sell, price_sell_avg, scu_sell, scu_sell_avg } = item;
        if (price_sell === 0)
            return;
        if (!commodities[commodity_name]) { commodities[commodity_name] = []; }
        commodities[commodity_name].push(
            {
                terminal_name,
                price_sell: price_sell > 0 ? price_sell : null,
                price_sell_avg: price_sell_avg > 0 ? price_sell_avg : null,
                scu_sell: scu_sell > 0 ? scu_sell : null,
                scu_sell_avg: scu_sell_avg > 0 ? scu_sell_avg : null,
            });
    });
    return (commodities);
}

function genData_buy() {
    const commodities = {};
    global.cachedData.data.forEach(item => {
        const { commodity_name, terminal_name, price_buy, price_buy_avg, scu_buy, scu_buy_avg } = item;
        if (price_buy === 0)
            return;
        if (!commodities[commodity_name]) { commodities[commodity_name] = []; }
        commodities[commodity_name].push(
            {
                terminal_name,
                price_buy: price_buy > 0 ? price_buy : null,
                price_buy_avg: price_buy_avg > 0 ? price_buy_avg : null,
                scu_buy: scu_buy > 0 ? scu_buy : null,
                scu_buy_avg: scu_buy_avg > 0 ? scu_buy_avg : null,
            });
    });
    return (commodities);
}


function website_showData(req, res) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.write(html.header);
    const unique_commodities = getComodities();
    const sell_prices = genData_sell();
    const buy_prices = genData_buy();
    const tables = unique_commodities.map(commodity => html.displayCommodity(commodity, buy_prices[commodity], sell_prices[commodity])).join('');
    const profit_uec = html.profit_uec();
    const profit_perc = html.profit_perc();
    res.write(profit_uec);
    res.write(profit_perc);
    res.write(tables);
    res.write(html.footer);
    res.end();
}
async function processRequest(req, res) {
    console.log('INFO: Client request received - ' + req.url);
    if (cachedData == null) {
        console.log('WARNING: No cached data');
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('ERROR: No data to process');
        return;
    }

    switch (req.url) {
        case '/':
            website_showData(req, res);
            break;
        case '/refresh':
            website_refreshData(req, res);
            break;
        case '/default.css':
            website_showCSS(req, res);
            break;
        default:
            website_unknown(req, res);
    }
}

function loadConfig() {
    const filename = './config.json';
    const data = fs.readFileSync(filename, 'utf8');
    if (!data) {
        console.error('ERROR: Couldnt load config file - ' + filename);
        process.exit(1);
    }
    const json = JSON.parse(data);
    console.log(`INFO: Config file loaded`);
    return json;
}

module.exports =
{
    serverStarted,
    refreshData,
    processRequest,
    loadConfig
};
