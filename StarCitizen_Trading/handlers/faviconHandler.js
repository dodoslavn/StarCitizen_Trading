/**
 * Favicon Handler
 * Serves the favicon
 */

const favicon = require('../favicon.js');

/**
 * Handle favicon request
 * @param {Object} req - HTTP request
 * @param {Object} res - HTTP response
 */
function handle(req, res) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/x-icon');
    const faviconBase64 = favicon.faviconBase64;
    res.end(Buffer.from(faviconBase64, 'base64'));
}

module.exports = { handle };
