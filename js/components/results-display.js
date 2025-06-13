// Results Display Module - Updated for Write Confirmation and Statistics
import { Section, Button, Alert } from './ui-components.js';
import { APP_CONFIG } from '../../config/config.js';

/**
 * Results Display Manager for LLM with Manual Override
 */
export class ResultsDisplay {
    constructor(config = {}) {
        this.config = {
            containerId: config.containerId || 'results-container',
            ...config
        };
        
        this.results = null;
        this._buildUI();
    }
    
    /**
     * Build the results UI for write confirmation
     */
    _buildUI() {
        // Create main section
        this.section = Section.create({
            id: 'results-section',
            className: 'results-section',
            title: 'Translation Complete',
            hidden: true
        });
        
        // Create success message container
        const messageContainer = document.createElement('div');
        messageContainer.className = 'success-message-container';
        
        this.successIcon = document.createElement('div');
        this.successIcon.className = 'success-icon';
        this.successIcon.innerHTML = '✓';
        
        this.successMessage = document.createElement('h3');
        this.successMessage.className = 'success-message';
        this.successMessage.textContent = 'Successfully updated Google Sheets!';
        
        messageContainer.appendChild(this.successIcon);
        messageContainer.appendChild(this.successMessage);
        
        // Create statistics container
        this.statsContainer = document.createElement('div');
        this.statsContainer.className = 'results-statistics';
        this.statsContainer.id = 'results-statistics';
        
        // Create summary container
        this.summaryContainer = document.createElement('div');
        this.summaryContainer.className = 'results-summary';
        this.summaryContainer.id = 'results-summary';
        
        // Create actions container
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'results-actions';
        
        // View sheet button
        this.viewSheetBtn = Button.primary({
            id: 'view-sheet-btn',
            text: 'View Updated Sheet',
            onClick: () => this.handleViewSheet()
        });
        
        // New translation button
        this.newTranslationBtn = Button.secondary({
            id: 'new-translation-btn',
            text: 'Start New Translation',
            onClick: () => this.handleNewTranslation()
        });
        
        actionsDiv.appendChild(this.viewSheetBtn);
        actionsDiv.appendChild(this.newTranslationBtn);
        
        // Append all elements
        this.section.element.appendChild(messageContainer);
        this.section.element.appendChild(this.statsContainer);
        this.section.element.appendChild(this.summaryContainer);
        this.section.element.appendChild(actionsDiv);
    }
    
    /**
     * Show results with statistics
     * @param {Object} results - Translation results with statistics
     */
    show(results) {
        this.results = results;
        this.updateStatistics();
        this.updateSummary();
        this.section.show();
        
        // Update sheet URL for view button
        if (results.sheetsUrl) {
            this.sheetsUrl = results.sheetsUrl;
        }
        
        if (this.config.onShow) {
            this.config.onShow(results);
        }
    }
    
    /**
     * Hide results
     */
    hide() {
        this.section.hide();
    }
    
    /**
     * Update statistics display
     */
    updateStatistics() {
        if (!this.results || !this.results.statistics) return;
        
        const stats = this.results.statistics;
        
        this.statsContainer.innerHTML = `
            <h4>Translation Statistics</h4>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${stats.totalRows || 0}</div>
                    <div class="stat-label">Total Rows</div>
                </div>
                <div class="stat-card success">
                    <div class="stat-value">${stats.rowsTranslated || 0}</div>
                    <div class="stat-label">Rows Translated</div>
                </div>
                <div class="stat-card info">
                    <div class="stat-value">${stats.rowsWithManualOverride || 0}</div>
                    <div class="stat-label">Manual Overrides</div>
                </div>
                <div class="stat-card ${stats.errors?.length > 0 ? 'error' : 'success'}">
                    <div class="stat-value">${stats.errors?.length || 0}</div>
                    <div class="stat-label">Errors</div>
                </div>
            </div>
        `;
        
        // Add processing time if available
        if (stats.processingTime) {
            const timeDiv = document.createElement('div');
            timeDiv.className = 'processing-time';
            timeDiv.textContent = `Processing time: ${this.formatTime(stats.processingTime)}`;
            this.statsContainer.appendChild(timeDiv);
        }
    }
    
