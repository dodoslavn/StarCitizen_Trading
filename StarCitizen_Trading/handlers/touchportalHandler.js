/**
 * Touchportal Handler
 * Serves the touch portal interface
 */

const html = require('../html.js');

/**
 * Parse touchportal URL parameters
 * @param {string} url - Request URL
 * @returns {Object} Parsed parameters {scu, system}
 */
function parseParams(url) {
    const parts = url.split('/').filter(p => p);

    if (parts.length === 1) {
        return { scu: 50, system: '' };
    } else if (parts.length === 2) {
        return { scu: parts[1], system: '' };
    } else if (parts.length === 3) {
        return { scu: parts[1], system: parts[2] };
    }

    return { scu: 50, system: '' };
}

/**
 * Handle touchportal request
 * @param {Object} req - HTTP request
 * @param {Object} res - HTTP response
 */
function handle(req, res) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');

    const { scu, system } = parseParams(req.url);
    res.end(html.touchportal(scu, system));
}

module.exports = { handle };
