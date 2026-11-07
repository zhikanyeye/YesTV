const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendMagicLinkEmail(to: string, link: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error('Email sender is not configured');
  }

  const safeLink = escapeHtml(link);
  const html = `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 16px">登录 YesTV</h2>
      <p>点击下方按钮完成登录，链接 10 分钟内有效，且只能使用一次。</p>
      <p style="margin:24px 0">
        <a href="${safeLink}" style="background:#111;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">登录</a>
      </p>
      <p style="font-size:12px;color:#666">按钮无法点击时，请复制以下链接到浏览器打开：<br>${safeLink}</p>
      <p style="font-size:12px;color:#999">如果这不是你本人的操作，请忽略这封邮件。</p>
    </div>`;

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: '登录 YesTV',
      html,
      text: `点击链接登录 YesTV（10 分钟内有效，仅可使用一次）：\n${link}\n\n如果这不是你本人的操作，请忽略这封邮件。`,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend responded ${response.status}: ${detail.slice(0, 300)}`);
  }
}
