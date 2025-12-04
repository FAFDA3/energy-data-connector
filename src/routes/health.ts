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

// GET /health/client-ip - Ottiene l'IP del client
router.get('/client-ip', (req, res) => {
  // Prova a ottenere l'IP da vari header (per proxy/load balancer)
  let clientIP = 
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
    req.headers['x-real-ip']?.toString() ||
    req.socket.remoteAddress ||
    req.ip ||
    'unknown';
  
  // Converti IPv6 localhost (::1) o IPv6 mapped IPv4 (::ffff:127.0.0.1) in IPv4
  if (clientIP === '::1' || clientIP === '::ffff:127.0.0.1' || clientIP.startsWith('::ffff:')) {
    if (clientIP.startsWith('::ffff:')) {
      clientIP = clientIP.replace('::ffff:', '');
    } else {
      clientIP = '127.0.0.1';
    }
  }
  
  // Se è ancora IPv6, prova a ottenere IPv4 dalla connessione
  if (clientIP.includes(':')) {
    const socket = req.socket;
    if (socket.remoteFamily === 'IPv4') {
      // Cerca l'IP IPv4 nella connessione
      const address = socket.remoteAddress;
      if (address && !address.includes(':')) {
        clientIP = address;
      } else {
        clientIP = '127.0.0.1'; // Fallback
      }
    } else {
      clientIP = '127.0.0.1'; // Fallback per IPv6
    }
  }
  
  return res.json({ 
    ip: clientIP,
    detectedFrom: {
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-real-ip': req.headers['x-real-ip'],
      'socket.remoteAddress': req.socket.remoteAddress,
      'req.ip': req.ip,
    }
  });
});

export const healthRouter = router;
