// Form Builder Module - Updated with OAuth2 and Language Selection
import { Button, Input, Select, RadioGroup, Section } from './ui-components.js';
import { validateSheetsUrl, validateApiKey } from '../utils/validators.js';
import { APP_CONFIG } from '../../config/config.js';

/**
 * Translation Form Builder with Authentication
 */
export const TranslationFormBuilder = {
    /**
     * Build the complete translation form with auth
     */
    build: (config = {}) => {
        const form = document.createElement('form');
        form.id = config.id || 'translation-form';
        form.className = 'translation-form';
        
        // Form state
        const state = {
            isAuthenticated: false,
            userInfo: null,
            sheetsUrl: '',
            dataType: '',
            language: '',
            apiService: 'deepl',
            apiKey: '',
            isValid: false
        };
        
        // Create form sections
        const sections = {
            auth: createAuthSection(state),
            dataSource: createDataSourceSection(state),
            dataType: createDataTypeSection(),
            language: createLanguageSection(),
            apiConfig: createApiConfigSection(),
            actions: createActionsSection()
        };
        
        // Append sections to form
        Object.values(sections).forEach(section => {
            form.appendChild(section.element);
        });
        
        // Form validation
        const validate = () => {
            const isValid = 
                state.isAuthenticated &&
                validateSheetsUrl(state.sheetsUrl) &&
                state.dataType !== '' &&
                state.language !== '' &&
                validateApiKey(state.apiKey);
            
            state.isValid = isValid;
            sections.actions.buttons.start.disabled = !isValid;
            return isValid;
        };
        
        // Update auth state
        const updateAuthState = (isAuthenticated, userInfo = null) => {
            state.isAuthenticated = isAuthenticated;
            state.userInfo = userInfo;
            
            // Update UI
            sections.auth.updateAuthUI(isAuthenticated, userInfo);
            
            // Enable/disable form based on auth
            const shouldDisable = !isAuthenticated;
            sections.dataSource.inputs.sheetsUrl.setDisabled(shouldDisable);
            sections.dataType.setDisabled?.(shouldDisable);
            sections.language.inputs.language.setDisabled(shouldDisable);
            sections.apiConfig.inputs.apiKey.setDisabled(shouldDisable);
            
            validate();
        };
        
        // Event handlers
        const handleSubmit = (e) => {
            e.preventDefault();
            if (validate() && config.onSubmit) {
                config.onSubmit({
                    ...state,
                    targetLanguage: state.language // Alias for clarity
                });
            }
        };
        
        // Input change handlers
        sections.dataSource.inputs.sheetsUrl.input.addEventListener('input', (e) => {
            state.sheetsUrl = e.target.value;
            validate();
        });
        
        const dataTypeRadios = form.querySelectorAll('input[name="data-type"]');
        dataTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                state.dataType = e.target.value;
                validate();
            });
        });
        
        sections.language.inputs.language.select.addEventListener('change', (e) => {
            state.language = e.target.value;
            validate();
        });
        
        sections.apiConfig.inputs.apiKey.input.addEventListener('input', (e) => {
            state.apiKey = e.target.value;
            validate();
        });
        
        form.addEventListener('submit', handleSubmit);
        
        // Return form API
        return {
            element: form,
            state,
            validate,
            updateAuthState,
            disable: () => disableForm(sections),
            enable: () => enableForm(sections),
            reset: () => resetForm(sections, state)
        };
    }
};

/**
 * Create Authentication Section
 */
