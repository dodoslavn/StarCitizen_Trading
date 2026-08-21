/**
 * Tests for Smart Routes ranking logic (Milestone 2)
 */

const DataCache = require('../dataCache.js');
const { calculateSmartRoutes, confidenceBadge, touchportalSmart } = require('../views/touchportal-smart.js');

const now = () => Math.floor(Date.now() / 1000);
const daysAgo = n => now() - n * 24 * 60 * 60;

describe('calculateSmartRoutes', () => {
    test('pairs a sell row and a buy row of the same commodity into a route', () => {
        const cache = new DataCache();
        cache.setData({
            data: [
                { commodity_name: 'Aluminum', terminal_name: 'Terminal A', price_sell: 100, scu_sell_stock: 50, price_buy: 0, scu_buy: 0, date_modified: now() },
                { commodity_name: 'Aluminum', terminal_name: 'Terminal B', price_sell: 0, scu_sell_stock: 0, price_buy: 40, scu_buy: 80, date_modified: now() }
            ]
        });
        cache.setInitData({});

        const routes = calculateSmartRoutes(cache);
        expect(routes).toHaveLength(1);
        expect(routes[0]).toMatchObject({
            commodity: 'Aluminum',
            sellTerminal: 'Terminal A',
            buyTerminal: 'Terminal B',
            priceDelta: 60,
            amount: 50, // min(50, 80)
            rawProfit: 3000,
            confidence: 1.0,
            discountedProfit: 3000
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

        expect(calculateSmartRoutes(cache)).toHaveLength(0);
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

        expect(calculateSmartRoutes(cache)).toHaveLength(0);
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

        const [route] = calculateSmartRoutes(cache);
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

        const routes = calculateSmartRoutes(cache);
        expect(routes).toHaveLength(30);
        for (let i = 1; i < routes.length; i++) {
            expect(routes[i - 1].discountedProfit).toBeGreaterThanOrEqual(routes[i].discountedProfit);
        }
    });

    test('caps amount at the smaller of sell stock and buy demand', () => {
        const cache = new DataCache();
        cache.setData({
            data: [
                { commodity_name: 'Aluminum', terminal_name: 'A', price_sell: 100, scu_sell_stock: 5000, price_buy: 0, scu_buy: 0, date_modified: now() },
                { commodity_name: 'Aluminum', terminal_name: 'B', price_sell: 0, scu_sell_stock: 0, price_buy: 40, scu_buy: 12, date_modified: now() }
            ]
        });
        cache.setInitData({});

        const [route] = calculateSmartRoutes(cache);
        expect(route.amount).toBe(12);
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

    test('shows unapplied query params as a debug hint', () => {
        const cache = new DataCache();
        cache.setData({ data: [] });
        cache.setInitData({});

        const html = touchportalSmart(cache, { ship: 'corsair' });
        expect(html).toContain('ship');
        expect(html).toContain('corsair');
    });
});
