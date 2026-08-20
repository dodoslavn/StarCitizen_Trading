/**
 * Commodity Display Module
 * Handles commodity table generation and profit calculations
 */

const { readable_number, getStalenessLevel, formatDateTime, formatContainerSizes, escapeHtml, getStockUsageClass } = require('../utils/formatters.js');

/**
 * Display single terminal data row
 * @param {Object} item - Terminal data
 * @param {Object} staleThresholds - Staleness thresholds in minutes ({ stale, veryStale })
 * @param {'buy'|'sell'} side - Which side of the trade this row represents
 * @returns {string} HTML table row
 */
function displayTerminal(item, staleThresholds, side) {
    const price = (item.price_buy || 0) + (item.price_sell || 0);
    const price_avg = (item.price_buy_avg || 0) + (item.price_sell_avg || 0);
    const stock = (item.scu_buy || 0) + (item.scu_sell || 0);
    const stock_avg = (item.scu_buy_avg || 0) + (item.scu_sell_avg || 0);
    const max_inventory = (item.scu_buy_max || 0) + (item.scu_sell_max || 0);
    const max_is_estimate = item.scu_buy_max_is_estimate || item.scu_sell_max_is_estimate;

    const staleness = getStalenessLevel(item.date_modified, staleThresholds);
    const rowClass = staleness !== 'fresh' ? ` class="${staleness}"` : '';
    const updatedTitle = `Last updated: ${formatDateTime(item.date_modified)}`;
    const sizesTitle = `SCU box sizes: ${formatContainerSizes(item.container_sizes)}`;
    const maxTitle = max_is_estimate
        ? 'Estimated max capacity (based on current stock level)'
        : 'Confirmed max stock observed in the last ~30 days';
    const maxSuffix = max_inventory > 0 ? ` / ${max_is_estimate ? '~' : ''}${readable_number(max_inventory)}` : '';

    const usageClass = getStockUsageClass(stock, max_inventory, side, staleness);
    const stockClassAttr = usageClass ? ` class="${usageClass}"` : '';

    return `<tr${rowClass}>
        <td title="${escapeHtml(sizesTitle)}&#10;${escapeHtml(updatedTitle)}">${escapeHtml(item.terminal_name)}</td>
        <td>${readable_number(price)} (~${readable_number(price_avg)})</td>
        <td${stockClassAttr} title="${escapeHtml(maxTitle)}">${readable_number(stock)} (~${readable_number(stock_avg)})${maxSuffix}</td>
    </tr>`;
}

/**
 * Display pricing table (buy or sell)
 * @param {Array} pricings - Array of pricing data
 * @param {string} stock_demand - Label for stock/demand column
 * @param {Object} staleThresholds - Staleness thresholds in minutes ({ stale, veryStale })
 * @param {'buy'|'sell'} side - Which side of the trade this table represents
 * @returns {string} HTML table content
 */
function displayPricing(pricings, stock_demand, staleThresholds, side) {
    const no_prices = pricings.length === 0 ? '<tr><td>-</td><td>-</td><td>-</td></tr>' : '';
    const header = `<tr><th>Location</th><th>Price (avg)</th><th>${stock_demand} (avg)</th></tr>`;
    const rows = pricings.map(terminal => displayTerminal(terminal, staleThresholds, side)).join('');

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
            (${escapeHtml(cachedInitData?.[latest.buy.terminal_name]?.code ?? '?')}) ${escapeHtml(latest.buy.terminal_name)} →
            (${escapeHtml(cachedInitData?.[latest.sell.terminal_name]?.code ?? '?')}) ${escapeHtml(latest.sell.terminal_name)}
        </td>
        <td class="text-right" title="Profit from the trip">${readable_number(latest.profit)} aUEC</td>
        <td class="text-right" title="Amount of SCU to trade">${readable_number(latest.amount)} SCU</td>
        <td class="text-right padding-right-1" title="Required aUEC investment">
            ( ${readable_number(latest.investment)} aUEC )
        </td>
    </tr>
    <tr>
        <td title="Most profitable trip based on average data">
            (${escapeHtml(cachedInitData?.[average.buy.terminal_name]?.code ?? '?')}) ${escapeHtml(average.buy.terminal_name)} →
            (${escapeHtml(cachedInitData?.[average.sell.terminal_name]?.code ?? '?')}) ${escapeHtml(average.sell.terminal_name)}
        </td>
        <td class="text-right" title="Profit from the trip">~ ${readable_number(average.profit)} aUEC</td>
        <td class="text-right" title="Amount of SCU to trade">~ ${readable_number(average.amount)} SCU</td>
        <td class="text-right padding-right-1" title="Required aUEC investment">
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
 * @param {Object} staleThresholds - Staleness thresholds in minutes ({ stale, veryStale })
 * @returns {string} HTML table for commodity
 */
function displayCommodity(item, buy = [], sell = [], cache, staleThresholds = { stale: 1440, veryStale: 4320 }) {
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
    <table class="commodity" id="comm-${escapeHtml(item)}">
        <tr><th colspan="4" class="text-center">${escapeHtml(item)} ${best_profit}</th></tr>
        ${best_route}
        <tr>
            <td colspan="2">(you) Sell</td>
            <td colspan="2">(you) Buy</td>
        </tr>
        <tr>
            <td colspan="2">
                <table>
                    ${displayPricing(sell_sorted, 'Demand', staleThresholds, 'sell')}
                </table>
            </td>
            <td colspan="2">
                <table>
                    ${displayPricing(buy_sorted, 'In stock', staleThresholds, 'buy')}
                </table>
            </td>
        </tr>
    </table>
    `;
}

module.exports = {
    displayCommodity
};
