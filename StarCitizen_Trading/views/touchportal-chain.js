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
 * index[displayName] = { b: {commodity: avgBuyPrice}, s: {commodity: avgSellPrice} }
 * displayName includes system prefix, e.g. "(ST) TDD New Babbage"
 * b = player CAN BUY here (price_buy_avg > 0)
 * s = player CAN SELL here (price_sell_avg > 0)
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
        if (buyAvg  > 0) index[t].b[c] = buyAvg;
        if (sellAvg > 0) index[t].s[c] = sellAvg;
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
    div#stops-row .stop-arrow { color: #4ab8ff; font-size: 1.1rem; display: block; line-height: 1; text-align: center; }
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
    div.action-label { font-size: 0.8rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; margin: 0.6rem 0 0.25rem; }
    div.sell-label { color: #7dff8a; }
    div.buy-label  { color: #ffd966; }
    p#no-trades { text-align: center; color: #888; margin-top: 2rem; }
    span#scu-label { color: #ffd966; font-weight: bold; }
</style>

<div id="chain-wrap">
<div id="chain-setup">
    <div id="ship-row">
        <label for="ship-select">Ship:</label>
        <select id="ship-select">${shipOptions}</select>
    </div>
    <div id="stops-row"></div>
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
        <button class="btn green" onclick="addStop()">+ Add Stop</button>
        <button class="btn" onclick="computeAndShow()">Show Trades</button>
        <button class="btn red" onclick="clearAll()">Clear All</button>
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

        if (stops.length > 0) {
            var arrowRow = document.createElement('span');
            arrowRow.className = 'stop-arrow';
            arrowRow.textContent = '\\u2193';
            stopsRow.appendChild(arrowRow);
        }

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

                Object.keys(B.b).forEach(function (c) {
                    var bp = B.b[c];
                    var sp = S.s[c];
                    if (!sp || sp <= bp) return;
                    rows.push({
                        commodity: c,
                        buyTerm:   buyTerm,
                        sellTerm:  sellTerm,
                        buyPrice:  bp,
                        sellPrice: sp,
                        profit:    sp - bp,
                        total:     (sp - bp) * scu
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
            var buys  = buyAt[idx].sort(function (a, b) { return b.profit - a.profit; });
            var sells = sellAt[idx].sort(function (a, b) { return b.profit - a.profit; });
            if (!buys.length && !sells.length) return;
            anyFound = true;

            html += '<div class="stop-section">'
                + '<h3 class="stop-header">' + name + '</h3>';

            if (sells.length) {
                html += '<div class="action-label sell-label">Sell here</div>'
                    + '<table><thead><tr><th>Commodity</th><th>Bought at</th>'
                    + '<th>Buy avg</th><th>Sell avg</th>'
                    + '<th>Profit / SCU</th><th>Est. Total (' + scu + ' SCU)</th>'
                    + '</tr></thead><tbody>';
                sells.forEach(function (r) {
                    html += '<tr>'
                        + '<td>' + r.commodity + '</td>'
                        + '<td class="from">' + r.buyTerm + '</td>'
                        + '<td>' + fmtNum(r.buyPrice) + '</td>'
                        + '<td>' + fmtNum(r.sellPrice) + '</td>'
                        + '<td class="profit">' + fmtNum(r.profit) + '</td>'
                        + '<td class="total">' + fmtNum(r.total) + '</td>'
                        + '</tr>';
                });
                html += '</tbody></table>';
            }

            if (buys.length) {
                html += '<div class="action-label buy-label">Buy here</div>'
                    + '<table><thead><tr><th>Commodity</th><th>Sell at</th>'
                    + '<th>Buy avg</th><th>Sell avg</th>'
                    + '<th>Profit / SCU</th><th>Est. Total (' + scu + ' SCU)</th>'
                    + '</tr></thead><tbody>';
                buys.forEach(function (r) {
                    html += '<tr>'
                        + '<td>' + r.commodity + '</td>'
                        + '<td class="to">' + r.sellTerm + '</td>'
                        + '<td>' + fmtNum(r.buyPrice) + '</td>'
                        + '<td>' + fmtNum(r.sellPrice) + '</td>'
                        + '<td class="profit">' + fmtNum(r.profit) + '</td>'
                        + '<td class="total">' + fmtNum(r.total) + '</td>'
                        + '</tr>';
                });
                html += '</tbody></table>';
            }

            html += '</div>';
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
