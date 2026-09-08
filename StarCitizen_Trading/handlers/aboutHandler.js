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

    let coverageBar = '';
    if (cache) {
        const { perc } = maxInventoryStats(cache);
        coverageBar = `
        <div style="margin-bottom:1.5rem">
            <div style="display:flex;justify-content:space-between;margin-bottom:0.4rem;font-size:0.85rem;color:#aaa">
                <span>Max inventory coverage</span>
                <span style="color:#fff">${perc}%</span>
            </div>
            <div style="background:#2e2e2e;border-radius:0.25rem;height:6px;overflow:hidden">
                <div style="width:${perc}%;height:100%;background:#006fdd;border-radius:0.25rem"></div>
            </div>
        </div>`;
    }

    const aboutHtml = `
    <div class="about-page about-container">
        <h1>About ComTrading</h1>

        <div style="display:grid;grid-template-columns:auto 1fr;gap:0.3rem 1.5rem;margin-bottom:1.5rem">
            <span style="color:#aaa">Author</span>      <span>Dodoslav Novak</span>
            <span style="color:#aaa">Contact</span>     <span><a href='mailto:admin@dodoslav.eu'>admin@dodoslav.eu</a></span>
            <span style="color:#aaa">Data</span>        <span><a href='https://uexcorp.space/' target="_blank" rel="noopener">UEX Corp API</a></span>
            <span style="color:#aaa">Source</span>      <span><a href='https://github.com/dodoslavn/StarCitizen_Trading' target="_blank" rel="noopener">GitHub</a> &middot; GPL v2</span>
        </div>

        ${coverageBar}

        <p class="footer-text">&copy; 2026 &middot; version: ${version}</p>
    </div>`;

    res.write(html.header);
    res.write(aboutHtml);
    res.write(html.footer);
    res.end();
}

module.exports = { handle };
