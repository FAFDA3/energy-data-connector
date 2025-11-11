import { Router } from 'express';
import { loadConfig } from '../config/index.js';

const router = Router();
const config = loadConfig();

router.get('/', (_req, res) => {
  res.json({ ok: true, version: '0.1.0', logLevel: config.connector.logLevel });
});

export const healthRouter = router;
