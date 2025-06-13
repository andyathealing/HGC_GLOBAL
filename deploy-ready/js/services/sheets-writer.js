// File path: js/services/sheets-writer.js
// Sheets Writer Module - Handles writing translations and JSON back to Google Sheets
// UPDATED: Multi-language JSON support with new column positions
import { APP_CONFIG } from '../../config/config.js';

/**
 * Sheets Writer Service
 * Manages all write operations to Google Sheets
 * Now writes to updated column positions (J, K, L)
 */
export class SheetsWriter {
    constructor() {
        this.sheetsService = null; // Lazy initialization
        this.writeQueue = [];
        this.isWriting = false;
    }
    
    /**
     * Get sheets service instance (lazy loading)
     * @private
     */
    async _getSheetsService() {
        if (!this.sheetsService) {
            // Lazy load to avoid circular dependencies
            const { getSheetsService } = await import('./sheets-service.js');
            this.sheetsService = getSheetsService();
        }
        return this.sheetsService;
    }
    
    /**
     * Write LLM translations to sheet
     * UPDATED: Handles skipped rows from translation service
     * @param {string} spreadsheetId - Google Sheets ID
     * @param {string} sheetName - Sheet name
     * @param {Array} translations - Translation results with row indices
     * @param {string} dataType - 'doctor' or 'hospital'
     * @returns {Promise<Object>} - Write result
     */
    async writeLLMTranslations(spreadsheetId, sheetName, translations, dataType) {
        if (!translations || translations.length === 0) {
            return { success: true, updatedCells: 0, skippedRows: 0 };
        }
        
        try {
            const sheetsService = await this._getSheetsService();
            const columnLetters = APP_CONFIG.COLUMN_LETTERS[dataType.toUpperCase()];
            const updates = [];
            
            // Separate translated and skipped rows
            const translatedRows = translations.filter(t => t.success && !t.skipped);
            const skippedRows = translations.filter(t => t.skipped);
            
            // Group translations by column
            const nameValues = [];
            const contentValues = [];
            const rowIndices = [];
            
            translatedRows.forEach(translation => {
                const rowNumber = translation.rowIndex + 2; // +2 for header and 0-index
                rowIndices.push(rowNumber);
                
                nameValues.push([translation.translated.name || '']);
                
                if (dataType === 'doctor') {
                    contentValues.push([translation.translated.history || '']);
                } else {
                    contentValues.push([translation.translated.description || '']);
                }
            });
            
            // Create batch updates for each column
            if (nameValues.length > 0) {
                // For non-contiguous rows, we need individual updates
                const nameUpdates = this.createNonContiguousUpdates(
                    sheetName,
                    columnLetters.llm_name, // Now column J
                    rowIndices,
                    nameValues
                );
                updates.push(...nameUpdates);
                
                const contentColumn = dataType === 'doctor' 
                    ? columnLetters.llm_history 
                    : columnLetters.llm_description; // Now column K
                    
                const contentUpdates = this.createNonContiguousUpdates(
                    sheetName,
                    contentColumn,
                    rowIndices,
                    contentValues
                );
                updates.push(...contentUpdates);
            }
            
            // Execute batch update
            if (updates.length > 0) {
                const result = await sheetsService.batchUpdate(spreadsheetId, updates);
                return {
                    success: true,
                    updatedCells: result.totalUpdatedCells || updates.length * 2,
                    updatedRows: translatedRows.length,
                    skippedRows: skippedRows.length
                };
            }
            
            return { 
                success: true, 
                updatedCells: 0, 
                updatedRows: 0,
                skippedRows: skippedRows.length 
            };
            
        } catch (error) {
            console.error('Failed to write LLM translations:', error);
            throw new Error(`Failed to write translations: ${error.message}`);
        }
    }
    
