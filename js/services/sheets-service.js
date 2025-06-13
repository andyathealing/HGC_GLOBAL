// Google Sheets Service Module - Fixed initialization
import { APP_CONFIG } from '../../config/config.js';

export class SheetsService {
    constructor() {
        this.apiKey = null;
        this.accessToken = null;
        this.apiLoaded = false;
        this.gapiClient = null;
        this.authClient = null;
        this.currentUser = null;
    }
    
    async initialize(config = {}) {
        try {
            await this.loadGoogleAPI();
            await this.initializeClient(config);
            this.apiLoaded = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize Sheets API:', error);
            throw new Error('Failed to initialize Google Sheets API');
        }
    }
    
    async loadGoogleAPI() {
        return new Promise((resolve, reject) => {
            if (window.gapi) {
                resolve();
                return;
            }
            
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
     * FIXED: Initialize Google API client with better error handling
     */
    async initializeClient(config) {
        return new Promise((resolve, reject) => {
            window.gapi.load('client:auth2', async () => {
                try {
                    // FIXED: Simplified initialization config
                    const initConfig = {
                        clientId: config.clientId || APP_CONFIG.GOOGLE_CLIENT_ID,
                        discoveryDocs: APP_CONFIG.OAUTH2.DISCOVERY_DOCS,
                        scope: APP_CONFIG.OAUTH2.SCOPES.join(' ')
                    };
                    
                    // FIXED: Only add API key if it's available and not empty
                    const apiKey = config.apiKey || APP_CONFIG.GOOGLE_API_KEY;
                    if (apiKey && apiKey.trim() !== '') {
                        initConfig.apiKey = apiKey;
                    }
                    
                    console.log('Initializing Google API client...');
                    
                    await window.gapi.client.init(initConfig);
                    
                    this.gapiClient = window.gapi.client;
                    this.authClient = window.gapi.auth2.getAuthInstance();
                    
                    // FIXED: Better error handling for auth instance
                    if (!this.authClient) {
                        throw new Error('Failed to get auth instance');
                    }
                    
                    this.authClient.isSignedIn.listen((isSignedIn) => {
                        this.handleAuthChange(isSignedIn);
                    });
                    
                    this.handleAuthChange(this.authClient.isSignedIn.get());
                    
                    console.log('Google API client initialized successfully');
                    resolve();
                } catch (error) {
                    console.error('Client initialization error:', error);
                    reject(new Error(`Failed to initialize Google client: ${error.message}`));
                }
            });
        });
    }
    
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
    
    async authenticate() {
        try {
            if (this.authClient && this.authClient.isSignedIn.get()) {
                return true;
            }
            
            const user = await this.authClient.signIn({
                prompt: 'select_account'
            });
            
            this.accessToken = user.getAuthResponse().access_token;
            this.currentUser = user;
            return true;
        } catch (error) {
            console.error('Authentication failed:', error);
            throw new Error('Failed to authenticate with Google');
        }
    }
    
    async signOut() {
        if (this.authClient) {
            await this.authClient.signOut();
            this.accessToken = null;
            this.currentUser = null;
        }
    }
    
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
    
    async getSheetNames(spreadsheetId) {
        const metadata = await this.getSpreadsheetMetadata(spreadsheetId);
        return metadata.sheets.map(sheet => ({
            name: sheet.properties.title,
            id: sheet.properties.sheetId,
            index: sheet.properties.index
        }));
    }
    
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
    
    async getSheetData(spreadsheetId, sheetName = null) {
        try {
            if (!sheetName) {
                const sheets = await this.getSheetNames(spreadsheetId);
                if (sheets.length === 0) {
                    throw new Error('No sheets found in spreadsheet');
                }
                sheetName = sheets[0].name;
            }
            
            const range = `'${sheetName}'`;
            const data = await this.getRange(spreadsheetId, range);
            
            if (data.length === 0) {
                return { headers: [], rows: [], sheetName };
            }
            
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
    
    async updateValues(spreadsheetId, range, values) {
        this.ensureApiLoaded();
        this.ensureAuthenticated();
        
        try {
            const response = await this.gapiClient.sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetId,
                range: range,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: values
                }
            });
            
            return response.result;
        } catch (error) {
            this.handleApiError(error);
        }
    }
    
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
    
    ensureApiLoaded() {
        if (!this.apiLoaded || !this.gapiClient) {
            throw new Error('Google Sheets API not initialized. Call initialize() first.');
        }
    }
    
    ensureAuthenticated() {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated. Please sign in first.');
        }
    }
    
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
    
    isAuthenticated() {
        return this.authClient && this.authClient.isSignedIn.get();
    }
    
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
    
    // Additional methods remain the same...
    // [Include all other methods from original file]
}

let serviceInstance = null;

export function getSheetsService() {
    if (!serviceInstance) {
        serviceInstance = new SheetsService();
    }
    return serviceInstance;
}

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