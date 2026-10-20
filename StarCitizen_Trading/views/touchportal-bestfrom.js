'use strict';

const { shell } = require('./touchportal.js');
const { escapeHtml, estimateMaxInventory } = require('../utils/formatters.js');

function buildPriceIndex(cachedData, initData) {
    const index = {};
    for (const item of cachedData.data) {
        const rawName = item.terminal_name;
        const c = item.commodity_name;
        if (!rawName || !c) continue;
        const meta   = initData?.[rawName] ?? {};
        const code   = meta.code ?? '?';
        const t = `(${code}) ${rawName}`;
        if (!index[t]) index[t] = { b: {}, s: {}, sys: meta.name || '', planet: meta.planet_name || '' };
        const buyAvg  = Number(item.price_buy_avg)  || 0;
        const sellAvg = Number(item.price_sell_avg) || 0;
        if (buyAvg  > 0) index[t].b[c] = { p: buyAvg,  cur: Number(item.scu_buy)        || 0, scu: Number(item.scu_buy_avg)       || 0, max: estimateMaxInventory(Number(item.scu_buy_avg)       || 0, item.status_buy)  || 0 };
        if (sellAvg > 0) index[t].s[c] = { p: sellAvg, cur: Number(item.scu_sell_stock) || 0, scu: Number(item.scu_sell_stock_avg) || 0, max: estimateMaxInventory(Number(item.scu_sell_stock_avg) || 0, item.status_sell) || 0 };
    }
    return index;
}

