// Application Configuration - LLM Translation Tool with Manual Override System
export const APP_CONFIG = {
    // App version
    VERSION: '2.0.0',
    
    // API Configuration
    DEEPL_API: {
        BASE_URL: 'https://api-free.deepl.com/v2',
        TIMEOUT: 30000,
        MAX_RETRIES: 3,
        RATE_LIMIT: 10, // requests per second
        BATCH_SIZE: 50  // texts per request
    },
    
    // Google API Configuration (placeholders - will be set via environment or UI)
    GOOGLE_API_KEY: '', // Set this via environment variable or secure config
    GOOGLE_CLIENT_ID: '825827340710-ejjs06hs55j4bhvr1ds8tsfrvfb1r0sl.apps.googleusercontent.com', // OAuth2 client ID - REQUIRED for write access
    
    // ADD MISSING MULTI-LANGUAGE CONFIG
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
    
    // ADD MISSING PERFORMANCE CONFIG
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
            language: 3,           // NEW
            old_name: 4,          // NEW
            old_history: 5,       // NEW
            old_json: 6,          // NEW
            manual_name: 7,       // UPDATED position
            manual_history: 8,    // UPDATED position
            llm_name: 9,          // UPDATED position
            llm_history: 10,      // UPDATED position
            updated_json: 11      // RENAMED from json_result
        },
        HOSPITAL: {
            id: 0,
            kr_name: 1,
            kr_description: 2,
            language: 3,           // NEW
            old_name: 4,          // NEW
            old_description: 5,   // NEW
            old_json: 6,          // NEW
            manual_name: 7,       // UPDATED position
            manual_description: 8, // UPDATED position
            llm_name: 9,          // UPDATED position
            llm_description: 10,  // UPDATED position
            updated_json: 11      // RENAMED from json_result
        }
    },
    
    // Column Letters for Writing (A=0, B=1, etc.)
    COLUMN_LETTERS: {
        DOCTOR: {
            llm_name: 'J',          // Column 9 (was F)
            llm_history: 'K',       // Column 10 (was G)
            updated_json: 'L'       // Column 11 (was H, renamed from json_result)
        },
        HOSPITAL: {
            llm_name: 'J',          // Column 9 (was F)
            llm_description: 'K',   // Column 10 (was G)
            updated_json: 'L'       // Column 11 (was H, renamed from json_result)
        }
    },
    
    // Translation Configuration
    TRANSLATION: {
        // Single language selection per run
        SUPPORTED_LANGUAGES: {
            en: { code: 'EN-US', name: 'English (US)' },
            ja: { code: 'JA', name: 'Japanese' },
            th: { code: 'TH', name: 'Thai' }
        },
        BATCH_SIZE: 50,
        CONCURRENT_REQUESTS: 3,
        // Fields to translate
        FIELDS: {
            DOCTOR: ['name', 'history'],
            HOSPITAL: ['name', 'description']
        }
    },
    
    // JSON Output Configuration
    JSON_OUTPUT: {
        INDENT: 2,
        // JSON structure templates
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
        BATCH_SIZE: 100, // Rows per batch write
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000, // ms
        // Rate limiting for writes
        WRITE_DELAY: 100 // ms between batches
    },
    
    // OAuth2 Configuration
    OAUTH2: {
        // Scopes required for the application
        SCOPES: ['https://www.googleapis.com/auth/spreadsheets'],
        // Discovery docs for Google Sheets API
        DISCOVERY_DOCS: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
        // Sign-in options
        SIGN_IN_OPTIONS: {
            prompt: 'select_account',
            ux_mode: 'popup'
        }
    },
    
    // Session Configuration
    SESSION: {
        // Auto sign-out after translation
        AUTO_SIGN_OUT: false,
        // Token refresh interval (ms)
        TOKEN_REFRESH_INTERVAL: 3300000 // 55 minutes
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