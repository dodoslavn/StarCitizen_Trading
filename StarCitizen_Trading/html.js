/**
 * HTML Generation Module
 * Handles all HTML rendering for the trading website
 */

const header = `
<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <title>ComTrading - Star Citizen</title>
        <link rel="stylesheet" type="text/css" href="/default.css" media="screen" >
        <meta http-equiv="refresh" content="300">
    </head>
    <body>
    `;

const footer = `
    </body>
</html>
`;

/**
 * Generate CSS content
 * @returns {string} CSS styles
 */
function css() {
    return `
body
    {
    min-width: 92rem;
    color: white;
    background-color: #121212;
    font-family: Open Sans;
    font-size: 1rem;
    }
table
    {
    background-color: #1e1e1e;
    flex-shrink: 0;
    }
table.commodity
    {
    margin-top: 2rem;
    margin-bottom: 0rem;
    margin-left: auto;
    margin-right: auto;
    float: left;
    border-radius: 0.5rem;
    box-shadow: 0.15rem 0.15rem 0.15rem rgba(50, 50, 50, 0.5);
    min-width: 45rem;
    }
table.best
    {
    margin-top: 1rem;
    margin-left: auto;
    margin-right: auto;
    border-radius: 0.5rem;
    box-shadow: 0.15rem 0.15rem 0.15rem rgba(50, 50, 50, 0.5);
    }

th
    {
    background-color: #006fdd;
    color: #fff;
    padding: 5px;
    border-radius: 5px;
    }
td
    {
    text-align: center;
    vertical-align: top;
    }

a
    {
    text-decoration: none;
    color: inherit;
    outline: none;
    }
a:hover
    {
    color: #006fdd;
    }

div.about-page a
    {
    color: #4da6ff !important;
    cursor: pointer;
    transition: color 0.2s ease;
    }
div.about-page a:hover
    {
    color: #80c1ff !important;
    text-decoration: underline !important;
    }


div#content
    {
    width: 100%;
    }

div#main
    {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    align-items: flex-start;
    }

div#panel_r
    {
    float: right;
    }

div#panel_l
    {
    float: left;
    }

:target tbody tr th {
    background-color: goldenrod;
}
    `;
}

const about = `
    <div class="about-page" style="max-width: 50rem; margin: 2rem auto; padding: 2rem; background-color: #1e1e1e; border-radius: 0.5rem; line-height: 1.8;">
        <h1 style="color: #4da6ff; margin-bottom: 1.5rem;">About ComTrading</h1>

        <p style="margin-bottom: 1rem;">
            <strong>Community made website</strong><br>
            Created by Dodoslav Novak
        </p>

        <p style="margin-bottom: 1rem;">
            <strong>Contact:</strong><br>
            <a href='mailto:admin@dodoslav.eu'>admin@dodoslav.eu</a>
        </p>

        <p style="margin-bottom: 1rem;">
            <strong>Data Source:</strong><br>
            Trading data collected from <a href='https://uexcorp.space/' target="_blank" rel="noopener">UEX Corp API</a>
        </p>

        <p style="margin-bottom: 1rem;">
            <strong>Source Code:</strong><br>
            <a href='https://github.com/dodoslavn/StarCitizen_Trading' target="_blank" rel="noopener">View on GitHub</a>
        </p>

        <p style="margin-top: 2rem; text-align: center; color: #888;">
            &copy; 2025
        </p>
    </div>
    `;

/**
 * Format number with thousand separators
 * @param {number|string} num - Number to format
 * @returns {string} Formatted number
 */
function readable_number(num) {
    if (num === '-') return num;
    return new Intl.NumberFormat('en-US', { useGrouping: true })
        .format(num)
        .replace(/,/g, ' ');
}

/**
 * Display single terminal data row
 * @param {Object} item - Terminal data
 * @returns {string} HTML table row
 */
function displayTerminal(item) {
    const price = (item.price_buy || 0) + (item.price_sell || 0);
    const price_avg = (item.price_buy_avg || 0) + (item.price_sell_avg || 0);
    const stock = (item.scu_buy || 0) + (item.scu_sell || 0);
    const stock_avg = (item.scu_buy_avg || 0) + (item.scu_sell_avg || 0);

    return `<tr>
        <td title="${item.container_sizes}">${item.terminal_name}</td>
        <td>${readable_number(price)} (~${readable_number(price_avg)})</td>
        <td>${readable_number(stock)} (~${readable_number(stock_avg)})</td>
    </tr>`;
}

/**
 * Display pricing table (buy or sell)
 * @param {Array} pricings - Array of pricing data
 * @param {string} stock_demand - Label for stock/demand column
 * @returns {string} HTML table content
 */
