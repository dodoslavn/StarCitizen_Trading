/**
 * TouchPortal Market Depth Page
 * Sortable table with spectrum coloring per column (red=low, green=high)
 */

const { readable_number, escapeHtml } = require('../utils/formatters.js');
const { shell } = require('./touchportal.js');

const SORT_JS = `
<script>
var sortKeys = [{col: 8, dir: -1}];

function handleSort(colIndex, event) {
    if (event.shiftKey) {
        var existing = sortKeys.findIndex(function(s) { return s.col === colIndex; });
        if (existing >= 0) {
            sortKeys[existing].dir *= -1;
        } else {
            sortKeys.push({col: colIndex, dir: -1});
        }
    } else {
        if (sortKeys.length === 1 && sortKeys[0].col === colIndex) {
            sortKeys[0].dir *= -1;
        } else {
            sortKeys = [{col: colIndex, dir: -1}];
        }
    }
    applySort();
    updateHeaders();
}

function applySort() {
    var tbody = document.getElementById('mkt-body');
    var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
    rows.sort(function(a, b) {
        for (var i = 0; i < sortKeys.length; i++) {
            var col = sortKeys[i].col, dir = sortKeys[i].dir;
            var av = a.children[col].getAttribute('data-val');
            var bv = b.children[col].getAttribute('data-val');
            var an = parseFloat(av), bn = parseFloat(bv);
            var cmp = (!isNaN(an) && !isNaN(bn)) ? (an - bn) * dir : av.localeCompare(bv) * dir;
            if (cmp !== 0) return cmp;
        }
        return 0;
    });
    rows.forEach(function(r) { tbody.appendChild(r); });
}

function updateHeaders() {
    var ths = document.querySelectorAll('#mkt-table th');
    for (var i = 0; i < ths.length; i++) {
        var span = ths[i].querySelector('.si');
        if (!span) continue;
        var key = sortKeys.findIndex(function(s) { return s.col === i; });
        if (key >= 0) {
            var priority = sortKeys.length > 1 ? (key + 1) : '';
            span.textContent = priority + (sortKeys[key].dir === -1 ? '↓' : '↑');
        } else {
            span.textContent = '';
        }
    }
}
</script>`;

