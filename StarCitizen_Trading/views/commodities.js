/**
 * Commodity Display Module
 * Handles commodity table generation and profit calculations
 */

const { readable_number, getStalenessLevel, formatDateTime, formatContainerSizes, escapeHtml, estimateMaxInventory } = require('../utils/formatters.js');

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
    const raw_max = (item.scu_buy_max || 0) + (item.scu_sell_max || 0);
    const raw_max_is_estimate = item.scu_buy_max_is_estimate || item.scu_sell_max_is_estimate;

    // Floor the displayed max at the current live stock: if the terminal is
    // holding more right now than the scan ever recorded, that's a new high
    // we can display immediately instead of waiting for the next scan to catch
    // up. When the bump happens, the value stops being "confirmed from history"
    // and becomes "confirmed from right-now observation" - still no tilde.
    const max_inventory = raw_max > 0 ? Math.max(raw_max, stock) : 0;
    const max_is_estimate = max_inventory > raw_max ? false : raw_max_is_estimate;

    const staleness = getStalenessLevel(item.date_modified, staleThresholds);
    // Use UEX status tier (0-7) to determine stock level color.
    // Buy side: high status = well stocked (green). Sell side: low status = high demand (green).
    const status = (item.status_buy || 0) + (item.status_sell || 0);
    let stockClass;
    if (side === 'buy') {
        if (status >= 6) stockClass = 'stock-available';
        else if (status >= 2) stockClass = 'stock-medium';
        else stockClass = 'stock-depleted';
    } else {
        if (status <= 1) stockClass = 'stock-available';
        else if (status <= 5) stockClass = 'stock-medium';
        else stockClass = 'stock-depleted';
    }
    const classes = [stockClass];
    if (staleness !== 'fresh') classes.push(staleness);
    const rowClass = ` class="${classes.join(' ')}"`;

    const updatedTitle = `Last updated: ${formatDateTime(item.date_modified)}`;
    const sizesTitle = `SCU box sizes: ${formatContainerSizes(item.container_sizes)}`;
    const maxTitle = max_is_estimate
        ? 'Estimated max capacity (based on current stock level)'
        : 'Confirmed max stock observed';
    const maxSuffix = max_inventory > 0 ? ` / ${max_is_estimate ? '~' : ''}${readable_number(max_inventory)}` : '';

    return `<tr${rowClass}>
        <td title="${escapeHtml(sizesTitle)}&#10;${escapeHtml(updatedTitle)}">${escapeHtml(item.terminal_name)}</td>
        <td>${readable_number(price)} (~${readable_number(price_avg)})</td>
        <td title="${escapeHtml(maxTitle)}">${readable_number(stock)} (~${readable_number(stock_avg)})${maxSuffix}</td>
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
 * Compute market depth for a single commodity across all terminals.
 * Sums current, average, and confirmed-max SCU for both buy and sell sides.
 * @param {string} commodityName
 * @param {Object} cachedData
 * @param {Object} cache - DataCache instance (for confirmed max lookups)
 * @returns {Object}
 */
function calcMarketDepth(commodityName, cachedData, cache) {
    let buyCurrent = 0, buyAvg = 0, buyMax = 0, buyTerminals = 0;
    let sellCurrent = 0, sellAvg = 0, sellMax = 0, sellTerminals = 0;
    let bestBuyPrice = Infinity, bestSellPrice = 0;

    cachedData.data.forEach(d => {
        if (d.commodity_name !== commodityName) return;

        if (d.price_buy > 0 && d.scu_buy > 0) {
            const confirmedMax = cache.getConfirmedMax(`${d.id_commodity}_${d.id_terminal}`, 'buy');
            const maxVal = confirmedMax ?? estimateMaxInventory(d.scu_buy, d.status_buy);
            buyCurrent += d.scu_buy;
            buyAvg += d.scu_buy_avg || 0;
            buyMax += maxVal;
            buyTerminals++;
            if (d.price_buy < bestBuyPrice) bestBuyPrice = d.price_buy;
        }

        if (d.price_sell > 0 && d.scu_sell_stock > 0) {
            const confirmedMax = cache.getConfirmedMax(`${d.id_commodity}_${d.id_terminal}`, 'sell');
            const maxVal = confirmedMax ?? estimateMaxInventory(d.scu_sell_stock, d.status_sell);
            sellCurrent += d.scu_sell_stock;
            sellAvg += d.scu_sell_stock_avg || 0;
            sellMax += maxVal;
            sellTerminals++;
            if (d.price_sell > bestSellPrice) bestSellPrice = d.price_sell;
        }
    });

    const bestBuy = bestBuyPrice === Infinity ? 0 : bestBuyPrice;
    const margin = bestSellPrice - bestBuy;
    const tradeableCurrent = Math.min(buyCurrent, sellCurrent);
    const tradeableMax = Math.min(buyMax, sellMax);
    const potentialCurrent = margin > 0 && tradeableCurrent > 0 ? tradeableCurrent * margin : 0;
    const potentialMax = margin > 0 && tradeableMax > 0 ? tradeableMax * margin : 0;

    return {
        buyCurrent, buyAvg, buyMax, buyTerminals,
        sellCurrent, sellAvg, sellMax, sellTerminals,
        tradeableCurrent, tradeableMax,
        potentialCurrent, potentialMax
    };
}

/**
 * Generate market depth summary row HTML for a commodity table.
 */
function generateMarketDepthRowHTML(depth) {
    const { buyCurrent, buyAvg, buyMax, buyTerminals, sellCurrent, sellAvg, sellMax, sellTerminals, tradeableCurrent, tradeableMax, potentialCurrent, potentialMax } = depth;
    if (!buyCurrent && !sellCurrent) return '';

    const buyMaxStr = buyMax > 0 ? ` / ${readable_number(buyMax)}` : '';
    const sellMaxStr = sellMax > 0 ? ` / ${readable_number(sellMax)}` : '';
    const tradeableMaxStr = tradeableMax > 0 ? ` / ${readable_number(tradeableMax)}` : '';
    const potentialMaxStr = potentialMax > 0 ? ` / ${readable_number(potentialMax)}` : '';

    const cellColor = (current, max, invert = false) => {
        if (!max) return '';
        const p = Math.round(current / max * 100);
        if (invert) {
            if (p <= 30) return ' style="color:#b8e0b8"';
            if (p >= 70) return ' style="color:#ffb0b0"';
        } else {
            if (p >= 70) return ' style="color:#b8e0b8"';
            if (p <= 30) return ' style="color:#ffb0b0"';
        }
        return '';
    };
    const percStr = (current, max) => max ? ` (${Math.round(current / max * 100)}%)` : '';

    return `<tr>
        <th title="How much of this commodity terminals will buy from you (current / avg / max SCU across ${sellTerminals} terminal${sellTerminals !== 1 ? 's' : ''})">Total Demand</th>
        <th title="How much of this commodity you can buy from terminals (current / avg / max SCU across ${buyTerminals} terminal${buyTerminals !== 1 ? 's' : ''})">Total Supply</th>
        <th title="How much you can actually trade right now — limited by whichever side is smaller (current / max SCU)">Tradeable</th>
        <th title="Total market opportunity — tradeable SCU × best margin (current / max aUEC)">Market Potential</th>
    </tr>
    <tr class="market-depth-row">
        <td${cellColor(sellCurrent, sellMax, true)}>${readable_number(sellCurrent)} (~${readable_number(sellAvg)})${sellMaxStr} SCU${percStr(sellCurrent, sellMax)}</td>
        <td${cellColor(buyCurrent, buyMax)}>${readable_number(buyCurrent)} (~${readable_number(buyAvg)})${buyMaxStr} SCU${percStr(buyCurrent, buyMax)}</td>
        <td${cellColor(tradeableCurrent, tradeableMax)}>${readable_number(tradeableCurrent)}${tradeableMaxStr} SCU${percStr(tradeableCurrent, tradeableMax)}</td>
        <td${cellColor(potentialCurrent, potentialMax)}>${readable_number(potentialCurrent)}${potentialMaxStr} aUEC${percStr(potentialCurrent, potentialMax)}</td>
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

    const depth = calcMarketDepth(item, cachedData, cache);
    const market_depth_row = generateMarketDepthRowHTML(depth);

    return `
    <table class="commodity" id="comm-${escapeHtml(item)}">
        <tr><th colspan="4" class="text-center">${escapeHtml(item)} ${best_profit}</th></tr>
        ${best_route}
        ${market_depth_row}
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
