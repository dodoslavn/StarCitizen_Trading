/**
 * About Page Handler
 */

const html = require('../html.js');

function readVersion() {
    try { const v = require('fs').readFileSync(require('path').join(__dirname, '..', 'VERSION'), 'utf8').trim(); if (v) return v; } catch {}
    try { return require('../package.json').version || 'unknown'; } catch { return 'unknown'; }
}

function maxInventoryStats(cache) {
    const state = cache.exportMaxInventoryState();
    const confirmed = state.data || {};
    const confirmedCount = Object.keys(confirmed).length;

    const liveData = cache.getData();
    const totalPairs = liveData
        ? new Set(liveData.data.map(i => `${i.id_commodity}_${i.id_terminal}`)).size
        : 0;

    const perc = totalPairs > 0 ? Math.round(confirmedCount / totalPairs * 100) : 0;
    const sellOnly  = Object.values(confirmed).filter(v => v.sell && !v.buy).length;
    const buyOnly   = Object.values(confirmed).filter(v => v.buy && !v.sell).length;
    const both      = Object.values(confirmed).filter(v => v.sell && v.buy).length;
    const estimated = totalPairs - confirmedCount;

    return { confirmedCount, totalPairs, perc, sellOnly, buyOnly, both, estimated };
}

const version = readVersion();

function handle(req, res, cache) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    let statsHtml = '';
    if (cache) {
        const { confirmedCount, totalPairs, perc, sellOnly, buyOnly, both, estimated } = maxInventoryStats(cache);
        statsHtml = `
        <p>
            <strong>Max Inventory Coverage:</strong><br>
            ${confirmedCount} of ${totalPairs} commodity&ndash;terminal pairs have a confirmed historical maximum (${perc}%).<br>
            <span style="color:#aaa; font-size:0.9em">
                Sell max: ${sellOnly} &nbsp;&middot;&nbsp;
                Buy max: ${buyOnly} &nbsp;&middot;&nbsp;
                Both: ${both} &nbsp;&middot;&nbsp;
                Estimated (no history): ${estimated}
            </span>
        </p>`;
    }

    const aboutHtml = `
    <div class="about-page about-container">
        <h1>About ComTrading</h1>

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
            License: GPL v2
        </p>
        ${statsHtml}
        <p class="footer-text">
            &copy; 2026 &middot; version: ${version}
        </p>
    </div>`;

    res.write(html.header);
    res.write(aboutHtml);
    res.write(html.footer);
    res.end();
}

module.exports = { handle };
