// Progress Tracker Module - Updated for LLM with Manual Override Workflow
import { Section, Progress, Alert } from './ui-components.js';
import { APP_CONFIG } from '../../config/config.js';

/**
 * Progress Tracker with Enhanced Sub-step Support
 */
export class ProgressTracker {
    constructor(config = {}) {
        this.config = {
            containerId: config.containerId || 'progress-container',
            ...config
        };
        
        this.currentProgress = 0;
        this.statusMessage = '';
        this.detailMessage = '';
        this.isActive = false;
        
        this._buildUI();
    }
    
    /**
     * Build the progress UI with detail support
     */
    _buildUI() {
        // Create main section
        this.section = Section.create({
            id: 'progress-section',
            className: 'progress-section',
            title: 'Translation Progress',
            hidden: true,
            ariaLive: 'polite'
        });
        
        // Create progress bar
        this.progressBar = Progress.create({
            id: 'progress-bar',
            value: 0
        });
        
        // Create status message
        this.statusElement = document.createElement('p');
        this.statusElement.className = 'status-message';
        this.statusElement.id = 'status-message';
        this.statusElement.textContent = 'Preparing translation...';
        
        // Create detail message for sub-steps
        this.detailElement = document.createElement('p');
        this.detailElement.className = 'detail-message';
        this.detailElement.id = 'detail-message';
        this.detailElement.style.fontSize = '0.9em';
        this.detailElement.style.color = '#666';
        
        // Translation stats container
        this.statsContainer = document.createElement('div');
        this.statsContainer.className = 'translation-stats';
        this.statsContainer.id = 'translation-stats';
        this.statsContainer.style.display = 'none';
        
        // Append elements
        this.section.element.appendChild(this.progressBar.container);
        this.section.element.appendChild(this.statusElement);
        this.section.element.appendChild(this.detailElement);
        this.section.element.appendChild(this.statsContainer);
    }
    
    /**
     * Show progress tracker
     */
    show() {
        this.isActive = true;
        this.section.show();
        this.reset();
    }
    
    /**
     * Hide progress tracker
     */
    hide() {
        this.isActive = false;
        this.section.hide();
    }
    
    /**
     * Update progress
     * @param {number} percent - Progress percentage (0-100)
     */
    updateProgress(percent) {
        this.currentProgress = Math.min(Math.max(percent, 0), 100);
        this.progressBar.update(this.currentProgress);
        
        if (this.config.onProgress) {
            this.config.onProgress(this.currentProgress);
        }
    }
    
    /**
     * Update status message
     * @param {string} message - Status message
     */
    updateStatus(message) {
        this.statusMessage = message;
        this.statusElement.textContent = message;
        
        if (this.config.onStatusUpdate) {
            this.config.onStatusUpdate(message);
        }
    }
    
    /**
     * Update detail message (for sub-steps)
     * @param {string} message - Detail message
     */
    updateDetail(message) {
        this.detailMessage = message;
        this.detailElement.textContent = message;
        this.detailElement.style.display = message ? 'block' : 'none';
    }
    
