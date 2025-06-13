// File path: js/utils/sheets-parser.js
// Sheets Parser Module - Fixed column parser for LLM with manual override
// UPDATED: Multi-language JSON support with old_ columns
import { APP_CONFIG } from '../../config/config.js';
import { sanitizeInput } from './validators.js';
import { MultiLanguageJSONHandler } from './multi-language-json-handler.js';

/**
 * Parse and validate Google Sheets data with fixed column structure
 * Now supports multi-language JSON and old_ value columns
 */
export const SheetsParser = {
    /**
     * Parse sheet data based on data type
     * @param {Object} sheetData - Raw sheet data from SheetsService
     * @param {string} dataType - 'doctor' or 'hospital'
     * @param {string} language - Target language (en/ja/th)
     * @returns {Object} - Parsed and validated data
     */
    parseData(sheetData, dataType, language) {
        if (!sheetData || !sheetData.rows) {
            throw new Error('Invalid sheet data structure');
        }
        
        // Validate data type
        if (!['doctor', 'hospital'].includes(dataType)) {
            throw new Error(`Invalid data type: ${dataType}`);
        }
        
        // Validate language
        if (!['en', 'ja', 'th'].includes(language)) {
            throw new Error(`Invalid language: ${language}`);
        }
        
        // Get expected column structure
        const columnStructure = APP_CONFIG.SHEET_COLUMNS[dataType.toUpperCase()];
        
        // Validate headers if present
        if (sheetData.headers && sheetData.headers.length > 0) {
            this.validateHeaders(sheetData.headers, dataType);
        }
        
        // Parse rows
        const parsedData = this.parseRows(sheetData.rows, dataType, columnStructure, language);
        
        // Add metadata
        parsedData.sheetName = sheetData.sheetName;
        parsedData.language = language;
        parsedData.dataType = dataType;
        
        return parsedData;
    },
    
    /**
     * Validate headers match expected structure
     * UPDATED: Now expects more columns due to new structure
     * @param {Array} headers - Sheet headers
     * @param {string} dataType - Data type
     */
    validateHeaders(headers, dataType) {
        const expectedHeaders = {
            doctor: ['id', 'kr_name', 'kr_history', 'language', 'old_name', 'old_history', 'old_json', 'manual_name', 'manual_history', 'LLM_name', 'LLM_history', 'updated_json'],
            hospital: ['id', 'kr_name', 'kr_description', 'language', 'old_name', 'old_description', 'old_json', 'manual_name', 'manual_description', 'LLM_name', 'LLM_description', 'updated_json']
        };
        
        const expected = expectedHeaders[dataType];
        const minRequired = 4; // At least id, kr_name, kr_history/description, and language
        
        if (headers.length < minRequired) {
            throw new Error(`Insufficient columns. Expected at least ${minRequired}, found ${headers.length}`);
        }
        
        // Check first 4 required columns
        const requiredColumns = expected.slice(0, 4);
        requiredColumns.forEach((col, index) => {
            if (headers[index] && headers[index].toLowerCase() !== col.toLowerCase()) {
                console.warn(`Column ${index} expected to be "${col}", found "${headers[index]}"`);
            }
        });
    },
    
    /**
     * Parse rows with fixed column structure
     * UPDATED: Added statistics for old_ values
     * @param {Array} rows - Sheet rows
     * @param {string} dataType - Data type
     * @param {Object} columnStructure - Column index mapping
     * @param {string} language - Target language for validation
     * @returns {Object} - Parsed data with statistics
     */
    parseRows(rows, dataType, columnStructure, language) {
        const data = [];
        const errors = [];
        const statistics = {
            totalRows: rows.length,
            validRows: 0,
            rowsNeedingTranslation: 0,
            rowsWithManualOverride: 0,
            rowsWithLLMTranslation: 0,
            rowsWithJSON: 0,
            rowsWithOldValues: 0,          // NEW
            rowsWithValidOldJSON: 0,       // NEW
            rowsWithContentChanges: 0,     // NEW
            languageMismatches: 0          // NEW
        };
        
        rows.forEach((row, index) => {
            try {
                const parsedRow = this.parseRow(row, dataType, columnStructure, language);
                
                // Validate required fields
                if (!parsedRow.id || !parsedRow.kr_name) {
                    throw new Error('Missing required fields: id or kr_name');
                }
                
                // Update statistics
                statistics.validRows++;
                
                if (parsedRow.needsTranslation) {
                    statistics.rowsNeedingTranslation++;
                }
                
                if (parsedRow.hasManualOverride) {
                    statistics.rowsWithManualOverride++;
                }
                
                if (parsedRow.hasLLMTranslation) {
                    statistics.rowsWithLLMTranslation++;
                }
                
                if (parsedRow.updated_json) {
                    statistics.rowsWithJSON++;
                }
                
                // NEW statistics
                if (parsedRow.hasOldValues) {
                    statistics.rowsWithOldValues++;
                }
                
                if (parsedRow.old_json_parsed && Object.keys(parsedRow.old_json_parsed).length > 0) {
                    statistics.rowsWithValidOldJSON++;
                }
                
                if (parsedRow.contentChanged) {
                    statistics.rowsWithContentChanges++;
                }
                
                if (parsedRow.languageMismatch) {
                    statistics.languageMismatches++;
                }
                
                data.push(parsedRow);
            } catch (error) {
                errors.push({
                    row: index + 2, // +2 for header row and 0-index
                    error: error.message,
                    data: row
                });
            }
        });
        
        return {
            data,
            errors,
            statistics
        };
    },
    
    /**
     * Parse a single row
     * UPDATED: Now extracts language, old_ columns, and parses old_json
     * @param {Array} row - Row data
     * @param {string} dataType - Data type
     * @param {Object} columnStructure - Column indices
     * @param {string} expectedLanguage - Expected language from form
     * @returns {Object} - Parsed row object
     */
    parseRow(row, dataType, columnStructure, expectedLanguage) {
        const getValue = (index) => {
            return index < row.length ? row[index] : '';
        };
        
        // Base fields
        const parsedRow = {
            id: getValue(columnStructure.id),
            kr_name: sanitizeInput(getValue(columnStructure.kr_name) || ''),
            rowIndex: row.length > 0 ? row[0] : null // Store original row index if available
        };
        
        // NEW: Language field
        parsedRow.language = getValue(columnStructure.language) || expectedLanguage;
        parsedRow.languageMismatch = parsedRow.language && parsedRow.language !== expectedLanguage;
        
        // Type-specific Korean source field and NEW old_ fields
        if (dataType === 'doctor') {
            parsedRow.kr_history = sanitizeInput(getValue(columnStructure.kr_history) || '');
            parsedRow.old_name = sanitizeInput(getValue(columnStructure.old_name) || '');
            parsedRow.old_history = sanitizeInput(getValue(columnStructure.old_history) || '');
            parsedRow.manual_name = sanitizeInput(getValue(columnStructure.manual_name) || '');
            parsedRow.manual_history = sanitizeInput(getValue(columnStructure.manual_history) || '');
            parsedRow.llm_name = sanitizeInput(getValue(columnStructure.llm_name) || '');
            parsedRow.llm_history = sanitizeInput(getValue(columnStructure.llm_history) || '');
        } else {
            parsedRow.kr_description = sanitizeInput(getValue(columnStructure.kr_description) || '');
            parsedRow.old_name = sanitizeInput(getValue(columnStructure.old_name) || '');
            parsedRow.old_description = sanitizeInput(getValue(columnStructure.old_description) || '');
            parsedRow.manual_name = sanitizeInput(getValue(columnStructure.manual_name) || '');
            parsedRow.manual_description = sanitizeInput(getValue(columnStructure.manual_description) || '');
            parsedRow.llm_name = sanitizeInput(getValue(columnStructure.llm_name) || '');
            parsedRow.llm_description = sanitizeInput(getValue(columnStructure.llm_description) || '');
        }
        
        // NEW: Parse old_json
        const oldJsonString = getValue(columnStructure.old_json) || '';
        parsedRow.old_json = oldJsonString; // Keep original string
        parsedRow.old_json_parsed = this.parseOldJSON(oldJsonString);
        
        // NEW: Extract values from old_json for current language
        if (parsedRow.old_json_parsed && parsedRow.language && MultiLanguageJSONHandler) {
            parsedRow.old_json_values = MultiLanguageJSONHandler.extractOldJSONValues(
                parsedRow.old_json_parsed,
                parsedRow.language,
                dataType
            );
        } else {
            parsedRow.old_json_values = {};
        }
        
        // Updated JSON result column (renamed from json_result)
        parsedRow.updated_json = getValue(columnStructure.updated_json) || '';
        
        // Metadata flags
        parsedRow.hasManualOverride = this.hasManualOverride(parsedRow, dataType);
        parsedRow.hasLLMTranslation = this.hasLLMTranslation(parsedRow, dataType);
        parsedRow.hasOldValues = this.hasOldValues(parsedRow, dataType); // NEW
        parsedRow.contentChanged = this.hasContentChanged(parsedRow, dataType); // NEW
        parsedRow.needsTranslation = this.needsTranslation(parsedRow, dataType);
        
        return parsedRow;
    },
    
    /**
     * Parse old JSON using MultiLanguageJSONHandler
     * NEW METHOD
     * @param {string} jsonString - JSON string to parse
     * @returns {Object} - Parsed JSON or empty object
     */
    parseOldJSON(jsonString) {
        // Check if handler is available
        if (!MultiLanguageJSONHandler || typeof MultiLanguageJSONHandler.parse !== 'function') {
            console.warn('MultiLanguageJSONHandler not available, returning empty object');
            return {};
        }
        return MultiLanguageJSONHandler.parse(jsonString);
    },
    
    /**
     * Check if row has manual override values
     * @param {Object} row - Parsed row
     * @param {string} dataType - Data type
     * @returns {boolean}
     */
    hasManualOverride(row, dataType) {
        if (dataType === 'doctor') {
            return !!(row.manual_name || row.manual_history);
        } else {
            return !!(row.manual_name || row.manual_description);
        }
    },
    
    /**
     * Check if row has LLM translation values
     * @param {Object} row - Parsed row
     * @param {string} dataType - Data type
     * @returns {boolean}
     */
    hasLLMTranslation(row, dataType) {
        if (dataType === 'doctor') {
            return !!(row.llm_name || row.llm_history);
        } else {
            return !!(row.llm_name || row.llm_description);
        }
    },
    
    /**
     * Check if row has old values
     * NEW METHOD
     * @param {Object} row - Parsed row
     * @param {string} dataType - Data type
     * @returns {boolean}
     */
    hasOldValues(row, dataType) {
        if (dataType === 'doctor') {
            return !!(row.old_name || row.old_history);
        } else {
            return !!(row.old_name || row.old_description);
        }
    },
    
    /**
     * Check if content has changed from old values
     * NEW METHOD
     * @param {Object} row - Parsed row
     * @param {string} dataType - Data type
     * @returns {boolean}
     */
    hasContentChanged(row, dataType) {
        if (dataType === 'doctor') {
            return row.kr_name !== row.old_name || row.kr_history !== row.old_history;
        } else {
            return row.kr_name !== row.old_name || row.kr_description !== row.old_description;
        }
    },
    
    /**
     * Check if row needs translation
     * UPDATED: Now considers if content changed from old values
     * @param {Object} row - Parsed row
     * @param {string} dataType - Data type
     * @returns {boolean}
     */
    needsTranslation(row, dataType) {
        // Only needs translation if:
        // 1. LLM fields are empty, OR
        // 2. Content has changed from old values (if old values exist)
        const hasNoLLM = !this.hasLLMTranslation(row, dataType);
        const contentChanged = this.hasOldValues(row, dataType) && this.hasContentChanged(row, dataType);
        
        return hasNoLLM || contentChanged;
    },
    
    /**
     * Get rows that need translation
     * @param {Array} data - Parsed data
     * @returns {Array} - Rows needing translation
     */
    getRowsForTranslation(data) {
        return data.filter(row => row.needsTranslation);
    },
    
    /**
     * Get final values using priority (manual > LLM > old > old_json)
     * UPDATED: Now includes full priority chain
     * @param {Object} row - Parsed row
     * @param {string} dataType - Data type
     * @returns {Object} - Final values
     */
    getFinalValues(row, dataType) {
        const values = {
            id: row.id,
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
     * Prepare data for translation
     * @param {Array} rows - Rows needing translation
     * @param {string} dataType - Data type
     * @returns {Array} - Translation requests
     */
    prepareTranslationRequests(rows, dataType) {
        return rows.map(row => {
            const request = {
                id: row.id,
                rowIndex: row.rowIndex,
                texts: {
                    name: row.kr_name
                }
            };
            
            if (dataType === 'doctor') {
                request.texts.history = row.kr_history;
            } else {
                request.texts.description = row.kr_description;
            }
            
            return request;
        });
    },
    
    /**
     * Create summary report of parsed data
     * UPDATED: Includes new statistics
     * @param {Object} parseResult - Parse result
     * @returns {Object} - Summary report
     */
    createSummaryReport(parseResult) {
        const { statistics, errors } = parseResult;
        
        const report = {
            dataType: parseResult.dataType,
            language: parseResult.language,
            sheetName: parseResult.sheetName,
            statistics: {
                ...statistics,
                successRate: ((statistics.validRows / statistics.totalRows) * 100).toFixed(1) + '%',
                translationNeeded: statistics.rowsNeedingTranslation,
                readyRows: statistics.validRows - statistics.rowsNeedingTranslation
            }
        };
        
        // Add error summary if present
        if (errors.length > 0) {
            report.errors = {
                count: errors.length,
                samples: errors.slice(0, 5).map(e => ({
                    row: e.row,
                    error: e.error
                }))
            };
        }
        
        // Add coverage analysis - UPDATED
        report.coverage = {
            manualCoverage: ((statistics.rowsWithManualOverride / statistics.validRows) * 100).toFixed(1) + '%',
            llmCoverage: ((statistics.rowsWithLLMTranslation / statistics.validRows) * 100).toFixed(1) + '%',
            oldValuesCoverage: ((statistics.rowsWithOldValues / statistics.validRows) * 100).toFixed(1) + '%',
            oldJSONCoverage: ((statistics.rowsWithValidOldJSON / statistics.validRows) * 100).toFixed(1) + '%',
            jsonCoverage: ((statistics.rowsWithJSON / statistics.validRows) * 100).toFixed(1) + '%'
        };
        
        // Add change analysis - NEW
        report.changes = {
            contentChanges: statistics.rowsWithContentChanges,
            languageMismatches: statistics.languageMismatches
        };
        
        return report;
    },
    
    /**
     * Validate sheet structure before processing
     * UPDATED: Checks for new column count
     * @param {Object} sheetData - Raw sheet data
     * @param {string} dataType - Data type
     * @returns {Object} - Validation result
     */
    validateSheetStructure(sheetData, dataType) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };
        
        // Check if sheet has data
        if (!sheetData.rows || sheetData.rows.length === 0) {
            result.isValid = false;
            result.errors.push('Sheet contains no data rows');
            return result;
        }
        
        // Check minimum columns - UPDATED
        const minColumns = 12; // Now expects 12 columns
        const firstRow = sheetData.rows[0];
        
        if (!firstRow || firstRow.length < minColumns) {
            result.warnings.push(`Sheet has ${firstRow ? firstRow.length : 0} columns, expected at least ${minColumns}`);
        }
        
        // Check for required Korean source data
        let emptySourceCount = 0;
        sheetData.rows.forEach((row, index) => {
            const krNameIndex = APP_CONFIG.SHEET_COLUMNS[dataType.toUpperCase()].kr_name;
            const krContentIndex = dataType === 'doctor' 
                ? APP_CONFIG.SHEET_COLUMNS.DOCTOR.kr_history 
                : APP_CONFIG.SHEET_COLUMNS.HOSPITAL.kr_description;
            
            if (!row[krNameIndex] || !row[krContentIndex]) {
                emptySourceCount++;
            }
        });
        
        if (emptySourceCount > 0) {
            result.warnings.push(`${emptySourceCount} rows have empty Korean source data`);
        }
        
        return result;
    }
};

/**
 * Export individual functions for convenience
 */
export const { 
    parseData,
    getRowsForTranslation,
    getFinalValues,
    prepareTranslationRequests,
    createSummaryReport,
    validateSheetStructure
} = SheetsParser;