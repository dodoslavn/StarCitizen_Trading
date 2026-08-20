/**
 * HTML Layout Module
 * Contains page structure and static content
 */

const fs = require('fs');
const path = require('path');

/**
 * Determine the deployed version string, evaluated once at module load.
 * Prefers a VERSION file at the app root (populated at build time from the
 * git SHA), falls back to package.json's version.
 * @returns {string}
 */
function readVersion() {
    try {
        const v = fs.readFileSync(path.join(__dirname, '..', 'VERSION'), 'utf8').trim();
        if (v) return v;
    } catch { /* file absent, fall through */ }
    try {
        return require('../package.json').version || 'unknown';
    } catch {
        return 'unknown';
    }
}

const version = readVersion();

const header = `
<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <title>ComTrading - Star Citizen</title>
        <link rel="stylesheet" type="text/css" href="/default.css" media="screen" >
        <meta http-equiv="refresh" content="300">
    </head>
    <body>
    `;

const footer = `
    </body>
</html>
`;

const about = `
    <div class="about-page about-container">
        <h1>About ComTrading</h1>

        <p>
            <strong>Community made website</strong><br>
            Created by Dodoslav Novak
        </p>

        <p>
            <strong>Contact:</strong><br>
            <a href='mailto:admin@dodoslav.eu'>admin@dodoslav.eu</a>
        </p>

        <p>
            <strong>Data Source:</strong><br>
            Trading data collected from <a href='https://uexcorp.space/' target="_blank" rel="noopener">UEX Corp API</a>
        </p>

        <p>
            <strong>Source Code:</strong><br>
            <a href='https://github.com/dodoslavn/StarCitizen_Trading' target="_blank" rel="noopener">View on GitHub</a><br>
            License: MIT
        </p>

        <p class="footer-text">
            &copy; 2025 &middot; version: ${version}
        </p>
    </div>
    `;

module.exports = {
    header,
    footer,
    about
};
