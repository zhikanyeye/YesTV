import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuthContext } from '@/lib/auth/request-auth';
import { getManagedUser } from '@/lib/user-management';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const auth = await getRequestAuthContext(req);

  if (!auth.userId) {
    return NextResponse.json({
      loggedIn: false,
      isAdmin: false,
      user: null,
    });
  }

  const profile = await getManagedUser(auth.userId);

  return NextResponse.json({
    loggedIn: true,
    isAdmin: auth.isAdmin,
    user: {
      id: auth.userId,
      name: auth.name || profile?.name || null,
      email: auth.email || profile?.email || null,
      image: auth.image || profile?.image || null,
      banned: profile?.banned ?? false,
      banReason: profile?.banReason ?? null,
    },
  });
}
