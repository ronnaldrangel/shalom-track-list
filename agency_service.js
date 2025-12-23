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
            const apiResponsePromise = this.page.waitForResponse(response => 
                response.url().includes('servicesweb.shalomapi.com/api/v1/web/agencias/listar') && 
                response.status() === 200
            , { timeout: 30000 });

            // We use goto to trigger the load. If we are already there, reload might be needed to trigger the API call again.
            await this.page.goto('https://agencias.shalom.pe/', { waitUntil: 'networkidle2' });

            console.log('Waiting for agency API response...');
            const response = await apiResponsePromise;
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
