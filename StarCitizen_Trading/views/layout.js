/**
 * HTML Layout Module
 * Contains page structure and static content
 */

const fs = require('fs');
const path = require('path');

/**
 * Determine the deployed version string, evaluated once at module load.
 * Prefers a VERSION file at the app root (populated at build time from the
 * git SHA), falls back to package.json's version.
 * @returns {string}
 */
function readVersion() {
    try {
        const v = fs.readFileSync(path.join(__dirname, '..', 'VERSION'), 'utf8').trim();
        if (v) return v;
    } catch { /* file absent, fall through */ }
    try {
        return require('../package.json').version || 'unknown';
    } catch {
        return 'unknown';
    }
}

const version = readVersion();

const header = `
<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <title>SCTrading - Star Citizen</title>
        <link rel="stylesheet" type="text/css" href="/default.css" media="screen" >
        <meta http-equiv="refresh" content="1800">
    </head>
    <body>
    `;

const footer = `
    <div id="sc-tooltip"></div>
    <script>
    (function () {
        var tip    = document.getElementById('sc-tooltip');
        var active = null;   // element whose tooltip is open
        var pinned = null;   // pinned terminal name string

        // ── Terminal data index ─────────────────────────────────────────
        // index[terminalName] = { buy: {commodity: price}, sell: {commodity: price} }
        // "buy"  = player CAN BUY here   (right table "you buy")
        // "sell" = player CAN SELL here  (left table "you sell")
        var index = {};

        function parsePrice(text) {
            if (!text) return 0;
            var s = text + '';
            var avg = s.match(/\\(~([\\d\\s]+)\\)/);
            var raw = avg ? avg[1] : s.split('(')[0];
            return parseInt(raw.replace(/\\s/g, '')) || 0;
        }

        function buildIndex() {
            document.querySelectorAll('table.commodity').forEach(function (table) {
                var h = table.querySelector('th.text-center');
                if (!h) return;
                var commodity = h.textContent.trim().split(' (')[0];
                var inner = table.querySelectorAll('td[colspan="4"] > table');
                if (inner.length < 2) return;

                [inner[0], inner[1]].forEach(function (t, i) {
                    var side = i === 0 ? 'sell' : 'buy';
                    t.querySelectorAll('tr').forEach(function (row) {
                        var td = row.querySelector('td[data-tname]');
                        if (!td) return;
                        var tname = td.dataset.tname;
                        var cells = row.querySelectorAll('td');
                        var price = parsePrice(cells[1] && cells[1].textContent);
                        if (!index[tname]) index[tname] = { buy: {}, sell: {} };
                        if (price > 0) index[tname][side][commodity] = price;
                    });
                });
            });
        }

        // ── Trade computation ───────────────────────────────────────────
        function computeTrades(pinnedName, hoverName, excludeCommodity) {
            if (pinnedName === hoverName) return '';
            var P = index[pinnedName];
            var H = index[hoverName];
            if (!P || !H) return '';

            var bring = [], take = [];

            Object.keys(P.buy).forEach(function (c) {
                if (c === excludeCommodity) return;
                var sp = H.sell[c];
                if (sp && sp > P.buy[c]) bring.push({ c: c, profit: sp - P.buy[c] });
            });
            Object.keys(H.buy).forEach(function (c) {
                if (c === excludeCommodity) return;
                var sp = P.sell[c];
                if (sp && sp > H.buy[c]) take.push({ c: c, profit: sp - H.buy[c] });
            });

            if (!bring.length && !take.length) return '';

            bring.sort(function (a, b) { return b.profit - a.profit; });
            take.sort(function (a, b) { return b.profit - a.profit; });

            function fmtNum(n) {
                return ('' + n).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ' ') + ' aUEC/SCU';
            }
            function fmt(list) {
                return list.slice(0, 6).map(function (x) {
                    return x.c + ' ( ~ ' + fmtNum(x.profit) + ' )';
                }).join('\\n  ');
            }

            var lines = [];
            if (bring.length) lines.push('\\nBuyable at ' + pinnedName + ', sell here:\\n  ' + fmt(bring));
            if (take.length)  lines.push('\\nBuyable here, sell at ' + pinnedName + ':\\n  ' + fmt(take));
            return lines.join('\\n');
        }

        // ── Tooltip display ─────────────────────────────────────────────
        function show(el) {
            active = el;
            var text = el.dataset.tip || '';
            var tname = el.dataset.tname;

            // Color legend
            var tr = el.parentElement;
            if (tr) {
                var colorText = '';
                if (tr.classList.contains('very-stale')) {
                    colorText = 'Color: dark gray (outdated data)';
                } else if (tr.classList.contains('stale')) {
                    colorText = 'Color: light gray (older data)';
                } else {
                    var ct = el.closest('table.commodity');
                    var its = ct ? ct.querySelectorAll('td[colspan] > table') : [];
                    var isSell = its.length >= 1 && its[0].contains(el);
                    if (tr.classList.contains('stock-available')) {
                        colorText = isSell ? 'Color: green (high demand)' : 'Color: green (well stocked)';
                    } else if (tr.classList.contains('stock-medium')) {
                        colorText = isSell ? 'Color: orange (moderate demand)' : 'Color: orange (moderate stock)';
                    } else if (tr.classList.contains('stock-depleted')) {
                        colorText = isSell ? 'Color: red (demand met)' : 'Color: red (low stock)';
                    }
                }
                if (colorText) text += '\\n' + colorText;
            }
            if (el.dataset.loc) text += '\\n' + el.dataset.loc;

            if (pinned && tname) {
                var ct = el.closest('table.commodity');
                var cth = ct ? ct.querySelector('th.text-center') : null;
                var curCommodity = cth ? cth.textContent.trim().split(' (')[0] : null;
                var trades = computeTrades(pinned, tname, curCommodity);
                if (trades) text += '\\n' + trades;
            }
            tip.textContent = text;
            tip.style.display = 'block';

            var rect = el.getBoundingClientRect();
            var sY = window.scrollY || document.documentElement.scrollTop;
            var sX = window.scrollX || document.documentElement.scrollLeft;
            tip.style.top  = (rect.bottom + sY + 6) + 'px';
            tip.style.left = Math.min(rect.left + sX, sX + window.innerWidth - 336) + 'px';
        }

        function hide() { active = null; tip.style.display = 'none'; }

        // ── Pin ─────────────────────────────────────────────────────────
        function handlePin(el) {
            var tname = el.dataset.tname;
            document.querySelectorAll('[data-tname].sc-pinned').forEach(function (t) { t.classList.remove('sc-pinned'); });
            if (pinned === tname) {
                pinned = null;
            } else {
                pinned = tname;
                el.classList.add('sc-pinned');
            }
        }

        // ── Events ──────────────────────────────────────────────────────
        // Desktop: hover to show tooltip (with delay)
        var hovered = null;
        var hoverTimer = null;
        document.addEventListener('mouseover', function (e) {
            var el = e.target.closest('[data-tname]');
            if (el === hovered) return;
            hovered = el;
            clearTimeout(hoverTimer);
            if (el) hoverTimer = setTimeout(function () { if (hovered === el) show(el); }, 350);
            else hide();
        });
        document.addEventListener('mouseout', function (e) {
            var el = e.target.closest('[data-tname]');
            if (el && !el.contains(e.relatedTarget)) { clearTimeout(hoverTimer); hovered = null; hide(); }
        });

        // Desktop: click cell to toggle pin, refresh tooltip
        document.addEventListener('click', function (e) {
            var el = e.target.closest('[data-tname]');
            if (el) { handlePin(el); show(el); }
        });

        // Mobile: tap cell to toggle pin and show tooltip
        document.addEventListener('touchstart', function (e) {
            var el = e.target.closest('[data-tname]');
            if (el) {
                e.preventDefault();
                handlePin(el);
                show(el);
            } else {
                hide();
            }
        }, { passive: false });

        buildIndex();
    })();
    </script>
    </body>
</html>
`;

