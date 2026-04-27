import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import config from './config/index.js';
import webhookRoutes from './api/webhook.js';
import apiRoutes from './api/routes.js';
import devRoutes from './api/dev.js';
import { securityHeaders } from './middleware/security.js';
import { startReminderService } from './services/reminders.js';
import { prisma } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy:
      config.nodeEnv === 'production'
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(securityHeaders);
app.use(morgan(':method :url :status :response-time ms'));

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser clients and server-to-server traffic.
    if (!origin) {
      return callback(null, true);
    }

    if (config.security.allowedOrigins.length === 0) {
      return callback(null, true);
    }

    if (config.security.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('CORS origin not allowed'));
  },
};

app.use(cors(corsOptions));

app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.use(express.json({ limit: '50kb' }));

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

if (config.nodeEnv === 'development') {
  app.use(express.static(path.join(__dirname, '..', 'public')));
}

app.use('/api/webhook', webhookRoutes);
app.use('/api', apiRoutes);

if (config.nodeEnv === 'development') {
  app.use('/api/dev', devRoutes);
} else {
  app.use('/api/dev', (_req, res) => res.status(404).json({ error: 'Not found' }));
}

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(config.port, async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log(`Server started on http://localhost:${config.port}`);
    console.log(`Webhook endpoint: /api/webhook/whatsapp`);
    if (config.nodeEnv === 'development') {
      console.log(`Dev simulator: /api/dev/simulate`);
    }
    startReminderService();
  } catch (error) {
    console.error('Failed to connect to database:', error.message);
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  });
}

export default app;
