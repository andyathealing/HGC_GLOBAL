// File path: main.js
// Medical Translation Tool - Main Application with LLM Manual Override
// UPDATED: Multi-language JSON support
// main.js 파일 상단에 임시 추가 (디버깅용)


import { APP_CONFIG } from './config/config.js';
import { TranslationFormBuilder } from './js/components/form-builder.js';
import { ProgressTracker, createTranslationSteps, formatTranslationProgress } from './js/components/progress-tracker.js';
import { ResultsDisplay, createResultsObject } from './js/components/results-display.js';
import { Alert } from './js/components/ui-components.js';

// Service imports with fallback handling
let sheetsService, sheetsWriter, sheetsParser, jsonBuilder, translationService, multiLanguageJSONHandler;

/**
 * Main Application Class with OAuth2 and Real Translation
 * Now supports multi-language JSON structures
 */
class MedicalTranslationApp {
    constructor() {
        this.state = {
            isAuthenticated: false,
            userInfo: null,
            isTranslating: false,
            formData: null,
            results: null,
            servicesLoaded: false
        };
        
        this.components = {};
        this.progressSteps = createTranslationSteps();
        
        this._initialize();
    }
    
    /**
     * Initialize the application
     */
    async _initialize() {
        try {
            // Load services dynamically
            await this._loadServices();
            
            // Build UI components
            this._buildComponents();
            
            // Setup event handlers
            this._setupEventHandlers();
            
            // Mount components to DOM
            this._mountComponents();
            
            // Load Google API
            await this._loadGoogleAPI();
            
            // Initial validation
            this._validateForm();
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
        }
    }
    
    /**
     * Load services dynamically with error handling
     * UPDATED: Added MultiLanguageJSONHandler import
     */
    async _loadServices() {
        try {
            // Import services
            const [
                { getSheetsService, parseGoogleSheetsUrl },
                { getSheetsWriter },
                { SheetsParser },
                { JSONBuilder },
                { createTranslationService },
                { MultiLanguageJSONHandler } // NEW
            ] = await Promise.all([
                import('./js/services/sheets-service.js'),
                import('./js/services/sheets-writer.js'),
                import('./js/utils/sheets-parser.js'),
                import('./js/utils/json-builder.js'),
                import('./js/services/translation-service.js'),
                import('./js/utils/multi-language-json-handler.js') // NEW
            ]);
            
            // Store service references
            sheetsService = getSheetsService();
            sheetsWriter = getSheetsWriter();
            sheetsParser = SheetsParser;
            jsonBuilder = JSONBuilder;
            translationService = createTranslationService;
            multiLanguageJSONHandler = MultiLanguageJSONHandler; // NEW
            
            // Store parseGoogleSheetsUrl globally
            window.parseGoogleSheetsUrl = parseGoogleSheetsUrl;
            
            this.state.servicesLoaded = true;
            console.log('Services loaded successfully');
            
        } catch (error) {
            console.error('Failed to load services:', error);
            this.state.servicesLoaded = false;
            
            // Continue with limited functionality
            this.showError('Some features may be unavailable. Please check your connection.');
        }
    }
    
    /**
     * Load Google API client library
     */
    async _loadGoogleAPI() {
        // Check if config has client ID
        if (!APP_CONFIG.GOOGLE_CLIENT_ID) {
            console.warn('Google Client ID not configured');
            this.showError('Google authentication not configured. Please set up OAuth2 credentials.');
            return;
        }
        
        // Create script tag for Google API
        return new Promise((resolve, reject) => {
            if (window.gapi) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = resolve;
            script.onerror = () => {
                reject(new Error('Failed to load Google API'));
            };
            document.head.appendChild(script);
        });
    }
    
