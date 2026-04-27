import dotenv from 'dotenv';

dotenv.config();

const toInt = (value, fallback) => {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) ? num : fallback;
};

const parseAllowedPhones = (value) =>
  (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const parseAllowedOrigins = (value) =>
  (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3000),
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  dashboardApiKey: process.env.DASHBOARD_API_KEY || '',
  ai: {
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'claude-sonnet-4-20250514',
    baseUrl: process.env.AI_BASE_URL || 'https://api.anthropic.com/v1',
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886',
  },
  rateLimit: {
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    maxRequests: toInt(process.env.RATE_LIMIT_MAX, 120),
  },
  security: {
    maxMessageLength: toInt(process.env.MAX_MESSAGE_LENGTH, 2000),
    allowedPhones: parseAllowedPhones(process.env.ALLOWED_PHONES),
    blockPromptInjection: (process.env.BLOCK_PROMPT_INJECTION || 'true') === 'true',
    allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
  },
  reminderCron: process.env.REMINDER_CRON || '*/10 * * * *',
};

export default config;