function createAuthSection(state) {
    const section = Section.create({
        className: 'auth-section'
    });
    
    const authContainer = document.createElement('div');
    authContainer.className = 'google-auth-container';
    
    // Sign-in button
    const signInBtn = Button.primary({
        id: 'google-signin-btn',
        text: 'Sign in with Google',
        className: 'btn btn-primary google-signin-btn',
        onClick: () => {
            if (window.handleGoogleSignIn) {
                window.handleGoogleSignIn();
            } else {
                console.error('Google Sign-in handler not found');
                alert('Google Sign-in is not available. Please check your connection.');
            }
        }
    });
    
    // User info display (hidden initially)
    const userInfo = document.createElement('div');
    userInfo.id = 'user-info';
    userInfo.className = 'user-info hidden';
    userInfo.innerHTML = `
        <img id="user-avatar" class="user-avatar" alt="User avatar" />
        <div class="user-details">
            <span id="user-name" class="user-name"></span>
            <span id="user-email" class="user-email"></span>
        </div>
        <button type="button" id="sign-out-btn" class="btn btn-link">Sign out</button>
    `;
    
    // Help text
    const helpText = document.createElement('p');
    helpText.className = 'auth-help-text';
    helpText.textContent = 'Sign in with your Google account to access Google Sheets';
    
    authContainer.appendChild(signInBtn);
    authContainer.appendChild(userInfo);
    authContainer.appendChild(helpText);
    section.element.appendChild(authContainer);
    
    // Sign out handler
    setTimeout(() => {
        const signOutBtn = document.getElementById('sign-out-btn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => {
                if (window.handleGoogleSignOut) {
                    window.handleGoogleSignOut();
                }
            });
        }
    }, 0);
    
    // Update auth UI function
    const updateAuthUI = (isAuthenticated, userInfo) => {
        if (isAuthenticated && userInfo) {
            signInBtn.classList.add('hidden');
            helpText.classList.add('hidden');
            document.getElementById('user-info').classList.remove('hidden');
            
            const avatar = document.getElementById('user-avatar');
            const name = document.getElementById('user-name');
            const email = document.getElementById('user-email');
            
            if (avatar && userInfo.imageUrl) avatar.src = userInfo.imageUrl;
            if (name) name.textContent = userInfo.name || 'User';
            if (email) email.textContent = userInfo.email || '';
        } else {
            signInBtn.classList.remove('hidden');
            helpText.classList.remove('hidden');
            document.getElementById('user-info').classList.add('hidden');
        }
    };
    
    return {
        element: section.element,
        updateAuthUI
    };
}

/**
 * Create Data Source Section
 */
function createDataSourceSection(state) {
    const section = Section.create({
        className: 'form-section'
    });
    
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'form-section';
    
    const legend = document.createElement('legend');
    legend.textContent = 'Data Source';
    fieldset.appendChild(legend);
    
    // Sheets URL input
    const sheetsInput = Input.url({
        id: 'sheets-url',
        name: 'sheets-url',
        label: 'Google Sheets URL',
        placeholder: 'https://docs.google.com/spreadsheets/d/...',
        helpText: 'Paste the Google Sheets URL containing your Korean data',
        required: true,
        disabled: true, // Disabled until authenticated
        onInput: (e) => handleSheetsUrlInput(e, openSheetBtn)
    });
    
    // Open Sheet button
    const openSheetBtn = Button.link({
        id: 'open-sheet-btn',
        text: 'Open Sheet in New Tab',
        disabled: true,
        onClick: () => {
            const url = sheetsInput.getValue();
            if (validateSheetsUrl(url)) {
                window.open(url, '_blank');
            }
        }
    });
    
    fieldset.appendChild(sheetsInput.container);
    fieldset.appendChild(openSheetBtn);
    section.element.appendChild(fieldset);
    
    return {
        element: section.element,
        inputs: { sheetsUrl: sheetsInput },
        buttons: { openSheet: openSheetBtn }
    };
}

/**
 * Create Language Selection Section
 */
function createLanguageSection() {
    const section = Section.create({
        className: 'form-section'
    });
    
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'form-section';
    
    const legend = document.createElement('legend');
    legend.textContent = 'Target Language';
    fieldset.appendChild(legend);
    
    // Language selector
    const languageSelector = Select.create({
        id: 'target-language',
        name: 'target-language',
        label: 'Select target language for translation',
        required: true,
        disabled: true, // Disabled until authenticated
        options: [
            { value: '', text: 'Choose a language...' },
            { value: 'en', text: 'English (US)' },
            { value: 'ja', text: 'Japanese' },
            { value: 'th', text: 'Thai' }
        ]
    });
    
    // Help text
    const helpText = document.createElement('small');
    helpText.className = 'help-text';
    helpText.textContent = 'The sheet tab name should match the language code (en, ja, or th)';
    
    fieldset.appendChild(languageSelector.container);
    fieldset.appendChild(helpText);
    section.element.appendChild(fieldset);
    
    return {
        element: section.element,
        inputs: { language: languageSelector }
    };
}

/**
 * Create Data Type Section
 */
function createDataTypeSection() {
    const section = Section.create({
        className: 'form-section'
    });
    
    const radioGroup = RadioGroup.create({
        name: 'data-type',
        legend: 'Data Type',
        required: true,
        options: [
            { value: 'doctor', text: 'Doctor Data' },
            { value: 'hospital', text: 'Hospital Data' }
        ]
    });
    
    // Disable initially
    const radios = radioGroup.container.querySelectorAll('input[type="radio"]');
    radios.forEach(radio => radio.disabled = true);
    
    section.element.appendChild(radioGroup.container);
    
    return {
        element: section.element,
        inputs: { dataType: radioGroup },
        setDisabled: (disabled) => {
            radios.forEach(radio => radio.disabled = disabled);
        }
    };
}

