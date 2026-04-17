import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuthContext } from '@/lib/auth/request-auth';
import {
  banManagedUser,
  deleteManagedUser,
  listManagedUsers,
  unbanManagedUser,
} from '@/lib/user-management';


type UserAction = 'ban' | 'unban' | 'delete';

function forbiddenResponse() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function GET(req: NextRequest) {
  const auth = await getRequestAuthContext(req);
  if (!auth.userId || !auth.isAdmin) {
    return forbiddenResponse();
  }

  const users = await listManagedUsers();
  return NextResponse.json({ users });
}

export async function PATCH(req: NextRequest) {
  const auth = await getRequestAuthContext(req);
  if (!auth.userId || !auth.isAdmin) {
    return forbiddenResponse();
  }

  try {
    const { action, userId, reason } = (await req.json()) as {
      action?: UserAction;
      userId?: string;
      reason?: string;
    };

    if (!action || !userId) {
      return NextResponse.json({ error: 'Missing action or userId' }, { status: 400 });
    }

    if (auth.userId === userId) {
      return NextResponse.json({ error: '不能操作当前管理员账号' }, { status: 400 });
    }

    if (action === 'ban') {
      const updated = await banManagedUser(userId, reason);
      if (!updated) {
        return NextResponse.json({ error: '用户不存在' }, { status: 404 });
      }
      return NextResponse.json({ success: true, user: updated });
    }

    if (action === 'unban') {
      const updated = await unbanManagedUser(userId);
      if (!updated) {
        return NextResponse.json({ error: '用户不存在' }, { status: 404 });
      }
      return NextResponse.json({ success: true, user: updated });
    }

    if (action === 'delete') {
      await deleteManagedUser(userId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

