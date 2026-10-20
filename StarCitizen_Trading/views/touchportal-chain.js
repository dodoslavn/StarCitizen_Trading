/**
 * Chain Route Planner
 * /touchportal/chain  — pick any number of stops and a ship; see all
 * profitable trades between every forward pair of stops.
 */

'use strict';

const { shell } = require('./touchportal.js');
const { escapeHtml } = require('../utils/formatters.js');

/**
 * Build a compact price index from the raw cache data.
 * index[displayName] = {
 *   b: { commodity: { p: avgBuyPrice,  scu: avgBuyScu  } },
 *   s: { commodity: { p: avgSellPrice, scu: avgSellScu } }
 * }
 * b = player CAN BUY here, s = player CAN SELL here
 * @param {Object} cachedData - cache.getData()
 * @param {Object} initData   - cache.getInitData()
 * @returns {Object}
 */
function buildPriceIndex(cachedData, initData) {
    const index = {};
    for (const item of cachedData.data) {
        const rawName = item.terminal_name;
        const c = item.commodity_name;
        if (!rawName || !c) continue;
        const code = initData?.[rawName]?.code ?? '?';
        const t = `(${code}) ${rawName}`;
        if (!index[t]) index[t] = { b: {}, s: {} };
        const buyAvg  = Number(item.price_buy_avg)  || 0;
        const sellAvg = Number(item.price_sell_avg) || 0;
        if (buyAvg  > 0) index[t].b[c] = { p: buyAvg,  scu: Number(item.scu_buy_avg)       || 0 };
        if (sellAvg > 0) index[t].s[c] = { p: sellAvg, scu: Number(item.scu_sell_stock_avg) || 0 };
    }
    return index;
}

/**
 * Generate the chain route planner page.
 * @param {Object} cache - DataCache instance
 * @returns {string} HTML
 */
