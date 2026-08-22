/**
 * HTML Generation Module
 * Central export point for all view components
 *
 * This module has been refactored into smaller, focused modules:
 * - views/styles.js - CSS generation
 * - views/layout.js - Page structure (header, footer, about)
 * - views/commodities.js - Commodity display logic
 * - views/profits.js - Profit tables
 * - views/touchportal.js - Touchportal interface
 * - utils/formatters.js - Number formatting utilities
 */

const { css } = require('./views/styles.js');
const { header, footer, loadingPage, about } = require('./views/layout.js');
const { displayCommodity } = require('./views/commodities.js');
const { profit_uec, profit_perc } = require('./views/profits.js');
const { touchportal, touchportalHub, touchportalStale } = require('./views/touchportal.js');
const { touchportalSmart } = require('./views/touchportal-smart.js');

module.exports = {
    header,
    footer,
    loadingPage,
    displayCommodity,
    css,
    profit_uec,
    profit_perc,
    touchportal,
    touchportalHub,
    touchportalStale,
    touchportalSmart,
    about
};
