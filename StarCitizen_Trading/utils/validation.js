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

module.exports = {
    validateSCU,
    validateSystemName,
    sanitizePath
};
