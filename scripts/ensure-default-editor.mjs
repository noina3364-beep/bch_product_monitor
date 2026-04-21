import 'dotenv/config';
import path from 'node:path';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';

const scrypt = promisify(scryptCallback);
const DEFAULT_EDITOR_USERNAME = 'editor';
const DEFAULT_EDITOR_PASSWORD = 'ChangeMe123!';
const databaseUrl = process.env.DATABASE_URL ?? 'file:./dev.db';

process.env.DATABASE_URL = databaseUrl.startsWith('file:./')
  ? `file:${path.resolve('prisma', databaseUrl.slice('file:'.length)).replace(/\\/g, '/')}`
  : databaseUrl;

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function main() {
  const prisma = new PrismaClient();

  try {
    const existingUser = await prisma.user.findUnique({
      where: { username: DEFAULT_EDITOR_USERNAME },
      select: { id: true },
    });

    if (existingUser) {
      console.log(`Default Editor user "${DEFAULT_EDITOR_USERNAME}" already exists.`);
      return;
    }

    await prisma.user.create({
      data: {
        username: DEFAULT_EDITOR_USERNAME,
        passwordHash: await hashPassword(DEFAULT_EDITOR_PASSWORD),
        role: 'editor',
      },
    });

    console.log(`Created default Editor user "${DEFAULT_EDITOR_USERNAME}".`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