    /**
     * Update summary display
     */
    updateSummary() {
        if (!this.results) return;
        
        const summaryItems = [];
        
        // Language info
        if (this.results.language) {
            const langNames = {
                en: 'English',
                ja: 'Japanese',
                th: 'Thai'
            };
            summaryItems.push(`<strong>Language:</strong> ${langNames[this.results.language] || this.results.language}`);
        }
        
        // Data type
        if (this.results.dataType) {
            summaryItems.push(`<strong>Data Type:</strong> ${this.capitalizeFirst(this.results.dataType)}`);
        }
        
        // Completion time
        if (this.results.timestamp) {
            const date = new Date(this.results.timestamp);
            summaryItems.push(`<strong>Completed:</strong> ${date.toLocaleString()}`);
        }
        
        // Status
        const status = this.results.success ? 
            '<span class="status-success">✓ Success</span>' : 
            '<span class="status-error">⚠ Completed with errors</span>';
        summaryItems.push(`<strong>Status:</strong> ${status}`);
        
        this.summaryContainer.innerHTML = `
            <h4>Summary</h4>
            <div class="summary-list">
                ${summaryItems.map(item => `<div class="summary-item">${item}</div>`).join('')}
            </div>
        `;
        
        // Add error details if any
        if (this.results.statistics?.errors?.length > 0) {
            this.addErrorDetails(this.results.statistics.errors);
        }
    }
    
    /**
     * Add error details section
     * @param {Array} errors - Array of error messages
     */
    addErrorDetails(errors) {
        const errorSection = document.createElement('div');
        errorSection.className = 'error-details';
        errorSection.innerHTML = `
            <h4>Error Details</h4>
            <div class="error-list">
                ${errors.slice(0, 5).map(error => 
                    `<div class="error-item">• ${this.sanitizeError(error)}</div>`
                ).join('')}
                ${errors.length > 5 ? `<div class="error-item">... and ${errors.length - 5} more errors</div>` : ''}
            </div>
        `;
        
        this.summaryContainer.appendChild(errorSection);
    }
    
    /**
     * Handle view sheet action
     */
    handleViewSheet() {
        if (this.sheetsUrl) {
            window.open(this.sheetsUrl, '_blank');
        } else {
            this.showErrorMessage('Sheet URL not available');
        }
    }
    
    /**
     * Handle new translation action
     */
    handleNewTranslation() {
        if (this.config.onNewTranslation) {
            this.config.onNewTranslation();
        } else {
            // Default: reload page
            window.location.reload();
        }
    }
    
    /**
     * Format time duration
     * @param {number} ms - Duration in milliseconds
     */
    formatTime(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }
    
    /**
     * Capitalize first letter
     * @param {string} str - String to capitalize
     */
    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    /**
     * Sanitize error message for display
     * @param {string} error - Error message
     */
    sanitizeError(error) {
        // Remove technical details, keep user-friendly message
        if (typeof error === 'string') {
            return error.replace(/Error:\s*/i, '').slice(0, 100);
        }
        return 'Unknown error occurred';
    }
    
    /**
     * Show success message
     * @param {string} message - Success message
     */
    showSuccessMessage(message) {
        const alert = Alert.create({
            type: 'success',
            message,
            autoHide: true,
            autoHideDelay: 3000
        });
        
        this.section.element.insertBefore(alert.container, this.section.element.firstChild);
    }
    
    /**
     * Show error message
     * @param {string} message - Error message
     */
    showErrorMessage(message) {
        const alert = Alert.create({
            type: 'error',
            message,
            autoHide: true,
            autoHideDelay: 5000
        });
        
        this.section.element.insertBefore(alert.container, this.section.element.firstChild);
    }
    
    /**
     * Get DOM element
     */
    getElement() {
        return this.section.element;
    }
    
    /**
     * Clear results
     */
    clear() {
        this.results = null;
        this.statsContainer.innerHTML = '';
        this.summaryContainer.innerHTML = '';
        this.hide();
    }
    
    /**
     * Destroy results display
     */
    destroy() {
        this.section.element.remove();
    }
}

/**
 * Create a simplified results object from translation output
 * @param {Object} translationResult - Raw translation result
 * @param {Object} formData - Original form data
 */
export function createResultsObject(translationResult, formData) {
    const startTime = translationResult.startTime || Date.now();
    const endTime = Date.now();
    
    return {
        success: translationResult.success !== false,
        dataType: formData.dataType,
        language: formData.language || formData.targetLanguage,
        sheetsUrl: formData.sheetsUrl,
        timestamp: new Date().toISOString(),
        statistics: {
            totalRows: translationResult.statistics?.totalRows || 0,
            rowsTranslated: translationResult.statistics?.rowsTranslated || 0,
            rowsWithManualOverride: translationResult.statistics?.rowsWithManualOverride || 0,
            jsonGenerated: translationResult.statistics?.jsonGenerated || 0,
            errors: translationResult.statistics?.errors || [],
            processingTime: endTime - startTime
        }
    };
}