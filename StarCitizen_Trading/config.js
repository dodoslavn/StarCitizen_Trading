/**
 * Shared Configuration Loader
 */

const fs = require('fs');

/**
 * Load and parse config.json
 * @param {string} filename - Path to the config file
 * @returns {Object} Parsed configuration
 */
function loadConfig(filename = './config.json') {
    try {
        const data = fs.readFileSync(filename, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`ERROR: Could not load config file (${filename}):`, error.message);
        process.exit(1);
    }
}

module.exports = { loadConfig };
