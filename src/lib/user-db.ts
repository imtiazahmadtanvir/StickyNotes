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