    /**
     * Write JSON results to sheet
     * UPDATED: Now writes to updated_json column (L)
     * @param {string} spreadsheetId - Google Sheets ID
     * @param {string} sheetName - Sheet name
     * @param {Array} jsonResults - JSON strings with row indices
     * @param {string} dataType - 'doctor' or 'hospital'
     * @returns {Promise<Object>} - Write result
     */
    async writeJSONResults(spreadsheetId, sheetName, jsonResults, dataType) {
        if (!jsonResults || jsonResults.length === 0) {
            return { success: true, updatedCells: 0 };
        }
        
        try {
            const sheetsService = await this._getSheetsService();
            const columnLetter = APP_CONFIG.COLUMN_LETTERS[dataType.toUpperCase()].updated_json; // Changed from json_result
            const updates = [];
            
            // Group JSON results
            const jsonValues = [];
            const rowIndices = [];
            
            jsonResults.forEach(result => {
                const rowNumber = result.rowIndex + 2; // +2 for header and 0-index
                rowIndices.push(rowNumber);
                jsonValues.push([result.json || result.updated_json]); // Support both property names
            });
            
            // Create updates for non-contiguous rows
            const jsonUpdates = this.createNonContiguousUpdates(
                sheetName,
                columnLetter, // Now column L
                rowIndices,
                jsonValues
            );
            updates.push(...jsonUpdates);
            
            // Execute batch update
            if (updates.length > 0) {
                const result = await sheetsService.batchUpdate(spreadsheetId, updates);
                return {
                    success: true,
                    updatedCells: result.totalUpdatedCells || updates.length,
                    updatedRows: jsonResults.length
                };
            }
            
            return { success: true, updatedCells: 0 };
            
        } catch (error) {
            console.error('Failed to write JSON results:', error);
            throw new Error(`Failed to write JSON results: ${error.message}`);
        }
    }
    
    /**
     * Write all results (translations and JSON) in one batch
     * UPDATED: Handles skipped rows and new column positions
     * @param {string} spreadsheetId - Google Sheets ID
     * @param {string} sheetName - Sheet name
     * @param {Array} results - Combined results with translations and JSON
     * @param {string} dataType - 'doctor' or 'hospital'
     * @returns {Promise<Object>} - Write result
     */
    async writeAllResults(spreadsheetId, sheetName, results, dataType) {
        if (!results || results.length === 0) {
            return { success: true, updatedCells: 0, updatedRows: 0, skippedRows: 0 };
        }
        
        try {
            const sheetsService = await this._getSheetsService();
            const columnLetters = APP_CONFIG.COLUMN_LETTERS[dataType.toUpperCase()];
            const updates = [];
            let skippedCount = 0;
            
            // Process each result
            results.forEach(result => {
                const rowNumber = result.rowIndex + 2; // +2 for header and 0-index
                
                // Handle skipped rows
                if (result.skipped) {
                    skippedCount++;
                    return; // Skip this row for writing
                }
                
                // Add LLM translation updates if present
                if (result.translated) {
                    // Name column (J)
                    if (result.translated.name) {
                        updates.push({
                            range: `'${sheetName}'!${columnLetters.llm_name}${rowNumber}`,
                            values: [[result.translated.name]]
                        });
                    }
                    
                    // Content column (K)
                    const contentColumn = dataType === 'doctor' 
                        ? columnLetters.llm_history 
                        : columnLetters.llm_description;
                    const contentValue = dataType === 'doctor'
                        ? result.translated.history
                        : result.translated.description;
                        
                    if (contentValue) {
                        updates.push({
                            range: `'${sheetName}'!${contentColumn}${rowNumber}`,
                            values: [[contentValue]]
                        });
                    }
                }
                
                // Add JSON update (L)
                if (result.json || result.updated_json) {
                    updates.push({
                        range: `'${sheetName}'!${columnLetters.updated_json}${rowNumber}`,
                        values: [[result.json || result.updated_json]]
                    });
                }
            });
            
            // Execute batch update with batching for large datasets
            if (updates.length > 0) {
                const batchSize = APP_CONFIG.WRITE_CONFIG.BATCH_SIZE;
                let totalUpdatedCells = 0;
                
                for (let i = 0; i < updates.length; i += batchSize) {
                    const batch = updates.slice(i, i + batchSize);
                    const result = await sheetsService.batchUpdate(spreadsheetId, batch);
                    totalUpdatedCells += result.totalUpdatedCells || batch.length;
                    
                    // Add delay between batches to avoid rate limiting
                    if (i + batchSize < updates.length) {
                        await this.delay(APP_CONFIG.WRITE_CONFIG.WRITE_DELAY);
                    }
                }
                
                return {
                    success: true,
                    updatedCells: totalUpdatedCells,
                    updatedRows: results.length - skippedCount,
                    skippedRows: skippedCount
                };
            }
            
            return { 
                success: true, 
                updatedCells: 0, 
                updatedRows: 0,
                skippedRows: skippedCount 
            };
            
        } catch (error) {
            console.error('Failed to write all results:', error);
            throw new Error(`Failed to write results: ${error.message}`);
        }
    }
    
