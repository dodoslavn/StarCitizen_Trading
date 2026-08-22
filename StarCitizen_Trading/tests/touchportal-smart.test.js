/**
 * Tests for Smart Routes ranking logic (Milestones 2, 3 & 4)
 */

const DataCache = require('../dataCache.js');
const {
    calculateSmartRoutes,
    confidenceBadge,
    riskBadge,
    resolveShip,
    terminalReachable,
    containerSizesCompatible,
    formatDuration,
    touchportalSmart
} = require('../views/touchportal-smart.js');

const now = () => Math.floor(Date.now() / 1000);
const daysAgo = n => now() - n * 24 * 60 * 60;

const SMALL_SHIP = { slug: 'small-ship', name: 'Small Ship', scu: 20, pad_type: 'S', container_sizes: '1,2,4', canLand: true, needsAutoLoad: false };
const BIG_MANUAL_SHIP = { slug: 'big-ship', name: 'Big Ship', scu: 500, pad_type: 'L', container_sizes: '1,2,4,8,16', canLand: true, needsAutoLoad: true };
const CAPITAL_SHIP = { slug: 'capital-ship', name: 'Capital Ship', scu: 1000, pad_type: 'XL', container_sizes: '1,2,4,8,16', canLand: false, needsAutoLoad: true };