    /**
     * Build all UI components
     */
    _buildComponents() {
        // Build translation form with auth
        this.components.form = TranslationFormBuilder.build({
            id: 'translation-form',
            onSubmit: (formData) => this.handleFormSubmit(formData)
        });
        
        // Build progress tracker
        this.components.progress = new ProgressTracker({
            onComplete: () => this.handleProgressComplete(),
            onError: (error) => this.handleError(error)
        });
        
        // Build results display
        this.components.results = new ResultsDisplay({
            onNewTranslation: () => this.handleNewTranslation()
        });
        
        // Attach progress tracker to steps manager
        this.progressSteps.attachTracker(this.components.progress);
    }
    
    /**
     * Setup event handlers
     */
    _setupEventHandlers() {
        // Make auth handlers globally accessible
        window.handleGoogleSignIn = () => this.handleGoogleSignIn();
        window.handleGoogleSignOut = () => this.handleGoogleSignOut();
        
        // Form validation on input
        const form = this.components.form.element;
        form.addEventListener('input', () => this._validateForm());
        form.addEventListener('change', () => this._validateForm());
        
        // Cancel button handler
        const cancelBtn = form.querySelector('#quit-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.handleCancel());
        }
        
        // Help link handler
        const helpLink = document.getElementById('help-link');
        if (helpLink) {
            helpLink.addEventListener('click', (e) => this.handleHelpClick(e));
        }
    }
    
    /**
     * Mount components to DOM
     */
    _mountComponents() {
        const container = document.querySelector('.container');
        
        // Find the existing form and replace it
        const existingForm = document.getElementById('translation-form');
        if (existingForm) {
            existingForm.replaceWith(this.components.form.element);
        }
        
        // Add progress section after form
        this.components.form.element.insertAdjacentElement(
            'afterend', 
            this.components.progress.getElement()
        );
        
        // Add results section after progress
        this.components.progress.getElement().insertAdjacentElement(
            'afterend',
            this.components.results.getElement()
        );
        
        // Add error container if it doesn't exist
        if (!document.getElementById('error-container')) {
            const errorContainer = this._createErrorContainer();
            container.appendChild(errorContainer);
        }
    }
    
    /**
     * Create error container
     */
    _createErrorContainer() {
        const container = document.createElement('div');
        container.id = 'error-container';
        container.className = 'error-container';
        container.hidden = true;
        container.setAttribute('role', 'alert');
        container.setAttribute('aria-live', 'assertive');
        
        const message = document.createElement('p');
        message.className = 'error-message';
        message.id = 'error-message';
        
        container.appendChild(message);
        return container;
    }
    
    /**
     * Handle Google Sign In
     */
    async handleGoogleSignIn() {
        if (!this.state.servicesLoaded || !sheetsService) {
            this.showError('Services not loaded. Please refresh the page.');
            return;
        }
        
        try {
            // Initialize sheets service if needed
            if (!sheetsService.apiLoaded) {
                await sheetsService.initialize({
                    clientId: APP_CONFIG.GOOGLE_CLIENT_ID
                });
            }
            
            // Authenticate
            const success = await sheetsService.authenticate();
            
            if (success) {
                const userInfo = sheetsService.getCurrentUser();
                this.state.isAuthenticated = true;
                this.state.userInfo = userInfo;
                
                // Update form auth state
                this.components.form.updateAuthState(true, userInfo);
                
                this.showSuccess('Successfully signed in with Google!');
            }
        } catch (error) {
            console.error('Authentication failed:', error);
            
            if (error.error === 'popup_closed_by_user') {
                this.showError('Sign-in cancelled. Please sign in to continue.');
            } else if (error.error === 'access_denied') {
                this.showError('Access denied. Please grant permissions to access Google Sheets.');
            } else {
                this.showError('Failed to sign in. Please try again.');
            }
        }
    }
    