/**
 * Standalone page shown while the server has not yet loaded any trading
 * data (e.g. right after a restart). Self-contained (own inline styles,
 * no dependency on /default.css or cached data) and auto-refreshes every
 * few seconds so the visitor doesn't have to reload manually.
 * @returns {string}
 */
function loadingPage() {
    return `
<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <title>SCTrading - Star Citizen</title>
        <meta http-equiv="refresh" content="3">
        <style>
            body {
                background-color: #000000;
                color: white;
                font-family: Open Sans, Arial, sans-serif;
                min-height: 100vh;
                margin: 0;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            div.loading-card {
                text-align: center;
                padding: 2.5rem 3rem;
                background-color: #1e1e1e;
                border-radius: 0.5rem;
                box-shadow: 0.15rem 0.15rem 0.15rem rgba(50, 50, 50, 0.5);
            }
            div.spinner {
                width: 2.5rem;
                height: 2.5rem;
                margin: 0 auto 1.5rem;
                border: 0.3rem solid #333;
                border-top-color: #006fdd;
                border-radius: 50%;
                animation: spin 0.9s linear infinite;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            h1 {
                color: #4da6ff;
                font-size: 1.3rem;
                margin: 0 0 0.5rem;
            }
            p {
                color: #aaa;
                margin: 0;
            }
        </style>
    </head>
    <body>
        <div class="loading-card">
            <div class="spinner"></div>
            <h1>Loading trading data&hellip;</h1>
            <p>This page refreshes automatically, no need to reload.</p>
        </div>
    </body>
</html>
    `;
}

const about = `
    <div class="about-page about-container">
        <h1>About SCTrading</h1>

        <p>
            <strong>Community made website</strong><br>
            Created by Dodoslav Novak
        </p>

        <p>
            <strong>Contact:</strong><br>
            <a href='mailto:admin@dodoslav.eu'>admin@dodoslav.eu</a>
        </p>

        <p>
            <strong>Data Source:</strong><br>
            Trading data collected from <a href='https://uexcorp.space/' target="_blank" rel="noopener">UEX Corp API</a>
        </p>

        <p>
            <strong>Source Code:</strong><br>
            <a href='https://github.com/dodoslavn/StarCitizen_Trading' target="_blank" rel="noopener">View on GitHub</a><br>
            License: MIT
        </p>

        <p class="footer-text">
            &copy; 2025 &middot; version: ${version}
        </p>
    </div>
    `;

module.exports = {
    header,
    footer,
    loadingPage,
    about
};
