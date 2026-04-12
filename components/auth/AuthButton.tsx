'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import { useState } from 'react';

export default function AuthButton() {
  const { data: session } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (session) {
    return (
      <div className="relative">
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-2">
          <Image
            src={session.user?.image ?? ''}
            alt={session.user?.name ?? ''}
            width={32}
            height={32}
            className="rounded-full"
          />
        </button>
        {isMenuOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
            <button
              onClick={() => signOut()}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              登出
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-sm font-medium">登录</button>
      {isMenuOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
          <button
            onClick={() => signIn('github')}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            使用 GitHub 登录
          </button>
          <button
            onClick={() => signIn('qq')}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            使用 QQ 登录
          </button>
        </div>
      )}
    </div>
  );
}
