// UI Component Factory Module - Reusable components for the Medical Translation Tool

/**
 * Button Component Factory
 * Creates consistent button components with various styles
 */
export const Button = {
    /**
     * Create a primary button (main action)
     */
    primary: (config) => {
        const defaults = {
            type: 'button',
            className: 'btn btn-primary',
            disabled: false,
            loading: false
        };
        
        const settings = { ...defaults, ...config };
        const button = document.createElement('button');
        
        button.type = settings.type;
        button.className = settings.className;
        button.disabled = settings.disabled;
        button.textContent = settings.text;
        
        if (settings.id) button.id = settings.id;
        if (settings.onClick) button.addEventListener('click', settings.onClick);
        
        // Loading state management
        button.setLoading = (isLoading) => {
            button.disabled = isLoading;
            button.classList.toggle('loading', isLoading);
            if (!isLoading && settings.text) {
                button.textContent = settings.text;
            }
        };
        
        button.setText = (text) => {
            if (!button.classList.contains('loading')) {
                button.textContent = text;
            }
        };
        
        return button;
    },
    
    /**
     * Create a secondary button (alternative action)
     */
    secondary: (config) => {
        return Button.primary({
            ...config,
            className: 'btn btn-secondary'
        });
    },
    
    /**
     * Create a success button
     */
    success: (config) => {
        return Button.primary({
            ...config,
            className: 'btn btn-success'
        });
    },
    
    /**
     * Create a link-styled button
     */
    link: (config) => {
        return Button.primary({
            ...config,
            className: 'btn btn-link'
        });
    }
};

/**
 * Input Component Factory
 * Creates consistent form input components
 */
export const Input = {
    /**
     * Create a text input with consistent styling and behavior
     */
    text: (config) => {
        const defaults = {
            type: 'text',
            className: 'form-input',
            placeholder: '',
            required: false,
            disabled: false,
            value: ''
        };
        
        const settings = { ...defaults, ...config };
        
        // Container
        const container = document.createElement('div');
        container.className = 'form-group';
        
        // Label
        if (settings.label) {
            const label = document.createElement('label');
            label.textContent = settings.label;
            if (settings.id) label.htmlFor = settings.id;
            container.appendChild(label);
        }
        
        // Input
        const input = document.createElement('input');
        input.type = settings.type;
        input.className = settings.className;
        input.placeholder = settings.placeholder;
        input.required = settings.required;
        input.disabled = settings.disabled;
        input.value = settings.value;
        
        if (settings.id) input.id = settings.id;
        if (settings.name) input.name = settings.name;
        if (settings.pattern) input.pattern = settings.pattern;
        
        // Help text
        let helpText = null;
        if (settings.helpText) {
            helpText = document.createElement('small');
            helpText.className = 'help-text';
            helpText.textContent = settings.helpText;
            if (settings.id) {
                helpText.id = `${settings.id}-help`;
                input.setAttribute('aria-describedby', helpText.id);
            }
        }
        
        // Event handlers
        if (settings.onChange) input.addEventListener('change', settings.onChange);
        if (settings.onInput) input.addEventListener('input', settings.onInput);
        if (settings.onBlur) input.addEventListener('blur', settings.onBlur);
        
        // Validation
        input.setError = (message) => {
            input.classList.add('error');
            if (helpText) {
                helpText.textContent = message;
                helpText.classList.add('error-text');
            }
        };
        
        input.clearError = () => {
            input.classList.remove('error');
            if (helpText && settings.helpText) {
                helpText.textContent = settings.helpText;
                helpText.classList.remove('error-text');
            }
        };
        
        // Append elements
        container.appendChild(input);
        if (helpText) container.appendChild(helpText);
        
        // Return component API
        return {
            container,
            input,
            getValue: () => input.value,
            setValue: (value) => { input.value = value; },
            setDisabled: (disabled) => { input.disabled = disabled; },
            focus: () => input.focus(),
            validate: () => input.checkValidity()
        };
    },
    
    /**
     * Create a URL input
     */
    url: (config) => {
        return Input.text({
            ...config,
            type: 'url',
            pattern: config.pattern || 'https://.*'
        });
    },
    
    /**
     * Create a password input
     */
    password: (config) => {
        return Input.text({
            ...config,
            type: 'password'
        });
    }
};

/**
 * Select Component Factory
 */
export const Select = {
    /**
     * Create a select dropdown
     */
    create: (config) => {
        const defaults = {
            className: 'form-select',
            required: false,
            disabled: false,
            value: ''
        };
        
        const settings = { ...defaults, ...config };
        
        // Container
        const container = document.createElement('div');
        container.className = 'form-group';
        
        // Label
        if (settings.label) {
            const label = document.createElement('label');
            label.textContent = settings.label;
            if (settings.id) label.htmlFor = settings.id;
            container.appendChild(label);
        }
        
        // Select
        const select = document.createElement('select');
        select.className = settings.className;
        select.required = settings.required;
        select.disabled = settings.disabled;
        
        if (settings.id) select.id = settings.id;
        if (settings.name) select.name = settings.name;
        
        // Options
        if (settings.options) {
            settings.options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.text;
                option.disabled = opt.disabled || false;
                option.selected = opt.value === settings.value;
                select.appendChild(option);
            });
        }
        
        // Events
        if (settings.onChange) select.addEventListener('change', settings.onChange);
        
        container.appendChild(select);
        
        return {
            container,
            select,
            getValue: () => select.value,
            setValue: (value) => { select.value = value; },
            setDisabled: (disabled) => { select.disabled = disabled; }
        };
    }
};

