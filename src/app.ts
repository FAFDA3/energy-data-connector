import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { healthRouter } from './routes/health.js';
import { sessionRouter } from './routes/session.js';
import { bulkRouter } from './routes/bulk.js';
import { anchorRouter } from './routes/anchor.js';
import { configRouter } from './routes/config.js';
import { storageRouter } from './routes/storage.js';
import { authMiddleware } from './middleware/auth.js';
import { loadConfig } from './config/index.js';

const app = express();
const config = loadConfig();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(helmet());
app.use(
  cors({
    origin: config.connector.allowedOrigins,
    credentials: false,
  }),
);
app.use(express.json({ limit: '5mb' }));
app.use(morgan('combined'));

// Servi file statici per frontend
app.use(express.static(join(__dirname, '../public')));

app.use('/health', healthRouter);
app.use('/session', sessionRouter);
app.use('/api/config', configRouter); // API config (pubblica per ora)
app.use('/storage', storageRouter); // Storage pubblico (auth via blockchain signature)
app.use(authMiddleware); // Tutte le route dopo questo richiedono autenticazione
app.use('/bulk', bulkRouter);
app.use('/anchor', anchorRouter);

// Fallback: serva index.html per SPA (solo se non è una route API)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/health') || req.path.startsWith('/session') || req.path.startsWith('/bulk') || req.path.startsWith('/anchor') || req.path.startsWith('/storage')) {
    return next();
  }
  res.sendFile(join(__dirname, '../public/index.html'));
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export { app };
