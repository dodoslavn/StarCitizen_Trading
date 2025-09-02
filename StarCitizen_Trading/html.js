const header = `
<!DOCTYPE html>
<html>
    <head>
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

function css() {
    return `
body
    {
    //margin: auto, 0, auto, 0;
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
table.best tbody tr
    {
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
    Community made website - Dodoslav Novak<br>
    <a href='mailto:admin@dodoslav.eu'>admin@dodoslav.eu</a><br>
    Data collected from on <a href='https://uexcorp.space/'>UEX corp</a> API
    2025
    GitHub link to be provided..
    `;


function displayTerminal(item) {
    const price = (item.price_buy || 0) + (item.price_sell || 0);
    const price_avg = (item.price_buy_avg || 0) + (item.price_sell_avg || 0);
    const stock = (item.scu_buy || 0) + (item.scu_sell || 0);
    const stock_avg = (item.scu_buy_avg || 0) + (item.scu_sell_avg || 0);
    return `<tr><td>${item.terminal_name}</td><td>${readable_number(price)} (~${readable_number(price_avg)})</td><td>${readable_number(stock)} (~${readable_number(stock_avg)})</td></tr>`;
}

function displayPricing(pricings, stock_demand)
    {
    no_prices = '';
    if (pricings.length === 0) no_prices = '<tr><td>-</td><td>-</td><td>-</td></tr>';
    return '<tr><th>Location</th><th>Price (avg)</th><th>' + stock_demand + ' (avg)</th></tr>' + no_prices + pricings.map(terminal => displayTerminal(terminal)).join('');
    }

function displayCommodity(item, buy = [], sell = []) {

    let buy_sorted = buy.sort((a, b) => a.price_buy - b.price_buy);
    let sell_sorted = sell.sort((a, b) => b.price_sell - a.price_sell);

    const sell_sorted_real = sell.filter(item => item.scu_sell_avg !== null && item.scu_sell_avg !== 0);
    const buy_sorted_real = buy.filter(item => item.scu_buy_avg !== null && item.scu_buy_avg !== 0);

    let profit_uec_txt = '';
    let profit_perc_txt = '';
    if (sell_sorted.length > 0 && buy_sorted.length > 0)
        {
        const profit_uec = (sell_sorted[0].price_sell - buy_sorted[0].price_buy);
        const profit_perc = (((sell_sorted[0].price_sell - buy_sorted[0].price_buy) / buy_sorted[0].price_buy) * 100).toFixed(2);

        let profit_uec_real = '-';
        let profit_perc_real = '-';
        if (sell_sorted_real.length > 0 && buy_sorted_real.length > 0)
            {
            profit_uec_real = (sell_sorted_real[0].price_sell - buy_sorted_real[0].price_buy);
            if (profit_uec_real < 0) profit_uec_real = '-';
            profit_perc_real = (((sell_sorted_real[0].price_sell - buy_sorted_real[0].price_buy) / buy_sorted_real[0].price_buy) * 100).toFixed(2);
            if (profit_perc_real < 0) profit_perc_real = '-';
            }

        profit_uec_txt = profit_uec + ' aUEC - ';
        profit_perc_txt = profit_perc + '%';

        global.profit.push({ 'commodity': item, 'profit_uec': profit_uec, 'profit_perc': profit_perc, 'profit_uec_real': profit_uec_real, 'profit_perc_real': profit_perc_real });
        }

    let deals_list = [];
    let deals_list_avg = [];
    const terminals_sell = global.cachedData.data.filter(comm => comm.commodity_name === item && comm.price_sell_avg > 0);
    const terminals_buy = global.cachedData.data.filter(comm => comm.commodity_name === item && comm.price_buy_avg > 0);

    terminals_sell.forEach(sell =>
        {
        terminals_buy.forEach(buy =>
            {
            let amount = sell.scu_sell;
            if (amount > buy.scu_buy) amount = buy.scu_buy;
            deals_list.push({ 'profit': (sell.price_sell - buy.price_buy) * amount, 'investment': buy.price_buy * amount, 'amount': amount, 'buy': buy, 'sell': sell })
            });
        });
    terminals_sell.forEach(sell => {
        terminals_buy.forEach(buy => {
            let amount = sell.scu_sell_avg;
            if (amount > buy.scu_buy_avg) amount = buy.scu_buy_avg;
            deals_list_avg.push({ 'profit': (sell.price_sell_avg - buy.price_buy_avg) * amount, 'investment': buy.price_buy_avg * amount, 'amount': amount, 'buy': buy, 'sell': sell })
        });
    });
    profit_sorted = deals_list.sort((a, b) => b.profit - a.profit).slice(0, 1);
    profit_sorted_avg = deals_list_avg.sort((a, b) => b.profit - a.profit).slice(0, 1);
    best_profit = '';
    best_route = '';
    if (profit_sorted.length > 0)
        {
        best_profit = `( ${profit_uec_txt} ${profit_perc_txt} )`;
        best_route = `<tr><td title="Most profitable trip based on latest reported data">${profit_sorted[0].buy.terminal_name} -> ${profit_sorted[0].sell.terminal_name}</td><td style="text-align:right;" title="Profit from the trip">${readable_number(profit_sorted[0].profit)} aUEC</td><td style="text-align:right;" title="Amount of SCU to trade">${readable_number(profit_sorted[0].amount)} SCU</td><td style="text-align: right; padding-right: 1rem;" title="Required aUEC investment">( ${readable_number(profit_sorted[0].investment)} aUEC )</td></tr>
        <tr><td title="Most profitable trip based on average data">${profit_sorted_avg[0].buy.terminal_name} -> ${profit_sorted_avg[0].sell.terminal_name}</td><td style="text-align:right;" title="Profit from the trip">~ ${readable_number(profit_sorted_avg[0].profit)} aUEC</td><td style="text-align:right;" title="Amount of SCU to trade">~ ${readable_number(profit_sorted_avg[0].amount)} SCU</td><td style="text-align: right; padding-right: 1rem;" title="Required aUEC investment">( ~ ${readable_number(profit_sorted_avg[0].investment)} aUEC )</td></tr>`;
        }
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

function displayProfit_uec(item) { return `<tr><td>${item.commodity}</td><td>${readable_number(item.profit_uec)} UEC/SCU</td></tr>`; }

function displayProfit_perc(item) { return `<tr><td>${item.commodity}</td><td>${item.profit_perc}%</td></tr>`; }

function profit_uec() {
    let profit_sorted = global.profit;
    profit_sorted.sort((a, b) => b.profit_uec - a.profit_uec);
    const header = '<tr><th>Commodity</th><th>Profit aUEC/SCU</th></tr>';
    const data = profit_sorted.map(item => { return `<tr><td><a href="#comm-${item.commodity}">${item.commodity}</a></td><td>${readable_number(item.profit_uec_real)} (up to ${readable_number(item.profit_uec)})</td></tr>`; }).join('');
    return '<table class="best">' + header + data + '</table> <br> <a style="padding-left: 4rem; padding-top: 1rem; color: #333;" href="/about">About this website</a>';
}
function profit_perc() {
    let profit_sorted = global.profit;
    profit_sorted.sort((a, b) => b.profit_perc - a.profit_perc);
    const header = '<tr><th>Commodity</th><th>Profit %</th></tr>';
    const data = profit_sorted.map(item => { return `<tr><td><a href="#comm-${item.commodity}">${item.commodity}</a></td><td>${item.profit_perc_real} (up to ${item.profit_perc})</td></tr>`; }).join('');
    return '<table class="best">' + header + data + '</table>';
}

function readable_number(num)
    {
    if (num == '-') return num;
    return new Intl.NumberFormat("en-US", { useGrouping: true }).format(num).replace(/,/g, " "); 
    }

function touchportal(scu, solar_system = '')
    {
    const uniq_comm = [...new Set(global.cachedData.data.map(item => item.commodity_name))];
    let profit_sorted = global.profit;
    let deals_list = [];
    uniq_comm.forEach(commodity =>
        {
        const terminals_sell = global.cachedData.data.filter(item => item.commodity_name === commodity && item.price_sell_avg > 0);
        const terminals_buy = global.cachedData.data.filter(item => item.commodity_name === commodity && item.price_buy_avg > 0);

        terminals_sell.forEach(sell =>
            {
            const system = global.cachedInitData[sell.terminal_name].name;
            if (solar_system && (system != solar_system)) return;
            terminals_buy.filter(item => global.cachedInitData[item.terminal_name].name === system).forEach(buy =>
                {
                let amount = sell.scu_sell_stock_avg;
                if (amount > buy.scu_buy_stock_avg) amount = buy.scu_buy_stock_avg;
                if (amount > scu) deals_list.push({ 'profit_avg': (sell.price_sell_avg - buy.price_buy_avg) * scu, 'profit': Math.floor(((sell.price_sell - buy.price_buy) * scu) / 1000), 'investment': buy.price_buy_avg * scu, 'amount': scu, 'system': system, 'buy': buy, 'sell': sell })
                });       
            });
        });
    profit_sorted = deals_list.filter(item => item.amount === scu).sort((a, b) => b.profit_avg - a.profit_avg).slice(0, 20);
    let output = '';
    output = output + '<table><tr><th>Commodity</th><th>System</th><th>From</th><th>To</th><th>Profit aUEC/' + scu +' SCU</th><th>Investment</th></tr>';
    output = output + profit_sorted.map(item => { return `<tr><td>${item.sell.commodity_name}</td><td>${item.system}</td><td>${item.buy.terminal_name}</td><td>${item.sell.terminal_name}</td><td>~ ${readable_number(item.profit_avg)} ( ${readable_number(item.profit)}k )</td><td>${readable_number(item.investment)}</td></tr>`; }).join('');
    output = output + '</table>';
    return `
<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="refresh" content="10">
    <style>
        body
            {
            background-color: black;
            color: white;
            }
        body div#top
            {
            text-align: center;
            margin-bottom: 2rem;
            }
        body div#top a
            {
            background-color: #006fdd;
            border-radius: 5px;
            text-align: center;
            padding: 0.4rem;
            }
        table
            {
            margin-right: auto;
            margin-left: auto;
            margin-bottom: 1rem;
            }
        table tr th
            {
            background-color: #006fdd;
            border-radius: 5px;
            text-align: center;
            padding-left: 0.5rem;
            padding-right: 0.5rem;
            }
        table tr td
            {
            text-align: center;
            }
        a
            {
            text-decoration: none;
            color: white;
            }
    </style>
</head>
<body>
    <div id="top">
        <a href="/touchportal/` + scu + `/Stanton">Stanton only</a>
        <a href="/touchportal/` + scu + `/Pyro">Pyro only</a>
        <a style="margin-right: 3rem;" href="/touchportal/` + scu + `/">All systems</a> 
        ${scu > 10 ? "<a href='/touchportal/" + (Number(scu) - 10) + "/" + String(solar_system) +"'>-10 SCU</a>" : "" }
        <a href="/touchportal/` + (Number(scu) + 10) + `/` + String(solar_system) + `">+10 SCU</a>
        ${scu > 100 ? "<a href='/touchportal/" + (Number(scu) - 100) + "/" + String(solar_system) +"'>-100 SCU</a>" : "" }
        <a href="/touchportal/` + (Number(scu) + 100) + `/` + String(solar_system) + `">+100 SCU</a>
    </div>
    `+ output + `

</body>
</html>

    `;
    }

module.exports = { header, footer, displayCommodity, css, profit_uec, profit_perc, touchportal, about };