    /**
     * Update translation statistics
     * @param {Object} stats - Translation statistics
     */
    updateStats(stats) {
        if (!stats) {
            this.statsContainer.style.display = 'none';
            return;
        }
        
        this.statsContainer.style.display = 'block';
        this.statsContainer.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">Total Rows:</span>
                    <span class="stat-value">${stats.totalRows || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Need Translation:</span>
                    <span class="stat-value">${stats.rowsToTranslate || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Already Translated:</span>
                    <span class="stat-value">${stats.alreadyTranslated || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Manual Overrides:</span>
                    <span class="stat-value">${stats.manualOverrides || 0}</span>
                </div>
            </div>
        `;
    }
    
    /**
     * Set progress and status together
     * @param {number} percent - Progress percentage
     * @param {string} message - Status message
     * @param {string} detail - Detail message (optional)
     */
    update(percent, message, detail = '') {
        this.updateProgress(percent);
        this.updateStatus(message);
        if (detail) this.updateDetail(detail);
    }
    
    /**
     * Reset progress tracker
     */
    reset() {
        this.currentProgress = 0;
        this.progressBar.reset();
        this.updateStatus('Preparing translation...');
        this.updateDetail('');
        this.statsContainer.style.display = 'none';
    }
    
    /**
     * Mark as complete
     * @param {string} message - Completion message
     */
    complete(message = 'Translation complete!') {
        this.updateProgress(100);
        this.updateStatus(message);
        this.updateDetail('');
        
        if (this.config.onComplete) {
            this.config.onComplete();
        }
    }
    
    /**
     * Show error state
     * @param {string} errorMessage - Error message
     */
    showError(errorMessage) {
        this.statusElement.classList.add('error');
        this.updateStatus(errorMessage);
        
        if (this.config.onError) {
            this.config.onError(errorMessage);
        }
    }
    
    /**
     * Get DOM element
     */
    getElement() {
        return this.section.element;
    }
    
    /**
     * Destroy progress tracker
     */
    destroy() {
        this.section.element.remove();
    }
}

/**
 * Enhanced Progress Steps Manager for LLM Workflow
 */
export class ProgressStepsManager {
    constructor(steps = []) {
        this.steps = steps.map((step, index) => ({
            id: index,
            name: step.name,
            weight: step.weight || 1,
            status: 'pending',
            progress: 0,
            subSteps: step.subSteps || []
        }));
        
        this.totalWeight = this.steps.reduce((sum, step) => sum + step.weight, 0);
        this.tracker = null;
        this.currentSubStep = null;
    }
    
    /**
     * Attach to a progress tracker
     * @param {ProgressTracker} tracker - Progress tracker instance
     */
    attachTracker(tracker) {
        this.tracker = tracker;
    }
    
    /**
     * Start a step
     * @param {number} stepId - Step ID
     * @param {Object} context - Additional context (e.g., row counts)
     */
    startStep(stepId, context = {}) {
        const step = this.steps[stepId];
        if (!step) return;
        
        step.status = 'active';
        step.progress = 0;
        step.context = context;
        
        if (this.tracker) {
            this.tracker.updateStatus(step.name);
            
            // Show translation stats for relevant steps
            if (stepId === 2 && context.stats) {
                this.tracker.updateStats(context.stats);
            }
            
            this._updateOverallProgress();
        }
    }
    
    /**
     * Update step progress with optional detail
     * @param {number} stepId - Step ID
     * @param {number} progress - Step progress (0-100)
     * @param {string} detail - Optional detail message
     */
    updateStepProgress(stepId, progress, detail = '') {
        const step = this.steps[stepId];
        if (!step) return;
        
        step.progress = Math.min(Math.max(progress, 0), 100);
        
        if (this.tracker && detail) {
            this.tracker.updateDetail(detail);
        }
        
        this._updateOverallProgress();
    }
    
    /**
     * Start a sub-step within a step
     * @param {number} stepId - Parent step ID
     * @param {number} subStepId - Sub-step ID
     * @param {string} message - Sub-step message
     */
    startSubStep(stepId, subStepId, message) {
        const step = this.steps[stepId];
        if (!step || !step.subSteps[subStepId]) return;
        
        this.currentSubStep = {
            stepId,
            subStepId,
            message
        };
        
        if (this.tracker) {
            this.tracker.updateDetail(message);
        }
    }
    
    /**
     * Complete a step
     * @param {number} stepId - Step ID
     */
    completeStep(stepId) {
        const step = this.steps[stepId];
        if (!step) return;
        
        step.status = 'completed';
        step.progress = 100;
        this.currentSubStep = null;
        
        if (this.tracker) {
            this.tracker.updateDetail('');
        }
        
        this._updateOverallProgress();
    }
    
    /**
     * Calculate and update overall progress
     */
    _updateOverallProgress() {
        if (!this.tracker) return;
        
        let weightedProgress = 0;
        
        this.steps.forEach(step => {
            const stepContribution = (step.progress * step.weight) / this.totalWeight;
            weightedProgress += stepContribution;
        });
        
        this.tracker.updateProgress(Math.round(weightedProgress));
    }
    
    /**
     * Get current active step
     */
    getCurrentStep() {
        return this.steps.find(step => step.status === 'active');
    }
    
    /**
     * Reset all steps
     */
    reset() {
        this.steps.forEach(step => {
            step.status = 'pending';
            step.progress = 0;
            step.context = null;
        });
        
        this.currentSubStep = null;
        
        if (this.tracker) {
            this.tracker.reset();
        }
    }
}

/**
 * Create translation progress steps for LLM workflow
 */
export function createTranslationSteps() {
    return new ProgressStepsManager([
        { 
            name: 'Authenticating with Google...', 
            weight: 1 
        },
        { 
            name: 'Loading spreadsheet...', 
            weight: 1 
        },
        { 
            name: 'Analyzing data...', 
            weight: 1,
            subSteps: [
                'Validating sheet structure',
                'Identifying rows needing translation',
                'Checking manual overrides'
            ]
        },
        { 
            name: 'Translating content...', 
            weight: 4,
            subSteps: [
                'Connecting to DeepL API',
                'Processing translation batches',
                'Handling translation results'
            ]
        },
        { 
            name: 'Writing translations...', 
            weight: 2,
            subSteps: [
                'Preparing batch updates',
                'Writing to LLM columns'
            ]
        },
        { 
            name: 'Generating JSON...', 
            weight: 1,
            subSteps: [
                'Applying manual override priority',
                'Formatting JSON objects'
            ]
        },
        { 
            name: 'Updating spreadsheet...', 
            weight: 2,
            subSteps: [
                'Writing JSON results',
                'Finalizing updates'
            ]
        }
    ]);
}

/**
 * Helper to show translation progress details
 */
export function formatTranslationProgress(current, total, batchNumber = null) {
    let message = `Processing ${current} of ${total} rows`;
    if (batchNumber !== null) {
        message += ` (Batch ${batchNumber})`;
    }
    return message;
}