describe('calculateSmartRoutes (no ship filter)', () => {
    test('pairs a sell row and a buy row of the same commodity into a route', () => {
        const cache = new DataCache();
        cache.setData({
            data: [
                { commodity_name: 'Aluminum', terminal_name: 'Terminal A', price_sell: 100, scu_sell_stock: 50, price_buy: 0, scu_buy: 0, date_modified: now() },
                { commodity_name: 'Aluminum', terminal_name: 'Terminal B', price_sell: 0, scu_sell_stock: 0, price_buy: 40, scu_buy: 80, date_modified: now() }
            ]
        });
        cache.setInitData({});

        const { routes } = calculateSmartRoutes(cache);
        expect(routes).toHaveLength(1);
        expect(routes[0]).toMatchObject({
            commodity: 'Aluminum',
            sellTerminal: 'Terminal A',
            buyTerminal: 'Terminal B',
            priceDelta: 60,
            amount: 50, // no ship/wallet/demand cap in play -> limited by sell stock only
            rawProfit: 3000,
            confidence: 1.0,
            discountedProfit: 3000,
            investment: 2000, // 50 * 40
            roi: 150 // (100-40)/40 * 100
        });
    });

    test('does not pair rows of different commodities', () => {
        const cache = new DataCache();
        cache.setData({
            data: [
                { commodity_name: 'Aluminum', terminal_name: 'A', price_sell: 100, scu_sell_stock: 50, price_buy: 0, scu_buy: 0, date_modified: now() },
                { commodity_name: 'Titanium', terminal_name: 'B', price_sell: 0, scu_sell_stock: 0, price_buy: 40, scu_buy: 80, date_modified: now() }
            ]
        });
        cache.setInitData({});

        expect(calculateSmartRoutes(cache).routes).toHaveLength(0);
    });

    test('drops routes with zero or negative price delta (no profit)', () => {
        const cache = new DataCache();
        cache.setData({
            data: [
                { commodity_name: 'Aluminum', terminal_name: 'A', price_sell: 40, scu_sell_stock: 50, price_buy: 0, scu_buy: 0, date_modified: now() },
                { commodity_name: 'Aluminum', terminal_name: 'B', price_sell: 0, scu_sell_stock: 0, price_buy: 100, scu_buy: 80, date_modified: now() }
            ]
        });
        cache.setInitData({});

        expect(calculateSmartRoutes(cache).routes).toHaveLength(0);
    });

    test('discounts profit by the lower of the two sides confidence', () => {
        const cache = new DataCache();
        cache.setData({
            data: [
                // Fresh sell side (confidence 1.0), 10-day-old buy side (confidence 0.3)
                { commodity_name: 'Aluminum', terminal_name: 'A', price_sell: 100, scu_sell_stock: 50, price_buy: 0, scu_buy: 0, date_modified: now() },
                { commodity_name: 'Aluminum', terminal_name: 'B', price_sell: 0, scu_sell_stock: 0, price_buy: 40, scu_buy: 80, date_modified: daysAgo(10) }
            ]
        });
        cache.setInitData({});

        const { routes: [route] } = calculateSmartRoutes(cache);
        expect(route.confidence).toBe(0.3); // min(1.0, 0.3)
        expect(route.rawProfit).toBe(3000);
        expect(route.discountedProfit).toBe(900); // 3000 * 0.3
    });

    test('sorts by discounted profit descending and caps at 30 routes', () => {
        const cache = new DataCache();
        const data = [];
        for (let i = 0; i < 40; i++) {
            data.push({ commodity_name: `Commodity${i}`, terminal_name: `Sell${i}`, price_sell: 100 + i, scu_sell_stock: 50, price_buy: 0, scu_buy: 0, date_modified: now() });
            data.push({ commodity_name: `Commodity${i}`, terminal_name: `Buy${i}`, price_sell: 0, scu_sell_stock: 0, price_buy: 10, scu_buy: 80, date_modified: now() });
        }
        cache.setData({ data });
        cache.setInitData({});

        const { routes } = calculateSmartRoutes(cache, { sort: 'profit' });
        expect(routes).toHaveLength(30);
        for (let i = 1; i < routes.length; i++) {
            expect(routes[i - 1].discountedProfit).toBeGreaterThanOrEqual(routes[i].discountedProfit);
        }
    });

    test('sorts by aUEC/hour by default (M4)', () => {
        const cache = new DataCache();
        cache.setData({
            data: [
                // Same profit, but route A is a long cross-system manual-load
                // trip while route B is a quick same-orbit auto-load hop -
                // B should rank first once time is factored in.
                { commodity_name: 'SlowGoods', terminal_name: 'SlowSell', price_sell: 200, scu_sell_stock: 50, price_buy: 0, scu_buy: 0, date_modified: now() },
                { commodity_name: 'SlowGoods', terminal_name: 'SlowBuy', price_sell: 0, scu_sell_stock: 0, price_buy: 100, scu_buy: 80, date_modified: now() },
                { commodity_name: 'FastGoods', terminal_name: 'FastSell', price_sell: 200, scu_sell_stock: 50, price_buy: 0, scu_buy: 0, date_modified: now() },
                { commodity_name: 'FastGoods', terminal_name: 'FastBuy', price_sell: 0, scu_sell_stock: 0, price_buy: 100, scu_buy: 80, date_modified: now() }
            ]
        });
        cache.setInitData({
            SlowSell: { name: 'Pyro', planet_name: 'Bloom', outpost_name: 'Remote Outpost', is_auto_load: false },
            SlowBuy: { name: 'Stanton', planet_name: 'ArcCorp', outpost_name: 'Another Outpost', is_auto_load: false },
            FastSell: { name: 'Stanton', planet_name: 'ArcCorp', space_station_name: 'Station A', is_auto_load: true },
            FastBuy: { name: 'Stanton', planet_name: 'ArcCorp', space_station_name: 'Station B', is_auto_load: true }
        });

        const { routes } = calculateSmartRoutes(cache); // no explicit sort -> default 'hour'
        expect(routes[0].commodity).toBe('FastGoods');
        expect(routes[0].perHour).toBeGreaterThan(routes[1].perHour);
    });

    test('every route has a positive tripTimeMin and perHour', () => {
        const cache = new DataCache();
        cache.setData({
            data: [
                { commodity_name: 'Aluminum', terminal_name: 'A', price_sell: 100, scu_sell_stock: 50, price_buy: 0, scu_buy: 0, date_modified: now() },
                { commodity_name: 'Aluminum', terminal_name: 'B', price_sell: 0, scu_sell_stock: 0, price_buy: 40, scu_buy: 80, date_modified: now() }
            ]
        });
        cache.setInitData({});

        const { routes: [route] } = calculateSmartRoutes(cache);
        expect(route.tripTimeMin).toBeGreaterThan(0);
        expect(route.perHour).toBeGreaterThan(0);
        // perHour is risk-adjusted (expectedProfit = discountedProfit * survival), not raw discountedProfit
        expect(route.perHour).toBeCloseTo(route.expectedProfit / (route.tripTimeMin / 60));
        expect(route.expectedProfit).toBeCloseTo(route.discountedProfit * route.survival);
    });

    test('uses cache.getTerminalDistances() for trip time when available (M6)', () => {
        const cache = new DataCache();
        cache.setData({
            data: [
                { commodity_name: 'Aluminum', terminal_name: 'A', id_commodity: 5, id_terminal: 12, price_sell: 100, scu_sell_stock: 50, price_buy: 0, scu_buy: 0, date_modified: now() },
                { commodity_name: 'Aluminum', terminal_name: 'B', id_commodity: 5, id_terminal: 466, price_sell: 0, scu_sell_stock: 0, price_buy: 40, scu_buy: 80, date_modified: now() }
            ]
        });
        cache.setInitData({
            A: { name: 'Stanton', code: 'ST' },
            B: { name: 'Pyro', code: 'PY' }
        });

        const { routes: [withoutDistance] } = calculateSmartRoutes(cache);

        cache.setTerminalDistances({ '12_466': 99 }); // real Gm value from a spot check
        const { routes: [withDistance] } = calculateSmartRoutes(cache);

        // Real distance (99 Gm) gives a different trip time than the flat
        // 20-minute cross-system heuristic used when no distance data exists.
        expect(withDistance.tripTimeMin).not.toBeCloseTo(withoutDistance.tripTimeMin, 0);
    });

    test('sorts by ROI when sort=roi', () => {
        const cache = new DataCache();
        cache.setData({
            data: [
                // Low absolute profit, high ROI
                { commodity_name: 'Cheap', terminal_name: 'S1', price_sell: 20, scu_sell_stock: 10, price_buy: 0, scu_buy: 0, date_modified: now() },
                { commodity_name: 'Cheap', terminal_name: 'B1', price_sell: 0, scu_sell_stock: 0, price_buy: 5, scu_buy: 80, date_modified: now() },
                // High absolute profit, low ROI
                { commodity_name: 'Expensive', terminal_name: 'S2', price_sell: 10100, scu_sell_stock: 10, price_buy: 0, scu_buy: 0, date_modified: now() },
                { commodity_name: 'Expensive', terminal_name: 'B2', price_sell: 0, scu_sell_stock: 0, price_buy: 10000, scu_buy: 80, date_modified: now() }
            ]
        });
        cache.setInitData({});

        const { routes } = calculateSmartRoutes(cache, { sort: 'roi' });
        expect(routes[0].commodity).toBe('Cheap'); // ROI 300% vs 1%
    });

    test('demand cap uses confirmed max inventory at the buy terminal, not raw scu_buy', () => {
        const cache = new DataCache();
        cache.setData({
            data: [
                { commodity_name: 'Aluminum', terminal_name: 'A', price_sell: 100, scu_sell_stock: 5000, price_buy: 0, scu_buy: 0, date_modified: now() },
                { commodity_name: 'Aluminum', terminal_name: 'B', id_commodity: 5, id_terminal: 12, price_sell: 0, scu_sell_stock: 0, price_buy: 40, scu_buy: 999999, date_modified: now() }
            ]
        });
        cache.setInitData({});
        cache.setConfirmedMax('5_12', 'buy', 300);

        const { routes: [route] } = calculateSmartRoutes(cache);
        expect(route.amount).toBe(300);
    });

    test('demand cap is unconstrained when no confirmed/estimated max exists', () => {
        const cache = new DataCache();
        cache.setData({
            data: [
                { commodity_name: 'Aluminum', terminal_name: 'A', price_sell: 100, scu_sell_stock: 5000, price_buy: 0, scu_buy: 0, date_modified: now() },
                { commodity_name: 'Aluminum', terminal_name: 'B', price_sell: 0, scu_sell_stock: 0, price_buy: 40, scu_buy: 80, date_modified: now() }
            ]
        });
        cache.setInitData({});

        const { routes: [route] } = calculateSmartRoutes(cache);
        expect(route.amount).toBe(5000); // limited by sell stock only
    });
});