function touchportalBestFrom(cache) {
    const cachedData = cache.getData();
    if (!cachedData) return shell('Best From Here', '<p style="text-align:center">No data yet — try again shortly.</p>', false);

    const initData  = cache.getInitData();
    const index     = buildPriceIndex(cachedData, initData);
    const vehicles  = cache.getVehicles();

    const terminalNames = Object.keys(index).sort();
    const shipOptions = vehicles.length > 0
        ? vehicles.map(v => `<option value="${escapeHtml(v.slug)}">${escapeHtml(v.name)} (${v.scu} SCU)</option>`).join('')
        : '<option value="">No ship data</option>';

    const indexJson     = JSON.stringify(index);
    const terminalsJson = JSON.stringify(terminalNames);

    const body = `
<h1>Best From Here</h1><style>
    h1 { font-size: 1.3rem; margin: 0.4rem 0 0.8rem; text-align: center; }
    div#wrap { max-width: 72rem; margin: 0 auto; }
    div#setup { display: flex; justify-content: center; gap: 0.5rem; margin-bottom: 0.8rem; flex-wrap: wrap; }
    select#ship-select, input#terminal-input, select#sys-filter { background: #1a1a1a; color: white; border: 1px solid #444; border-radius: 6px; padding: 0.45rem 0.6rem; font-size: 1rem; box-sizing: border-box; }
    select#ship-select { width: 16rem; }
    input#terminal-input { flex: 1; min-width: 14rem; max-width: 22rem; }
    select#sys-filter { background: #1a1a1a; color: white; border: 1px solid #444; border-radius: 6px; padding: 0.45rem 0.6rem; font-size: 1rem; box-sizing: border-box; width: 14rem; }
    select#sys-filter:focus { outline: none; border-color: #4ab8ff; }
    select#ship-select:focus, input#terminal-input:focus, select#sys-filter:focus { outline: none; border-color: #4ab8ff; }
    div#phase1 { margin-top: 0.8rem; }
    div#comm-list { display: flex; flex-direction: column; gap: 0.3rem; max-width: 38rem; margin: 0 auto; }
    div.comm-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 0.6rem; background: #111; border-radius: 6px; border: 1px solid #2a2a2a; transition: opacity 0.15s; }
    div.comm-row.off { opacity: 0.3; }
    div.comm-row input[type=checkbox] { width: 1.1rem; height: 1.1rem; flex-shrink: 0; cursor: pointer; accent-color: #4ab8ff; }
    div.comm-row .comm-name { flex: 1; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
    div.comm-row .comm-inp { background: #1a1a1a; color: white; border: 1px solid #333; border-radius: 4px; padding: 0.3rem 0.4rem; font-size: 0.85rem; width: 6.5rem; text-align: right; box-sizing: border-box; }
    div.comm-row .comm-inp:focus { outline: none; border-color: #4ab8ff; }
    div.comm-row .inp-label { font-size: 0.75rem; color: #666; flex-shrink: 0; }
    div#comm-header { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0.6rem; max-width: 38rem; margin: 0 auto 0.25rem; font-size: 0.75rem; color: #888; }
    div#comm-header .ch-name { flex: 1; }
    div#comm-header .ch-inp { width: 6.5rem; text-align: right; }
    button.find-btn { display: block; width: 100%; max-width: 38rem; margin: 0.6rem auto 0; background: #1e7e34; color: white; border: none; border-radius: 6px; padding: 0.55rem; font-size: 1rem; cursor: pointer; box-sizing: border-box; }
    button.find-btn:hover { background: #28a745; }
    div#phase2 { margin-top: 1.5rem; }
    div.trip-best { margin-bottom: 1.5rem; border: 1px solid #4ab8ff; border-radius: 8px; padding: 0.8rem 1rem; background: #0a1a2a; }
    div.trip-best h3 { color: #4ab8ff; margin: 0 0 0.6rem; font-size: 1.1rem; display: flex; justify-content: space-between; align-items: baseline; }
    div.trip-best span.trip-total { color: #7dff8a; font-weight: bold; font-size: 1.2rem; }
    h2.alt-header { color: #888; font-size: 0.9rem; font-weight: normal; margin: 1.5rem 0 0.5rem; border-top: 1px solid #333; padding-top: 0.8rem; letter-spacing: 0.05em; text-transform: uppercase; }
    div.trip-alt { margin-bottom: 1.2rem; }
    div.trip-alt h3 { color: #4ab8ff; margin: 0 0 0.4rem; font-size: 0.95rem; display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #222; padding-bottom: 0.25rem; }
    div.trip-alt span.trip-total { color: #ffd966; font-weight: bold; }
    div#phase2 table { font-size: 0.85rem; }
    div#phase2 thead th { position: sticky; top: 0; background: #006fdd; z-index: 2; padding: 0.4rem 0.5rem; }
    div#phase2 td { padding: 0.3rem 0.5rem; border-bottom: 1px solid #2a2a2a; }
    div#phase2 tr:hover td { background: #1a1a1a; }
    td.profit  { color: #7dff8a; font-weight: bold; }
    td.total   { color: #ffd966; font-weight: bold; }
    td.dest    { color: #4ab8ff; }
    td.scu-ok   { color: #7dff8a; }
    td.scu-low  { color: #ff9f43; }
    td.scu-none { color: #888; font-style: italic; }
    p.note { text-align: center; color: #888; margin-top: 1rem; font-size: 0.9rem; }
</style>

<div id="wrap">
<div id="setup">
  <select id="ship-select">${shipOptions}</select>
  <input id="terminal-input" type="text" list="terminals-list" placeholder="Your current terminal" autocomplete="off" />
  <select id="sys-filter">
    <option value="all">All systems</option>
    <option value="system">Same star system</option>
    <option value="planet">Same planet</option>
  </select>
</div>
<div id="phase1"></div>
<div id="phase2"></div>
</div>

<datalist id="terminals-list"></datalist>

<script>
(function () {
    var INDEX = ${indexJson};
    var TERMINALS = ${terminalsJson};

    var dl = document.getElementById('terminals-list');
    TERMINALS.forEach(function (n) { var o = document.createElement('option'); o.value = n; dl.appendChild(o); });

    var shipSel   = document.getElementById('ship-select');
    var termInp   = document.getElementById('terminal-input');
    var sysFilter = document.getElementById('sys-filter');
    var phase1    = document.getElementById('phase1');
    var phase2    = document.getElementById('phase2');

    termInp.addEventListener('change', loadCommodities);
    termInp.addEventListener('input', debounce(loadCommodities, 500));
    sysFilter.addEventListener('change', function () { if (phase2.innerHTML) findDestinations(); });

    function getScu() {
        var opt = shipSel.options[shipSel.selectedIndex];
        var m = opt ? opt.text.match(/\\((\\d+) SCU\\)/) : null;
        return m ? parseInt(m[1]) : 1;
    }

    function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

    function fmtNum(n) {
        return ('' + Math.round(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '\\u202f') + ' aUEC';
    }

    function esc(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function loadCommodities() {
        var term = termInp.value.trim();
        phase1.innerHTML = '';
        phase2.innerHTML = '';
        if (!term) return;
        if (!INDEX[term]) {
            phase1.innerHTML = '<p class="note">Terminal not found — check the name.</p>';
            return;
        }
        var buys = INDEX[term].b;
        var comms = Object.keys(buys).sort();
        if (!comms.length) {
            phase1.innerHTML = '<p class="note">No buyable commodities at this terminal.</p>';
            return;
        }
        var items = comms.map(function (c) {
            var e = buys[c];
            var scuVal = e.cur > 0 ? e.cur : (e.scu || 0);
            return '<div class="comm-row" data-comm="' + esc(c) + '">'
                + '<input type="checkbox" checked title="Include this commodity" />'
                + '<span class="comm-name" title="' + esc(c) + '">' + esc(c) + '</span>'
                + '<span class="inp-label">aUEC</span>'
                + '<input class="comm-inp price-inp" type="number" value="' + Math.round(e.p) + '" min="0" />'
                + '<span class="inp-label">SCU</span>'
                + '<input class="comm-inp scu-inp" type="number" value="' + scuVal + '" min="0" />'
                + '</div>';
        }).join('');

        phase1.innerHTML = '<div id="comm-header">'
            + '<div style="width:1.1rem"></div>'
            + '<div class="ch-name">Commodity</div>'
            + '<div style="width:2.5rem;text-align:right">Price</div>'
            + '<div class="ch-inp">aUEC</div>'
            + '<div style="width:2.5rem;text-align:right">Stock</div>'
            + '<div class="ch-inp">SCU</div>'
            + '</div>'
            + '<div id="comm-list">' + items + '</div>'
            + '<button class="find-btn" onclick="window.findDestinations()">Find Best Destinations &#x2192;</button>';

        // Toggle row dim on checkbox change, and on name click
        phase1.querySelectorAll('.comm-row').forEach(function (row) {
            var cb = row.querySelector('input[type=checkbox]');
            var name = row.querySelector('.comm-name');
            function toggle() { row.classList.toggle('off', !cb.checked); }
            cb.addEventListener('change', toggle);
            name.addEventListener('click', function () { cb.checked = !cb.checked; toggle(); });
        });
    }

    function findDestinations() {
        var term   = termInp.value.trim();
        var scu    = getScu();
        var filter = sysFilter.value;
        var originSys    = INDEX[term] ? INDEX[term].sys    : '';
        var originPlanet = INDEX[term] ? INDEX[term].planet : '';
        phase2.innerHTML = '';

        // Build list of user's available commodities from phase1 table
        var inventory = [];
        phase1.querySelectorAll('.comm-row').forEach(function (row) {
            var cb = row.querySelector('input[type=checkbox]');
            if (!cb || !cb.checked) return;
            var comm     = row.getAttribute('data-comm');
            var buyPrice = parseFloat(row.querySelector('.price-inp').value) || 0;
            var avail    = parseFloat(row.querySelector('.scu-inp').value)   || 0;
            if (buyPrice > 0) inventory.push({ comm: comm, buyPrice: buyPrice, avail: avail });
        });
        if (!inventory.length) return;

        // For each possible destination, compute optimal cargo load and total profit
        var tripMap = {};
        inventory.forEach(function (item) {
            Object.keys(INDEX).forEach(function (t) {
                if (t === term) return;
                var destEntry = INDEX[t];
                if (filter === 'system' && destEntry.sys !== originSys) return;
                if (filter === 'planet') {
                    if (!originPlanet || destEntry.planet !== originPlanet) return;
                }
                var s = INDEX[t].s[item.comm];
                if (!s || s.p <= item.buyPrice) return;
                if (!tripMap[t]) tripMap[t] = [];
                tripMap[t].push({
                    comm:     item.comm,
                    buyPrice: item.buyPrice,
                    sellP:    s.p,
                    profit:   s.p - item.buyPrice,
                    avail:    item.avail,
                    demScu:   s.scu,
                    demCur:   s.cur,
                    demMax:   s.max
                });
            });
        });

        // For each destination, greedily fill ship by profit/SCU, respect available stock
        var trips = Object.keys(tripMap).map(function (t) {
            var lines = tripMap[t].slice().sort(function (a, b) { return b.profit - a.profit; });
            var remaining = scu;
            var totalProfit = 0;
            var plan = [];
            lines.forEach(function (l) {
                if (remaining <= 0) return;
                var canBuy = l.avail > 0 ? Math.min(l.avail, remaining) : remaining;
                var load = Math.min(canBuy, remaining);
                if (load <= 0) return;
                totalProfit += l.profit * load;
                remaining -= load;
                plan.push({ comm: l.comm, buyPrice: l.buyPrice, sellP: l.sellP, profit: l.profit, load: load, demScu: l.demScu, demCur: l.demCur, demMax: l.demMax });
            });
            return { t: t, totalProfit: totalProfit, plan: plan };
        });

        trips = trips.filter(function (t) { return t.totalProfit > 0; });
        trips.sort(function (a, b) { return b.totalProfit - a.totalProfit; });

        if (!trips.length) {
            phase2.innerHTML = '<p class="note">No profitable destinations found.</p>';
            return;
        }

        function tripTable(trip) {
            var demClass = function (s) { return s.demScu >= scu ? 'scu-ok' : s.demScu > 0 ? 'scu-low' : 'scu-none'; };
            var demTxt = function (s) {
                return (s.demCur > 0 || s.demScu > 0)
                    ? s.demCur + (s.demScu > 0 ? ' (' + s.demScu + ')' : '') + (s.demMax > 0 ? ' / ' + s.demMax : '')
                    : '?';
            };
            var t = '<table><thead><tr>'
                + '<th>Commodity</th><th>Buy</th><th>Sell</th><th>Profit/SCU</th><th>Load (SCU)</th><th>Demand (cur/avg/max)</th><th>Subtotal</th>'
                + '</tr></thead><tbody>';
            trip.plan.forEach(function (p) {
                t += '<tr>'
                    + '<td>' + esc(p.comm) + '</td>'
                    + '<td>' + fmtNum(p.buyPrice) + '</td>'
                    + '<td>' + fmtNum(p.sellP) + '</td>'
                    + '<td class="profit">' + fmtNum(p.profit) + '</td>'
                    + '<td>' + p.load + '</td>'
                    + '<td class="' + demClass(p) + '">' + demTxt(p) + '</td>'
                    + '<td class="total">' + fmtNum(p.profit * p.load) + '</td>'
                    + '</tr>';
            });
            return t + '</tbody></table>';
        }

        var best = trips[0];
        var html = '<div class="trip-best">'
            + '<h3>' + esc(best.t) + ' <span class="trip-total">' + fmtNum(best.totalProfit) + '</span></h3>'
            + tripTable(best)
            + '</div>';

        if (trips.length > 1) {
            html += '<h2 class="alt-header">Alternative destinations</h2>';
            trips.slice(1, 10).forEach(function (trip) {
                html += '<div class="trip-alt">'
                    + '<h3>' + esc(trip.t) + ' <span class="trip-total">' + fmtNum(trip.totalProfit) + '</span></h3>'
                    + tripTable(trip)
                    + '</div>';
            });
        }

        phase2.innerHTML = html;
    }

    window.findDestinations = findDestinations;
})();
</script>`;

    return shell('Best From Here', body, false);
}

module.exports = { touchportalBestFrom };
