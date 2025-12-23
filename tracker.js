const puppeteer = require('puppeteer');
require('dotenv').config();

class ShalomTracker {
    constructor() {
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        this.processing = false; // Simple lock
        this.credentials = {
            username: process.env.SHALOM_USER,
            password: process.env.SHALOM_PASS
        };
    }

    async initialize() {
        if (this.browser && this.browser.isConnected()) return;

        console.log('Initializing persistent browser...');
        this.browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        console.log(`Tracker Browser PID: ${this.browser.process().pid}`);

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

        await this.login();
    }

    async login() {
        try {
            console.log('Navigating to rastrea.shalom.pe...');
            await this.page.goto('https://rastrea.shalom.pe/', { waitUntil: 'networkidle2' });

            const isLoginPage = await this.page.evaluate(() => {
                return !!document.querySelector('input[type="email"]');
            });

            if (isLoginPage) {
                console.log('Login page detected. Logging in...');
                if (!this.credentials.username || !this.credentials.password) {
                    throw new Error('Login required. Please check .env credentials.');
                }

                await this.page.type('input[type="email"]', this.credentials.username);
                await this.page.type('input[type="password"]', this.credentials.password);
                
                const loginButton = await this.page.evaluateHandle(() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    return buttons.find(b => b.innerText.includes('Ingresar'));
                });

                if (loginButton) {
                    await Promise.all([
                        this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
                        loginButton.click()
                    ]);
                    console.log('Login successful.');
                } else {
                    throw new Error('Login button not found');
                }
            } else {
                console.log('Already logged in or no login required.');
            }
            this.isLoggedIn = true;
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    }

    async trackPackage(orderNumber, orderCode) {
        // Queue mechanism: Wait if currently processing
        while (this.processing) {
            await new Promise(r => setTimeout(r, 100));
        }
        
        this.processing = true;
        let responseHandler = null;

        try {
            // Ensure browser is alive
            if (!this.browser || !this.browser.isConnected()) {
                await this.initialize();
            } else if (!this.isLoggedIn) {
                await this.login();
            }

            // Ensure we are on the tracker page
            const url = this.page.url();
            if (!url.includes('rastrea.shalom.pe')) {
                console.log('Page not on tracker. Navigating back...');
                await this.login(); 
            }

            console.log(`Tracking ${orderNumber} - ${orderCode}...`);
            
            // Wait for content to be ready
            // await new Promise(r => setTimeout(r, 1000)); // Reduced wait time

            // Inputs
            const orderNumberSelector = 'input[placeholder="N° de Orden"]';
            const orderCodeSelector = 'input[placeholder="Código de Orden"]';

            await this.page.waitForSelector(orderNumberSelector, { timeout: 5000 });
            
            // Force set values via evaluate (Robust method for Vue/React)
            await this.page.evaluate((sel, val) => { 
                const el = document.querySelector(sel);
                if(el) {
                    el.value = val;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new Event('blur', { bubbles: true }));
                }
            }, orderNumberSelector, orderNumber);

            await this.page.evaluate((sel, val) => { 
                const el = document.querySelector(sel);
                if(el) {
                    el.value = val;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new Event('blur', { bubbles: true }));
                }
            }, orderCodeSelector, orderCode);
            
            // Wait for Vue to react
            await new Promise(r => setTimeout(r, 200));
            
            // Find the "Buscar" button
            const searchButton = await this.page.evaluateHandle(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.find(b => b.innerText.trim() === 'Buscar');
            });

            if (!searchButton) {
                throw new Error('Search button not found');
            }

            // SETUP RESPONSE INTERCEPTION
            const apiResponsePromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    resolve(null); 
                }, 8000); // 8s timeout

                responseHandler = async (response) => {
                    const url = response.url();
                    if (url.includes('shalomapi.com') && url.includes('rastrea') && response.request().method() === 'POST') {
                        try {
                            const json = await response.json();
                            clearTimeout(timeout);
                            resolve(json);
                        } catch (e) {
                            // ignore parsing errors
                        }
                    }
                };

                this.page.on('response', responseHandler);
            });
            
            // Click search
            await this.page.evaluate((btn) => btn.click(), searchButton);
            
            const apiResult = await apiResponsePromise;

            if (!apiResult) {
                throw new Error('Timeout waiting for API response (or received null)');
            }

            return apiResult;

        } catch (error) {
            console.error("Error during tracking:", error);
            // If error is critical (e.g. browser disconnected), reset state
            if (error.message.includes('Session closed') || error.message.includes('Target closed')) {
                this.browser = null;
                this.isLoggedIn = false;
            }
            throw error;
        } finally {
            // Cleanup listener
            if (responseHandler) {
                this.page.off('response', responseHandler);
            }
            this.processing = false;
        }
    }
}

// Singleton instance
const tracker = new ShalomTracker();

module.exports = tracker;
