import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const DATABASE_URL_KEYS = [
  'DATABASE_URL',
  'DATABASE_PUBLIC_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
];

const isLocalPostgresUrl = (value) => {
  if (!value) return false;

  try {
    const url = new URL(value);
    return ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch {
    return false;
  }
};

const resolveDatabaseUrl = () => {
  const candidates = DATABASE_URL_KEYS
    .map((key) => [key, process.env[key]])
    .filter(([, value]) => Boolean(value));

  const preferred = candidates.find(([, value]) => !isLocalPostgresUrl(value));
  const selected = preferred || candidates[0];

  if (!selected) {
    throw new Error(
      `Missing database configuration. Set one of: ${DATABASE_URL_KEYS.join(', ')}`
    );
  }

  const [sourceKey, databaseUrl] = selected;

  if (process.env.NODE_ENV === 'production' && isLocalPostgresUrl(databaseUrl) && !preferred) {
    throw new Error(
      `Invalid production database configuration from ${sourceKey}: localhost is not reachable from Railway.`
    );
  }

  process.env.DATABASE_URL = databaseUrl;
  return { sourceKey, databaseUrl };
};

const { sourceKey } = resolveDatabaseUrl();

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'test') {
  console.log(`Prisma database URL resolved from ${sourceKey}`);
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
