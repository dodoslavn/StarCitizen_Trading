/**
 * About Page Handler
 */

const html = require('../html.js');

/**
 * Handle about page request
 * @param {Object} req - HTTP request
 * @param {Object} res - HTTP response
 */
function handle(req, res) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.write(html.header);
    res.write(html.about);
    res.write(html.footer);
    res.end();
}

module.exports = { handle };
