/**
 * Input Validation Utilities
 */

/**
 * Validate and sanitize SCU input
 * @param {string|number} input - SCU value to validate
 * @param {number} defaultValue - Default value if invalid
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {number} Validated SCU value
 */
function validateSCU(input, defaultValue = 50, min = 1, max = 10000) {
    const num = Number(input);

    // Check if it's a valid number
    if (isNaN(num) || !isFinite(num)) {
        return defaultValue;
    }

    // Check bounds
    if (num < min || num > max) {
        return defaultValue;
    }

    // Ensure it's an integer
    return Math.floor(num);
}

/**
 * Validate solar system name
 * @param {string} input - System name to validate
 * @returns {string} Validated system name (empty string if invalid)
 */
function validateSystemName(input) {
    if (typeof input !== 'string') {
        return '';
    }

    // Allow only alphanumeric characters and hyphens
    const sanitized = input.replace(/[^a-zA-Z0-9-]/g, '');

    // Limit length
    return sanitized.substring(0, 50);
}

/**
 * Sanitize URL path to prevent path traversal
 * @param {string} path - URL path to sanitize
 * @returns {string} Sanitized path
 */
function sanitizePath(path) {
    if (typeof path !== 'string') {
        return '/';
    }

    // Remove any .. or other dangerous patterns
    return path.replace(/\.\./g, '').replace(/\/\//g, '/');
}

/**
 * Validate and sanitize a ship slug (UEX vehicle identifier, e.g. "drak-corsair").
 * Only checks format (lowercase alphanumeric + hyphens); whether the slug
 * matches a real cached vehicle is checked separately where cache is available.
 * @param {string} input - Ship slug to validate
 * @returns {string} Sanitized slug, empty string if input isn't a string
 */
function validateShipId(input) {
    if (typeof input !== 'string') {
        return '';
    }

    const sanitized = input.toLowerCase().replace(/[^a-z0-9-]/g, '');
    return sanitized.substring(0, 50);
}

/**
 * Validate and sanitize a wallet amount (aUEC)
 * @param {string|number} input - Wallet value to validate
 * @param {number} max - Maximum allowed value
 * @returns {number} Validated wallet amount; 0 means "unlimited" (empty/invalid/missing input)
 */
function validateWallet(input, max = 1000000000) {
    if (input === undefined || input === null || input === '') {
        return 0;
    }

    const num = Number(input);

    if (isNaN(num) || !isFinite(num) || num < 0) {
        return 0;
    }

    return Math.floor(Math.min(num, max));
}

module.exports = {
    validateSCU,
    validateSystemName,
    sanitizePath,
    validateShipId,
    validateWallet
};
