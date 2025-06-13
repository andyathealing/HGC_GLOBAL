// File path: js/utils/json-builder.js
// JSON Builder Module - Multi-language JSON generation with full priority chain
// UPDATED: Support for multi-language JSON and extended priority chain
import { APP_CONFIG } from '../../config/config.js';
import { MultiLanguageJSONHandler } from './multi-language-json-handler.js';

/**
 * JSON Builder
 * Handles merging of manual, LLM, old, and old_json values
 * Generates multi-language JSON structures
 */
export const JSONBuilder = {
    /**
     * Build multi-language JSON for a single row
     * UPDATED: Now uses buildUpdatedJSON internally
     * @param {Object} row - Parsed row data
     * @param {string} dataType - 'doctor' or 'hospital'
     * @param {string} language - Target language (en/ja/th)
     * @returns {Object} - JSON object and string
     */
    buildJSON(row, dataType, language = null) {
        // Use the new multi-language method
        const jsonObject = this.buildUpdatedJSON(row, dataType, language || row.language);
        
        // Convert to formatted string
        const jsonString = MultiLanguageJSONHandler ? 
            MultiLanguageJSONHandler.stringify(jsonObject) : 
            JSON.stringify(jsonObject, null, APP_CONFIG.JSON_OUTPUT.INDENT);
        
        return {
            object: jsonObject,
            string: jsonString
        };
    },
    
    /**
     * Build updated multi-language JSON
     * NEW METHOD - Core method for multi-language support
     * @param {Object} row - Parsed row data with old_json_parsed
     * @param {string} dataType - 'doctor' or 'hospital'
     * @param {string} language - Target language to update
     * @returns {Object} - Multi-language JSON object
     */
    buildUpdatedJSON(row, dataType, language) {
        // Start with existing multi-language JSON or empty object
        const baseJSON = row.old_json_parsed || {};
        
        // Get final values using full priority chain
        const finalValues = this.getFinalValuesWithOld(row, dataType);
        
        // Create language-specific data
        const languageData = dataType === 'doctor' 
            ? {
                id: finalValues.id,
                name: finalValues.name,
                history: finalValues.history
            }
            : {
                id: finalValues.id,
                name: finalValues.name,
                description: finalValues.description
            };
        
        // Merge with existing JSON
        if (MultiLanguageJSONHandler && typeof MultiLanguageJSONHandler.merge === 'function') {
            return MultiLanguageJSONHandler.merge(baseJSON, language, languageData);
        } else {
            // Fallback if handler not available
            return {
                ...baseJSON,
                [language]: languageData
            };
        }
    },
    
    /**
     * Get final values using full priority chain
     * NEW METHOD - Implements manual > llm > old > old_json priority
     * @param {Object} row - Row data with all value types
     * @param {string} dataType - 'doctor' or 'hospital'
     * @returns {Object} - Final merged values
     */
    getFinalValuesWithOld(row, dataType) {
        const values = {
            id: row.id || '',
            name: row.manual_name || row.llm_name || row.old_name || row.old_json_values?.name || ''
        };
        
        if (dataType === 'doctor') {
            values.history = row.manual_history || row.llm_history || row.old_history || row.old_json_values?.history || '';
        } else {
            values.description = row.manual_description || row.llm_description || row.old_description || row.old_json_values?.description || '';
        }
        
        return values;
    },
    
    /**
     * Get final values using manual override priority
     * DEPRECATED: Use getFinalValuesWithOld for full priority chain
     * Kept for backward compatibility
     * @param {Object} row - Row data with manual and LLM values
     * @param {string} dataType - 'doctor' or 'hospital'
     * @returns {Object} - Final merged values
     */
    getFinalValues(row, dataType) {
        // Call the new method for consistency
        return this.getFinalValuesWithOld(row, dataType);
    },
    
    /**
     * Create JSON object based on template
     * UPDATED: Now creates language-specific structure
     * @param {Object} values - Final values
     * @param {string} dataType - 'doctor' or 'hospital'
     * @param {string} language - Target language
     * @returns {Object} - Multi-language JSON object
     */
    createJSONObject(values, dataType, language = 'en') {
        const template = { ...APP_CONFIG.JSON_OUTPUT.TEMPLATES[dataType.toUpperCase()].LANGUAGE_TEMPLATE };
        
        // Populate template with values
        Object.keys(template).forEach(key => {
            if (values.hasOwnProperty(key)) {
                template[key] = values[key];
            }
        });
        
        // Return as multi-language structure
        return {
            [language]: template
        };
    },
    
    /**
     * Build JSON for multiple rows
     * UPDATED: Now includes language parameter
     * @param {Array} rows - Array of parsed rows
     * @param {string} dataType - 'doctor' or 'hospital'
     * @param {string} language - Target language
     * @returns {Array} - Array of JSON results
     */
    buildBatchJSON(rows, dataType, language) {
        return rows.map((row, index) => {
            try {
                const json = this.buildJSON(row, dataType, language);
                return {
                    rowIndex: row.rowIndex !== undefined ? row.rowIndex : index,
                    id: row.id,
                    json: json.string,
                    object: json.object,
                    success: true
                };
            } catch (error) {
                console.error(`Failed to build JSON for row ${row.id}:`, error);
                return {
                    rowIndex: row.rowIndex !== undefined ? row.rowIndex : index,
                    id: row.id,
                    json: '',
                    error: error.message,
                    success: false
                };
            }
        });
    },
    
    /**
     * Validate JSON generation results
     * @param {Array} results - JSON generation results
     * @returns {Object} - Validation summary
     */
    validateResults(results) {
        const summary = {
            total: results.length,
            successful: 0,
            failed: 0,
            errors: []
        };
        
        results.forEach(result => {
            if (result.success) {
                summary.successful++;
            } else {
                summary.failed++;
                summary.errors.push({
                    id: result.id,
                    rowIndex: result.rowIndex,
                    error: result.error
                });
            }
        });
        
        summary.successRate = ((summary.successful / summary.total) * 100).toFixed(1) + '%';
        
        return summary;
    },
    
    /**
     * Merge translation results with existing data
     * @param {Array} originalRows - Original parsed rows
     * @param {Array} translations - Translation results
     * @param {string} dataType - 'doctor' or 'hospital'
     * @returns {Array} - Merged rows
     */
    mergeTranslations(originalRows, translations, dataType) {
        // Create a map of translations by ID
        const translationMap = new Map();
        translations.forEach(trans => {
            translationMap.set(trans.id, trans.translated);
        });
        
        // Merge translations into original rows
        return originalRows.map(row => {
            const translation = translationMap.get(row.id);
            
            if (translation) {
                // Add translated values to row
                const mergedRow = { ...row };
                mergedRow.llm_name = translation.name || '';
                
                if (dataType === 'doctor') {
                    mergedRow.llm_history = translation.history || '';
                } else {
                    mergedRow.llm_description = translation.description || '';
                }
                
                return mergedRow;
            }
            
            return row;
        });
    },
    
    /**
     * Prepare results for writing to sheet
     * UPDATED: Column name changed to updated_json
     * @param {Array} rows - Rows with all data
     * @param {Array} jsonResults - JSON generation results
     * @param {string} dataType - 'doctor' or 'hospital'
     * @returns {Array} - Combined results for writing
     */
    prepareWriteData(rows, jsonResults, dataType) {
        // Create a map of JSON results by row index
        const jsonMap = new Map();
        jsonResults.forEach(result => {
            if (result.success) {
                jsonMap.set(result.rowIndex, result.json);
            }
        });
        
        // Combine all data for writing
        return rows.map((row, index) => {
            const rowIndex = row.rowIndex !== undefined ? row.rowIndex : index;
            const writeData = {
                rowIndex: rowIndex,
                id: row.id
            };
            
            // Add translation data if row was translated
            if (row.needsTranslation && row.llm_name) {
                writeData.translated = {
                    name: row.llm_name
                };
                
                if (dataType === 'doctor') {
                    writeData.translated.history = row.llm_history || '';
                } else {
                    writeData.translated.description = row.llm_description || '';
                }
            }
            
            // Add JSON data - now for updated_json column
            const json = jsonMap.get(rowIndex);
            if (json) {
                writeData.json = json;
                writeData.updated_json = json; // NEW: Use new column name
            }
            
            return writeData;
        });
    },
    
    /**
     * Create summary report
     * UPDATED: Includes multi-language statistics
     * @param {Object} data - Processing data
     * @returns {Object} - Summary report
     */
    createSummaryReport(data) {
        const report = {
            dataType: data.dataType,
            language: data.language,
            timestamp: new Date().toISOString(),
            statistics: {
                totalRows: data.totalRows || 0,
                translatedRows: data.translatedRows || 0,
                manualOverrides: data.manualOverrides || 0,
                oldValues: data.oldValues || 0,                    // NEW
                validOldJSON: data.validOldJSON || 0,              // NEW
                jsonGenerated: data.jsonGenerated || 0,
                multiLanguageJSON: data.multiLanguageJSON || 0,    // NEW
                errors: data.errors || 0
            }
        };
        
        // Calculate percentages
        if (report.statistics.totalRows > 0) {
            report.statistics.translationCoverage = 
                ((report.statistics.translatedRows / report.statistics.totalRows) * 100).toFixed(1) + '%';
            report.statistics.manualOverrideCoverage = 
                ((report.statistics.manualOverrides / report.statistics.totalRows) * 100).toFixed(1) + '%';
            report.statistics.oldValuesCoverage = 
                ((report.statistics.oldValues / report.statistics.totalRows) * 100).toFixed(1) + '%';
            report.statistics.successRate = 
                ((report.statistics.jsonGenerated / report.statistics.totalRows) * 100).toFixed(1) + '%';
        }
        
        return report;
    },
    
    /**
     * Export data as downloadable JSON file
     * UPDATED: Exports multi-language JSON structure
     * @param {Array} jsonObjects - Array of multi-language JSON objects
     * @param {string} dataType - 'doctor' or 'hospital'
     * @param {string} language - Primary language (for filename)
     * @returns {Object} - File data
     */
    exportAsFile(jsonObjects, dataType, language) {
        // Merge all objects into a single multi-language structure
        const mergedData = {};
        
        jsonObjects.forEach(obj => {
            if (obj && obj.id) {
                const id = obj.id;
                if (!mergedData[id]) {
                    mergedData[id] = {};
                }
                // Merge all languages for this ID
                Object.assign(mergedData[id], obj);
            }
        });
        
        const exportData = {
            version: APP_CONFIG.VERSION,
            dataType: dataType,
            primaryLanguage: language,
            languages: this.getExportLanguages(mergedData),
            timestamp: new Date().toISOString(),
            count: Object.keys(mergedData).length,
            data: mergedData
        };
        
        const jsonString = JSON.stringify(exportData, null, APP_CONFIG.JSON_OUTPUT.INDENT);
        const blob = new Blob([jsonString], { type: 'application/json' });
        
        const date = new Date().toISOString().split('T')[0];
        const filename = `${APP_CONFIG.EXPORT.FILE_PREFIX[dataType.toUpperCase()]}_${date}.json`;
        
        return {
            blob: blob,
            filename: filename,
            size: blob.size
        };
    },
    
    /**
     * Get all languages present in export data
     * NEW METHOD
     * @param {Object} mergedData - Merged multi-language data
     * @returns {Array} - Array of language codes
     */
    getExportLanguages(mergedData) {
        const languages = new Set();
        
        Object.values(mergedData).forEach(item => {
            Object.keys(item).forEach(key => {
                if (MultiLanguageJSONHandler && MultiLanguageJSONHandler.isValidLanguage(key)) {
                    languages.add(key);
                } else if (!MultiLanguageJSONHandler && ['en', 'ja', 'th'].includes(key)) {
                    // Fallback to hardcoded languages if handler not available
                    languages.add(key);
                }
            });
        });
        
        return Array.from(languages);
    },
    
    /**
     * Extract single language data from multi-language JSON
     * NEW METHOD - Useful for backwards compatibility
     * @param {Array} multiLangObjects - Array of multi-language objects
     * @param {string} language - Language to extract
     * @returns {Array} - Single language objects
     */
    extractSingleLanguage(multiLangObjects, language) {
        return multiLangObjects.map(obj => {
            if (MultiLanguageJSONHandler && typeof MultiLanguageJSONHandler.extractLanguage === 'function') {
                const langData = MultiLanguageJSONHandler.extractLanguage(obj, language);
                return langData || null;
            } else {
                // Fallback to direct property access
                return obj[language] || null;
            }
        }).filter(Boolean);
    }
};

/**
 * Export individual functions for convenience
 */
export const {
    buildJSON,
    buildUpdatedJSON,
    buildBatchJSON,
    getFinalValues,
    getFinalValuesWithOld,
    mergeTranslations,
    prepareWriteData,
    createSummaryReport,
    exportAsFile,
    extractSingleLanguage
} = JSONBuilder;