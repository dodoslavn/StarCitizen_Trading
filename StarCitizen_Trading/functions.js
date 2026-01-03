const fs = require('fs');
const html = require('./html.js');
const favicon = require('./favicon.js');
function serverStarted() { console.log(timestamp() + `INFO: HTTP server started`); }

const endpoints =
    {
    prices_all: "https://api.uexcorp.space/2.0/commodities_prices_all",
    solar_systems_all: "https://api.uexcorp.space/2.0/star_systems",
    terminals_all: "https://api.uexcorp.space/2.0/terminals"
    }

function timestamp()
    {
    const now = new Date();
    let sec;
    if (now.getSeconds() < 10) sec = "0" + now.getSeconds();
    else sec = now.getSeconds();
    return now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate() + "_" + now.getHours() + ":" + now.getMinutes() + ":" + sec + " > ";
    } 

async function downloadJson(url)
    {
    const result = await fetch(url);
    const data = await result.json();
    return (data);
    }

async function refreshData() {
    try
        {
        const resp = await downloadJson(endpoints['prices_all']);
        resp.data.forEach(item =>
            {
            item.price_buy = Number(item.price_buy);
            item.price_buy_avg = Number(item.price_buy_avg);
            item.price_sell = Number(item.price_sell);
            item.price_sell_avg = Number(item.price_sell_avg);
            item.scu_buy = Number(item.scu_buy);
            item.scu_buy_avg = Number(item.scu_buy_avg);
            item.scu_sell_stock = Number(item.scu_sell_stock);
            item.scu_sell_stock_avg = Number(item.scu_sell_stock_avg);
            item.scu_sell = Number(item.scu_sell);
            item.scu_sell_avg = Number(item.scu_sell_avg);
            });
        global.cachedData = resp;
        console.log(timestamp() + 'INFO: Data refreshed successfully');
        }
    catch (error) { console.error(timestamp() + 'ERROR: Refreshing data failed:', error); }
}

async function getInitData_Solar()
    {
    try {
        const resp = await downloadJson(endpoints['solar_systems_all']);
        const data = resp.data.reduce((acc, item) =>
            {
            acc[item.id] = { name: item.name, code: item.code };
            return acc;
            }, {});
        console.log(timestamp() + 'INFO: Init data (solar systems) processed successfully');
        return data;
        }
    catch (error) { console.error(timestamp() + 'ERROR: Init data (solar systems) process data failed:', error); }
    }

async function getInitData_Terminals()
    {
    try {
        const resp = await downloadJson(endpoints['terminals_all']);
        const data = resp.data.reduce((acc, item) => {
            acc[item.nickname] = item.id_star_system;
            return acc;
            }, {});
        console.log(timestamp() + 'INFO: Init data (termianls) processed successfully');
        return data;
        }
    catch (error) { console.error(timestamp() + 'ERROR: Init data (termianls) process data failed:', error); }
    }

async function getInitData()
    {
    const systems = await getInitData_Solar();
    const terminals = await getInitData_Terminals();
    let mergedDict = [];
    Object.entries(terminals).forEach(([key, value]) => { mergedDict[key] = systems[value]; });
    global.cachedInitData = mergedDict;
    console.log(timestamp() + 'INFO: Init data processed successfully');
    }

function website_unknown(req, res)
    {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('HTTP 404');
    console.error(timestamp() + 'ERROR: Unknown URL - ' + req.url);
    }

function website_showCSS(req, res)
    {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/css');
    res.end(html.css());
    }

function website_showFavicon(req, res)
    {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/x-icon');
    faviconBase64 = favicon.faviconBase64;
    res.end(Buffer.from(faviconBase64, 'base64'));
    }

function website_touchpanel(req, res)
    {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    if (req.url == '/touchportal' || req.url == '/touchportal/') res.end(html.touchportal(50));
    else
        {
        if (req.url.split('/').length == 3 || (req.url.split('/')[3] == '' && req.url.split('/').length == 4)) res.end(html.touchportal(req.url.split('/')[2]));
        else
            if (req.url.split('/').length == 4 ) res.end(html.touchportal(req.url.split('/')[2], req.url.split('/')[3]));
        }
    }

