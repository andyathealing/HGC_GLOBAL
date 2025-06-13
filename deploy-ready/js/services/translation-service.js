// File path: js/services/translation-service.js
// Translation Service Module - Orchestrates single-language translation
// UPDATED: Content change detection and old_ value awareness
import { APP_CONFIG } from '../../config/config.js';

/**
 * Translation Service
 * Manages translation of Korean content to target language using DeepL
 * Now includes content change detection and skip logic
 */
export class TranslationService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = APP_CONFIG.DEEPL_API.BASE_URL;
        this.requestCount = 0;
        this.lastRequestTime = 0;
    }
    
    /**
     * Translate rows that need translation
     * UPDATED: Added statistics for skipped rows
     * @param {Array} rows - Rows needing translation
     * @param {string} targetLanguage - Target language code (en/ja/th)
     * @param {string} dataType - 'doctor' or 'hospital'
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Object>} - Translation results with statistics
     */
    async translateRows(rows, targetLanguage, dataType, onProgress) {
        if (!rows || rows.length === 0) {
            return {
                results: [],
                statistics: {
                    total: 0,
                    translated: 0,
                    skipped: 0,
                    failed: 0
                }
            };
        }
        
        // Get DeepL language code
        const targetLangCode = APP_CONFIG.TRANSLATION.SUPPORTED_LANGUAGES[targetLanguage].code;
        
        // Filter rows that actually need translation
        const { rowsToTranslate, skippedRows } = this.filterRowsForTranslation(rows, dataType);
        
        // Log skipped rows
        if (skippedRows.length > 0) {
            console.log(`Skipping ${skippedRows.length} rows with unchanged content`);
        }
        
        // Prepare batches from filtered rows
        const batches = this.createBatches(rowsToTranslate, dataType);
        const results = [];
        
        // Process batches
        for (let i = 0; i < batches.length; i++) {
            try {
                // Rate limiting
                await this.enforceRateLimit();
                
                // Translate batch
                const batchResult = await this.translateBatch(
                    batches[i], 
                    targetLangCode, 
                    dataType
                );
                
                results.push(...batchResult);
                
                // Update progress
                if (onProgress) {
                    const progress = ((i + 1) / batches.length) * 100;
                    onProgress(progress, `Translated batch ${i + 1} of ${batches.length}`);
                }
                
            } catch (error) {
                console.error(`Batch ${i + 1} translation failed:`, error);
                
                // Add failed results for this batch
                batches[i].forEach(item => {
                    results.push({
                        id: item.id,
                        rowIndex: item.rowIndex,
                        error: error.message,
                        success: false
                    });
                });
            }
        }
        
        // Add skipped rows to results (marked as successful but not translated)
        skippedRows.forEach(row => {
            results.push({
                id: row.id,
                rowIndex: row.rowIndex,
                translated: {
                    name: row.old_name || row.llm_name || '',
                    [dataType === 'doctor' ? 'history' : 'description']: 
                        dataType === 'doctor' 
                            ? (row.old_history || row.llm_history || '')
                            : (row.old_description || row.llm_description || '')
                },
                skipped: true,
                success: true
            });
        });
        
        // Return results with statistics
        return {
            results,
            statistics: {
                total: rows.length,
                translated: results.filter(r => r.success && !r.skipped).length,
                skipped: skippedRows.length,
                failed: results.filter(r => !r.success).length
            }
        };
    }
    
    /**
     * Filter rows for translation based on content changes
     * NEW METHOD
     * @param {Array} rows - All rows marked for translation
     * @param {string} dataType - Data type
     * @returns {Object} - Separated rows to translate and skip
     */
    filterRowsForTranslation(rows, dataType) {
        const rowsToTranslate = [];
        const skippedRows = [];
        
        rows.forEach(row => {
            // Check if content actually changed (double-check parser logic)
            const contentChanged = this.hasContentChanged(row, dataType);
            
            // Only translate if:
            // 1. No LLM translation exists, OR
            // 2. Content has changed from old values
            if (!row.llm_name || contentChanged) {
                rowsToTranslate.push(row);
            } else {
                skippedRows.push(row);
            }
        });
        
        return { rowsToTranslate, skippedRows };
    }
    
    /**
     * Check if content has changed from old values
     * NEW METHOD
     * @param {Object} row - Row data
     * @param {string} dataType - Data type
     * @returns {boolean} - True if content changed
     */
    hasContentChanged(row, dataType) {
        // If no old values exist, consider it as changed
        if (!row.old_name) {
            return true;
        }
        
        // Compare Korean content with old values
        const nameChanged = row.kr_name !== row.old_name;
        
        if (dataType === 'doctor') {
            const historyChanged = row.kr_history !== row.old_history;
            return nameChanged || historyChanged;
        } else {
            const descriptionChanged = row.kr_description !== row.old_description;
            return nameChanged || descriptionChanged;
        }
    }
    
    /**
     * Create batches for translation
     * @param {Array} rows - Rows to translate
     * @param {string} dataType - Data type
     * @returns {Array} - Batches of texts
     */
    createBatches(rows, dataType) {
        const batchSize = APP_CONFIG.TRANSLATION.BATCH_SIZE;
        const batches = [];
        
        for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize).map(row => {
                const texts = {
                    name: row.kr_name || ''
                };
                
                if (dataType === 'doctor') {
                    texts.history = row.kr_history || '';
                } else {
                    texts.description = row.kr_description || '';
                }
                
                return {
                    id: row.id,
                    rowIndex: row.rowIndex,
                    texts: texts
                };
            });
            
            batches.push(batch);
        }
        
        return batches;
    }
    
    /**
     * Translate a batch of texts
     * @param {Array} batch - Batch of texts to translate
     * @param {string} targetLang - DeepL target language code
     * @param {string} dataType - Data type
     * @returns {Promise<Array>} - Translation results
     */
    async translateBatch(batch, targetLang, dataType) {
        // Prepare texts for DeepL
        const textsToTranslate = [];
        const textMapping = [];
        
        batch.forEach(item => {
            Object.entries(item.texts).forEach(([field, text]) => {
                if (text && text.trim()) {
                    textsToTranslate.push(text);
                    textMapping.push({
                        id: item.id,
                        rowIndex: item.rowIndex,
                        field: field
                    });
                }
            });
        });
        
        if (textsToTranslate.length === 0) {
            return batch.map(item => ({
                id: item.id,
                rowIndex: item.rowIndex,
                translated: item.texts,
                success: true
            }));
        }
        
        // Call DeepL API
        const translations = await this.callDeepLAPI(textsToTranslate, targetLang);
        
        // Map translations back to rows
        const translationMap = new Map();
        
        textMapping.forEach((mapping, index) => {
            if (!translationMap.has(mapping.id)) {
                translationMap.set(mapping.id, {
                    id: mapping.id,
                    rowIndex: mapping.rowIndex,
                    translated: {},
                    success: true
                });
            }
            
            const result = translationMap.get(mapping.id);
            result.translated[mapping.field] = translations[index] || '';
        });
        
        // Convert map to array and include items with no translations
        return batch.map(item => {
            if (translationMap.has(item.id)) {
                return translationMap.get(item.id);
            } else {
                return {
                    id: item.id,
                    rowIndex: item.rowIndex,
                    translated: item.texts,
                    success: true
                };
            }
        });
    }
    
    /**
     * Call DeepL API
     * @param {Array} texts - Texts to translate
     * @param {string} targetLang - Target language code
     * @returns {Promise<Array>} - Translated texts
     */
    async callDeepLAPI(texts, targetLang) {
        const url = `${this.baseUrl}/translate`;
        
        // Prepare request body
        const formData = new FormData();
        texts.forEach(text => {
            formData.append('text', text);
        });
        formData.append('target_lang', targetLang);
        formData.append('source_lang', 'KO');
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `DeepL-Auth-Key ${this.apiKey}`
                },
                body: formData
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || `DeepL API error: ${response.status}`);
            }
            
            const data = await response.json();
            return data.translations.map(t => t.text);
            
        } catch (error) {
            console.error('DeepL API call failed:', error);
            throw error;
        }
    }
    
    /**
     * Enforce rate limiting
     */
    async enforceRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const minInterval = 1000 / APP_CONFIG.DEEPL_API.RATE_LIMIT;
        
        if (timeSinceLastRequest < minInterval) {
            await this.delay(minInterval - timeSinceLastRequest);
        }
        
        this.lastRequestTime = Date.now();
        this.requestCount++;
    }
    
    /**
     * Test API connection
     * @returns {Promise<boolean>} - Connection status
     */
    async testConnection() {
        try {
            const testText = '안녕하세요';
            const translations = await this.callDeepLAPI([testText], 'EN-US');
            return translations.length > 0 && translations[0].toLowerCase().includes('hello');
        } catch (error) {
            console.error('API connection test failed:', error);
            return false;
        }
    }
    
    /**
     * Get usage statistics (if available)
     * @returns {Promise<Object>} - Usage stats
     */
    async getUsageStats() {
        const url = `${this.baseUrl}/usage`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `DeepL-Auth-Key ${this.apiKey}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to get usage stats: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Failed to get usage stats:', error);
            return null;
        }
    }
    
    /**
     * Utility delay function
     * @param {number} ms - Milliseconds
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Create translation summary
     * UPDATED: Includes skipped rows statistics
     * @param {Object} translationData - Translation results with statistics
     * @returns {Object} - Summary statistics
     */
    createTranslationSummary(translationData) {
        const { results, statistics } = translationData;
        
        const summary = {
            total: statistics.total,
            successful: statistics.translated,
            skipped: statistics.skipped,
            failed: statistics.failed,
            characterCount: 0,
            errors: []
        };
        
        results.forEach(result => {
            if (result.success && !result.skipped) {
                // Count characters for actually translated content
                if (result.translated) {
                    Object.values(result.translated).forEach(text => {
                        summary.characterCount += (text || '').length;
                    });
                }
            } else if (!result.success) {
                summary.errors.push({
                    id: result.id,
                    error: result.error
                });
            }
        });
        
        summary.successRate = summary.total > 0 
            ? ((summary.successful / summary.total) * 100).toFixed(1) + '%'
            : '0%';
        
        summary.skipRate = summary.total > 0
            ? ((summary.skipped / summary.total) * 100).toFixed(1) + '%'
            : '0%';
        
        return summary;
    }
}

/**
 * Factory function to create translation service
 * @param {string} apiKey - DeepL API key
 * @returns {TranslationService} - Service instance
 */
export function createTranslationService(apiKey) {
    return new TranslationService(apiKey);
}