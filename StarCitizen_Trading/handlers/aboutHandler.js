/**
 * About Page Handler
 */

const html = require('../html.js');

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

    return { confirmedCount, totalPairs, perc, sellOnly, buyOnly, both };
}

/**
 * Handle about page request
 * @param {Object} req - HTTP request
 * @param {Object} res - HTTP response
 * @param {Object} cache - DataCache instance
 */
function handle(req, res, cache) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    let statsHtml = '';
    if (cache) {
        const { confirmedCount, totalPairs, perc, sellOnly, buyOnly, both } = maxInventoryStats(cache);
        statsHtml = `
        <p>
            <strong>Max Inventory Coverage:</strong><br>
            ${confirmedCount} of ${totalPairs} commodity&ndash;terminal pairs have a confirmed historical maximum (${perc}%).<br>
            <span style="color:#aaa;font-size:0.9em">
                Sell max: ${sellOnly} &nbsp;&middot;&nbsp;
                Buy max: ${buyOnly} &nbsp;&middot;&nbsp;
                Both: ${both} &nbsp;&middot;&nbsp;
                Estimated: ${totalPairs - confirmedCount}
            </span>
        </p>`;
    }

    const aboutWithStats = html.about.replace('</div>', `${statsHtml}\n    </div>`);

    res.write(html.header);
    res.write(aboutWithStats);
    res.write(html.footer);
    res.end();
}

module.exports = { handle };
