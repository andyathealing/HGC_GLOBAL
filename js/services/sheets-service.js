// Google Sheets Service Module - With Detailed Error Logging
import { APP_CONFIG } from '../../config/config.js';

export class SheetsService {
    constructor() {
        this.apiLoaded = false;
        this.gapiClient = null;
        this.authClient = null;
        this.currentUser = null;
    }
    
    async initialize(config = {}) {
        try {
            console.log('Starting Google API initialization...');
            
            // Load Google API
            await this.loadGoogleAPI();
            console.log('Google API loaded successfully');
            
            // Initialize client with detailed logging
            await this.initializeClient(config);
            console.log('Google client initialized successfully');
            
            this.apiLoaded = true;
            return true;
            
        } catch (error) {
            console.error('Failed to initialize Sheets API:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            throw new Error(`Failed to initialize Google Sheets API: ${error.message}`);
        }
    }
    
    async loadGoogleAPI() {
        return new Promise((resolve, reject) => {
            if (window.gapi) {
                console.log('Google API already loaded');
                resolve();
                return;
            }
            
            console.log('Loading Google API script...');
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.async = true;
            script.defer = true;
            
            script.onload = () => {
                console.log('Google API script loaded');
                if (window.gapi) {
                    resolve();
                } else {
                    reject(new Error('Google API failed to load'));
                }
            };
            
            script.onerror = (error) => {
                console.error('Failed to load Google API script:', error);
                reject(new Error('Failed to load Google API script'));
            };
            
            document.head.appendChild(script);
        });
    }
    
    async initializeClient(config) {
        return new Promise((resolve, reject) => {
            console.log('Loading gapi client and auth2...');
            
            window.gapi.load('client:auth2', async () => {
                try {
                    console.log('gapi.client and gapi.auth2 loaded');
                    
                    // Check if gapi.client exists
                    if (!window.gapi.client) {
                        throw new Error('gapi.client is undefined');
                    }
                    
                    // Simple configuration - only essentials
                    const clientId = config.clientId || APP_CONFIG.GOOGLE_CLIENT_ID;
                    
                    if (!clientId) {
                        throw new Error('Google Client ID is required');
                    }
                    
                    console.log('Using Client ID:', clientId);
                    
                    const initConfig = {
                        clientId: clientId,
                        scope: 'https://www.googleapis.com/auth/spreadsheets',
                        discoveryDocs: ['https://sheets.googleapis.com/discovery/rest?version=v4']
                    };
                    
                    console.log('Initializing with config:', initConfig);
                    
                    // Add detailed error handling for the init call
                    try {
                        const initResult = await window.gapi.client.init(initConfig);
                        console.log('gapi.client.init completed successfully');
                        console.log('Init result:', initResult);
                    } catch (initError) {
                        console.error('gapi.client.init failed:', initError);
                        console.error('Init error details:', {
                            message: initError.message,
                            status: initError.status,
                            details: initError.details,
                            error: initError.error
                        });
                        throw initError;
                    }
                    
                    // Get auth instance with error checking
                    console.log('Getting auth instance...');
                    this.authClient = window.gapi.auth2.getAuthInstance();
                    this.gapiClient = window.gapi.client;
                    
                    if (!this.authClient) {
                        console.error('Auth instance is null/undefined');
                        throw new Error('Failed to get auth instance - returned null/undefined');
                    }
                    
                    console.log('Auth instance obtained successfully');
                    console.log('Auth instance type:', typeof this.authClient);
                    
                    // Set up auth state listener
                    this.authClient.isSignedIn.listen((isSignedIn) => {
                        this.handleAuthChange(isSignedIn);
                    });
                    
                    // Handle initial auth state
                    const currentSignInState = this.authClient.isSignedIn.get();
                    console.log('Current sign-in state:', currentSignInState);
                    this.handleAuthChange(currentSignInState);
                    
                    resolve();
                    
                } catch (error) {
                    console.error('Client initialization error:', error);
                    console.error('Error type:', typeof error);
                    console.error('Error properties:', Object.keys(error));
                    reject(new Error(`Failed to initialize Google client: ${error.message || 'Unknown error'}`));
                }
            }, (loadError) => {
                console.error('Failed to load gapi client:auth2:', loadError);
                reject(new Error('Failed to load Google API client libraries'));
            });
        });
    }
    
    handleAuthChange(isSignedIn) {
        console.log('Auth state changed:', isSignedIn);
        if (isSignedIn) {
            const user = this.authClient.currentUser.get();
            this.currentUser = user;
            console.log('User signed in:', user.getBasicProfile().getEmail());
        } else {
            this.currentUser = null;
            console.log('User signed out');
        }
    }
    
    async authenticate() {
        try {
            console.log('Starting authentication...');
            
            if (this.authClient && this.authClient.isSignedIn.get()) {
                console.log('Already signed in');
                return true;
            }
            
            if (!this.authClient) {
                throw new Error('Auth client not initialized');
            }
            
            console.log('Calling signIn...');
            const user = await this.authClient.signIn({
                prompt: 'select_account'
            });
            
            this.currentUser = user;
            console.log('Authentication successful');
            return true;
            
        } catch (error) {
            console.error('Authentication failed:', error);
            console.error('Auth error details:', {
                error: error.error,
                details: error.details
            });
            throw new Error(`Failed to authenticate with Google: ${error.message}`);
        }
    }
    
    async signOut() {
        if (this.authClient) {
            await this.authClient.signOut();
            this.currentUser = null;
            console.log('Signed out successfully');
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
    
    // Essential methods for basic functionality
    async getSheetData(spreadsheetId, sheetName = null) {
        this.ensureApiLoaded();
        this.ensureAuthenticated();
        
        try {
            console.log('Getting sheet data for:', spreadsheetId, sheetName);
            
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
    
    async getSheetNames(spreadsheetId) {
        const metadata = await this.getSpreadsheetMetadata(spreadsheetId);
        return metadata.sheets.map(sheet => ({
            name: sheet.properties.title,
            id: sheet.properties.sheetId,
            index: sheet.properties.index
        }));
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
}

// Singleton instance
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
