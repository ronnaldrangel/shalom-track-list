const { createClient } = require('redis');
require('dotenv').config();

// Connection string from env
const REDIS_URL = process.env.REDIS_URL;

const client = createClient({
    url: REDIS_URL
});

client.on('error', (err) => console.error('Redis Client Error', err));
client.on('connect', () => console.log('Redis Client Connected'));

// Initialize connection
(async () => {
    try {
        await client.connect();
    } catch (err) {
        console.error('Failed to connect to Redis:', err);
    }
})();

module.exports = client;