function spectrumColor(fraction) {
    // Only color the outer edges; middle stays neutral white.
    const EDGE = 0.15;
    const neutral = [210, 210, 210];
    const low     = [204,  80,  80];
    const high    = [ 80, 180, 100];
    let rgb;
    if (fraction <= EDGE) {
        const t = fraction / EDGE;
        rgb = neutral.map((n, i) => Math.round(low[i] + (n - low[i]) * t));
    } else if (fraction >= 1 - EDGE) {
        const t = (fraction - (1 - EDGE)) / EDGE;
        rgb = neutral.map((n, i) => Math.round(n + (high[i] - n) * t));
    } else {
        rgb = neutral;
    }
    return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

function buildRankFractions(items, key) {
    const sorted = items.slice().sort((a, b) => a[key] - b[key]);
    const map = new Map();
    sorted.forEach((item, i) => {
        map.set(item.commodity, sorted.length > 1 ? i / (sorted.length - 1) : 0.5);
    });
    return map;
}

function buildRows(depth) {
    const items = depth.map(item => ({
        ...item,
        profitPerc: item.bestBuy > 0 ? (item.margin / item.bestBuy * 100) : 0
    }));

    const ranks = {
        margin:           buildRankFractions(items, 'margin'),
        profitPerc:       buildRankFractions(items, 'profitPerc'),
        tradeableCurrent: buildRankFractions(items, 'tradeableCurrent'),
        potentialCurrent: buildRankFractions(items, 'potentialCurrent'),
    };

    const pct = (current, max) => max > 0 ? Math.round(current / max * 100) : null;

    const rows = items.map(item => {
        const name = escapeHtml(item.commodity);
        const marginColor   = spectrumColor(ranks.margin.get(item.commodity));
        const percColor     = spectrumColor(ranks.profitPerc.get(item.commodity));
        const tradeColor    = spectrumColor(ranks.tradeableCurrent.get(item.commodity));
        const potColor      = spectrumColor(ranks.potentialCurrent.get(item.commodity));

        const supplyPerc = pct(item.buyCurrent, item.buyMax);
        const demandPerc = pct(item.sellCurrent, item.sellMax);
        // Supply: high % = well stocked = green. Demand: low % = room to sell = green (invert).
        const supplyFrac = supplyPerc !== null ? supplyPerc / 100 : 0.5;
        const demandFrac = demandPerc !== null ? 1 - demandPerc / 100 : 0.5;
        const supplyColor = spectrumColor(supplyFrac);
        const demandColor = spectrumColor(demandFrac);

        return `<tr>
            <td data-val="${name}"><a href="/#comm-${name}">${name}</a></td>
            <td data-val="${item.margin}" style="color:${marginColor}">${readable_number(item.margin)}</td>
            <td data-val="${item.profitPerc.toFixed(2)}" style="color:${percColor}">${item.profitPerc.toFixed(1)}%</td>
            <td data-val="${item.buyCurrent}" style="color:${supplyColor}">${readable_number(item.buyCurrent)} SCU</td>
            <td data-val="${supplyPerc ?? -1}" style="color:${supplyColor}">${supplyPerc !== null ? supplyPerc + '%' : '-'}</td>
            <td data-val="${item.sellCurrent}" style="color:${demandColor}">${readable_number(item.sellCurrent)} SCU</td>
            <td data-val="${demandPerc ?? -1}" style="color:${demandColor}">${demandPerc !== null ? demandPerc + '%' : '-'}</td>
            <td data-val="${item.tradeableCurrent}" style="color:${tradeColor}">${readable_number(item.tradeableCurrent)}</td>
            <td data-val="${item.potentialCurrent}" style="color:${potColor}">${readable_number(item.potentialCurrent)}</td>
        </tr>`;
    }).join('');

    const headers = [
        { label: 'Commodity',       title: 'Commodity name' },
        { label: 'Margin aUEC/SCU', title: 'Best sell price minus best buy price' },
        { label: 'Profit %',        title: 'Margin as a percentage of the buy price — capital efficiency' },
        { label: 'Supply SCU',      title: 'Current buy stock available across all terminals' },
        { label: 'Supply %',        title: 'Buy stock as % of max — how full terminals are (green = well stocked)' },
        { label: 'Demand SCU',      title: 'Current sell demand stock across all terminals' },
        { label: 'Demand %',        title: 'Sell stock as % of max — low % means terminals want more (green = good time to sell)' },
        { label: 'Tradeable SCU',   title: 'min(supply, demand) — how much you can actually move right now' },
        { label: 'Potential aUEC',  title: 'Tradeable SCU × margin — total market opportunity right now' },
    ];

    const headerRow = headers.map((h, i) =>
        `<th title="${escapeHtml(h.title)}" onclick="handleSort(${i}, event)" style="cursor:pointer;white-space:nowrap">${escapeHtml(h.label)} <span class="si">${i === 8 ? '↓' : ''}</span></th>`
    ).join('');

    return { rows: rows || '<tr><td colspan="9">No data available</td></tr>', headerRow };
}

function touchportalMarket(depthAll, depthBySystem, systems) {
    const allKey = 'All';
    const { rows: allRows, headerRow } = buildRows(depthAll);

    const systemData = { [allKey]: allRows };
    (systems || []).forEach(s => {
        systemData[s] = buildRows(depthBySystem[s] || []).rows;
    });

    const switcherKeys = [allKey, ...(systems || [])];

    const switcherButtons = switcherKeys.map(s =>
        `<button onclick="switchSystem(${JSON.stringify(s)})" id="btn-${escapeHtml(s)}" style="margin:0 0.25rem;padding:0.3rem 0.8rem;border-radius:0.25rem;border:1px solid #444;background:#2e2e2e;color:#ccc;cursor:pointer">${escapeHtml(s)}</button>`
    ).join('');

    const body = `
    ${SORT_JS}
    <script>
    var marketData = ${JSON.stringify(systemData)};
    var activeSystem = ${JSON.stringify(allKey)};

    function switchSystem(s) {
        activeSystem = s;
        document.getElementById('mkt-body').innerHTML = marketData[s] || '<tr><td colspan="9">No data</td></tr>';
        sortKeys = [{col: 8, dir: -1}];
        applySort();
        updateHeaders();
        document.querySelectorAll('[id^="btn-"]').forEach(function(b) {
            b.style.background = '#2e2e2e';
            b.style.color = '#ccc';
            b.style.borderColor = '#444';
        });
        var active = document.getElementById('btn-' + s);
        if (active) { active.style.background = '#006fdd'; active.style.color = '#fff'; active.style.borderColor = '#006fdd'; }
    }
    window.addEventListener('load', function() { switchSystem(${JSON.stringify(allKey)}); });
    </script>
    <h2>Market Depth</h2>
    <div style="text-align:center;margin-bottom:0.75rem">${switcherButtons}</div>
    <p style="text-align:center; color:#888; margin-top:-0.25rem; font-size:0.85rem;">Click column to sort · Shift+click to add secondary sort</p>
    <table id="mkt-table">
        <thead><tr>${headerRow}</tr></thead>
        <tbody id="mkt-body">${allRows}</tbody>
    </table>`;

    return shell('Market Depth', body, true);
}

module.exports = { touchportalMarket };
