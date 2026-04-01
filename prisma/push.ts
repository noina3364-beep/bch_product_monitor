import { spawn } from 'node:child_process';
import path from 'node:path';

function run(command: string, input?: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr || stdout || `Command failed with exit code ${code}`));
    });

    if (input) {
      child.stdin.write(input);
    }

    child.stdin.end();
  });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? 'file:./dev.db';
  const resolvedDatabaseUrl = databaseUrl.startsWith('file:./')
    ? `file:${path.resolve('prisma', databaseUrl.slice('file:'.length)).replace(/\\/g, '/')}`
    : databaseUrl;

  process.env.DATABASE_URL = resolvedDatabaseUrl;
  const sql = await run(
    `npx prisma migrate diff --from-url "${resolvedDatabaseUrl}" --to-schema-datamodel prisma/schema.prisma --script`,
  );

  await run('npx prisma db execute --stdin --schema prisma/schema.prisma', sql);

  console.log('Prisma schema applied successfully.');
}

main().catch((error) => {
  console.error('Prisma push failed');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
