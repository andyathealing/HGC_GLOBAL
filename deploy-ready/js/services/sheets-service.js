// Google Sheets Service Module - Handles Google Sheets API interactions with read/write
import { APP_CONFIG } from '../../config/config.js';

/**
 * Google Sheets Service
 * Manages all interactions with Google Sheets API v4
 * Enhanced with write capabilities and OAuth2 authentication
 */
export class SheetsService {
    constructor() {
        this.apiKey = null;
        this.accessToken = null;
        this.apiLoaded = false;
        this.gapiClient = null;
        this.authClient = null;
        this.currentUser = null;
    }
    
    /**
     * Initialize the Google Sheets API
     * @param {Object} config - Configuration options
     */
    async initialize(config = {}) {
        try {
            // Load Google API client library
            await this.loadGoogleAPI();
            
            // Initialize the API client with read/write scope
            await this.initializeClient(config);
            
            this.apiLoaded = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize Sheets API:', error);
            throw new Error('Failed to initialize Google Sheets API');
        }
    }
    
    /**
     * Load Google API client library
     */
    async loadGoogleAPI() {
        return new Promise((resolve, reject) => {
            // Check if gapi is already loaded
            if (window.gapi) {
                resolve();
                return;
            }
            
            // Create script element
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.async = true;
            script.defer = true;
            
            script.onload = () => {
                if (window.gapi) {
                    resolve();
                } else {
                    reject(new Error('Google API failed to load'));
                }
            };
            
            script.onerror = () => {
                reject(new Error('Failed to load Google API script'));
            };
            
            document.head.appendChild(script);
        });
    }
    
    /**
     * Initialize Google API client with OAuth2
     * @param {Object} config - Client configuration
     */
    async initializeClient(config) {
    return new Promise((resolve, reject) => {
        window.gapi.load('client:auth2', async () => {
            try {
                // OAuth2만 사용하는 설정 (API Key 제거)
                const initConfig = {
                    clientId: config.clientId || APP_CONFIG.GOOGLE_CLIENT_ID,
                    discoveryDocs: ['https://sheets.googleapis.com/discovery/rest?version=v4'], // $discovery 제거
                    scope: 'https://www.googleapis.com/auth/spreadsheets'
                };
                
                // API Key가 있고 비어있지 않은 경우에만 추가
                if (config.apiKey && config.apiKey.trim() !== '') {
                    initConfig.apiKey = config.apiKey;
                } else if (APP_CONFIG.GOOGLE_API_KEY && APP_CONFIG.GOOGLE_API_KEY.trim() !== '') {
                    initConfig.apiKey = APP_CONFIG.GOOGLE_API_KEY;
                }
                // 그렇지 않으면 apiKey 필드를 아예 포함하지 않음
                
                console.log('Initializing with config:', initConfig);
                
                await window.gapi.client.init(initConfig);
                
                this.gapiClient = window.gapi.client;
                this.authClient = window.gapi.auth2.getAuthInstance();
                
                // Listen for sign-in state changes
                this.authClient.isSignedIn.listen((isSignedIn) => {
                    this.handleAuthChange(isSignedIn);
                });
                
                // Handle initial sign-in state
                this.handleAuthChange(this.authClient.isSignedIn.get());
                
                console.log('Client initialization successful');
                resolve();
            } catch (error) {
                console.error('Client initialization error:', error);
                reject(error);
            }
        });
    });
}
    
    /**
     * Handle authentication state changes
     * @param {boolean} isSignedIn - Authentication status
     */
    handleAuthChange(isSignedIn) {
        if (isSignedIn) {
            const user = this.authClient.currentUser.get();
            this.accessToken = user.getAuthResponse().access_token;
            this.currentUser = user;
        } else {
            this.accessToken = null;
            this.currentUser = null;
        }
    }
    
    /**
     * Authenticate user with OAuth2
     * @returns {Promise<boolean>} - Authentication status
     */
    async authenticate() {
        try {
            // Check if already signed in
            if (this.authClient && this.authClient.isSignedIn.get()) {
                return true;
            }
            
            // Sign in the user - will open Google OAuth popup
            const user = await this.authClient.signIn({
                prompt: 'select_account' // Always show account selector
            });
            
            this.accessToken = user.getAuthResponse().access_token;
            this.currentUser = user;
            return true;
        } catch (error) {
            console.error('Authentication failed:', error);
            throw new Error('Failed to authenticate with Google');
        }
    }
    
    /**
     * Sign out user
     */
    async signOut() {
        if (this.authClient) {
            await this.authClient.signOut();
            this.accessToken = null;
            this.currentUser = null;
        }
    }
    
