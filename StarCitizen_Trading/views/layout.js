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

/**
 * Standalone page shown while the server has not yet loaded any trading
 * data (e.g. right after a restart). Self-contained (own inline styles,
 * no dependency on /default.css or cached data) and auto-refreshes every
 * few seconds so the visitor doesn't have to reload manually.
 * @returns {string}
 */
function loadingPage() {
    return `
<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <title>ComTrading - Star Citizen</title>
        <meta http-equiv="refresh" content="3">
        <style>
            body {
                background-color: #000000;
                color: white;
                font-family: Open Sans, Arial, sans-serif;
                min-height: 100vh;
                margin: 0;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            div.loading-card {
                text-align: center;
                padding: 2.5rem 3rem;
                background-color: #1e1e1e;
                border-radius: 0.5rem;
                box-shadow: 0.15rem 0.15rem 0.15rem rgba(50, 50, 50, 0.5);
            }
            div.spinner {
                width: 2.5rem;
                height: 2.5rem;
                margin: 0 auto 1.5rem;
                border: 0.3rem solid #333;
                border-top-color: #006fdd;
                border-radius: 50%;
                animation: spin 0.9s linear infinite;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            h1 {
                color: #4da6ff;
                font-size: 1.3rem;
                margin: 0 0 0.5rem;
            }
            p {
                color: #aaa;
                margin: 0;
            }
        </style>
    </head>
    <body>
        <div class="loading-card">
            <div class="spinner"></div>
            <h1>Loading trading data&hellip;</h1>
            <p>This page refreshes automatically, no need to reload.</p>
        </div>
    </body>
</html>
    `;
}

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
    loadingPage,
    about
};
