const puppeteer = require('puppeteer');

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
            
            // Setup response listener before navigation to catch it early if it fires quickly
            // Updated to be more flexible with domain changes
            const apiResponsePromise = this.page.waitForResponse(response => 
                response.url().includes('agencias') && 
                response.url().includes('listar') &&
                response.request().method() !== 'OPTIONS'
            , { timeout: 30000 });

            // We use goto to trigger the load. If we are already there, reload might be needed to trigger the API call again.
            await this.page.goto('https://agencias.shalom.pe/', { waitUntil: 'networkidle2' });

            console.log('Waiting for agency API response...');
            const response = await apiResponsePromise;
            
            if (response.status() !== 200) {
                console.error(`Agency API returned error status: ${response.status()} ${response.statusText()}`);
                // Try to get error body
                try {
                    const text = await response.text();
                    console.error('Error body:', text.substring(0, 500));
                } catch (e) {}
                throw new Error(`Agency API returned status ${response.status()}`);
            }

            const data = await response.json();
            
            return data;

        } catch (error) {
            console.error('Error getting agencies:', error);
            // If browser looks dead, reset
            if (this.browser && !this.browser.isConnected()) {
                this.browser = null;
            }
            throw error;
        } finally {
            this.processing = false;
        }
    }
}

module.exports = new AgencyService();
