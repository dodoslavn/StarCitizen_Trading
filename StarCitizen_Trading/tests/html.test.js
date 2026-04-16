/**
 * Tests for HTML generation functions
 */

// Note: Since html.js uses internal functions not exported,
// we'll test what we can through the exported interface

const html = require('../html.js');
const DataCache = require('../dataCache.js');

describe('HTML Module', () => {
    test('should export required functions', () => {
        expect(html.header).toBeDefined();
        expect(html.footer).toBeDefined();
        expect(html.css).toBeDefined();
        expect(html.displayCommodity).toBeDefined();
        expect(html.profit_uec).toBeDefined();
        expect(html.profit_perc).toBeDefined();
    });

    test('css() should return valid CSS string', () => {
        const cssContent = html.css();
        expect(typeof cssContent).toBe('string');
        expect(cssContent).toContain('body');
        expect(cssContent).toContain('background-color');
    });

    test('header should contain valid HTML', () => {
        expect(html.header).toContain('<!DOCTYPE html>');
        expect(html.header).toContain('<title>ComTrading');
    });

    test('footer should contain closing tags', () => {
        expect(html.footer).toContain('</body>');
        expect(html.footer).toContain('</html>');
    });

    test('displayCommodity should generate table HTML', () => {
        const cache = new DataCache();
        cache.setData({ data: [] });
        cache.setInitData({});

        const buy = [{
            terminal_name: 'Test Terminal',
            price_buy: 100,
            price_buy_avg: 95,
            scu_buy: 1000,
            scu_buy_avg: 900,
            container_sizes: 'SCU'
        }];

        const sell = [{
            terminal_name: 'Test Terminal 2',
            price_sell: 150,
            price_sell_avg: 145,
            scu_sell: 800,
            scu_sell_avg: 750,
            container_sizes: 'SCU'
        }];

        const result = html.displayCommodity('Aluminum', buy, sell, cache);

        expect(result).toContain('table');
        expect(result).toContain('Aluminum');
        expect(result).toContain('Buy');
        expect(result).toContain('Sell');
    });

    test('profit_uec should generate profit table', () => {
        const cache = new DataCache();
        cache.addProfit({
            commodity: 'Aluminum',
            profit_uec: 50,
            profit_uec_real: 45,
            profit_perc: 50,
            profit_perc_real: 47
        });

        const result = html.profit_uec(cache);

        expect(result).toContain('table');
        expect(result).toContain('Aluminum');
        expect(result).toContain('Profit aUEC/SCU');
    });

    test('profit_perc should generate percentage profit table', () => {
        const cache = new DataCache();
        cache.addProfit({
            commodity: 'Gold',
            profit_uec: 200,
            profit_uec_real: 190,
            profit_perc: 100,
            profit_perc_real: 95
        });

        const result = html.profit_perc(cache);

        expect(result).toContain('table');
        expect(result).toContain('Gold');
        expect(result).toContain('Profit %');
    });
});
