/**
 * CSS Handler
 * Serves the stylesheet
 */

const html = require('../html.js');

/**
 * Handle CSS request
 * @param {Object} req - HTTP request
 * @param {Object} res - HTTP response
 */
function handle(req, res) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/css');
    res.end(html.css());
}

module.exports = { handle };
