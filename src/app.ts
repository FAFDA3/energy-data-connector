import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { healthRouter } from './routes/health.js';
import { sessionRouter } from './routes/session.js';
import { bulkRouter } from './routes/bulk.js';
import { anchorRouter } from './routes/anchor.js';
import { authMiddleware } from './middleware/auth.js';
import { loadConfig } from './config/index.js';

const app = express();
const config = loadConfig();

app.use(helmet());
app.use(
  cors({
    origin: config.connector.allowedOrigins,
    credentials: false,
  }),
);
app.use(express.json({ limit: '5mb' }));
app.use(morgan('combined'));

app.use('/health', healthRouter);
app.use('/session', sessionRouter);
app.use(authMiddleware); // Tutte le route dopo questo richiedono autenticazione
app.use('/bulk', bulkRouter);
app.use('/anchor', anchorRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export { app };
