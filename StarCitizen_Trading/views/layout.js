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
    <div class="about-page" style="max-width: 50rem; margin: 2rem auto; padding: 2rem; background-color: #1e1e1e; border-radius: 0.5rem; line-height: 1.8;">
        <h1 style="color: #4da6ff; margin-bottom: 1.5rem;">About ComTrading</h1>

        <p style="margin-bottom: 1rem;">
            <strong>Community made website</strong><br>
            Created by Dodoslav Novak
        </p>

        <p style="margin-bottom: 1rem;">
            <strong>Contact:</strong><br>
            <a href='mailto:admin@dodoslav.eu'>admin@dodoslav.eu</a>
        </p>

        <p style="margin-bottom: 1rem;">
            <strong>Data Source:</strong><br>
            Trading data collected from <a href='https://uexcorp.space/' target="_blank" rel="noopener">UEX Corp API</a>
        </p>

        <p style="margin-bottom: 1rem;">
            <strong>Source Code:</strong><br>
            <a href='https://github.com/dodoslavn/StarCitizen_Trading' target="_blank" rel="noopener">View on GitHub</a>
        </p>

        <p style="margin-top: 2rem; text-align: center; color: #888;">
            &copy; 2025
        </p>
    </div>
    `;

module.exports = {
    header,
    footer,
    about
};
