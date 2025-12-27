const agencyService = require('./agency_service');

(async () => {
    try {
        console.log('Iniciando prueba de agencias...');
        const agencies = await agencyService.getAgencies();
        console.log(`Se encontraron ${agencies.length} agencias (o estructura de respuesta).`);
        console.log('Muestra:', JSON.stringify(agencies).substring(0, 200) + '...');
    } catch (error) {
        console.error('Error en prueba de agencias:', error);
    } finally {
        process.exit();
    }
})();