    /**
     * Get spreadsheet metadata
     * @param {string} spreadsheetId - Google Sheets ID
     * @returns {Promise<Object>} - Spreadsheet metadata
     */
    async getSpreadsheetMetadata(spreadsheetId) {
        this.ensureApiLoaded();
        this.ensureAuthenticated();
        
        try {
            const response = await this.gapiClient.sheets.spreadsheets.get({
                spreadsheetId: spreadsheetId
            });
            
            return response.result;
        } catch (error) {
            this.handleApiError(error);
        }
    }
    
    /**
     * Get all sheet names in a spreadsheet
     * @param {string} spreadsheetId - Google Sheets ID
     * @returns {Promise<Array>} - Array of sheet names
     */
    async getSheetNames(spreadsheetId) {
        const metadata = await this.getSpreadsheetMetadata(spreadsheetId);
        return metadata.sheets.map(sheet => ({
            name: sheet.properties.title,
            id: sheet.properties.sheetId,
            index: sheet.properties.index
        }));
    }
    
    /**
     * Get data from a specific range
     * @param {string} spreadsheetId - Google Sheets ID
     * @param {string} range - A1 notation range (e.g., 'Sheet1!A1:Z1000')
     * @returns {Promise<Array>} - 2D array of cell values
     */
    async getRange(spreadsheetId, range) {
        this.ensureApiLoaded();
        this.ensureAuthenticated();
        
        try {
            const response = await this.gapiClient.sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: range,
                valueRenderOption: 'UNFORMATTED_VALUE',
                dateTimeRenderOption: 'FORMATTED_STRING'
            });
            
