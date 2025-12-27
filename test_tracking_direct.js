const tracker = require('./tracker');

(async () => {
    try {
        console.log('Iniciando prueba directa de tracking...');
        await tracker.initialize();
        console.log('Tracker inicializado. Ejecutando búsqueda...');
        
        // Datos tomados del log de error del usuario
        const result = await tracker.trackPackage('66479331', '3KTH');
        
        console.log('Resultado:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error en prueba directa:', error);
    } finally {
        process.exit();
    }
})();