describe('calculateSmartRoutes (ship + wallet constraints)', () => {
    function buildCache() {
        const cache = new DataCache();
        cache.setData({
            data: [
                { commodity_name: 'Aluminum', terminal_name: 'A', price_sell: 100, scu_sell_stock: 5000, price_buy: 0, scu_buy: 0, date_modified: now() },
                { commodity_name: 'Aluminum', terminal_name: 'B', price_sell: 0, scu_sell_stock: 0, price_buy: 40, scu_buy: 5000, date_modified: now() }
            ]
        });
        cache.setInitData({
            A: { name: 'Stanton', code: 'ST' },
            B: { name: 'Stanton', code: 'ST' }
        });
        cache.setVehicles([SMALL_SHIP]);
        return cache;
    }

    test('caps amount at ship SCU capacity', () => {
        const { routes: [route] } = calculateSmartRoutes(buildCache(), { shipSlug: 'small-ship' });
        expect(route.amount).toBe(20); // SMALL_SHIP.scu
    });

    test('caps amount by wallet / acquisition price', () => {
        const { routes: [route] } = calculateSmartRoutes(buildCache(), { shipSlug: 'small-ship', wallet: 100 });
        expect(route.amount).toBe(2); // floor(100 / 40) = 2, tighter than ship's 20
    });

    test('wallet of 0 means unlimited', () => {
        const { routes: [route] } = calculateSmartRoutes(buildCache(), { shipSlug: 'small-ship', wallet: 0 });
        expect(route.amount).toBe(20); // ship cap only
    });

    test('falls back to the smallest-SCU ship when shipSlug does not match any cached vehicle', () => {
        const { ship } = calculateSmartRoutes(buildCache(), { shipSlug: 'nonexistent' });
        expect(ship.slug).toBe('small-ship');
    });

    test('drops the route entirely when amount would be 0', () => {
        const cache = buildCache();
        const { routes } = calculateSmartRoutes(cache, { shipSlug: 'small-ship', wallet: 10 }); // floor(10/40) = 0
        expect(routes).toHaveLength(0);
    });
});

