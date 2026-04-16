/**
 * Refresh Handler
 * Triggers manual data refresh
 */

const logger = require('../logger.js');
const trading = require('../services/trading.js');

/**
 * Handle refresh request
 * @param {Object} req - HTTP request
 * @param {Object} res - HTTP response
 * @param {Object} config - Configuration
 * @param {Object} cache - DataCache instance
 */
function handle(req, res, config, cache) {
    trading.refreshData(config, cache).catch(err => {
        logger.error('Manual refresh failed:', err);
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Data refresh triggered');
    logger.info('Manual data refresh triggered');
}

module.exports = { handle };
