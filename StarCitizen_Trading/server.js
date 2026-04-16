/**
 * Star Citizen Trading Server
 * Main entry point for the application
 */

const http_server = require('http');
const cron = require('node-cron');
const logger = require('./logger.js');
const DataCache = require('./dataCache.js');
const trading = require('./services/trading.js');
const routes = require('./routes.js');
const fs = require('fs');

logger.info(`Node.js version: ${process.version}`);

// Load configuration
function loadConfig() {
    const filename = './config.json';

    try {
        const data = fs.readFileSync(filename, 'utf8');
        const config = JSON.parse(data);
        logger.info('Configuration file loaded successfully');
        return config;
    } catch (error) {
        console.error(`ERROR: Could not load config file (${filename}):`, error.message);
        process.exit(1);
    }
}

const config = loadConfig();
const cache = new DataCache();

// Initial data fetch
async function initialize() {
    try {
        logger.info('Initializing application...');

        await trading.initializeData(config, cache);
        await trading.refreshData(config, cache);

        logger.info('Initial data loaded successfully');
    } catch (error) {
        logger.error('Failed to initialize:', error);
        logger.warn('Server will continue, but data may not be available yet');
    }
}

// Schedule periodic data refresh
const refreshInterval = config.cache?.refresh_interval_minutes || 1;
const cronExpression = `*/${refreshInterval} * * * *`;

logger.info(`Scheduling data refresh every ${refreshInterval} minute(s)`);
cron.schedule(cronExpression, () => {
    logger.debug('Running scheduled data refresh');
    trading.refreshData(config, cache).catch(err => {
        logger.error('Scheduled refresh failed:', err);
    });
});

// Create HTTP server
const my_server = http_server.createServer((req, res) => {
    routes.processRequest(req, res, config, cache).catch(err => {
        logger.error('Request processing error:', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<html><body><h1>500 Internal Server Error</h1><p>An error occurred processing your request.</p></body></html>');
    });
});

// Handle server errors
my_server.on('error', (error) => {
    logger.error('Server error:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    my_server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    my_server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

// Start server
const port = config.http_server.port_listen;
const host = config.http_server.ip_listen;

my_server.listen(port, host, () => {
    logger.info('HTTP server started successfully');
    logger.info(`Server listening on http://${host}:${port}`);
});

// Run initialization
initialize();
