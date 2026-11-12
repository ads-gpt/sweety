import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import authRoutes from './routes/auth.js';
import readingRoutes from './routes/readings.js';
import reportRoutes from './routes/reports.js';
import accountRoutes from './routes/account.js';
import doctorRoutes from './routes/doctor.js';
import docsRoutes from './routes/docs.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { allowedOrigins, csrfGuard, noStore } from './middleware/security.js';

export function createApp() {
  const app = express();
  if (config.isProd) app.set('trust proxy', 1); // behind nginx / a load balancer: real client IPs for rate limiting

  // One structured JSON line per request, with a request id (also returned as X-Request-Id).
  app.use(pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = String(req.headers['x-request-id'] || '').slice(0, 64) || crypto.randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    customProps: (req) => (req.user ? { userId: req.user.id } : {}),
    // Paths only: query strings can carry personal data, and cookies/auth headers are redacted.
    serializers: { req: (req) => ({ id: req.id, method: req.method, url: req.url.split('?')[0] }), res: (res) => ({ statusCode: res.statusCode }) },
    autoLogging: { ignore: (req) => req.url === '/api/health' },
  }));

  // API docs get a slightly looser CSP (Swagger UI needs inline styles); everything else is strict.
  app.use('/api/docs', helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'] } } }), docsRoutes);
  app.use(helmet());
  app.use(cors({ origin: allowedOrigins(), credentials: true }));
  app.use(express.json({ limit: '50kb' }));

  if (config.env !== 'test') {
    app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: config.authRateLimit, standardHeaders: true, legacyHeaders: false }));
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', noStore, csrfGuard);
  app.use('/api', authRoutes, accountRoutes, readingRoutes, reportRoutes, doctorRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