    /**
     * Handle Google Sign Out
     */
    async handleGoogleSignOut() {
        if (!sheetsService) return;
        
        try {
            await sheetsService.signOut();
            this.state.isAuthenticated = false;
            this.state.userInfo = null;
            
            // Update form auth state
            this.components.form.updateAuthState(false);
            
            // Reset form
            this.components.form.reset();
            
            this.showSuccess('Successfully signed out.');
        } catch (error) {
            console.error('Sign out failed:', error);
            this.showError('Failed to sign out. Please try again.');
        }
    }
    
    /**
     * Validate form
     */
    _validateForm() {
        return this.components.form.validate();
    }
    
    /**
     * Handle form submission
     */
    async handleFormSubmit(formData) {
        if (!this.state.servicesLoaded) {
            this.showError('Services not available. Please refresh the page.');
            return;
        }
        
        this.state.isTranslating = true;
        this.state.formData = formData;
        
        // Store start time
        formData.startTime = Date.now();
        
        // Update UI
        this.components.form.disable();
        this.components.progress.show();
        this.hideError();
        
        // Enable cancel button
        const cancelBtn = document.getElementById('quit-btn');
        if (cancelBtn) cancelBtn.disabled = false;
        
        try {
            const result = await this.startTranslationWithManualOverride(formData);
            this.handleTranslationSuccess(result, formData);
        } catch (error) {
            this.handleTranslationError(error);
        }
    }
    