            return response.result.values || [];
        } catch (error) {
            this.handleApiError(error);
        }
    }
    
    /**
     * Get all data from a sheet
     * @param {string} spreadsheetId - Google Sheets ID
     * @param {string} sheetName - Name of the sheet (optional)
     * @returns {Promise<Object>} - Sheet data with headers and rows
     */
    async getSheetData(spreadsheetId, sheetName = null) {
        try {
            // If no sheet name provided, use the first sheet
            if (!sheetName) {
                const sheets = await this.getSheetNames(spreadsheetId);
                if (sheets.length === 0) {
                    throw new Error('No sheets found in spreadsheet');
                }
                sheetName = sheets[0].name;
            }
            
            // Get all data from the sheet
            const range = `'${sheetName}'`;
            const data = await this.getRange(spreadsheetId, range);
            
            if (data.length === 0) {
                return { headers: [], rows: [], sheetName };
            }
            
            // First row as headers
            const headers = data[0] || [];
            const rows = data.slice(1);
            
            return {
                sheetName,
                headers,
                rows,
                rowCount: rows.length
            };
        } catch (error) {
            console.error('Failed to get sheet data:', error);
            throw error;
        }
    }
    
    /**
     * Update values in a range
     * @param {string} spreadsheetId - Google Sheets ID
     * @param {string} range - A1 notation range
     * @param {Array} values - 2D array of values to write
     * @returns {Promise<Object>} - Update response
     */
    async updateValues(spreadsheetId, range, values) {
        this.ensureApiLoaded();
        this.ensureAuthenticated();
        
        try {
            const response = await this.gapiClient.sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetId,
                range: range,
                valueInputOption: 'USER_ENTERED', // Parse values like user input
                resource: {
                    values: values
                }
            });
            
            return response.result;
        } catch (error) {
            this.handleApiError(error);
        }
    }
    
    /**
     * Batch update multiple ranges at once
     * @param {string} spreadsheetId - Google Sheets ID
     * @param {Array} updates - Array of {range, values} objects
     * @returns {Promise<Object>} - Batch update response
     */
    async batchUpdate(spreadsheetId, updates) {
        this.ensureApiLoaded();
        this.ensureAuthenticated();
        
        try {
            const data = updates.map(update => ({
                range: update.range,
                values: update.values
            }));
            
            const response = await this.gapiClient.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: spreadsheetId,
                resource: {
                    valueInputOption: 'USER_ENTERED',
                    data: data
                }
            });
            
            return response.result;
        } catch (error) {
            this.handleApiError(error);
        }
    }
    
    /**
     * Update specific columns for multiple rows
     * @param {string} spreadsheetId - Google Sheets ID
     * @param {string} sheetName - Sheet name
     * @param {number} startRow - Starting row (1-based)
     * @param {Object} columnUpdates - {columnLetter: values[]}
     * @returns {Promise<Object>} - Update response
     */
    async updateColumns(spreadsheetId, sheetName, startRow, columnUpdates) {
        const updates = [];
        
        Object.entries(columnUpdates).forEach(([column, values]) => {
            if (values.length > 0) {
                const range = `'${sheetName}'!${column}${startRow}:${column}${startRow + values.length - 1}`;
                updates.push({
                    range: range,
                    values: values.map(v => [v]) // Convert to 2D array
                });
            }
        });
        
        if (updates.length > 0) {
            return await this.batchUpdate(spreadsheetId, updates);
        }
        
        return { updatedCells: 0 };
    }
    
    /**
     * Clear values in a range
     * @param {string} spreadsheetId - Google Sheets ID
     * @param {string} range - A1 notation range
     * @returns {Promise<Object>} - Clear response
     */
    async clearRange(spreadsheetId, range) {
        this.ensureApiLoaded();
        this.ensureAuthenticated();
        
        try {
            const response = await this.gapiClient.sheets.spreadsheets.values.clear({
                spreadsheetId: spreadsheetId,
                range: range
            });
            
            return response.result;
        } catch (error) {
            this.handleApiError(error);
        }
    }
    
    /**
     * Get multiple ranges at once (batch request)
     * @param {string} spreadsheetId - Google Sheets ID
     * @param {Array<string>} ranges - Array of A1 notation ranges
     * @returns {Promise<Object>} - Object with range data
     */
    async getBatchRanges(spreadsheetId, ranges) {
        this.ensureApiLoaded();
        this.ensureAuthenticated();
        
        try {
            const response = await this.gapiClient.sheets.spreadsheets.values.batchGet({
                spreadsheetId: spreadsheetId,
                ranges: ranges,
                valueRenderOption: 'UNFORMATTED_VALUE',
                dateTimeRenderOption: 'FORMATTED_STRING'
            });
            
            const result = {};
            response.result.valueRanges.forEach((rangeData, index) => {
                result[ranges[index]] = rangeData.values || [];
            });
            
            return result;
        } catch (error) {
            this.handleApiError(error);
        }
    }
    
    /**
     * Ensure API is loaded before making requests
     */
    ensureApiLoaded() {
        if (!this.apiLoaded || !this.gapiClient) {
            throw new Error('Google Sheets API not initialized. Call initialize() first.');
        }
    }
    
    /**
     * Ensure user is authenticated
     */
    ensureAuthenticated() {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated. Please sign in first.');
        }
    }
    
    /**
     * Handle API errors
     * @param {Error} error - API error
     */
    handleApiError(error) {
        console.error('Sheets API Error:', error);
        
        if (error.status === 401) {
            throw new Error('Authentication expired. Please sign in again.');
        } else if (error.status === 403) {
            throw new Error('Access denied. Please check permissions.');
        } else if (error.status === 404) {
            throw new Error('Spreadsheet not found. Please check the URL.');
        } else if (error.status === 429) {
            throw new Error('Too many requests. Please try again later.');
        } else {
            throw new Error(error.message || 'Failed to access Google Sheets');
        }
    }
    
    /**
     * Check if user is authenticated
     * @returns {boolean} - Authentication status
     */
    isAuthenticated() {
        return this.authClient && this.authClient.isSignedIn.get();
    }
    
    /**
     * Get current user info
     * @returns {Object|null} - User profile info
     */
    getCurrentUser() {
        if (!this.isAuthenticated()) return null;
        
        const user = this.authClient.currentUser.get();
        const profile = user.getBasicProfile();
        
        return {
            id: profile.getId(),
            name: profile.getName(),
            email: profile.getEmail(),
            imageUrl: profile.getImageUrl()
        };
    }
    
    /**
     * Refresh access token if needed
     * @returns {Promise<string>} - Access token
     */
    async refreshAccessToken() {
        if (!this.currentUser) {
            throw new Error('No user signed in');
        }
        
        const authResponse = await this.currentUser.reloadAuthResponse();
        this.accessToken = authResponse.access_token;
        return this.accessToken;
    }
    
    /**
     * Column letter to index conversion
     * @param {string} letter - Column letter (A, B, AA, etc.)
     * @returns {number} - Column index (0-based)
     */
    static columnLetterToIndex(letter) {
        let index = 0;
        for (let i = 0; i < letter.length; i++) {
            index = index * 26 + (letter.charCodeAt(i) - 65 + 1);
        }
        return index - 1;
    }
    
    /**
     * Index to column letter conversion
     * @param {number} index - Column index (0-based)
     * @returns {string} - Column letter
     */
    static indexToColumnLetter(index) {
        let letter = '';
        index++;
        while (index > 0) {
            const remainder = (index - 1) % 26;
            letter = String.fromCharCode(65 + remainder) + letter;
            index = Math.floor((index - 1) / 26);
        }
        return letter;
    }
}

/**
 * Singleton instance
 */
let serviceInstance = null;

/**
 * Get or create service instance
 * @returns {SheetsService} - Service instance
 */
export function getSheetsService() {
    if (!serviceInstance) {
        serviceInstance = new SheetsService();
    }
    return serviceInstance;
}

/**
 * Utility function to parse Google Sheets URL
 * @param {string} url - Google Sheets URL
 * @returns {Object} - Parsed URL info
 */
export function parseGoogleSheetsUrl(url) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)(?:\/.*#gid=(\d+))?/);
    
    if (!match) {
        throw new Error('Invalid Google Sheets URL');
    }
    
    return {
        spreadsheetId: match[1],
        sheetId: match[2] || null,
        url: url
    };
}