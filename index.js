require('dotenv').config();
const express = require('express');
const tracker = require('./tracker');
const agencyService = require('./agency_service');
const redisClient = require('./redis_client');

const app = express();
app.use(express.json());

// Initialize tracker on startup
tracker.initialize().catch(err => {
    console.error('Failed to initialize tracker:', err);
});
// Initialize agency service on startup (optional, but good for speed)
agencyService.initialize().catch(err => {
    console.error('Failed to initialize agency service:', err);
});

app.post('/track', async (req, res) => {
  const { orderNumber, orderCode } = req.body;

  if (!orderNumber || !orderCode) {
    return res.status(400).json({ error: 'Both orderNumber and orderCode are required' });
  }

  try {
      const result = await tracker.trackPackage(orderNumber, orderCode);
      res.json(result);
  } catch (error) {
    console.error('Tracking error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/list', async (req, res) => {
    try {
        const result = await agencyService.getAgencies();
        res.json(result);
    } catch (error) {
        console.error('Agencies list error:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (redisClient.isOpen) {
      console.log('✅ Redis is connected');
  } else {
      console.log('⏳ Waiting for Redis connection...');
  }
});
