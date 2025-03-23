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
</thml>
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
    `;
}

function displayTerminal(item) {
    const price = (item.price_buy || 0) + (item.price_sell || 0);
    const price_avg = (item.price_buy_avg || 0) + (item.price_sell_avg || 0);
    const stock = (item.scu_buy || 0) + (item.scu_sell || 0);
    const stock_avg = (item.scu_buy_avg || 0) + (item.scu_sell_avg || 0);
    return `<tr><td>${item.terminal_name}</td><td>${price} (~${price_avg})</td><td>${stock} (~${stock_avg})</td></tr>`;
}

function displayPricing(pricings, stock_demand) { return '<tr><th>Location</th><th>Price (avg)</th><th>' + stock_demand + ' (avg)</th></tr>' + pricings.map(terminal => displayTerminal(terminal)).join(''); }

function displayCommodity(item, buy = [], sell = []) {
    const buy_sorted = buy.sort((a, b) => a.price_buy - b.price_buy);
    const sell_sorted = sell.sort((a, b) => b.price_sell - a.price_sell);

    const sell_sorted_real = sell.filter(item => item.scu_sell_avg !== null && item.scu_sell_avg !== 0);
    const buy_sorted_real = buy.filter(item => item.scu_buy_avg !== null && item.scu_buy_avg !== 0);

    let profit_uec_txt = '';
    let profit_perc_txt = '';
    if (sell_sorted.length > 0 && buy_sorted.length > 0) {
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
    return `
    <table class="commodity" id="comm-${item}">
        <tr><th colspan="2" style="text-align:center;">${item} ( ${profit_uec_txt} ${profit_perc_txt} )</th></tr>

        <tr>
            <td>(you) Sell</td>
            <td>(you) Buy</td>
        </tr>
        <tr>
            <td>
                <table>
                    ${displayPricing(sell_sorted, 'Demand')}
                </table>
            </td>
            <td>
                <table>
                    ${displayPricing(buy_sorted, 'In stock')}
                </table>
            </td>
        </tr>
    </table>
    `;
}

function displayProfit_uec(item) { return `<tr><td>${item.commodity}</td><td>${item.profit_uec} UEC/SCU</td></tr>`; }

function displayProfit_perc(item) { return `<tr><td>${item.commodity}</td><td>${item.profit_perc}%</td></tr>`; }

function profit_uec() {
    let profit_sorted = global.profit;
    profit_sorted.sort((a, b) => b.profit_uec - a.profit_uec);
    const header = '<tr><th>Commodity</th><th>Profit aUEC/SCU</th></tr>';
    const data = profit_sorted.map(item => { return `<tr><td><a href="#comm-${item.commodity}">${item.commodity}</a></td><td>${item.profit_uec_real} (up to ${item.profit_uec})</td></tr>`; }).join('');
    return '<table class="best">' + header + data + '</table>';
}
function profit_perc() {
    let profit_sorted = global.profit;
    profit_sorted.sort((a, b) => b.profit_perc - a.profit_perc);
    const header = '<tr><th>Commodity</th><th>Profit %</th></tr>';
    const data = profit_sorted.map(item => { return `<tr><td><a href="#comm-${item.commodity}">${item.commodity}</a></td><td>${item.profit_perc_real} (up to ${item.profit_perc})</td></tr>`; }).join('');
    //const header = '<tr><td>Commodity name</td>' + profit_sorted.map(item => { return `<td>${item.commodity}</td>`; }).join('') + '</tr>';
    //const data = '<tr><td>Profit</td>' + profit_sorted.map(item => { return `<td>${item.profit_perc}%</td>`; }).join('') + '</tr>';
    return '<table class="best">' + header + data + '</table>';
}

function readable_number(num)
    { return new Intl.NumberFormat("en-US", { useGrouping: true }).format(num).replace(/,/g, " "); 


    }
function touchportal()
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
            terminals_buy.filter(item => global.cachedInitData[item.terminal_name].name === system).forEach(buy =>
                {
                let amount = sell.scu_sell_stock_avg;
                if (amount > buy.scu_buy_stock_avg) amount = buy.scu_buy_stock_avg;
                if (amount > 50) deals_list.push({ 'profit_avg': (sell.price_sell_avg - buy.price_buy_avg) * 50, 'profit': Math.floor(((sell.price_sell - buy.price_buy) * 50) / 1000), 'investment': buy.price_buy_avg * 50, 'amount': 50, 'system': system, 'buy': buy, 'sell': sell })
                if (amount > 100) deals_list.push({ 'profit_avg': (sell.price_sell_avg - buy.price_buy_avg) * 100, 'profit': Math.floor(((sell.price_sell - buy.price_buy) * 100) / 1000), 'investment': buy.price_buy_avg * 100, 'amount': 100, 'system': system, 'buy': buy, 'sell': sell })
                if (amount > 300) deals_list.push({ 'profit_avg': (sell.price_sell_avg - buy.price_buy_avg) * 300, 'profit': Math.floor(((sell.price_sell - buy.price_buy) * 300) / 1000), 'investment': buy.price_buy_avg * 300, 'amount': 300, 'system': system, 'buy': buy, 'sell': sell })
                if (amount > 500) deals_list.push({ 'profit_avg': (sell.price_sell_avg - buy.price_buy_avg) * 500, 'profit': Math.floor(((sell.price_sell - buy.price_buy) * 500) / 1000), 'investment': buy.price_buy_avg * 500, 'amount': 500, 'system': system, 'buy': buy, 'sell': sell })
                });       
            });
        });
    profit_sorted = deals_list.filter(item => item.amount === 50).sort((a, b) => b.profit_avg - a.profit_avg).slice(0, 10);
    let output = '';
    output = output + '<table><tr><th>Commodity</th><th>System</th><th>From</th><th>To</th><th>Profit aUEC/50 SCU</th><th>Investment</th></tr>';
    output = output + profit_sorted.map(item => { return `<tr><td>${item.sell.commodity_name}</td><td>${item.system}</td><td>${item.buy.terminal_name}</td><td>${item.sell.terminal_name}</td><td>~${readable_number(item.profit_avg)} (${readable_number(item.profit)}k)</td><td>${readable_number(item.investment)}</td></tr>`; }).join('');
    output = output + '</table>';

    profit_sorted = deals_list.filter(item => item.amount === 100).sort((a, b) => b.profit_avg - a.profit_avg).slice(0, 10);
    output = output + '<table><tr><th>Commodity</th><th>System</th><th>From</th><th>To</th><th>Profit aUEC/100 SCU</th><th>Investment</th></tr>';
    output = output + profit_sorted.map(item => { return `<tr><td>${item.sell.commodity_name}</td><td>${item.system}</td><td>${item.buy.terminal_name}</td><td>${item.sell.terminal_name}</td><td>~${readable_number(item.profit_avg)} (${readable_number(item.profit)}k)</td><td>${readable_number(item.investment)}</td></tr>`; }).join('');
    output = output + '</table>';

    profit_sorted = deals_list.filter(item => item.amount === 300).sort((a, b) => b.profit_avg - a.profit_avg).slice(0, 10);
    output = output + '<table><tr><th>Commodity</th><th>System</th><th>From</th><th>To</th><th>Profit aUEC/300 SCU</th><th>Investment</th></tr>';
    output = output + profit_sorted.map(item => { return `<tr><td>${item.sell.commodity_name}</td><td>${item.system}</td><td>${item.buy.terminal_name}</td><td>${item.sell.terminal_name}</td><td>~${readable_number(item.profit_avg)} (${readable_number(item.profit)}k)</td><td>${readable_number(item.investment)}</td></tr>`; }).join('');
    output = output + '</table>';

    profit_sorted = deals_list.filter(item => item.amount === 500).sort((a, b) => b.profit_avg - a.profit_avg).slice(0, 10);
    output = output + '<table><tr><th>Commodity</th><th>System</th><th>From</th><th>To</th><th>Profit aUEC/500 SCU</th><th>Investment</th></tr>';
    output = output + profit_sorted.map(item => { return `<tr><td>${item.sell.commodity_name}</td><td>${item.system}</td><td>${item.buy.terminal_name}</td><td>${item.sell.terminal_name}</td><td>~${readable_number(item.profit_avg)} (${readable_number(item.profit)}k)</td><td>${readable_number(item.investment)}</td></tr>`; }).join('');
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
    `+ output + `

</body>
</html>

    `;
    }

module.exports = { header, footer, displayCommodity, css, profit_uec, profit_perc, touchportal };