describe('calculateSmartRoutes (system + safety filters, M5)', () => {
    // One sell terminal (Stanton), two buy terminals - one in Stanton (same-
    // system route) and one in Pyro (cross-system route touching a risky
    // system). Exactly 2 candidate routes, deliberately minimal.
    function buildCrossSystemCache() {
        const cache = new DataCache();
        cache.setData({
            data: [
                { commodity_name: 'Aluminum', terminal_name: 'StantonSell', price_sell: 100, scu_sell_stock: 50, price_buy: 0, scu_buy: 0, date_modified: now() },
                { commodity_name: 'Aluminum', terminal_name: 'StantonBuy', price_sell: 0, scu_sell_stock: 0, price_buy: 40, scu_buy: 80, date_modified: now() },
                { commodity_name: 'Aluminum', terminal_name: 'PyroBuy', price_sell: 0, scu_sell_stock: 0, price_buy: 40, scu_buy: 80, date_modified: now() }
            ]
        });
        cache.setInitData({
            StantonSell: { name: 'Stanton', code: 'ST' },
            StantonBuy: { name: 'Stanton', code: 'ST' },
            PyroBuy: { name: 'Pyro', code: 'PY' }
        });
        return cache;
    }

    test('system filter requires both terminals in the requested system', () => {
        const { routes } = calculateSmartRoutes(buildCrossSystemCache(), { system: 'Stanton' });
        expect(routes).toHaveLength(1);
        expect(routes[0].buyTerminal).toBe('StantonBuy');
        expect(routes[0].sellTerminal).toBe('StantonSell');
    });

    test('sameSystemOnly drops routes that cross systems, keeping same-system ones regardless of which', () => {
        const { routes } = calculateSmartRoutes(buildCrossSystemCache(), { sameSystemOnly: true });
        expect(routes).toHaveLength(1);
        expect(routes[0].sellTerminal).toBe('StantonSell');
    });

    test('safeOnly drops routes touching a system with survival < 0.90 (Pyro)', () => {
        const { routes } = calculateSmartRoutes(buildCrossSystemCache(), { safeOnly: true });
        // Only the fully-Stanton route survives; the Pyro-touching one is filtered
        expect(routes).toHaveLength(1);
        expect(routes[0].sellTerminal).toBe('StantonSell');
        expect(routes[0].buyTerminal).toBe('StantonBuy');
    });

    test('each route carries survival, expectedProfit, and capitalAtRisk', () => {
        const { routes } = calculateSmartRoutes(buildCrossSystemCache(), { system: 'Stanton', wallet: 1000 });
        const [route] = routes;
        expect(route.survival).toBe(0.98); // Stanton <-> Stanton
        expect(route.expectedProfit).toBeCloseTo(route.discountedProfit * 0.98);
        expect(route.capitalAtRisk).toBeCloseTo(route.investment * (1 - 0.98));
    });
});

