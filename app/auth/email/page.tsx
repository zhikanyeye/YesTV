'use client';

import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

type Status = 'verifying' | 'success' | 'failed';

function EmailSignIn() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<Status>(email && token ? 'verifying' : 'failed');
  const startedRef = useRef(false);

  useEffect(() => {
    // The token is single-use; guard against double invocation (React strict mode)
    if (!email || !token || startedRef.current) return;
    startedRef.current = true;

    signIn('email', { email, token, redirect: false })
      .then(result => {
        if (result?.ok && !result.error) {
          setStatus('success');
          window.location.replace('/');
        } else {
          setStatus('failed');
        }
      })
      .catch(() => setStatus('failed'));
  }, [email, token]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-4">
        {status === 'verifying' && <p className="text-gray-600">正在验证登录链接...</p>}
        {status === 'success' && <p className="text-gray-600">登录成功，正在跳转...</p>}
        {status === 'failed' && (
          <>
            <p className="text-gray-900 font-medium">登录链接无效或已过期</p>
            <p className="text-sm text-gray-500">链接有效期 10 分钟，且只能使用一次。请回到首页重新获取。</p>
            <Link href="/" className="inline-block text-sm text-blue-600 hover:underline">
              返回首页
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

export default function EmailAuthPage() {
  return (
    <Suspense fallback={null}>
      <EmailSignIn />
    </Suspense>
  );
}