    /**
     * Clear LLM columns before writing new translations
     * UPDATED: Uses new column positions (J, K)
     * @param {string} spreadsheetId - Google Sheets ID
     * @param {string} sheetName - Sheet name
     * @param {string} dataType - 'doctor' or 'hospital'
     * @param {number} rowCount - Number of data rows
     * @returns {Promise<Object>} - Clear result
     */
    async clearLLMColumns(spreadsheetId, sheetName, dataType, rowCount) {
        try {
            const sheetsService = await this._getSheetsService();
            const columnLetters = APP_CONFIG.COLUMN_LETTERS[dataType.toUpperCase()];
            const startRow = 2; // Skip header
            const endRow = startRow + rowCount - 1;
            
            const ranges = [
                `'${sheetName}'!${columnLetters.llm_name}${startRow}:${columnLetters.llm_name}${endRow}`
            ];
            
            if (dataType === 'doctor') {
                ranges.push(`'${sheetName}'!${columnLetters.llm_history}${startRow}:${columnLetters.llm_history}${endRow}`);
            } else {
                ranges.push(`'${sheetName}'!${columnLetters.llm_description}${startRow}:${columnLetters.llm_description}${endRow}`);
            }
            
            // Clear ranges
            for (const range of ranges) {
                await sheetsService.clearRange(spreadsheetId, range);
            }
            
            return { success: true, clearedRanges: ranges.length };
            
        } catch (error) {
            console.error('Failed to clear LLM columns:', error);
            // Non-critical error - continue with writes
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Create updates for non-contiguous rows
     * @param {string} sheetName - Sheet name
     * @param {string} column - Column letter
     * @param {Array} rowIndices - Row numbers
     * @param {Array} values - Values to write
     * @returns {Array} - Update objects
     */
    createNonContiguousUpdates(sheetName, column, rowIndices, values) {
        const updates = [];
        
        // Group contiguous rows for efficiency
        let currentGroup = {
            startRow: rowIndices[0],
            endRow: rowIndices[0],
            values: [values[0]]
        };
        
        for (let i = 1; i < rowIndices.length; i++) {
            if (rowIndices[i] === currentGroup.endRow + 1) {
                // Contiguous row
                currentGroup.endRow = rowIndices[i];
                currentGroup.values.push(values[i]);
            } else {
                // Non-contiguous - save current group and start new one
                updates.push({
                    range: currentGroup.startRow === currentGroup.endRow
                        ? `'${sheetName}'!${column}${currentGroup.startRow}`
                        : `'${sheetName}'!${column}${currentGroup.startRow}:${column}${currentGroup.endRow}`,
                    values: currentGroup.values
                });
                
                currentGroup = {
                    startRow: rowIndices[i],
                    endRow: rowIndices[i],
                    values: [values[i]]
                };
            }
        }
        
        // Add final group
        updates.push({
            range: currentGroup.startRow === currentGroup.endRow
                ? `'${sheetName}'!${column}${currentGroup.startRow}`
                : `'${sheetName}'!${column}${currentGroup.startRow}:${column}${currentGroup.endRow}`,
            values: currentGroup.values
        });
        
        return updates;
    }
    
    /**
     * Write with retry logic
     * @param {Function} writeFunction - Write function to retry
     * @param {Array} args - Arguments for write function
     * @returns {Promise<Object>} - Write result
     */
    async writeWithRetry(writeFunction, ...args) {
        const maxRetries = APP_CONFIG.WRITE_CONFIG.RETRY_ATTEMPTS;
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await writeFunction.apply(this, args);
            } catch (error) {
                lastError = error;
                console.warn(`Write attempt ${attempt} failed:`, error.message);
                
                if (attempt < maxRetries) {
                    // Exponential backoff
                    const delay = APP_CONFIG.WRITE_CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1);
                    await this.delay(delay);
                }
            }
        }
        
        throw lastError;
    }
    
    /**
     * Utility delay function
     * @param {number} ms - Milliseconds to delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Get write statistics
     * UPDATED: Includes skipped rows
     * @param {Array} results - Write results
     * @returns {Object} - Statistics
     */
    getWriteStatistics(results) {
        return {
            totalRows: results.length,
            translatedRows: results.filter(r => r.translated && !r.skipped).length,
            skippedRows: results.filter(r => r.skipped).length,
            jsonRows: results.filter(r => r.json || r.updated_json).length,
            failedRows: results.filter(r => r.error).length
        };
    }
}

/**
 * Singleton instance
 */
let writerInstance = null;

/**
 * Get or create writer instance
 * @returns {SheetsWriter} - Writer instance
 */
export function getSheetsWriter() {
    if (!writerInstance) {
        writerInstance = new SheetsWriter();
    }
    return writerInstance;
}