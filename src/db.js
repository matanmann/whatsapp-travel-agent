import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const DATABASE_URL_KEYS = [
  'DATABASE_URL',
  'DATABASE_PUBLIC_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
];

const buildDatabaseUrlFromParts = () => {
  const host = process.env.PGHOST;
  const port = process.env.PGPORT;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;
  const database = process.env.PGDATABASE;

  if (!host || !port || !user || !password || !database) {
    return null;
  }

  const url = new URL('postgresql://localhost');
  url.hostname = host;
  url.port = String(port);
  url.username = user;
  url.password = password;
  url.pathname = `/${database}`;

  return url.toString();
};

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
  const derivedDatabaseUrl = buildDatabaseUrlFromParts();
  const candidates = DATABASE_URL_KEYS
    .map((key) => [key, process.env[key]])
    .filter(([, value]) => Boolean(value));

  if (derivedDatabaseUrl) {
    candidates.unshift(['PG*', derivedDatabaseUrl]);
  }

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

const { sourceKey, databaseUrl } = resolveDatabaseUrl();

const safeDatabaseTarget = (() => {
  try {
    const parsed = new URL(databaseUrl);
    return `${parsed.hostname}:${parsed.port || '5432'}`;
  } catch {
    return 'unparseable';
  }
})();

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'test') {
  console.log(`Prisma database URL resolved from ${sourceKey} -> ${safeDatabaseTarget}`);
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
