const puppeteer = require('puppeteer');

(async () => {
    console.log('Iniciando prueba de conexión...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Simular lo que hace tracker.js
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        console.log('Navegando a https://rastrea.shalom.pe/ ...');
        await page.goto('https://rastrea.shalom.pe/', { waitUntil: 'networkidle2' });
        console.log('Navegación exitosa.');
        
    } catch (error) {
        console.error('Error durante la navegación:', error);
    } finally {
        await browser.close();
    }
})();