function displayPricing(pricings, stock_demand) {
    const no_prices = pricings.length === 0 ? '<tr><td>-</td><td>-</td><td>-</td></tr>' : '';
    const header = `<tr><th>Location</th><th>Price (avg)</th><th>${stock_demand} (avg)</th></tr>`;
    const rows = pricings.map(terminal => displayTerminal(terminal)).join('');

    return header + no_prices + rows;
}

/**
 * Calculate profit metrics
 * @param {Array} buy_sorted - Sorted buy prices
 * @param {Array} sell_sorted - Sorted sell prices
 * @returns {Object|null} Profit metrics or null
 */
function calculateProfit(buy_sorted, sell_sorted) {
    if (sell_sorted.length === 0 || buy_sorted.length === 0) {
        return null;
    }

    const sell_sorted_real = sell_sorted.filter(item => item.scu_sell_avg !== null && item.scu_sell_avg !== 0);
    const buy_sorted_real = buy_sorted.filter(item => item.scu_buy_avg !== null && item.scu_buy_avg !== 0);

    const profit_uec = sell_sorted[0].price_sell - buy_sorted[0].price_buy;
    const profit_perc = (((sell_sorted[0].price_sell - buy_sorted[0].price_buy) / buy_sorted[0].price_buy) * 100).toFixed(2);

    let profit_uec_real = '-';
    let profit_perc_real = '-';

    if (sell_sorted_real.length > 0 && buy_sorted_real.length > 0) {
        profit_uec_real = sell_sorted_real[0].price_sell - buy_sorted_real[0].price_buy;
        if (profit_uec_real < 0) profit_uec_real = '-';

        profit_perc_real = (((sell_sorted_real[0].price_sell - buy_sorted_real[0].price_buy) / buy_sorted_real[0].price_buy) * 100).toFixed(2);
        if (profit_perc_real < 0) profit_perc_real = '-';
    }

    return {
        profit_uec,
        profit_perc,
        profit_uec_real,
        profit_perc_real,
        text: `${profit_uec} aUEC - ${profit_perc}%`
    };
}

/**
 * Find best trading routes
 * @param {Array} terminals_sell - Sell terminals
 * @param {Array} terminals_buy - Buy terminals
 * @param {Object} cachedInitData - Init data for systems
 * @returns {Object|null} Best routes {latest, average}
 */
function findBestRoutes(terminals_sell, terminals_buy, cachedInitData) {
    const deals_list = [];
    const deals_list_avg = [];

    terminals_sell.forEach(sell => {
        terminals_buy.forEach(buy => {
            let amount = sell.scu_sell;
            if (amount > buy.scu_buy) amount = buy.scu_buy;
            deals_list.push({
                profit: (sell.price_sell - buy.price_buy) * amount,
                investment: buy.price_buy * amount,
                amount: amount,
                buy: buy,
                sell: sell
            });
        });
    });

    terminals_sell.forEach(sell => {
        terminals_buy.forEach(buy => {
            let amount = sell.scu_sell_avg;
            if (amount > buy.scu_buy_avg) amount = buy.scu_buy_avg;
            deals_list_avg.push({
                profit: (sell.price_sell_avg - buy.price_buy_avg) * amount,
                investment: buy.price_buy_avg * amount,
                amount: amount,
                buy: buy,
                sell: sell
            });
        });
    });

    const profit_sorted = deals_list.sort((a, b) => b.profit - a.profit).slice(0, 1);
    const profit_sorted_avg = deals_list_avg.sort((a, b) => b.profit - a.profit).slice(0, 1);

    if (profit_sorted.length === 0) return null;

    return {
        latest: profit_sorted[0],
        average: profit_sorted_avg[0],
        cachedInitData
    };
}

/**
 * Generate best route HTML
 * @param {Object|null} routes - Route data
 * @returns {string} HTML for best routes
 */
function generateBestRouteHTML(routes) {
    if (!routes) return '';

    const { latest, average, cachedInitData } = routes;

    return `<tr>
        <td title="Most profitable trip based on latest reported data">
            (${cachedInitData?.[latest.buy.terminal_name]?.code ?? '?'}) ${latest.buy.terminal_name} →
            (${cachedInitData?.[latest.sell.terminal_name]?.code ?? '?'}) ${latest.sell.terminal_name}
        </td>
        <td style="text-align:right;" title="Profit from the trip">${readable_number(latest.profit)} aUEC</td>
        <td style="text-align:right;" title="Amount of SCU to trade">${readable_number(latest.amount)} SCU</td>
        <td style="text-align: right; padding-right: 1rem;" title="Required aUEC investment">
            ( ${readable_number(latest.investment)} aUEC )
        </td>
    </tr>
    <tr>
        <td title="Most profitable trip based on average data">
            (${cachedInitData?.[average.buy.terminal_name]?.code ?? '?'}) ${average.buy.terminal_name} →
            (${cachedInitData?.[average.sell.terminal_name]?.code ?? '?'}) ${average.sell.terminal_name}
        </td>
        <td style="text-align:right;" title="Profit from the trip">~ ${readable_number(average.profit)} aUEC</td>
        <td style="text-align:right;" title="Amount of SCU to trade">~ ${readable_number(average.amount)} SCU</td>
        <td style="text-align: right; padding-right: 1rem;" title="Required aUEC investment">
            ( ~ ${readable_number(average.investment)} aUEC )
        </td>
    </tr>`;
}