describe('resolveShip', () => {
    test('returns null when no vehicles are cached', () => {
        const cache = new DataCache();
        expect(resolveShip(cache, 'anything')).toBeNull();
    });

    test('returns the matching ship by slug', () => {
        const cache = new DataCache();
        cache.setVehicles([SMALL_SHIP, BIG_MANUAL_SHIP]);
        expect(resolveShip(cache, 'big-ship')).toBe(BIG_MANUAL_SHIP);
    });

    test('falls back to the first (smallest-SCU) vehicle when slug is missing or unknown', () => {
        const cache = new DataCache();
        cache.setVehicles([SMALL_SHIP, BIG_MANUAL_SHIP]);
        expect(resolveShip(cache, '')).toBe(SMALL_SHIP);
        expect(resolveShip(cache, 'unknown-slug')).toBe(SMALL_SHIP);
    });
});

describe('terminalReachable', () => {
    test('non-landing ships need a space station or docking port', () => {
        expect(terminalReachable({ space_station_name: 'Some Station' }, CAPITAL_SHIP)).toBe(true);
        expect(terminalReachable({ has_docking_port: true }, CAPITAL_SHIP)).toBe(true);
        expect(terminalReachable({ outpost_name: 'Some Outpost' }, CAPITAL_SHIP)).toBe(false);
    });

    test('ships needing auto-load are blocked at manual-load terminals', () => {
        expect(terminalReachable({ is_auto_load: true }, BIG_MANUAL_SHIP)).toBe(true);
        expect(terminalReachable({ is_auto_load: false }, BIG_MANUAL_SHIP)).toBe(false);
    });

    test('small landing ships needing manual load work anywhere landable', () => {
        expect(terminalReachable({ outpost_name: 'Remote Outpost' }, SMALL_SHIP)).toBe(true);
        expect(terminalReachable({ is_auto_load: false }, SMALL_SHIP)).toBe(true);
    });
});

describe('containerSizesCompatible', () => {
    test('returns true when there is an overlap', () => {
        expect(containerSizesCompatible('1,2,4', { container_sizes: '4,8,16' })).toBe(true);
    });

    test('returns false when sizes are disjoint', () => {
        expect(containerSizesCompatible('1,2', { container_sizes: '8,16,24,32' })).toBe(false);
    });

    test('assumes compatible when either side is unknown', () => {
        expect(containerSizesCompatible('', { container_sizes: '1,2' })).toBe(true);
        expect(containerSizesCompatible('1,2', {})).toBe(true);
    });
});

describe('formatDuration', () => {
    test('formats sub-hour durations as "~N min"', () => {
        expect(formatDuration(18)).toBe('~18 min');
        expect(formatDuration(59)).toBe('~59 min');
    });

    test('formats hour-plus durations as "~Nh Mm"', () => {
        expect(formatDuration(75)).toBe('~1h 15m');
        expect(formatDuration(150)).toBe('~2h 30m');
    });

    test('omits the minutes part on an exact hour', () => {
        expect(formatDuration(120)).toBe('~2h');
    });

    test('rounds to the nearest minute', () => {
        expect(formatDuration(18.4)).toBe('~18 min');
        expect(formatDuration(18.6)).toBe('~19 min');
    });
});

describe('confidenceBadge', () => {
    test('labels tiers matching dataAgeConfidence thresholds', () => {
        expect(confidenceBadge(1.0)).toMatchObject({ label: 'Fresh' });
        expect(confidenceBadge(0.7)).toMatchObject({ label: 'Recent' });
        expect(confidenceBadge(0.3)).toMatchObject({ label: 'Aging' });
        expect(confidenceBadge(0.05)).toMatchObject({ label: 'Stale' });
    });
});

