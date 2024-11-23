const header = `
<html>
    <head>
        <title>Star Citizen - cargo trading</title>
        <link rel="stylesheet" type="text/css" href="default.css" media="screen" >
    </head>
    <body>`;

const footer = `
    </body>
</thml>`;

function css() {
    return `
body
    {
    //margin: auto, 0, auto, 0;
    //width: 100%
    }
table
    {
    border: 1px solid black;
    }
table.commodity
    {
    margin: 2rem;
    float: left;
    }
table.best
    {
    margin-top: 1rem;
    margin-left: auto;
    margin-right: auto;
    font-size: 0.8rem;
    }
table.best tbody tr td
    {
    border-left: 1px solid black;
    }
td
    { text-align: center; }
    `;
}

function displayTerminal(item) {
    const price = (item.price_buy || 0) + (item.price_sell || 0);
    const price_avg = (item.price_buy_avg || 0) + (item.price_sell_avg || 0);
    const stock = (item.scu_buy || 0) + (item.scu_sell || 0);
    const stock_avg = (item.scu_buy_avg || 0) + (item.scu_sell_avg || 0);
    return `<tr><td>${item.terminal_name}</td><td>${price} (~${price_avg})</td><td>${stock} (~${stock_avg})</td></tr>`;
}

function displayPricing(pricings, stock_demand) { return '<tr><td>Location</td><td>Price (avg)</td><td>' + stock_demand + ' (avg)</td></tr>' + pricings.map(terminal => displayTerminal(terminal)).join(''); }

function displayCommodity(item, buy = [], sell = []) {
    const buy_sorted = buy.sort((a, b) => a.price_buy - b.price_buy);
    const sell_sorted = sell.sort((a, b) => b.price_sell - a.price_sell);

    let profit_uec_txt = '';
    let profit_perc_txt = '';
    if (sell_sorted.length > 0 && buy_sorted.length > 0) {
        const profit_uec = (sell_sorted[0].price_sell - buy_sorted[0].price_buy);
        const profit_perc = (((sell_sorted[0].price_sell - buy_sorted[0].price_buy) / buy_sorted[0].price_buy) * 100).toFixed(2);

        profit_uec_txt = profit_uec + ' UEC/SCU - ';
        profit_perc_txt = profit_perc + '%';

        global.profit.push({ 'commodity': item, 'profit_uec': profit_uec, 'profit_perc': profit_perc });
    }
    return `
    <table class="commodity">
        <tr><td colspan="2" style="text-align:center;">${item}</td></tr>
        <tr>
            <td>Max profit</td>
            <td>${profit_uec_txt} ${profit_perc_txt}</td>
        </tr>
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
    const header = '<tr><td>Commodity name</td>' + profit_sorted.map(item => { return `<td>${item.commodity}</td>`; }).join('') + '</tr>';
    const data = '<tr><td>Profit [UEC/SCU]</td>' + profit_sorted.map(item => { return `<td>${item.profit_uec}</td>`; }).join('') + '</tr>';
    return '<table class="best">' + header + data + '</table>';
}
function profit_perc() {
    let profit_sorted = global.profit;
    profit_sorted.sort((a, b) => b.profit_perc - a.profit_perc);
    const header = '<tr><td>Commodity name</td>' + profit_sorted.map(item => { return `<td>${item.commodity}</td>`; }).join('') + '</tr>';
    const data = '<tr><td>Profit</td>' + profit_sorted.map(item => { return `<td>${item.profit_perc}%</td>`; }).join('') + '</tr>';
    return '<table class="best">' + header + data + '</table>';
}
module.exports = { header, footer, displayCommodity, css, profit_uec, profit_perc };