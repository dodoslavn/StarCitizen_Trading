/**
 * TouchPortal Market Depth Page
 * Sortable table: click column header to sort, Shift+click to add secondary sort
 */

const { readable_number, escapeHtml } = require('../utils/formatters.js');
const { shell } = require('./touchportal.js');

const SORT_JS = `
<script>
var sortKeys = [{col: 4, dir: -1}];

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

function touchportalMarket(depth) {
    const items = depth.map(item => ({
        ...item,
        profitPerc: item.bestBuy > 0 ? (item.margin / item.bestBuy * 100) : 0
    }));

    const rows = items.map(item => {
        const name = escapeHtml(item.commodity);
        return `<tr>
            <td data-val="${name}"><a href="/#comm-${name}">${name}</a></td>
            <td data-val="${item.margin}">${readable_number(item.margin)}</td>
            <td data-val="${item.profitPerc.toFixed(2)}">${item.profitPerc.toFixed(1)}%</td>
            <td data-val="${item.tradeableCurrent}">${readable_number(item.tradeableCurrent)}</td>
            <td data-val="${item.potentialCurrent}">${readable_number(item.potentialCurrent)}</td>
        </tr>`;
    }).join('');

    const headers = [
        { label: 'Commodity',       title: 'Commodity name' },
        { label: 'Margin aUEC/SCU', title: 'Best sell price minus best buy price' },
        { label: 'Profit %',        title: 'Margin as a percentage of the buy price — capital efficiency' },
        { label: 'Tradeable SCU',   title: 'min(supply, demand) — how much you can actually move right now' },
        { label: 'Potential aUEC',  title: 'Tradeable SCU × margin — total market opportunity right now' },
    ];

    const headerRow = headers.map((h, i) =>
        `<th title="${escapeHtml(h.title)}" onclick="handleSort(${i}, event)" style="cursor:pointer;white-space:nowrap">${escapeHtml(h.label)} <span class="si">${i === 4 ? '↓' : ''}</span></th>`
    ).join('');

    const body = `
    ${SORT_JS}
    <div id="top">
        <a href="/touchportal" style="background-color: #006fdd;">← Hub</a>
    </div>
    <h2>Market Depth</h2>
    <p style="text-align:center; color:#888; margin-top:-0.5rem; font-size:0.85rem;">Click column to sort · Shift+click to add secondary sort</p>
    <table id="mkt-table">
        <thead><tr>${headerRow}</tr></thead>
        <tbody id="mkt-body">${rows || '<tr><td colspan="5">No data available</td></tr>'}</tbody>
    </table>`;

    return shell('Market Depth', body, true);
}

module.exports = { touchportalMarket };
