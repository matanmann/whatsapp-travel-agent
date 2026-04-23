import { execSync } from 'node:child_process';

function run(command) {
  execSync(command, { stdio: 'inherit' });
}

try {
  run('npx prisma generate');
  run('npx prisma migrate deploy');
  console.log('Database initialized successfully.');
} catch (error) {
  console.error('Database initialization failed.');
  process.exit(1);
}
