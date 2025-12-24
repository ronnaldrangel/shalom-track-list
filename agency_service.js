const puppeteer = require('puppeteer');

class AgencyService {
    constructor() {
        this.browser = null;
        this.page = null;
        this.processing = false;
        this.cachedAgencies = null;
        this.lastCacheTime = 0;
        this.CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    }

    async initialize() {
        if (this.browser && this.browser.isConnected()) return;

        console.log('Initializing Agency Service browser...');
        this.browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        console.log(`Agency Service Browser PID: ${this.browser.process().pid}`);

        this.page = await this.browser.newPage();
        
        // Block unnecessary resources to speed up
        await this.page.setRequestInterception(true);
        this.page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Disable cache to ensure API requests are always fresh and triggered
        await this.page.setCacheEnabled(false);
    }

    async getAgencies() {
        // Return cached data if available and not expired
        // const now = Date.now();
        // if (this.cachedAgencies && (now - this.lastCacheTime < this.CACHE_TTL)) {
        //     console.log('Returning cached agencies data (Fresh).');
        //     return this.cachedAgencies;
        // } else if (this.cachedAgencies) {
        //     console.log('Cache expired. Fetching fresh data...');
        // }
        console.log('Cache DISABLED for testing. Fetching fresh data...');

        // Queue mechanism: Wait if currently processing
        while (this.processing) {
            await new Promise(r => setTimeout(r, 100));
        }

        this.processing = true;

        try {
            // Force close existing browser if any, to ensure we start fresh
            if (this.browser) {
                console.log('Closing existing browser session...');
                await this.browser.close();
                this.browser = null;
                this.page = null;
            }

            // Initialize a NEW browser instance
            await this.initialize();

            console.log('Preparing to fetch agencies...');
            
            // Define the target API URL part we are looking for
            // The API URL might have changed or is dynamic. Let's capture ALL XHR/Fetch responses to debug.
            const apiUrlPart = 'web/agencias/listar'; 

            // Setup response listener before navigation
            const apiResponsePromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    this.page.off('response', responseHandler);
                    reject(new Error('Timeout waiting for API response.'));
                }, 30000);

                const responseHandler = async (response) => {
                    try {
                        const url = response.url();
                        const resourceType = response.request().resourceType();
                        
                        // Log interesting requests to debug
                        if (resourceType === 'fetch' || resourceType === 'xhr') {
                            console.log(`[DEBUG] Network Response: ${url} (${response.status()})`);
                        }

                        if (url.includes(apiUrlPart) && response.status() === 200) {
                            console.log('MATCHED API Response:', url);
                            clearTimeout(timeout);
                            this.page.off('response', responseHandler);
                            try {
                                const data = await response.json();
                                resolve(data);
                            } catch (e) {
                                console.error('JSON Parse Error:', e);
                                reject(new Error('Failed to parse JSON: ' + e.message));
                            }
                        }
                    } catch (err) {
                        // Ignore errors from accessing response details if context is destroyed
                    }
                };

                this.page.on('response', responseHandler);
            });

            const targetUrl = 'https://agencias.shalom.pe/';
            
            // Always force a fresh navigation cycle to ensure network requests trigger
            console.log('Forcing fresh navigation via about:blank...');
            await this.page.goto('about:blank');
            
            console.log('Navigating to agencias.shalom.pe...');
            await this.page.goto(targetUrl, { waitUntil: 'networkidle0' }); // Changed to networkidle0 to wait for ALL traffic to settle

            console.log('Waiting for agency API response...');
            const data = await apiResponsePromise;
            
            // Cache the successful response
            if (data) {
                this.cachedAgencies = data;
                this.lastCacheTime = Date.now();
            }

            return data;

        } catch (error) {
            console.error('Error getting agencies:', error);
            throw error;
        } finally {
            // ALWAYS close the browser after fetching to save resources and ensure next run is fresh
            if (this.browser) {
                console.log('Closing browser to save resources...');
                await this.browser.close();
                this.browser = null;
                this.page = null;
            }
            this.processing = false;
        }
    }
}

module.exports = new AgencyService();
