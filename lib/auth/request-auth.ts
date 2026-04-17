import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isAdminUserId } from '@/lib/auth/admin';

export interface RequestAuthContext {
  userId: string | null;
  isAdmin: boolean;
  name: string | null;
  email: string | null;
  image: string | null;
}

export async function getRequestAuthContext(req: NextRequest): Promise<RequestAuthContext> {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
  });

  const userIdFromToken = typeof token?.id === 'string'
    ? token.id
    : typeof token?.sub === 'string'
      ? token.sub
      : null;

  return {
    userId: userIdFromToken,
    isAdmin: isAdminUserId(userIdFromToken),
    name: typeof token?.name === 'string' ? token.name : null,
    email: typeof token?.email === 'string' ? token.email : null,
    image: typeof token?.picture === 'string' ? token.picture : null,
  };
}