/**
 * Radio Group Component Factory
 */
export const RadioGroup = {
    /**
     * Create a radio button group
     */
    create: (config) => {
        const defaults = {
            className: 'radio-group',
            required: false,
            value: ''
        };
        
        const settings = { ...defaults, ...config };
        
        // Container
        const container = document.createElement('fieldset');
        container.className = 'form-section';
        
        // Legend
        if (settings.legend) {
            const legend = document.createElement('legend');
            legend.textContent = settings.legend;
            container.appendChild(legend);
        }
        
        // Radio group container
        const radioGroup = document.createElement('div');
        radioGroup.className = settings.className;
        radioGroup.setAttribute('role', 'radiogroup');
        if (settings.required) radioGroup.setAttribute('aria-required', 'true');
        
        // Radio options
        const radios = [];
        if (settings.options) {
            settings.options.forEach((opt, index) => {
                const label = document.createElement('label');
                label.className = 'radio-label';
                
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = settings.name;
                radio.value = opt.value;
                radio.required = settings.required;
                radio.checked = opt.value === settings.value;
                
                if (settings.onChange) {
                    radio.addEventListener('change', settings.onChange);
                }
                
                const span = document.createElement('span');
                span.textContent = opt.text;
                
                label.appendChild(radio);
                label.appendChild(span);
                radioGroup.appendChild(label);
                
                radios.push(radio);
            });
        }
        
        container.appendChild(radioGroup);
        
        return {
            container,
            radios,
            getValue: () => {
                const checked = radios.find(r => r.checked);
                return checked ? checked.value : '';
            },
            setValue: (value) => {
                radios.forEach(r => {
                    r.checked = r.value === value;
                });
            },
            validate: () => radios.some(r => r.checked)
        };
    }
};

/**
 * Progress Component Factory
 */
export const Progress = {
    /**
     * Create a progress bar component
     */
    create: (config) => {
        const defaults = {
            min: 0,
            max: 100,
            value: 0,
            className: 'progress-bar'
        };
        
        const settings = { ...defaults, ...config };
        
        // Container
        const container = document.createElement('div');
        container.className = 'progress-bar-container';
        
        // Progress bar
        const progressBar = document.createElement('div');
        progressBar.className = settings.className;
        progressBar.setAttribute('role', 'progressbar');
        progressBar.setAttribute('aria-valuemin', settings.min);
        progressBar.setAttribute('aria-valuemax', settings.max);
        progressBar.setAttribute('aria-valuenow', settings.value);
        progressBar.style.width = `${settings.value}%`;
        
        // Progress text
        const progressText = document.createElement('span');
        progressText.className = 'progress-text';
        progressText.textContent = `${settings.value}%`;
        
        progressBar.appendChild(progressText);
        container.appendChild(progressBar);
        
        return {
            container,
            update: (value) => {
                const percent = Math.min(Math.max(value, settings.min), settings.max);
                progressBar.style.width = `${percent}%`;
                progressBar.setAttribute('aria-valuenow', percent);
                progressText.textContent = `${percent}%`;
            },
            reset: () => {
                progressBar.style.width = '0%';
                progressBar.setAttribute('aria-valuenow', 0);
                progressText.textContent = '0%';
            }
        };
    }
};

/**
 * Alert Component Factory
 */
export const Alert = {
    /**
     * Create an alert/message component
     */
    create: (config) => {
        const defaults = {
            type: 'info', // info, success, error, warning
            dismissible: true,
            autoHide: false,
            autoHideDelay: 5000
        };
        
        const settings = { ...defaults, ...config };
        
        const container = document.createElement('div');
        container.className = `alert alert-${settings.type}`;
        container.setAttribute('role', 'alert');
        
        const message = document.createElement('p');
        message.className = 'alert-message';
        message.textContent = settings.message;
        container.appendChild(message);
        
        if (settings.dismissible) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'alert-close';
            closeBtn.textContent = '×';
            closeBtn.setAttribute('aria-label', 'Close alert');
            closeBtn.addEventListener('click', () => container.remove());
            container.appendChild(closeBtn);
        }
        
        if (settings.autoHide) {
            setTimeout(() => container.remove(), settings.autoHideDelay);
        }
        
        return {
            container,
            show: () => { container.hidden = false; },
            hide: () => { container.hidden = true; },
            remove: () => container.remove(),
            updateMessage: (msg) => { message.textContent = msg; }
        };
    }
};

/**
 * Section Component Factory
 */
export const Section = {
    /**
     * Create a content section
     */
    create: (config) => {
        const defaults = {
            className: 'content-section',
            hidden: false
        };
        
        const settings = { ...defaults, ...config };
        
        const section = document.createElement('section');
        section.className = settings.className;
        section.hidden = settings.hidden;
        
        if (settings.id) section.id = settings.id;
        if (settings.ariaLive) section.setAttribute('aria-live', settings.ariaLive);
        
        if (settings.title) {
            const title = document.createElement('h2');
            title.textContent = settings.title;
            section.appendChild(title);
        }
        
        return {
            element: section,
            show: () => { section.hidden = false; },
            hide: () => { section.hidden = true; },
            toggle: () => { section.hidden = !section.hidden; },
            appendChild: (child) => section.appendChild(child),
            clear: () => { section.innerHTML = ''; }
        };
    }
};