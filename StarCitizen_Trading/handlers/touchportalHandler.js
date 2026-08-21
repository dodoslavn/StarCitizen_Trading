/**
 * Touchportal Handler
 * Serves the touch portal hub and its sub-pages:
 *   /touchportal               -> hub
 *   /touchportal/{scu}         -> best trading routes for given SCU
 *   /touchportal/{scu}/{sys}   -> best trading routes filtered by system
 *   /touchportal/stale         -> terminals with the oldest data
 *   /touchportal/stale/{sys}   -> oldest-data list filtered by system
 *   /touchportal/smart         -> smart routes (ranked by aUEC/hour, profit,
 *                                  or ROI, see docs/smart-routes-plan.md).
 *                                  Reads its filters from the query string
 *                                  rather than path segments, since those
 *                                  inputs are independent of each other:
 *                                    ?ship=<uex-slug>  (e.g. drak-corsair)
 *                                    ?wallet=<aUEC>    (omit/0 = unlimited)
 *                                    ?sort=hour|profit|roi (default hour)
 *                                    ?system=<name>    (e.g. Stanton; omit = all)
 *                                    ?safe=1           (hide <90% survival routes)
 *                                    ?sameSystem=1     (hide cross-system routes)
 */

const html = require('../html.js');
const { validateSCU, validateSystemName, validateShipId, validateWallet } = require('../utils/validation.js');

const VALID_SORTS = ['profit', 'roi', 'hour'];

/**
 * Handle touchportal request
 * @param {Object} req - HTTP request
 * @param {Object} res - HTTP response
 * @param {Object} cache - DataCache instance
 */
function handle(req, res, cache) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(p => p);
    // parts[0] === 'touchportal' - already routed here by routes.js

    if (parts.length === 1) {
        res.end(html.touchportalHub());
        return;
    }

    if (parts[1] === 'stale') {
        const system = parts[2] ? validateSystemName(parts[2]) : '';
        res.end(html.touchportalStale(cache, system));
        return;
    }

    if (parts[1] === 'smart') {
        const rawSort = url.searchParams.get('sort');
        const filters = {
            shipSlug: validateShipId(url.searchParams.get('ship') || ''),
            wallet: validateWallet(url.searchParams.get('wallet')),
            sort: VALID_SORTS.includes(rawSort) ? rawSort : 'hour',
            system: validateSystemName(url.searchParams.get('system') || ''),
            safeOnly: url.searchParams.get('safe') === '1',
            sameSystemOnly: url.searchParams.get('sameSystem') === '1'
        };
        res.end(html.touchportalSmart(cache, filters));
        return;
    }

    // Best routes page: /touchportal/{scu}[/{system}]
    const scu = validateSCU(parts[1], 50);
    const system = parts[2] ? validateSystemName(parts[2]) : '';
    res.end(html.touchportal(scu, system, cache));
}

module.exports = { handle };
