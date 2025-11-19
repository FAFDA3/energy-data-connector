import { Router } from 'express';
import { loadConfig } from '../config/index.js';
import { testConnection } from '../services/influx.js';

const router = Router();
const config = loadConfig();

router.get('/', (_req, res) => {
  res.json({ ok: true, version: '0.1.0', logLevel: config.connector.logLevel });
});

router.get('/influx', async (_req, res) => {
  try {
    const isConnected = await testConnection();
    return res.json({
      ok: isConnected,
      influxDb: {
        connected: isConnected,
        url: config.influxDefault.url,
        org: config.influxDefault.org,
        bucket: config.influxDefault.bucket,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export const healthRouter = router;
