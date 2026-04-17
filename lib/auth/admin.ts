const ADMIN_USER_IDS_ENV = 'ADMIN_USER_IDS';

function normalizeUserId(value: string): string {
  return value.trim();
}

export function getAdminUserIds(): string[] {
  const raw = process.env[ADMIN_USER_IDS_ENV] || '';
  if (!raw) return [];

  return raw
    .split(',')
    .map(normalizeUserId)
    .filter((id) => id.length > 0);
}

export function isAdminUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return getAdminUserIds().includes(userId);
}
