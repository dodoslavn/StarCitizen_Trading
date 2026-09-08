/**
 * TouchPortal Market Depth Page
 * Sortable table with spectrum coloring per column (red=low, green=high)
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

function getRange(items, key) {
    const vals = items.map(i => i[key]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return { min, max };
}

function fraction(value, range) {
    if (range.max === range.min) return 0.5;
    return (value - range.min) / (range.max - range.min);
}

function touchportalMarket(depth) {
    const items = depth.map(item => ({
        ...item,
        profitPerc: item.bestBuy > 0 ? (item.margin / item.bestBuy * 100) : 0
    }));

    const ranges = {
        margin:           getRange(items, 'margin'),
        profitPerc:       getRange(items, 'profitPerc'),
        tradeableCurrent: getRange(items, 'tradeableCurrent'),
        potentialCurrent: getRange(items, 'potentialCurrent'),
    };

    const rows = items.map(item => {
        const name = escapeHtml(item.commodity);
        const marginColor   = spectrumColor(fraction(item.margin,           ranges.margin));
        const percColor     = spectrumColor(fraction(item.profitPerc,       ranges.profitPerc));
        const tradeColor    = spectrumColor(fraction(item.tradeableCurrent, ranges.tradeableCurrent));
        const potColor      = spectrumColor(fraction(item.potentialCurrent, ranges.potentialCurrent));

        return `<tr>
            <td data-val="${name}"><a href="/#comm-${name}">${name}</a></td>
            <td data-val="${item.margin}" style="color:${marginColor}">${readable_number(item.margin)}</td>
            <td data-val="${item.profitPerc.toFixed(2)}" style="color:${percColor}">${item.profitPerc.toFixed(1)}%</td>
            <td data-val="${item.tradeableCurrent}" style="color:${tradeColor}">${readable_number(item.tradeableCurrent)}</td>
            <td data-val="${item.potentialCurrent}" style="color:${potColor}">${readable_number(item.potentialCurrent)}</td>
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
    <h2>Market Depth</h2>
    <p style="text-align:center; color:#888; margin-top:-0.5rem; font-size:0.85rem;">Click column to sort · Shift+click to add secondary sort</p>
    <table id="mkt-table">
        <thead><tr>${headerRow}</tr></thead>
        <tbody id="mkt-body">${rows || '<tr><td colspan="5">No data available</td></tr>'}</tbody>
    </table>`;

    return shell('Market Depth', body, true);
}

module.exports = { touchportalMarket };