    /**
     * Start translation process with real services
     * UPDATED: Handle new translation service structure and multi-language JSON
     */
    async startTranslationWithManualOverride(formData) {
        const steps = this.progressSteps;
        const { sheetsUrl, dataType, language, apiKey } = formData;
        
        // Verify all required services are loaded
        if (!sheetsService || !sheetsParser || !jsonBuilder || !translationService || !sheetsWriter) {
            throw new Error('Required services not loaded. Please refresh the page.');
        }
        
        try {
            // Step 0: Verify authentication
            steps.startStep(0);
            if (!sheetsService.isAuthenticated()) {
                throw new Error('Authentication required');
            }
            steps.completeStep(0);
            
            // Step 1: Load spreadsheet
            steps.startStep(1);
            const { spreadsheetId } = window.parseGoogleSheetsUrl(sheetsUrl);
            const sheetName = language; // Sheet name matches language code
            const sheetData = await sheetsService.getSheetData(spreadsheetId, sheetName);
            steps.completeStep(1);
            
            // Step 2: Analyze data - UPDATED
            steps.startStep(2);
            const parsedData = sheetsParser.parseData(sheetData, dataType, language);
            
            // Validate structure
            const validation = sheetsParser.validateSheetStructure(sheetData, dataType);
            if (!validation.isValid) {
                throw new Error(`Invalid sheet structure: ${validation.errors.join(', ')}`);
            }
            
            // Show analysis stats - UPDATED
            const analysisStats = {
                totalRows: parsedData.data.length,
                rowsToTranslate: sheetsParser.getRowsForTranslation(parsedData.data).length,
                alreadyTranslated: parsedData.statistics.rowsWithLLMTranslation,
                manualOverrides: parsedData.statistics.rowsWithManualOverride,
                oldValues: parsedData.statistics.rowsWithOldValues,
                contentChanges: parsedData.statistics.rowsWithContentChanges
            };
            steps.startStep(2, { stats: analysisStats });
            
            steps.completeStep(2);
            
            // Step 3: Translate content - UPDATED
            steps.startStep(3);
            const rowsToTranslate = sheetsParser.getRowsForTranslation(parsedData.data);
            
            let translationData = { 
                results: [], 
                statistics: { total: 0, translated: 0, skipped: 0, failed: 0 } 
            };
            
            if (rowsToTranslate.length > 0) {
                // Create translation service instance
                const translator = translationService(apiKey);
                
                // Test connection
                const isConnected = await translator.testConnection();
                if (!isConnected) {
                    throw new Error('Failed to connect to DeepL API. Please check your API key.');
                }
                
                // Translate rows with progress updates - UPDATED
                translationData = await translator.translateRows(
                    rowsToTranslate,
                    language,
                    dataType,
                    (progress, message) => {
                        steps.updateStepProgress(3, progress, message);
                    }
                );
                
                // Log statistics
                if (translationData.statistics.skipped > 0) {
                    console.log(`Skipped ${translationData.statistics.skipped} rows with unchanged content`);
                }
            } else {
                this.components.progress.updateDetail('All rows already have translations');
            }
            steps.completeStep(3);
            
            // Step 4: Write translations - UPDATED
            steps.startStep(4);
            if (translationData.results.length > 0) {
                const successfulTranslations = translationData.results.filter(r => r.success);
                if (successfulTranslations.length > 0) {
                    const writeResult = await sheetsWriter.writeLLMTranslations(
                        spreadsheetId,
                        sheetName,
                        successfulTranslations,
                        dataType
                    );
                    
                    // Update progress with skip info
                    if (writeResult.skippedRows > 0) {
                        steps.updateStepProgress(4, 100, 
                            `Wrote ${writeResult.updatedRows} translations (${writeResult.skippedRows} unchanged)`
                        );
                    }
                }
            }
            steps.completeStep(4);
            
            // Step 5: Generate multi-language JSON - UPDATED
            steps.startStep(5);
            const mergedData = jsonBuilder.mergeTranslations(
                parsedData.data,
                translationData.results,
                dataType
            );
            
            // Build JSON with language parameter
            const jsonResults = jsonBuilder.buildBatchJSON(mergedData, dataType, language);
            
            // Count multi-language JSONs
            const multiLangCount = jsonResults.filter(r => 
                r.object && multiLanguageJSONHandler && multiLanguageJSONHandler.getAvailableLanguages(r.object).length > 1
            ).length;
            
            steps.updateStepProgress(5, 100, 
                `Generated JSON for ${jsonResults.filter(r => r.success).length} rows (${multiLangCount} multi-language)`
            );
            steps.completeStep(5);
            
            // Step 6: Update spreadsheet with JSON - UPDATED
            steps.startStep(6);
            const successfulJSON = jsonResults.filter(r => r.success);
            if (successfulJSON.length > 0) {
                await sheetsWriter.writeJSONResults(
                    spreadsheetId,
                    sheetName,
                    successfulJSON,
                    dataType
                );
            }
            steps.completeStep(6);
            
            // Create final summary - UPDATED
            return {
                success: true,
                dataType: dataType,
                language: language,
                statistics: {
                    totalRows: parsedData.data.length,
                    rowsTranslated: translationData.statistics.translated,
                    rowsSkipped: translationData.statistics.skipped,
                    rowsWithManualOverride: parsedData.statistics.rowsWithManualOverride,
                    rowsWithOldValues: parsedData.statistics.rowsWithOldValues,
                    jsonGenerated: jsonResults.filter(r => r.success).length,
                    multiLanguageJSON: multiLangCount,
                    errors: [
                        ...parsedData.errors,
                        ...translationData.results.filter(r => !r.success).map(r => r.error),
                        ...jsonResults.filter(r => !r.success).map(r => r.error)
                    ].filter(Boolean)
                },
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Translation process failed:', error);
            
            // Map errors to user-friendly messages
            if (error.message.includes('Authentication')) {
                throw new Error(APP_CONFIG.ERROR_MESSAGES.AUTH_REQUIRED);
            } else if (error.message.includes('not found') || error.message.includes('404')) {
                throw new Error(APP_CONFIG.ERROR_MESSAGES.SHEETS_ACCESS_DENIED);
            } else if (error.message.includes('Invalid sheet structure')) {
                throw new Error(error.message); // Keep detailed structure error
            } else if (error.message.includes('DeepL API')) {
                throw new Error(error.message); // Keep API error
            }
            
            throw error;
        }
    }
    
    /**
     * Handle successful translation
     */
    handleTranslationSuccess(result, formData) {
        this.state.results = result;
        this.state.isTranslating = false;
        
        // Create results object
        const resultsData = createResultsObject(result, formData);
        
        // Update UI
        this.components.progress.complete('Translation and multi-language JSON update complete!');
        
        // Show results after a short delay
        setTimeout(() => {
            this.components.progress.hide();
            this.components.results.show(resultsData);
            this.components.form.enable();
            
            // Disable cancel button
            const cancelBtn = document.getElementById('quit-btn');
            if (cancelBtn) cancelBtn.disabled = true;
        }, 1000);
    }
    
    /**
     * Handle translation error
     */
    handleTranslationError(error) {
        this.state.isTranslating = false;
        
        console.error('Translation error:', error);
        this.showError(error.message || APP_CONFIG.ERROR_MESSAGES.TRANSLATION_FAILED);
        
        // Reset UI
        this.components.progress.hide();
        this.components.form.enable();
        
        // Disable cancel button
        const cancelBtn = document.getElementById('quit-btn');
        if (cancelBtn) cancelBtn.disabled = true;
    }
    
    /**
     * Handle cancel
     */
    handleCancel() {
        if (!this.state.isTranslating) return;
        
        if (confirm('Are you sure you want to cancel the translation?')) {
            this.state.isTranslating = false;
            
            // Reset UI
            this.components.progress.hide();
            this.components.form.enable();
            this.hideError();
            
            // Show cancelled message
            this.showError('Translation cancelled.');
            
            // Disable cancel button
            const cancelBtn = document.getElementById('quit-btn');
            if (cancelBtn) cancelBtn.disabled = true;
        }
    }
    
    /**
     * Handle new translation
     */
    handleNewTranslation() {
        // Reset form but keep auth
        this.components.form.reset();
        this.components.results.clear();
        this.state.results = null;
        
        // Scroll to top
        window.scrollTo(0, 0);
    }
    
    /**
     * Handle help click
     * UPDATED: Reflect new column structure
     */
    handleHelpClick(e) {
        e.preventDefault();
        const helpText = `
Medical Translation Tool - Help

1. Sign in with Google to access your spreadsheets
2. Enter your Google Sheets URL
3. Select the data type (Doctor or Hospital)
4. Choose the target language (matches sheet tab name)
5. Enter your DeepL API key
6. Click "Start Translation"

Sheet Requirements:
- Sheet tabs must be named: en, ja, or th
- Columns must follow the exact structure (12 columns)
- Manual translations override LLM translations
- Old values are preserved in multi-language JSON

Translation Priority:
manual_ > llm_ > old_ > old_json

For detailed documentation, please refer to the project guide.
        `;
        alert(helpText);
    }
    
    /**
     * Handle progress complete
     */
    handleProgressComplete() {
        console.log('Progress complete');
    }
    
    /**
     * Handle error
     */
    handleError(error) {
        this.showError(error);
    }
    
    /**
     * Show success message
     */
    showSuccess(message) {
        const alert = Alert.create({
            type: 'success',
            message,
            autoHide: true,
            autoHideDelay: 3000
        });
        
        document.querySelector('.container').insertBefore(
            alert.container,
            document.querySelector('.container').firstChild
        );
    }
    
    /**
     * Show error message
     */
    showError(message) {
        const container = document.getElementById('error-container');
        const messageElement = document.getElementById('error-message');
        
        if (container && messageElement) {
            messageElement.textContent = message;
            container.hidden = false;
            
            // Auto-hide after 10 seconds
            setTimeout(() => {
                container.hidden = true;
            }, 10000);
        }
    }
    
    /**
     * Hide error message
     */
    hideError() {
        const container = document.getElementById('error-container');
        if (container) {
            container.hidden = true;
        }
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new MedicalTranslationApp();
    });
} else {
    window.app = new MedicalTranslationApp();
}

// Export for testing
export { MedicalTranslationApp };