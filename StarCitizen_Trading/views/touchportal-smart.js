/**
 * Smart Routes Interface Module
 *
 * Route ranking that accounts for data-age confidence, ship/wallet
 * constraints, travel+loading time, and system risk - built incrementally
 * per docs/smart-routes-plan.md. This file currently only scaffolds the
 * page (Milestone 1); ranking logic lands in later milestones.
 */

const { shell } = require('./touchportal.js');
const { escapeHtml } = require('../utils/formatters.js');

/**
 * Generate the smart routes page.
 * @param {Object} cache - Data cache instance
 * @param {Object} query - Parsed query-string params (ship, wallet, sort, etc.)
 * @returns {string} Complete HTML page
 */
function touchportalSmart(cache, query = {}) {
    // Milestone 1 is scaffolding only - just confirm data is loaded and echo
    // back any query params the URL already carries, so later milestones can
    // build on a page that already round-trips its own state.
    const status = cache.hasData()
        ? 'Commodity data loaded - ranking logic lands in a later milestone.'
        : 'Waiting for commodity data to load...';
    const paramsPreview = Object.keys(query).length
        ? `<p style="text-align: center; color: #666;">query: ${escapeHtml(JSON.stringify(query))}</p>`
        : '';

    const body = `
    <a class="back-hub" href="/touchportal">&larr; Hub</a>
    <h2>Smart Routes</h2>
    <p style="text-align: center; color: #888;">${escapeHtml(status)}</p>
    ${paramsPreview}`;

    return shell('Smart Routes', body, false);
}

module.exports = {
    touchportalSmart
};
