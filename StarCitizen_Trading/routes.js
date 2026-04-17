/**
 * Routes Module
 * Central routing logic mapping URLs to handlers
 */

const logger = require('./logger.js');
const mainHandler = require('./handlers/mainHandler.js');
const aboutHandler = require('./handlers/aboutHandler.js');
const cssHandler = require('./handlers/cssHandler.js');
const faviconHandler = require('./handlers/faviconHandler.js');
const refreshHandler = require('./handlers/refreshHandler.js');
const touchportalHandler = require('./handlers/touchportalHandler.js');
const notFoundHandler = require('./handlers/notFoundHandler.js');

/**
 * Route definitions
 * Maps URL patterns to handler functions
 */
const routes = {
    '/': mainHandler,
    '/about': aboutHandler,
    '/default.css': cssHandler,
    '/favicon.ico': faviconHandler,
    '/refresh': refreshHandler,
    '/touchportal': touchportalHandler
};

/**
 * Process incoming HTTP request and route to appropriate handler
 * @param {Object} req - HTTP request
 * @param {Object} res - HTTP response
 * @param {Object} config - Configuration object
 * @param {Object} cache - DataCache instance
 */
async function processRequest(req, res, config, cache) {
    // Get real client IP from Cloudflare/Apache headers
    const clientIp = req.headers['cf-connecting-ip'] ||
                     req.headers['x-real-ip'] ||
                     req.headers['x-forwarded-for']?.split(',')[0].trim() ||
                     req.connection.remoteAddress ||
                     req.socket.remoteAddress;
    logger.info(`Request from ${clientIp}: ${req.url}`);

    // Check if cache has data
    if (!cache.hasData()) {
        logger.warn('No cached data available');
        res.statusCode = 503;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<html><body><h1>503 Service Unavailable</h1><p>Data is being loaded. Please try again in a moment.</p></body></html>');
        return;
    }

    // Extract base path from URL (e.g., /touchportal/50/Stanton -> /touchportal)
    const url = req.url === '/' ? '/' : '/' + req.url.split('/')[1];

    // Find matching handler
    const handler = routes[url];

    if (handler) {
        // Call handler with appropriate parameters
        if (url === '/') {
            handler.handle(req, res, cache);
        } else if (url === '/refresh') {
            handler.handle(req, res, config, cache);
        } else if (url === '/about' || url === '/default.css' || url === '/favicon.ico' || url === '/touchportal') {
            handler.handle(req, res);
        } else {
            handler.handle(req, res, cache);
        }
    } else {
        // No handler found - 404
        notFoundHandler.handle(req, res);
    }
}

module.exports = {
    processRequest
};
