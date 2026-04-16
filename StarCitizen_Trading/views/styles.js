/**
 * CSS Styles Module
 * Generates CSS content for the trading website
 */

/**
 * Generate CSS content
 * @returns {string} CSS styles
 */
function css() {
    return `
body
    {
    min-width: 92rem;
    color: white;
    background-color: #121212;
    font-family: Open Sans;
    font-size: 1rem;
    }
table
    {
    background-color: #1e1e1e;
    flex-shrink: 0;
    }
table.commodity
    {
    margin-top: 2rem;
    margin-bottom: 0rem;
    margin-left: auto;
    margin-right: auto;
    float: left;
    border-radius: 0.5rem;
    box-shadow: 0.15rem 0.15rem 0.15rem rgba(50, 50, 50, 0.5);
    min-width: 45rem;
    }
table.best
    {
    margin-top: 1rem;
    margin-left: auto;
    margin-right: auto;
    border-radius: 0.5rem;
    box-shadow: 0.15rem 0.15rem 0.15rem rgba(50, 50, 50, 0.5);
    }

th
    {
    background-color: #006fdd;
    color: #fff;
    padding: 5px;
    border-radius: 5px;
    }
td
    {
    text-align: center;
    vertical-align: top;
    }

a
    {
    text-decoration: none;
    color: inherit;
    outline: none;
    }
a:hover
    {
    color: #006fdd;
    }

a.about-link
    {
    color: #4da6ff !important;
    cursor: pointer;
    transition: color 0.2s ease;
    }
a.about-link:hover
    {
    color: #80c1ff !important;
    text-decoration: underline !important;
    }

div.about-page a
    {
    color: #4da6ff !important;
    cursor: pointer;
    transition: color 0.2s ease;
    }
div.about-page a:hover
    {
    color: #80c1ff !important;
    text-decoration: underline !important;
    }


div#content
    {
    width: 100%;
    }

div#main
    {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    align-items: flex-start;
    }

div#panel_r
    {
    float: right;
    }

div#panel_l
    {
    float: left;
    }

:target tbody tr th {
    background-color: goldenrod;
}
    `;
}

module.exports = {
    css
};
