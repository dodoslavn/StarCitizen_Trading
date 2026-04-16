/**
 * Touchportal Interface Module
 * Simplified trading interface for touchscreen displays
 */

/**
 * Generate touchportal interface
 * @param {number} scu - SCU capacity
 * @param {string} solar_system - System filter
 * @returns {string} Complete HTML page
 */
function touchportal(scu, solar_system = '') {
    return `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="10"><style>
        body { background-color: black; color: white; }
        body div#top { text-align: center; margin-bottom: 2rem; }
        body div#top a { background-color: #006fdd; border-radius: 5px; text-align: center; padding: 0.4rem; }
        table { margin: auto; margin-bottom: 1rem; }
        table tr th { background-color: #006fdd; border-radius: 5px; text-align: center; padding: 0 0.5rem; }
        table tr td { text-align: center; }
        a { text-decoration: none; color: white; }
    </style></head><body>
    <div id="top">
        <a href="/touchportal/${scu}/Stanton">Stanton only</a>
        <a href="/touchportal/${scu}/Pyro">Pyro only</a>
        <a style="margin-right: 3rem;" href="/touchportal/${scu}/">All systems</a>
        ${scu > 10 ? `<a href='/touchportal/${Number(scu) - 10}/${solar_system}'>-10 SCU</a>` : ''}
        <a href="/touchportal/${Number(scu) + 10}/${solar_system}">+10 SCU</a>
        ${scu > 100 ? `<a href='/touchportal/${Number(scu) - 100}/${solar_system}'>-100 SCU</a>` : ''}
        <a href="/touchportal/${Number(scu) + 100}/${solar_system}">+100 SCU</a>
    </div>
    <p style="text-align:center;">Touchportal page for ${scu} SCU capacity</p>
    </body></html>`;
}

module.exports = {
    touchportal
};