/**
 * Display commodity table with buy/sell data
 * @param {string} item - Commodity name
 * @param {Array} buy - Buy price data
 * @param {Array} sell - Sell price data
 * @param {Object} cache - Data cache instance
 * @returns {string} HTML table for commodity
 */
function displayCommodity(item, buy = [], sell = [], cache) {
    const buy_sorted = buy.sort((a, b) => a.price_buy - b.price_buy);
    const sell_sorted = sell.sort((a, b) => b.price_sell - a.price_sell);

    const profitMetrics = calculateProfit(buy_sorted, sell_sorted);
    const best_profit = profitMetrics ? `( ${profitMetrics.text} )` : '';

    if (profitMetrics) {
        cache.addProfit({
            commodity: item,
            profit_uec: profitMetrics.profit_uec,
            profit_perc: profitMetrics.profit_perc,
            profit_uec_real: profitMetrics.profit_uec_real,
            profit_perc_real: profitMetrics.profit_perc_real
        });
    }

    const cachedData = cache.getData();
    const cachedInitData = cache.getInitData();

    const terminals_sell = cachedData.data.filter(comm => comm.commodity_name === item && comm.price_sell_avg > 0);
    const terminals_buy = cachedData.data.filter(comm => comm.commodity_name === item && comm.price_buy_avg > 0);

    const routes = findBestRoutes(terminals_sell, terminals_buy, cachedInitData);
    const best_route = generateBestRouteHTML(routes);

    return `
    <table class="commodity" id="comm-${item}">
        <tr><th colspan="4" style="text-align:center;">${item} ${best_profit}</th></tr>
        ${best_route}
        <tr>
            <td colspan="2">(you) Sell</td>
            <td colspan="2">(you) Buy</td>
        </tr>
        <tr>
            <td colspan="2">
                <table>
                    ${displayPricing(sell_sorted, 'Demand')}
                </table>
            </td>
            <td colspan="2">
                <table>
                    ${displayPricing(buy_sorted, 'In stock')}
                </table>
            </td>
        </tr>
    </table>
    `;
}

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
        return `<tr>
            <td><a href="#comm-${item.commodity}">${item.commodity}</a></td>
            <td>${readable_number(item.profit_uec_real)} (up to ${readable_number(item.profit_uec)})</td>
        </tr>`;
    }).join('');

    return '<table class="best">' + header + data + '</table> <br> ' +
        '<a style="padding-left: 4rem; padding-top: 1rem; color: #333; " href="/about">About this website</a>';
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
        return `<tr>
            <td><a href="#comm-${item.commodity}">${item.commodity}</a></td>
            <td>${item.profit_perc_real} (up to ${item.profit_perc})</td>
        </tr>`;
    }).join('');

    return '<table class="best">' + header + data + '</table>';
}

/**
 * Generate touchportal interface (simplified version for now)
 * @param {number} scu - SCU capacity
 * @param {string} solar_system - System filter
 * @returns {string} Complete HTML page
 */
function touchportal(scu, solar_system = '') {
    return `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="10"><style>
        body { background-color: black; color: white; }
        body div#top { text-align: center; margin-bottom: 2rem; }
        body div#top a { background-color: #006fdd; border-radius: 5px; text-align: center; padding: 0.4rem; }
        table { margin: auto; margin-bottom: 1rem; }
        table tr th { background-color: #006fdd; border-radius: 5px; text-align: center; padding: 0 0.5rem; }
        table tr td { text-align: center; }
        a { text-decoration: none; color: white; }
    </style></head><body>
    <div id="top">
        <a href="/touchportal/${scu}/Stanton">Stanton only</a>
        <a href="/touchportal/${scu}/Pyro">Pyro only</a>
        <a style="margin-right: 3rem;" href="/touchportal/${scu}/">All systems</a>
        ${scu > 10 ? `<a href='/touchportal/${Number(scu) - 10}/${solar_system}'>-10 SCU</a>` : ''}
        <a href="/touchportal/${Number(scu) + 10}/${solar_system}">+10 SCU</a>
        ${scu > 100 ? `<a href='/touchportal/${Number(scu) - 100}/${solar_system}'>-100 SCU</a>` : ''}
        <a href="/touchportal/${Number(scu) + 100}/${solar_system}">+100 SCU</a>
    </div>
    <p style="text-align:center;">Touchportal page for ${scu} SCU capacity</p>
    </body></html>`;
}

module.exports = {
    header,
    footer,
    displayCommodity,
    css,
    profit_uec,
    profit_perc,
    touchportal,
    about
};
