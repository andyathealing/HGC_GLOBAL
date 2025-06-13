// Google Sheets Service Module - Using Google Identity Services (GIS)
import { APP_CONFIG } from '../../config/config.js';

export class SheetsService {
    constructor() {
        this.apiLoaded = false;
        this.gapiClient = null;
        this.accessToken = null;
        this.currentUser = null;
        this.tokenClient = null;
    }
    
    async initialize(config = {}) {
        try {
            console.log('Starting Google API initialization with GIS...');
            
            // Load Google API and GIS
            await this.loadGoogleLibraries();
            console.log('Google libraries loaded successfully');
            
            // Initialize client
            await this.initializeClient(config);
            console.log('Google client initialized successfully');
            
            // Load Sheets API
            await this.loadSheetsAPI();
            console.log('Sheets API loaded successfully');
            
            this.apiLoaded = true;
            return true;
            
        } catch (error) {
            console.error('Failed to initialize Sheets API:', error);
            throw new Error(`Failed to initialize Google Sheets API: ${error.message}`);
        }
    }
    
    async loadGoogleLibraries() {
        // Load both gapi and gsi libraries
        await Promise.all([
            this.loadGoogleAPI(),
            this.loadGoogleIdentityServices()
        ]);
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
                resolve();
            };
            
            script.onerror = () => {
                reject(new Error('Failed to load Google API script'));
            };
            
            document.head.appendChild(script);
        });
    }
    
    async loadGoogleIdentityServices() {
        return new Promise((resolve, reject) => {
            if (window.google?.accounts) {
                console.log('Google Identity Services already loaded');
                resolve();
                return;
            }
            
            console.log('Loading Google Identity Services...');
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            
            script.onload = () => {
                console.log('Google Identity Services loaded');
                resolve();
            };
            
            script.onerror = () => {
                reject(new Error('Failed to load Google Identity Services'));
            };
            
            document.head.appendChild(script);
        });
    }
    
    async initializeClient(config) {
        return new Promise((resolve, reject) => {
            console.log('Loading gapi client...');
            
            window.gapi.load('client', async () => {
                try {
                    console.log('gapi.client loaded');
                    
                    const clientId = config.clientId || APP_CONFIG.GOOGLE_CLIENT_ID;
                    
                    if (!clientId) {
                        throw new Error('Google Client ID is required');
                    }
                    
                    console.log('Using Client ID:', clientId);
                    
                    // Initialize gapi client (no auth)
                    await window.gapi.client.init({
                        // No authentication here - just API client
                    });
                    
                    console.log('gapi.client.init completed');
                    this.gapiClient = window.gapi.client;
                    
                    // Initialize Google Identity Services token client
                    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
                        client_id: clientId,
                        scope: 'https://www.googleapis.com/auth/spreadsheets',
                        callback: (response) => {
                            console.log('Token response:', response);
                            if (response.error) {
                                console.error('Token error:', response.error);
                                return;
                            }
                            this.accessToken = response.access_token;
                            this.handleAuthChange(true);
                        },
                        error_callback: (error) => {
                            console.error('Token client error:', error);
                            this.handleAuthChange(false);
                        }
                    });
                    
                    console.log('Google Identity Services token client initialized');
                    
                    resolve();
                    
                } catch (error) {
                    console.error('Client initialization error:', error);
                    reject(new Error(`Failed to initialize Google client: ${error.message}`));
                }
            });
        });
    }
    
    async loadSheetsAPI() {
        console.log('Loading Sheets API...');
        
        try {
            await new Promise((resolve, reject) => {
                window.gapi.client.load('sheets', 'v4', (response) => {
                    if (response && response.error) {
                        console.error('Sheets API load error:', response.error);
                        reject(new Error(`Failed to load Sheets API: ${response.error.message}`));
                    } else {
                        console.log('Sheets API loaded successfully');
                        resolve();
                    }
                });
            });
            
            if (!window.gapi.client.sheets) {
                throw new Error('Sheets API not available after loading');
            }
            
        } catch (error) {
            console.error('Failed to load Sheets API:', error);
            throw error;
        }
    }
    
    handleAuthChange(isSignedIn) {
        console.log('Auth state changed:', isSignedIn);
        if (isSignedIn) {
            console.log('User authenticated with access token');
            // Set the access token for API requests
            window.gapi.client.setToken({
                access_token: this.accessToken
            });
        } else {
            console.log('User not authenticated');
            this.accessToken = null;
            window.gapi.client.setToken(null);
        }
    }
    
    async authenticate() {
        try {
            console.log('Starting authentication with Google Identity Services...');
            
            if (this.isAuthenticated()) {
                console.log('Already authenticated');
                return true;
            }
            
            if (!this.tokenClient) {
                throw new Error('Token client not initialized');
            }
            
            return new Promise((resolve, reject) => {
                // Set up one-time callback for this authentication attempt
                const originalCallback = this.tokenClient.callback;
                
                this.tokenClient.callback = (response) => {
                    // Restore original callback
                    this.tokenClient.callback = originalCallback;
                    
                    if (response.error) {
                        console.error('Authentication failed:', response.error);
                        reject(new Error(`Authentication failed: ${response.error}`));
                        return;
                    }
                    
                    console.log('Authentication successful');
                    this.accessToken = response.access_token;
                    this.handleAuthChange(true);
                    resolve(true);
                };
                
                // Request access token
                console.log('Requesting access token...');
                this.tokenClient.requestAccessToken({
                    prompt: 'consent' // Force account selection
                });
            });
            
        } catch (error) {
            console.error('Authentication failed:', error);
            throw new Error(`Failed to authenticate with Google: ${error.message}`);
        }
    }
    
    async signOut() {
        if (this.accessToken && window.google?.accounts?.oauth2) {
            window.google.accounts.oauth2.revoke(this.accessToken);
        }
        this.accessToken = null;
        this.currentUser = null;
        this.handleAuthChange(false);
        console.log('Signed out successfully');
    }
    
    isAuthenticated() {
        return !!this.accessToken;
    }
    
    getCurrentUser() {
        // With GIS, we don't get user profile automatically
        // You would need to make a separate API call to get user info
        return this.currentUser;
    }
    
    // Essential API methods
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
        if (!this.apiLoaded || !this.gapiClient || !this.gapiClient.sheets) {
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
