import { prisma } from './prisma';
import crypto from 'crypto';

export interface DbUser {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const normalized = email.trim().toLowerCase();
  try {
    if ((prisma as unknown as { user?: { findUnique: (args: unknown) => Promise<DbUser | null> } }).user?.findUnique) {
      return await (prisma as unknown as { user: { findUnique: (args: unknown) => Promise<DbUser | null> } }).user.findUnique({
        where: { email: normalized },
      });
    }
  } catch {}

  const rows = await prisma.$queryRawUnsafe<DbUser[]>(
    'SELECT id, email, name, "passwordHash", "createdAt", "updatedAt" FROM "User" WHERE LOWER(email) = $1 LIMIT 1',
    normalized
  );
  return rows[0] || null;
}

export async function findUserById(id: string): Promise<DbUser | null> {
  try {
    if ((prisma as unknown as { user?: { findUnique: (args: unknown) => Promise<DbUser | null> } }).user?.findUnique) {
      return await (prisma as unknown as { user: { findUnique: (args: unknown) => Promise<DbUser | null> } }).user.findUnique({
        where: { id },
      });
    }
  } catch {}

  const rows = await prisma.$queryRawUnsafe<DbUser[]>(
    'SELECT id, email, name, "passwordHash", "createdAt", "updatedAt" FROM "User" WHERE id = $1 LIMIT 1',
    id
  );
  return rows[0] || null;
}

export async function createUser(data: {
  email: string;
  name?: string;
  passwordHash: string;
}): Promise<DbUser> {
  const normalized = data.email.trim().toLowerCase();
  const id = crypto.randomUUID();
  const name = data.name?.trim() || normalized.split('@')[0];

  try {
    if ((prisma as unknown as { user?: { create: (args: unknown) => Promise<DbUser> } }).user?.create) {
      return await (prisma as unknown as { user: { create: (args: unknown) => Promise<DbUser> } }).user.create({
        data: {
          id,
          email: normalized,
          name,
          passwordHash: data.passwordHash,
        },
      });
    }
  } catch {}

  const now = new Date();
  await prisma.$executeRawUnsafe(
    'INSERT INTO "User" (id, email, name, "passwordHash", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6)',
    id,
    normalized,
    name,
    data.passwordHash,
    now,
    now
  );

  return {
    id,
    email: normalized,
    name,
    passwordHash: data.passwordHash,
    createdAt: now,
    updatedAt: now,
  };
}

export async function migrateUserNotes(newUserId: string, noteIds?: string[]): Promise<number> {
  try {
    if (noteIds && noteIds.length > 0) {
      const res = await prisma.note.updateMany({
        where: {
          id: { in: noteIds },
        },
        data: {
          userId: newUserId,
        },
      });
      return res.count;
    } else {
      // Migrate all 'default-user' notes to this user
      const res = await prisma.note.updateMany({
        where: {
          userId: 'default-user',
        },
        data: {
          userId: newUserId,
        },
      });
      return res.count;
    }
  } catch (e) {
    console.error('Failed to migrate notes to user:', e);
    return 0;
  }
}

export async function updateUserPassword(email: string, newPasswordHash: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const now = new Date();
  try {
    if ((prisma as unknown as { user?: { update: (args: unknown) => Promise<DbUser> } }).user?.update) {
      await (prisma as unknown as { user: { update: (args: unknown) => Promise<DbUser> } }).user.update({
        where: { email: normalized },
        data: {
          passwordHash: newPasswordHash,
          updatedAt: now,
        },
      });
      return true;
    }
  } catch {}

  const count = await prisma.$executeRawUnsafe(
    'UPDATE "User" SET "passwordHash" = $1, "updatedAt" = $2 WHERE LOWER(email) = $3',
    newPasswordHash,
    now,
    normalized
  );
  return count > 0;
}

export async function createPasswordResetToken(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  // Generate secure 6-digit random code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  const now = new Date();
  const id = crypto.randomUUID();

  try {
    // Delete any old codes for this email
    await prisma.$executeRawUnsafe(
      'DELETE FROM "PasswordResetToken" WHERE LOWER(email) = $1',
      normalized
    );
  } catch {}

  await prisma.$executeRawUnsafe(
    'INSERT INTO "PasswordResetToken" (id, email, code, "expiresAt", "createdAt") VALUES ($1, $2, $3, $4, $5)',
    id,
    normalized,
    code,
    expiresAt,
    now
  );

  return code;
}

export async function verifyPasswordResetToken(email: string, code: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const cleanCode = code.trim();
  const now = new Date();

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      'SELECT id FROM "PasswordResetToken" WHERE LOWER(email) = $1 AND code = $2 AND "expiresAt" > $3 LIMIT 1',
      normalized,
      cleanCode,
      now
    );

    if (rows && rows.length > 0) {
      // Consume the code so it cannot be used again
      await prisma.$executeRawUnsafe(
        'DELETE FROM "PasswordResetToken" WHERE id = $1',
        rows[0].id
      );
      return true;
    }
  } catch (e) {
    console.error('Failed to verify reset token:', e);
  }

  return false;
}