/**
 * Create API Configuration Section
 */
function createApiConfigSection() {
    const section = Section.create({
        className: 'form-section'
    });
    
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'form-section';
    
    const legend = document.createElement('legend');
    legend.textContent = 'Translation API';
    fieldset.appendChild(legend);
    
    // API Service selector (hidden for now, only DeepL supported)
    const apiSelector = Select.create({
        id: 'api-selector',
        name: 'api-selector',
        label: 'Translation Service',
        required: true,
        value: 'deepl',
        disabled: true,
        options: [
            { value: 'deepl', text: 'DeepL' }
        ]
    });
    apiSelector.container.style.display = 'none'; // Hide since only one option
    
    // API Key input
    const apiKeyInput = Input.password({
        id: 'api-key',
        name: 'api-key',
        label: 'DeepL API Key',
        placeholder: 'Enter your DeepL API key',
        helpText: 'Your API key is used only for this session and never stored',
        required: true,
        disabled: true // Disabled until authenticated
    });
    
    fieldset.appendChild(apiSelector.container);
    fieldset.appendChild(apiKeyInput.container);
    section.element.appendChild(fieldset);
    
    return {
        element: section.element,
        inputs: { 
            apiSelector,
            apiKey: apiKeyInput
        }
    };
}

/**
 * Create Form Actions Section
 */
function createActionsSection() {
    const section = Section.create({
        className: 'form-actions'
    });
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'form-actions';
    
    // Start button
    const startBtn = Button.primary({
        id: 'start-btn',
        text: 'Start Translation',
        type: 'submit',
        disabled: true
    });
    
    // Cancel button
    const cancelBtn = Button.secondary({
        id: 'quit-btn',
        text: 'Cancel',
        disabled: true
    });
    
    actionsDiv.appendChild(startBtn);
    actionsDiv.appendChild(cancelBtn);
    section.element.appendChild(actionsDiv);
    
    return {
        element: section.element,
        buttons: {
            start: startBtn,
            cancel: cancelBtn
        }
    };
}

/**
 * Handle Sheets URL input
 */
function handleSheetsUrlInput(event, openSheetBtn) {
    const url = event.target.value;
    const isValid = validateSheetsUrl(url);
    openSheetBtn.disabled = !isValid;
    
    if (url && !isValid) {
        event.target.setError('Please enter a valid Google Sheets URL');
    } else {
        event.target.clearError();
    }
}

/**
 * Disable all form inputs
 */
function disableForm(sections) {
    Object.values(sections).forEach(section => {
        if (section.inputs) {
            Object.values(section.inputs).forEach(input => {
                if (input.setDisabled) input.setDisabled(true);
            });
        }
        if (section.setDisabled) {
            section.setDisabled(true);
        }
        if (section.buttons) {
            Object.values(section.buttons).forEach(button => {
                if (button.disabled !== undefined && button.id !== 'quit-btn') {
                    button.disabled = true;
                }
            });
        }
    });
}

/**
 * Enable all form inputs
 */
function enableForm(sections) {
    Object.values(sections).forEach(section => {
        if (section.inputs) {
            Object.values(section.inputs).forEach(input => {
                if (input.setDisabled) input.setDisabled(false);
            });
        }
        if (section.setDisabled) {
            section.setDisabled(false);
        }
        if (section.buttons) {
            Object.values(section.buttons).forEach(button => {
                if (button.disabled !== undefined) {
                    button.disabled = false;
                }
            });
        }
    });
}

/**
 * Reset form to initial state
 */
function resetForm(sections, state) {
    // Reset state
    state.sheetsUrl = '';
    state.dataType = '';
    state.language = '';
    state.apiService = 'deepl';
    state.apiKey = '';
    state.isValid = false;
    
    // Reset inputs
    if (sections.dataSource.inputs.sheetsUrl) {
        sections.dataSource.inputs.sheetsUrl.setValue('');
    }
    if (sections.dataType.inputs.dataType) {
        sections.dataType.inputs.dataType.setValue('');
    }
    if (sections.language.inputs.language) {
        sections.language.inputs.language.setValue('');
    }
    if (sections.apiConfig.inputs.apiSelector) {
        sections.apiConfig.inputs.apiSelector.setValue('deepl');
    }
    if (sections.apiConfig.inputs.apiKey) {
        sections.apiConfig.inputs.apiKey.setValue('');
    }
    
    // Reset buttons
    sections.dataSource.buttons.openSheet.disabled = true;
    sections.actions.buttons.start.disabled = true;
    sections.actions.buttons.cancel.disabled = true;
}
