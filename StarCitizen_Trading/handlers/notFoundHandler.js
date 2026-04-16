/**
 * 404 Not Found Handler
 */

const logger = require('../logger.js');

/**
 * Handle 404 - Unknown URL
 * @param {Object} req - HTTP request
 * @param {Object} res - HTTP response
 */
function handle(req, res) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<html><body><h1>404 Not Found</h1><p>The requested page was not found.</p></body></html>');
    logger.warn(`404 - Unknown URL: ${req.url}`);
}

module.exports = { handle };
