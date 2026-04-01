import 'dotenv/config';
import path from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default('file:./dev.db'),
  PORT: z.coerce.number().int().positive().default(3001),
  CLIENT_ORIGIN: z.string().min(1).default('http://localhost:3000'),
});

const rawEnv = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: process.env.PORT,
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN,
});

const databaseUrl = rawEnv.DATABASE_URL.startsWith('file:./')
  ? `file:${path.resolve('prisma', rawEnv.DATABASE_URL.slice('file:'.length)).replace(/\\/g, '/')}`
  : rawEnv.DATABASE_URL;

process.env.DATABASE_URL = databaseUrl;
process.env.PORT ??= String(rawEnv.PORT);
process.env.CLIENT_ORIGIN ??= rawEnv.CLIENT_ORIGIN;

export const env = {
  ...rawEnv,
  DATABASE_URL: databaseUrl,
};
