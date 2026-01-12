const puppeteer = require('puppeteer');
const redisClient = require('./redis_client');

class AgencyService {
    constructor() {
        this.browser = null;
        this.page = null;
        this.processing = false;
    }

    async initialize() {
        if (this.browser && this.browser.isConnected()) return;

        console.log('Initializing Agency Service browser...');
        this.browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });
        
        console.log(`Agency Service Browser PID: ${this.browser.process().pid}`);

        this.page = await this.browser.newPage();
        
        // Set a real User-Agent
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Block unnecessary resources to speed up
        await this.page.setRequestInterception(true);
        this.page.on('request', (req) => {
            if (req.isInterceptResolutionHandled()) return;

            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort().catch(() => {});
            } else {
                req.continue().catch(() => {});
            }
        });
        
        // Log specific API calls for monitoring (optional)
        this.page.on('response', response => {
            const url = response.url();
            if (url.includes('agencias/listar') && response.request().method() === 'POST') {
                // console.log(`[DEBUG] Agencies loaded from: ${url}`);
            }
        });
    }

    async getAgencies() {
        // Check cache first
        try {
            const cachedData = await redisClient.get('agencies_list');
            if (cachedData) {
                console.log('Returning agencies from Redis cache');
                return JSON.parse(cachedData);
            }
        } catch (err) {
            console.error('Redis error (get):', err);
        }

        // Queue mechanism: Wait if currently processing
        while (this.processing) {
            await new Promise(r => setTimeout(r, 100));
        }

        this.processing = true;

        try {
            // Ensure browser is alive
            if (!this.browser || !this.browser.isConnected()) {
                await this.initialize();
            }

            console.log('Navigating to agencias.shalom.pe...');
            
            let responseHandler = null;

            // SETUP RESPONSE INTERCEPTION (More robust pattern)
            const apiResponsePromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    resolve(null); 
                }, 30000); // 30s timeout

                responseHandler = async (response) => {
                    const url = response.url();
                    const method = response.request().method();
                    
                    // Debug logs
                    if (url.includes('shalom') || url.includes('agencias')) {
                        console.log(`[DEBUG] Response received: ${method} ${url}`);
                    }

                    if (url.includes('agencias') && url.includes('listar') && method !== 'OPTIONS') {
                        console.log('[DEBUG] Matched Agencies API URL:', url);
                        try {
                            const json = await response.json();
                            console.log('[DEBUG] Agencies API Response captured successfully');
                            clearTimeout(timeout);
                            resolve(json);
                        } catch (e) {
                            console.log('[DEBUG] Error parsing JSON:', e.message);
                        }
                    }
                };

                this.page.on('response', responseHandler);
            });

            // We use goto to trigger the load. If we are already there, reload might be needed to trigger the API call again.
            await this.page.goto('https://agencias.shalom.pe/', { waitUntil: 'networkidle2' });

            console.log('Waiting for agency API response...');
            const apiResult = await apiResponsePromise;
            
            if (!apiResult) {
                 throw new Error('Timeout waiting for Agency API response (or received null)');
            }

            // Cache the result
            try {
                await redisClient.set('agencies_list', JSON.stringify(apiResult), { EX: 86400 }); // Cache for 24 hours
                console.log('Agencies cached in Redis');
            } catch (err) {
                console.error('Redis error (set):', err);
            }

            return apiResult;

        } catch (error) {
            console.error('Error getting agencies:', error);
            // If browser looks dead, reset
            if (this.browser && !this.browser.isConnected()) {
                this.browser = null;
            }
            throw error;
        } finally {
             // Cleanup listener
             if (this.page && responseHandler) {
                this.page.off('response', responseHandler);
            }
            this.processing = false;
        }
    }
}

module.exports = new AgencyService();