function touchportalChain(cache) {
    const cachedData = cache.getData();
    if (!cachedData) return shell('Chain Route', '<p style="text-align:center">No data yet — try again shortly.</p>', false);

    const initData = cache.getInitData();
    const index    = buildPriceIndex(cachedData, initData);
    const vehicles = cache.getVehicles();

    // Sorted terminal list for the datalist dropdowns
    const terminalNames = Object.keys(index).sort();

    // Ship options — vehicles sorted ascending by SCU
    const shipOptions = vehicles.length > 0
        ? vehicles.map(v => `<option value="${escapeHtml(v.slug)}">${escapeHtml(v.name)} (${v.scu} SCU)</option>`).join('')
        : '<option value="">No ship data</option>';

    const indexJson    = JSON.stringify(index);
    const terminalsJson = JSON.stringify(terminalNames);

    const body = `
<h1>Chain Route Planner</h1>
<style>
    div#chain-wrap { max-width: 72rem; margin: 0 auto; }
    div#chain-setup { margin-bottom: 1.5rem; display: flex; flex-direction: column; align-items: center; }
    div#stops-row { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.8rem; }
    div#stops-row .stop-wrap { display: flex; align-items: center; gap: 0.4rem; }
    div#stops-row .stop-arrow { color: #555; font-size: 1.1rem; display: block; line-height: 1; text-align: center; }
    input.stop-input { background: #1a1a1a; color: white; border: 1px solid #444; border-radius: 6px; padding: 0.45rem 0.6rem; font-size: 1rem; width: 16rem; }
    input.stop-input:focus { outline: none; border-color: #4ab8ff; }
    button.btn { background: #006fdd; color: white; border: none; border-radius: 6px; padding: 0.45rem 0.9rem; font-size: 0.95rem; cursor: pointer; }
    button.btn:hover { background: #4ab8ff; }
    button.btn.red { background: #c0392b; }
    button.btn.red:hover { background: #e74c3c; }
    button.btn.green { background: #1e7e34; }
    button.btn.green:hover { background: #28a745; }
    div#ship-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.8rem; flex-wrap: wrap; justify-content: center; }
    div#ship-row label { color: #aaa; }
    select#ship-select { background: #1a1a1a; color: white; border: 1px solid #444; border-radius: 6px; padding: 0.4rem 0.6rem; font-size: 0.95rem; min-width: 18rem; }
    select#ship-select:focus { outline: none; border-color: #4ab8ff; }
    div#results { }
    div#results table { font-size: 0.85rem; }
    div#results table thead th { position: sticky; top: 0; background: #006fdd; z-index: 2; padding: 0.4rem 0.5rem; }
    div#results table td { padding: 0.3rem 0.5rem; border-bottom: 1px solid #2a2a2a; }
    div#results table tr:hover td { background: #1a1a1a; }
    td.profit  { color: #7dff8a; font-weight: bold; }
    td.total   { color: #ffd966; font-weight: bold; }
    td.from    { color: #4ab8ff; }
    td.to      { color: #ff9f43; }
    div.stop-section { margin-bottom: 2rem; }
    h3.stop-header { color: #4ab8ff; margin: 1.2rem 0 0.5rem; font-size: 1.15rem; border-bottom: 1px solid #333; padding-bottom: 0.3rem; }
    td.action-buy  { color: #ffd966; font-weight: bold; }
    td.action-sell { color: #7dff8a; font-weight: bold; }
    td.eff         { color: #c8a0ff; font-weight: bold; }
    td.hops-good   { color: #7dff8a; }
    td.hops-bad    { color: #ff9f43; }
    td.scu-ok      { color: #7dff8a; }
    td.scu-low     { color: #ff9f43; }
    td.scu-none    { color: #888; font-style: italic; }
    p#no-trades { text-align: center; color: #888; margin-top: 2rem; }
    span#scu-label { color: #ffd966; font-weight: bold; }
</style>

<div id="chain-wrap">
<div id="chain-setup">
    <div id="ship-row">
        <select id="ship-select">${shipOptions}</select>
    </div>
    <div id="stops-row"></div>
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
        <button class="btn red" onclick="clearAll()">Clear All</button>
        <button class="btn green" onclick="addStop()">+ Add Stop</button>
    </div>
</div>
<div id="results"></div>
</div>

<datalist id="terminals-list"></datalist>

<script>
(function () {
    var INDEX = ${indexJson};
    var TERMINALS = ${terminalsJson};

    // Populate datalist
    var dl = document.getElementById('terminals-list');
    TERMINALS.forEach(function (n) {
        var opt = document.createElement('option');
        opt.value = n;
        dl.appendChild(opt);
    });

    var stops = [];   // array of input elements
    var stopsRow = document.getElementById('stops-row');
    var shipSel  = document.getElementById('ship-select');
    shipSel.addEventListener('change', computeAndShow);

    function addStop(value) {
        var wrap = document.createElement('div');
        wrap.className = 'stop-wrap';


        var inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'stop-input';
        inp.placeholder = 'Stop ' + (stops.length + 1);
        inp.setAttribute('list', 'terminals-list');
        inp.setAttribute('autocomplete', 'off');
        if (value) inp.value = value;
        inp.addEventListener('change', computeAndShow);
        inp.addEventListener('input', computeAndShow);
        wrap.appendChild(inp);

        if (stops.length > 1) {
            var del = document.createElement('button');
            del.className = 'btn red';
            del.textContent = '\\u00d7';
            del.style.padding = '0.35rem 0.55rem';
            del.onclick = function () { wrap.remove(); stops.splice(stops.indexOf(inp), 1); computeAndShow(); };
            wrap.appendChild(del);
        }

        stopsRow.appendChild(wrap);
        stops.push(inp);
        inp.focus();
    }

    function clearAll() {
        stopsRow.innerHTML = '';
        stops = [];
        document.getElementById('results').innerHTML = '';
        addStop();
        addStop();
    }

    function fmtNum(n) {
        return ('' + Math.round(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '\\u202f') + ' aUEC';
    }

    function computeAndShow() {
        var names = stops.map(function (i) { return i.value.trim(); }).filter(Boolean);
        var results = document.getElementById('results');

        if (names.length < 2) {
            results.innerHTML = '<p id="no-trades">Add at least 2 stops to see trades.</p>';
            return;
        }

        var opt = shipSel.options[shipSel.selectedIndex];
        var m = opt ? opt.text.match(/\\((\\d+) SCU\\)/) : null;
        var scu = m ? parseInt(m[1]) : 1;

        var rows = [];

        for (var i = 0; i < names.length - 1; i++) {
            for (var j = i + 1; j < names.length; j++) {
                var buyTerm  = names[i];
                var sellTerm = names[j];
                var B = INDEX[buyTerm];
                var S = INDEX[sellTerm];
                if (!B || !S) continue;

                var hops = j - i;
                Object.keys(B.b).forEach(function (c) {
                    var bEntry = B.b[c];
                    var sEntry = S.s[c];
                    if (!sEntry || sEntry.p <= bEntry.p) return;
                    var profit = sEntry.p - bEntry.p;
                    var stockScu = Math.min(bEntry.scu || 0, sEntry.scu || 0);
                    rows.push({
                        commodity: c,
                        buyTerm:   buyTerm,
                        sellTerm:  sellTerm,
                        buyPrice:  bEntry.p,
                        sellPrice: sEntry.p,
                        buyScu:    bEntry.scu || 0,
                        sellScu:   sEntry.scu || 0,
                        stockScu:  stockScu,
                        profit:    profit,
                        total:     profit * Math.min(stockScu || scu, scu),
                        hops:      hops,
                        eff:       profit / hops
                    });
                });
            }
        }

        if (!rows.length) {
            results.innerHTML = '<p id="no-trades">No profitable trades found between the selected stops.</p>';
            return;
        }

        // Build per-stop actions: buy[stopIndex] and sell[stopIndex]
        var buyAt  = names.map(function () { return []; });
        var sellAt = names.map(function () { return []; });
        rows.forEach(function (r) {
            var bi = names.indexOf(r.buyTerm);
            var si = names.indexOf(r.sellTerm);
            if (bi < 0 || si < 0) return;
            buyAt[bi].push(r);
            sellAt[si].push(r);
        });

        var anyFound = false;
        var html = '';
        names.forEach(function (name, idx) {
            var buys  = buyAt[idx].sort(function (a, b) { return b.eff - a.eff; });
            var sells = sellAt[idx].sort(function (a, b) { return b.eff - a.eff; });
            if (!buys.length && !sells.length) return;
            anyFound = true;

            // Merge: sells first (do these first on arrival), then buys
            var allRows = [];
            sells.forEach(function (r) { allRows.push({ action: 'Sell', terminal: r.buyTerm, termClass: 'from', r: r }); });
            buys.forEach(function (r)  { allRows.push({ action: 'Buy',  terminal: r.sellTerm, termClass: 'to',   r: r }); });

            html += '<div class="stop-section">'
                + '<h3 class="stop-header">' + name + '</h3>'
                + '<table><thead><tr>'
                + '<th>Action</th><th>Commodity</th>'
                + '<th>Buy avg</th><th>Sell avg</th>'
                + '<th>Profit/SCU</th><th>Hops</th><th title="Profit per SCU divided by number of stops the cargo rides">Eff./SCU</th>'
                + '<th title="Supply SCU at buy terminal">Supply</th>'
                + '<th title="Demand SCU at sell terminal">Demand</th>'
                + '<th>Est. Total</th>'
                + '<th>Terminal</th>'
                + '</tr></thead><tbody>';

            allRows.forEach(function (entry) {
                var r = entry.r;
                var actionClass = entry.action === 'Buy' ? 'action-buy' : 'action-sell';
                var hopClass = r.hops === 1 ? 'hops-good' : r.hops >= 3 ? 'hops-bad' : '';
                var supplyClass = r.buyScu >= scu ? 'scu-ok' : r.buyScu > 0 ? 'scu-low' : 'scu-none';
                var demandClass = r.sellScu >= scu ? 'scu-ok' : r.sellScu > 0 ? 'scu-low' : 'scu-none';
                var supplyTxt = r.buyScu > 0 ? r.buyScu + ' SCU' : '?';
                var demandTxt = r.sellScu > 0 ? r.sellScu + ' SCU' : '?';
                html += '<tr>'
                    + '<td class="' + actionClass + '">' + entry.action + '</td>'
                    + '<td>' + r.commodity + '</td>'
                    + '<td>' + fmtNum(r.buyPrice) + '</td>'
                    + '<td>' + fmtNum(r.sellPrice) + '</td>'
                    + '<td class="profit">' + fmtNum(r.profit) + '</td>'
                    + '<td class="' + hopClass + '">' + r.hops + '</td>'
                    + '<td class="eff">' + fmtNum(r.eff) + '</td>'
                    + '<td class="' + supplyClass + '">' + supplyTxt + '</td>'
                    + '<td class="' + demandClass + '">' + demandTxt + '</td>'
                    + '<td class="total">' + fmtNum(r.total) + '</td>'
                    + '<td class="' + entry.termClass + '">' + entry.terminal + '</td>'
                    + '</tr>';
            });

            html += '</tbody></table></div>';
        });

        results.innerHTML = anyFound ? html : '<p id="no-trades">No profitable trades found between the selected stops.</p>';
    }

    // Start with 2 empty stops
    addStop();
    addStop();
    computeAndShow();

    // Expose for onclick
    window.addStop = addStop;
    window.clearAll = clearAll;
    window.computeAndShow = computeAndShow;
})();
</script>`;

    return shell('Chain Route', body, false);
}

module.exports = { touchportalChain };
