import readline from 'node:readline/promises';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../server/src/auth.js';

async function main() {
  const prisma = new PrismaClient();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log('Note: password input is visible in this helper.');
    const usernameInput = (await rl.question('Editor username [editor]: ')).trim();
    const username = usernameInput || 'editor';

    const password = (await rl.question('New password: ')).trim();
    const confirmPassword = (await rl.question('Confirm password: ')).trim();

    if (!password) {
      throw new Error('Password cannot be empty.');
    }

    if (password !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, role: true },
    });

    if (!user || user.role !== 'editor') {
      throw new Error(`Editor user "${username}" was not found.`);
    }

    await prisma.user.update({
      where: { username },
      data: {
        passwordHash: await hashPassword(password),
      },
    });

    console.log(`Password updated for editor user "${username}".`);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
