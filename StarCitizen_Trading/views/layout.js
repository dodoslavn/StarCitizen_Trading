/**
 * HTML Layout Module
 * Contains page structure and static content
 */

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
            &copy; 2025
        </p>
    </div>
    `;

module.exports = {
    header,
    footer,
    about
};