function website_refreshData(req, res)
    {
    refreshData();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end(timestamp() + 'INFO: Call to refresh data sent');
    }

function getComodities()
    {
    global.profit = [];
    return commodityNames = [...new Set(global.cachedData.data.map(item => item.commodity_name))];
    }

function genData_sell()
    {
    const commodities = {};
    global.cachedData.data.forEach(item =>
        {
        const { commodity_name, container_sizes, terminal_name, price_sell, price_sell_avg, scu_sell, scu_sell_avg } = item;
        let system = global.cachedInitData?.[terminal_name]?.code ?? "(?) ";
        if (system != "- ") system = "(" + system + ") ";
        if (price_sell === 0) return;
        if (!commodities[commodity_name]) { commodities[commodity_name] = []; }
        commodities[commodity_name].push(
            {
            terminal_name: system + terminal_name,
            container_sizes,
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
    global.cachedData.data.forEach(item =>
        {
        const { commodity_name, container_sizes, terminal_name, price_buy, price_buy_avg, scu_buy, scu_buy_avg } = item;
        let system = global.cachedInitData?.[terminal_name]?.code ?? "(?) ";
        if (system != "- ") system = "(" + system + ") ";
        if (price_buy === 0) return;
        if (!commodities[commodity_name]) { commodities[commodity_name] = []; }
        commodities[commodity_name].push(
            {
            terminal_name: system + terminal_name,
            container_sizes,
            price_buy: price_buy > 0 ? price_buy : null,
            price_buy_avg: price_buy_avg > 0 ? price_buy_avg : null,
            scu_buy: scu_buy > 0 ? scu_buy : null,
            scu_buy_avg: scu_buy_avg > 0 ? scu_buy_avg : null,
            });
        });
    return (commodities);
    }
function website_about(req, res)
    {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.write(html.header);
    res.write(html.about);
    res.write(html.footer);
    res.end();
    }

function website_showData(req, res)
    {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.write(html.header);
    const unique_commodities = getComodities();
    const sell_prices = genData_sell();
    const buy_prices = genData_buy();
    const tables = unique_commodities.map(commodity => html.displayCommodity(commodity, buy_prices[commodity], sell_prices[commodity])).join('');
    const profit_uec = html.profit_uec();
    const profit_perc = html.profit_perc();
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

async function processRequest(req, res)
    {
    console.log(timestamp() + 'INFO: Client(' + (req.connection.remoteAddress || req.socket.remoteAddress) +') request received - ' + req.url);
    if (cachedData == null)
        {
        console.log(timestamp() + 'WARNING: No cached data');
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('ERROR: No data to process');
        return;
        }

    let url = '';
    if (req.url == '/') url = '/';
    else
        {
        if (req.url.split('/').length == 2) url = req.url;
        else url = '/' + req.url.split('/')[1];
        }

    switch (url)
        {
        case '/':
            website_showData(req, res);
            break;
        case '/refresh':
            website_refreshData(req, res);
            break;
        case '/default.css':
            website_showCSS(req, res);
            break;
        case '/favicon.ico':
            website_showFavicon(req, res);
            break;
        case '/about':
            website_about(req, res);
            break;
        case '/touchportal':
            website_touchpanel(req, res);
            break;
        default:
            website_unknown(req, res);
        }
    }

function loadConfig()
    {
    const filename = './config.json';
    const data = fs.readFileSync(filename, 'utf8');
    if (!data)
        {
        console.error(timestamp() + 'ERROR: Couldnt load config file - ' + filename);
        process.exit(1);
        }
    const json = JSON.parse(data);
    console.log(timestamp() + `INFO: Config file loaded`);
    return json;
    }

module.exports =
    {
    serverStarted,
    refreshData,
    getInitData,
    processRequest,
    loadConfig
    };