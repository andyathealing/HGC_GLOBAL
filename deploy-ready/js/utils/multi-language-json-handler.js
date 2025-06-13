// File path: js/utils/multi-language-json-handler.js
// Multi-Language JSON Handler - NEW MODULE
// Handles parsing, validation, and manipulation of multi-language JSON structures

import { APP_CONFIG } from '../../config/config.js';

/**
 * Multi-Language JSON Handler
 * Provides utilities for handling multi-language JSON structures
 * Following the pattern: { "en": {...}, "ja": {...}, "th": {...} }
 */
export const MultiLanguageJSONHandler = {
    // Cache for parsed JSON to avoid repeated parsing
    _cache: new Map(),
    
    /**
     * Safe JSON parsing with validation
     * @param {string} jsonString - JSON string to parse
     * @returns {Object} Parsed JSON object or empty object on error
     */
    parse(jsonString) {
        // Return empty object for null/undefined/empty
        if (!jsonString || jsonString.trim() === '') {
            return {};
        }
        
        // Check cache first
        if (APP_CONFIG.PERFORMANCE.JSON_CACHE.ENABLED && this._cache.has(jsonString)) {
            return this._cache.get(jsonString);
        }
        
        try {
            const parsed = JSON.parse(jsonString);
            
            // Validate it's an object (not array or primitive)
            if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
                console.warn('Parsed JSON is not a valid object structure');
                return {};
            }
            
            // Cache if enabled
            if (APP_CONFIG.PERFORMANCE.JSON_CACHE.ENABLED) {
                this._addToCache(jsonString, parsed);
            }
            
            return parsed;
        } catch (error) {
            if (APP_CONFIG.MULTI_LANGUAGE_JSON.PARSING.LOG_ERRORS) {
                console.warn('Failed to parse JSON:', error.message);
                console.debug('Invalid JSON string:', jsonString);
            }
            return {};
        }
    },
    
    /**
     * Merge existing JSON with language-specific updates
     * @param {Object} existingJSON - Current multi-language JSON object
     * @param {string} language - Language code (en, ja, th)
     * @param {Object} newData - New data for the specific language
     * @returns {Object} Merged JSON object
     */
    merge(existingJSON, language, newData) {
        // Ensure we have a valid base object
        const baseJSON = existingJSON && typeof existingJSON === 'object' ? { ...existingJSON } : {};
        
        // Validate language code
        if (!this.isValidLanguage(language)) {
            console.error(`Invalid language code: ${language}`);
            return baseJSON;
        }
        
        // Merge the language-specific data
        baseJSON[language] = {
            ...(baseJSON[language] || {}),
            ...newData
        };
        
        return baseJSON;
    },
    
    /**
     * Validate JSON structure
     * @param {Object} json - JSON object to validate
     * @returns {boolean} True if valid multi-language structure
     */
    validate(json) {
        // Must be an object
        if (!json || typeof json !== 'object' || Array.isArray(json)) {
            return false;
        }
        
        // Check if it has at least one valid language key
        const hasValidLanguage = Object.keys(json).some(key => 
            this.isValidLanguage(key)
        );
        
        if (!hasValidLanguage && Object.keys(json).length > 0) {
            // It has keys but none are valid languages
            console.warn('JSON has keys but no valid language codes');
        }
        
        return true;
    },
    
    /**
     * Extract specific language data from multi-language JSON
     * @param {Object} json - Multi-language JSON object
     * @param {string} language - Language code to extract
     * @returns {Object|null} Language-specific data or null if not found
     */
    extractLanguage(json, language) {
        if (!json || !this.isValidLanguage(language)) {
            return null;
        }
        
        return json[language] || null;
    },
    
    /**
     * Get all available languages in a JSON object
     * @param {Object} json - Multi-language JSON object
     * @returns {string[]} Array of language codes present in the JSON
     */
    getAvailableLanguages(json) {
        if (!json || typeof json !== 'object') {
            return [];
        }
        
        return Object.keys(json).filter(key => this.isValidLanguage(key));
    },
    
    /**
     * Create a new multi-language JSON object with initial data
     * @param {string} language - Initial language code
     * @param {Object} data - Initial data for the language
     * @returns {Object} New multi-language JSON object
     */
    create(language, data) {
        if (!this.isValidLanguage(language)) {
            console.error(`Cannot create JSON with invalid language: ${language}`);
            return {};
        }
        
        return {
            [language]: data
        };
    },
    
    /**
     * Remove a language from multi-language JSON
     * @param {Object} json - Multi-language JSON object
     * @param {string} language - Language code to remove
     * @returns {Object} Updated JSON object without the specified language
     */
    removeLanguage(json, language) {
        if (!json || !this.isValidLanguage(language)) {
            return json || {};
        }
        
        const updated = { ...json };
        delete updated[language];
        return updated;
    },
    
    /**
     * Check if a JSON object has data for a specific language
     * @param {Object} json - Multi-language JSON object
     * @param {string} language - Language code to check
     * @returns {boolean} True if language exists and has data
     */
    hasLanguage(json, language) {
        return !!(json && json[language] && Object.keys(json[language]).length > 0);
    },
    
    /**
     * Stringify JSON with proper formatting
     * @param {Object} json - JSON object to stringify
     * @returns {string} Formatted JSON string
     */
    stringify(json) {
        try {
            return JSON.stringify(json, null, APP_CONFIG.JSON_OUTPUT.INDENT);
        } catch (error) {
            console.error('Failed to stringify JSON:', error);
            return '{}';
        }
    },
    
    /**
     * Get default values for a specific data type and language
     * @param {string} dataType - 'doctor' or 'hospital'
     * @param {string} language - Language code
     * @returns {Object} Default values object
     */
    getDefaultValues(dataType, language) {
        const defaults = APP_CONFIG.MULTI_LANGUAGE_JSON.DEFAULT_VALUES;
        const template = dataType === 'doctor' 
            ? { name: defaults.name, history: defaults.history }
            : { name: defaults.name, description: defaults.description };
        
        return {
            [language]: template
        };
    },
    
    /**
     * Merge multiple JSON objects, preserving all languages
     * @param {...Object} jsons - Multiple JSON objects to merge
     * @returns {Object} Merged multi-language JSON
     */
    mergeMultiple(...jsons) {
        const result = {};
        
        for (const json of jsons) {
            if (json && typeof json === 'object') {
                for (const [lang, data] of Object.entries(json)) {
                    if (this.isValidLanguage(lang)) {
                        result[lang] = {
                            ...(result[lang] || {}),
                            ...(data || {})
                        };
                    }
                }
            }
        }
        
        return result;
    },
    
    /**
     * Validate if a string is a valid language code
     * @param {string} language - Language code to validate
     * @returns {boolean} True if valid
     */
    isValidLanguage(language) {
        return APP_CONFIG.MULTI_LANGUAGE_JSON.LANGUAGE_CODES.includes(language);
    },
    
    /**
     * Clear the JSON cache
     */
    clearCache() {
        this._cache.clear();
    },
    
    /**
     * Add to cache with size limit management
     * @private
     */
    _addToCache(key, value) {
        // Check cache size limit
        if (this._cache.size >= APP_CONFIG.PERFORMANCE.JSON_CACHE.MAX_SIZE) {
            // Remove oldest entry (first one in the Map)
            const firstKey = this._cache.keys().next().value;
            this._cache.delete(firstKey);
        }
        
        this._cache.set(key, value);
    },
    
    /**
     * Extract values for the priority chain from old_json
     * Used when falling back to old_json values
     * @param {Object} json - Multi-language JSON object
     * @param {string} language - Current language
     * @param {string} dataType - 'doctor' or 'hospital'
     * @returns {Object} Extracted values or empty object
     */
    extractOldJSONValues(json, language, dataType) {
        const langData = this.extractLanguage(json, language);
        if (!langData) {
            return {};
        }
        
        if (dataType === 'doctor') {
            return {
                name: langData.name || '',
                history: langData.history || ''
            };
        } else {
            return {
                name: langData.name || '',
                description: langData.description || ''
            };
        }
    }
};

// Export for testing individual methods if needed
export const {
    parse,
    merge,
    validate,
    extractLanguage,
    getAvailableLanguages,
    create,
    removeLanguage,
    hasLanguage,
    stringify,
    getDefaultValues,
    mergeMultiple,
    isValidLanguage,
    clearCache,
    extractOldJSONValues
} = MultiLanguageJSONHandler;