describe('riskBadge', () => {
    test('labels tiers matching the 0.95/0.80 thresholds', () => {
        expect(riskBadge(0.98)).toMatchObject({ label: 'Safe' });
        expect(riskBadge(0.95)).toMatchObject({ label: 'Safe' });
        expect(riskBadge(0.90)).toMatchObject({ label: 'Moderate' });
        expect(riskBadge(0.80)).toMatchObject({ label: 'Moderate' });
        expect(riskBadge(0.60)).toMatchObject({ label: 'Risky' });
    });
});

describe('touchportalSmart', () => {
    test('shows a waiting message when no data is cached yet', () => {
        const cache = new DataCache();
        const html = touchportalSmart(cache, {});
        expect(html).toContain('Waiting for commodity data to load');
    });

    test('renders a route table once data is present', () => {
        const cache = new DataCache();
        cache.setData({
            data: [
                { commodity_name: 'Aluminum', terminal_name: 'A', price_sell: 100, scu_sell_stock: 50, price_buy: 0, scu_buy: 0, date_modified: now() },
                { commodity_name: 'Aluminum', terminal_name: 'B', price_sell: 0, scu_sell_stock: 0, price_buy: 40, scu_buy: 80, date_modified: now() }
            ]
        });
        cache.setInitData({});

        const html = touchportalSmart(cache, {});
        expect(html).toContain('Aluminum');
        expect(html).toContain('Fresh');
    });

    test('ship picker defaults to the bracket of the resolved ship, not every ship at once', () => {
        const cache = new DataCache();
        cache.setData({ data: [] });
        cache.setInitData({});
        cache.setVehicles([SMALL_SHIP, BIG_MANUAL_SHIP]);

        // No shipSlug -> resolveShip defaults to the smallest ship (Small Ship,
        // bracket "small"), so only that bracket's ships should render -
        // Big Ship (bracket "very-large") should NOT appear until that
        // bracket is selected. This is the fix for the ship picker showing
        // all 100+ ships on one page.
        const html = touchportalSmart(cache, {});
        expect(html).toContain('Small Ship');
        expect(html).not.toContain('Big Ship');
    });

    test('ship picker shows ships from the requested shipBracket', () => {
        const cache = new DataCache();
        cache.setData({ data: [] });
        cache.setInitData({});
        cache.setVehicles([SMALL_SHIP, BIG_MANUAL_SHIP]);

        const html = touchportalSmart(cache, { shipBracket: 'very-large' });
        expect(html).toContain('Big Ship');
        expect(html).not.toContain('Small Ship');
    });

    test('preselects the ship passed in filters', () => {
        const cache = new DataCache();
        cache.setData({ data: [] });
        cache.setInitData({});
        cache.setVehicles([SMALL_SHIP, BIG_MANUAL_SHIP]);

        const html = touchportalSmart(cache, { shipSlug: 'big-ship' });
        expect(html).toContain('<input type="hidden" name="ship" value="big-ship">');
        // shipBracket isn't passed explicitly - it should be inferred from
        // the resolved ship (Big Ship -> "very-large"), so its link is the
        // one that shows as selected.
        expect(html).toMatch(/ship=big-ship&shipBracket=very-large"[^>]*background-color: #4ab8ff[^>]*>Big Ship</);
    });

    test('renders system filter buttons for every known system plus All systems', () => {
        const cache = new DataCache();
        cache.setData({ data: [] });
        cache.setInitData({});

        const html = touchportalSmart(cache, {});
        expect(html).toContain('system=Stanton');
        expect(html).toContain('system=Pyro');
        expect(html).toContain('system=Nyx');
        expect(html).toContain('All systems');
    });

    test('shows the Capital at risk column only when a wallet is set', () => {
        const cache = new DataCache();
        cache.setData({ data: [] });
        cache.setInitData({});

        expect(touchportalSmart(cache, {})).not.toContain('Capital at risk');
        expect(touchportalSmart(cache, { wallet: 100000 })).toContain('Capital at risk');
    });

    test('preserves system/safe/sameSystem filters across the sort links', () => {
        const cache = new DataCache();
        cache.setData({ data: [] });
        cache.setInitData({});

        const html = touchportalSmart(cache, { system: 'Stanton', safeOnly: true, sameSystemOnly: true });
        // Every sort link should carry all three filters forward
        expect(html).toMatch(/sort=profit[^"]*system=Stanton[^"]*safe=1[^"]*sameSystem=1/);
    });
});
