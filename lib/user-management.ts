import { db } from '@/lib/db';
import type { ManagedUser } from '@/lib/types';

const USERS_INDEX_KEY = 'users:index';

function userProfileKey(userId: string): string {
  return `users:profile:${userId}`;
}

async function getUserIndex(): Promise<string[]> {
  const value = await db.get(USERS_INDEX_KEY);
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
}

async function saveUserIndex(ids: string[]): Promise<void> {
  await db.set(USERS_INDEX_KEY, ids);
}

async function ensureUserIndexed(userId: string): Promise<void> {
  const ids = await getUserIndex();
  if (ids.includes(userId)) return;

  const next = [userId, ...ids].slice(0, 5000);
  await saveUserIndex(next);
}

async function removeUserFromIndex(userId: string): Promise<void> {
  const ids = await getUserIndex();
  const next = ids.filter((id) => id !== userId);
  await saveUserIndex(next);
}

export async function getManagedUser(userId: string): Promise<ManagedUser | null> {
  const value = await db.get(userProfileKey(userId));
  if (!value || typeof value !== 'object') return null;

  const user = value as Partial<ManagedUser>;
  if (!user.id || typeof user.id !== 'string') return null;

  return {
    id: user.id,
    name: typeof user.name === 'string' ? user.name : null,
    email: typeof user.email === 'string' ? user.email : null,
    image: typeof user.image === 'string' ? user.image : null,
    createdAt: typeof user.createdAt === 'number' ? user.createdAt : Date.now(),
    lastLoginAt: typeof user.lastLoginAt === 'number' ? user.lastLoginAt : Date.now(),
    banned: Boolean(user.banned),
    banReason: typeof user.banReason === 'string' ? user.banReason : null,
    bannedAt: typeof user.bannedAt === 'number' ? user.bannedAt : null,
  };
}

export async function upsertManagedUser(input: {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}): Promise<ManagedUser> {
  const now = Date.now();
  const existing = await getManagedUser(input.id);

  const merged: ManagedUser = {
    id: input.id,
    name: input.name ?? existing?.name ?? null,
    email: input.email ?? existing?.email ?? null,
    image: input.image ?? existing?.image ?? null,
    createdAt: existing?.createdAt ?? now,
    lastLoginAt: now,
    banned: existing?.banned ?? false,
    banReason: existing?.banReason ?? null,
    bannedAt: existing?.bannedAt ?? null,
  };

  await db.set(userProfileKey(input.id), merged);
  await ensureUserIndexed(input.id);

  return merged;
}

export async function listManagedUsers(): Promise<ManagedUser[]> {
  const ids = await getUserIndex();
  if (ids.length === 0) return [];

  const users = await Promise.all(ids.map((id) => getManagedUser(id)));

  return users
    .filter((user): user is ManagedUser => user !== null)
    .sort((a, b) => b.lastLoginAt - a.lastLoginAt);
}

export async function isUserBanned(userId: string): Promise<boolean> {
  const user = await getManagedUser(userId);
  return Boolean(user?.banned);
}

export async function banManagedUser(userId: string, reason?: string): Promise<ManagedUser | null> {
  const user = await getManagedUser(userId);
  if (!user) return null;

  const updated: ManagedUser = {
    ...user,
    banned: true,
    banReason: reason?.trim() || user.banReason || '管理员封禁',
    bannedAt: Date.now(),
  };

  await db.set(userProfileKey(userId), updated);
  return updated;
}

export async function unbanManagedUser(userId: string): Promise<ManagedUser | null> {
  const user = await getManagedUser(userId);
  if (!user) return null;

  const updated: ManagedUser = {
    ...user,
    banned: false,
    banReason: null,
    bannedAt: null,
  };

  await db.set(userProfileKey(userId), updated);
  return updated;
}

export async function deleteManagedUser(userId: string): Promise<void> {
  await db.del(userProfileKey(userId));
  await db.del(`favorites:${userId}`);
  await db.del(`history:${userId}`);
  await removeUserFromIndex(userId);
}
