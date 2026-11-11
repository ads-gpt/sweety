import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import readingRoutes from './routes/readings.js';
import reportRoutes from './routes/reports.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin.split(',') }));
  app.use(express.json({ limit: '50kb' }));

  if (config.env !== 'test') {
    app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }));
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', authRoutes, readingRoutes, reportRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
