/**
 * Touchportal Handler
 * Serves the touch portal interface
 */

const html = require('../html.js');
const { validateSCU, validateSystemName } = require('../utils/validation.js');

/**
 * Parse and validate touchportal URL parameters
 * @param {string} url - Request URL
 * @returns {Object} Parsed parameters {scu, system}
 */
function parseParams(url) {
    const parts = url.split('/').filter(p => p);

    let scu = 50;
    let system = '';

    if (parts.length === 1) {
        return { scu, system };
    } else if (parts.length === 2) {
        scu = validateSCU(parts[1], 50);
        return { scu, system };
    } else if (parts.length >= 3) {
        scu = validateSCU(parts[1], 50);
        system = validateSystemName(parts[2]);
        return { scu, system };
    }

    return { scu, system };
}

/**
 * Handle touchportal request
 * @param {Object} req - HTTP request
 * @param {Object} res - HTTP response
 */
function handle(req, res) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    const { scu, system } = parseParams(req.url);
    res.end(html.touchportal(scu, system));
}

module.exports = { handle };
