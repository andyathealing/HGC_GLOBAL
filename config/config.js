// Application Configuration - Fixed Discovery Document URL
export const APP_CONFIG = {
    // App version
    VERSION: '2.0.0',
    
    // API Configuration
    DEEPL_API: {
        BASE_URL: 'https://api-free.deepl.com/v2',
        TIMEOUT: 30000,
        MAX_RETRIES: 3,
        RATE_LIMIT: 10,
        BATCH_SIZE: 50
    },
    
    // Google API Configuration 
    GOOGLE_API_KEY: '', 
    GOOGLE_CLIENT_ID: '825827340710-ejjs06hs55j4bhvr1ds8tsfrvfb1r0sl.apps.googleusercontent.com',
    
    // MULTI-LANGUAGE CONFIG
    MULTI_LANGUAGE_JSON: {
        LANGUAGE_CODES: ['en', 'ja', 'th'],
        DEFAULT_VALUES: {
            name: '',
            history: '',
            description: ''
        },
        PARSING: {
            LOG_ERRORS: true
        }
    },
    
    // PERFORMANCE CONFIG
    PERFORMANCE: {
        JSON_CACHE: {
            ENABLED: true,
            MAX_SIZE: 100
        }
    },
    
    // Validation Rules
    VALIDATION: {
        SHEETS_URL_PATTERN: /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/,
        API_KEY_MIN_LENGTH: 10,
        REQUIRED_COLUMNS: {
            DOCTOR: ['id', 'kr_name', 'kr_history'],
            HOSPITAL: ['id', 'kr_name', 'kr_description']
        }
    },
    
    // Fixed Sheet Column Structure
    SHEET_COLUMNS: {
        DOCTOR: {
            id: 0,
            kr_name: 1,
            kr_history: 2,
            language: 3,
            old_name: 4,
            old_history: 5,
            old_json: 6,
            manual_name: 7,
            manual_history: 8,
            llm_name: 9,
            llm_history: 10,
            updated_json: 11
        },
        HOSPITAL: {
            id: 0,
            kr_name: 1,
            kr_description: 2,
            language: 3,
            old_name: 4,
            old_description: 5,
            old_json: 6,
            manual_name: 7,
            manual_description: 8,
            llm_name: 9,
            llm_description: 10,
            updated_json: 11
        }
    },
    
    // Column Letters for Writing
    COLUMN_LETTERS: {
        DOCTOR: {
            llm_name: 'J',
            llm_history: 'K',
            updated_json: 'L'
        },
        HOSPITAL: {
            llm_name: 'J',
            llm_description: 'K',
            updated_json: 'L'
        }
    },
    
    // Translation Configuration
    TRANSLATION: {
        SUPPORTED_LANGUAGES: {
            en: { code: 'EN-US', name: 'English (US)' },
            ja: { code: 'JA', name: 'Japanese' },
            th: { code: 'TH', name: 'Thai' }
        },
        BATCH_SIZE: 50,
        CONCURRENT_REQUESTS: 3,
        FIELDS: {
            DOCTOR: ['name', 'history'],
            HOSPITAL: ['name', 'description']
        }
    },
    
    // JSON Output Configuration
    JSON_OUTPUT: {
        INDENT: 2,
        TEMPLATES: {
            DOCTOR: {
                id: '',
                name: '',
                history: ''
            },
            HOSPITAL: {
                id: '',
                name: '',
                description: ''
            }
        }
    },
    
    // UI Messages
    SUCCESS_MESSAGES: {
        AUTH_SUCCESS: 'Successfully authenticated with Google',
        TRANSLATION_COMPLETE: 'Translation completed successfully!',
        WRITE_COMPLETE: 'Results written to spreadsheet!',
        JSON_GENERATED: 'JSON generated for all rows'
    },
    
    ERROR_MESSAGES: {
        INVALID_SHEETS_URL: 'Please enter a valid Google Sheets URL',
        MISSING_API_KEY: 'Please enter your DeepL API key',
        MISSING_LANGUAGE: 'Please select a target language',
        TRANSLATION_FAILED: 'Translation failed. Please try again.',
        NETWORK_ERROR: 'Network error. Please check your connection.',
        AUTH_REQUIRED: 'Google authentication required to access the spreadsheet.',
        SHEETS_ACCESS_DENIED: 'Unable to access the spreadsheet. Please check permissions.',
        INVALID_DATA_FORMAT: 'Invalid data format in spreadsheet.',
        MISSING_REQUIRED_COLUMNS: 'Required columns are missing in the spreadsheet.',
        WRITE_FAILED: 'Failed to write results to spreadsheet.',
        NO_ROWS_TO_TRANSLATE: 'No rows found that need translation.'
    },
    
    // Progress Steps Configuration
    PROGRESS_STEPS: [
        { name: 'Authenticating with Google...', weight: 1 },
        { name: 'Loading spreadsheet...', weight: 1 },
        { name: 'Analyzing data...', weight: 1 },
        { name: 'Translating content...', weight: 4 },
        { name: 'Writing translations...', weight: 2 },
        { name: 'Generating JSON...', weight: 1 },
        { name: 'Updating spreadsheet...', weight: 2 }
    ],
    
    // Write Operations Configuration
    WRITE_CONFIG: {
        BATCH_SIZE: 100,
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000,
        WRITE_DELAY: 100
    },
    
    // OAuth2 Configuration - NO DISCOVERY DOCS (Load manually)
    OAUTH2: {
        SCOPES: ['https://www.googleapis.com/auth/spreadsheets'],
        // REMOVED discovery docs - load manually after init
        DISCOVERY_DOCS: [],
        SIGN_IN_OPTIONS: {
            prompt: 'select_account',
            ux_mode: 'popup'
        }
    },
    
    // Session Configuration
    SESSION: {
        AUTO_SIGN_OUT: false,
        TOKEN_REFRESH_INTERVAL: 3300000
    },
    
    // Export Settings
    EXPORT: {
        JSON_INDENT: 2,
        FILE_PREFIX: {
            DOCTOR: 'doctors_translated',
            HOSPITAL: 'hospitals_translated'
        }
    }
};
