import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Admin } from '../models/Admin.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';

async function provisionAdmin(): Promise<void> {
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !email || !password) {
    throw new Error('Set ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD in the environment before provisioning.');
  }
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
    throw new Error('ADMIN_USERNAME must be 3–32 lowercase letters, numbers, dots, underscores, or hyphens.');
  }
  z.string().email().parse(email);
  if (password.length < 14 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('ADMIN_PASSWORD must be at least 14 characters and contain uppercase, lowercase, and numeric characters.');
  }

  await connectDatabase();
  if (await Admin.exists({ $or: [{ username }, { email }] })) {
    throw new Error('An administrator with this username or email already exists; no account was changed.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await Admin.create({ username, email, passwordHash, role: 'superadmin' });
  console.log(`Provisioned administrator "${username}".`);
}

provisionAdmin()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Administrator provisioning failed.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
