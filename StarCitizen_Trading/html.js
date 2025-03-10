const header = `
<html>
    <head>
        <title>ComTrading - Star Citizen</title>
        <link rel="stylesheet" type="text/css" href="default.css" media="screen" >
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
    //width: 100%;
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
    margin: 2rem;
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
    //const header = '<tr><td>Commodity name</td>' + profit_sorted.map(item => { return `<td>${item.commodity}</td>`; }).join('') + '</tr>';
    //const data = '<tr><td>Profit [UEC/SCU]</td>' + profit_sorted.map(item => { return `<td>${item.profit_uec}</td>`; }).join('') + '</tr>';
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
module.exports = { header, footer, displayCommodity, css, profit_uec, profit_perc };
