// Validation Utilities Module
import { APP_CONFIG } from '../../config/config.js';

/**
 * Validate Google Sheets URL
 * @param {string} url - URL to validate
 * @returns {boolean} - Is valid Sheets URL
 */
export function validateSheetsUrl(url) {
    if (!url) return false;
    return APP_CONFIG.VALIDATION.SHEETS_URL_PATTERN.test(url);
}

/**
 * Extract Spreadsheet ID from Google Sheets URL
 * @param {string} url - Google Sheets URL
 * @returns {string|null} - Spreadsheet ID or null
 */
export function extractSpreadsheetId(url) {
    if (!validateSheetsUrl(url)) return null;
    
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
}

/**
 * Validate API Key
 * @param {string} apiKey - API key to validate
 * @returns {boolean} - Is valid API key
 */
export function validateApiKey(apiKey) {
    if (!apiKey) return false;
    return apiKey.trim().length >= APP_CONFIG.VALIDATION.API_KEY_MIN_LENGTH;
}

/**
 * Validate data type selection
 * @param {string} dataType - Selected data type
 * @returns {boolean} - Is valid data type
 */
export function validateDataType(dataType) {
    return ['doctor', 'hospital'].includes(dataType);
}

/**
 * Validate required fields for doctor data
 * @param {Object} data - Doctor data object
 * @returns {Object} - Validation result { isValid, errors }
 */
export function validateDoctorData(data) {
    const errors = [];
    const requiredFields = APP_CONFIG.VALIDATION.REQUIRED_FIELDS.DOCTOR;
    
    requiredFields.forEach(field => {
        if (!data[field] || data[field].trim() === '') {
            errors.push(`Missing required field: ${field}`);
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validate required fields for hospital data
 * @param {Object} data - Hospital data object
 * @returns {Object} - Validation result { isValid, errors }
 */
export function validateHospitalData(data) {
    const errors = [];
    const requiredFields = APP_CONFIG.VALIDATION.REQUIRED_FIELDS.HOSPITAL;
    
    requiredFields.forEach(field => {
        if (!data[field] || data[field].trim() === '') {
            errors.push(`Missing required field: ${field}`);
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - Is valid email
 */
export function validateEmail(email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} - Is valid URL
 */
export function validateUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Sanitize input to prevent XSS
 * @param {string} input - Input to sanitize
 * @returns {string} - Sanitized input
 */
export function sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

/**
 * Validate translation data completeness
 * @param {Object} translationData - Translation result object
 * @returns {Object} - Validation result { isValid, errors }
 */
export function validateTranslationData(translationData) {
    const errors = [];
    
    if (!translationData) {
        errors.push('No translation data provided');
        return { isValid: false, errors };
    }
    
    // Check required properties
    if (!translationData.dataType) {
        errors.push('Missing data type');
    }
    
    if (!translationData.translations) {
        errors.push('Missing translations object');
    } else {
        // Check language completeness
        const requiredLangs = ['ja', 'th', 'en'];
        requiredLangs.forEach(lang => {
            if (!translationData.translations[lang]) {
                errors.push(`Missing ${lang} translations`);
            } else if (!Array.isArray(translationData.translations[lang])) {
                errors.push(`Invalid ${lang} translations format`);
            }
        });
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validate batch size for API requests
 * @param {number} size - Batch size
 * @param {number} maxSize - Maximum allowed size
 * @returns {boolean} - Is valid batch size
 */
export function validateBatchSize(size, maxSize = 50) {
    return Number.isInteger(size) && size > 0 && size <= maxSize;
}

/**
 * Debounce validation function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Debounce delay in ms
 * @returns {Function} - Debounced function
 */
export function debounceValidation(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}