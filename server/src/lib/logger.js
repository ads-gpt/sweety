import pino from 'pino';
import { config } from '../config.js';

// JSON lines in production / CI (easy to ship to a log service); readable output when developing.
const pretty = !config.isProd && config.env !== 'test' && !process.env.CI;

export const logger = pino({
  level: config.logLevel,
  redact: { paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'], censor: '[redacted]' },
  ...(pretty ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } } : {}),
});
