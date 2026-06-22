/**
 * Email 發送 — 直接 fetch Resend REST API (不裝 SDK，降依賴)。
 * RESEND_API_KEY 未設時 graceful skip (log 不 crash)，方便先上線站內通知。
 */
export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<{ ok: boolean; skipped?: boolean }> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM || 'AiDo 智行 <onboarding@resend.dev>'
  if (!key) {
    console.log('[email] RESEND_API_KEY 未設，跳過寄信:', opts.to, '|', opts.subject)
    return { ok: false, skipped: true }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
    })
    if (!res.ok) console.error('[email] Resend 回應非 2xx:', res.status)
    return { ok: res.ok }
  } catch (e) {
    console.error('[email] 寄送失敗:', e)
    return { ok: false }
  }
}

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://aido-web.vercel.app'

export function approvalPendingEmail(title: string): { subject: string; html: string } {
  return {
    subject: `[AiDo] 待簽核：${title}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px">
      <h2 style="color:#0070F3">待簽核通知</h2>
      <p>您有一筆申請待簽核：</p>
      <p style="font-size:16px;font-weight:600">${title}</p>
      <p><a href="${BASE}/approvals" style="display:inline-block;background:#0070F3;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">前往處理</a></p>
    </div>`,
  }
}

export function requestResultEmail(title: string, result: string): { subject: string; html: string } {
  return {
    subject: `[AiDo] 申請${result}：${title}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px">
      <h2 style="color:#0070F3">申請結果通知</h2>
      <p>您的申請「<b>${title}</b>」已<b>${result}</b>。</p>
      <p><a href="${BASE}/approvals" style="display:inline-block;background:#0070F3;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">查看詳情</a></p>
    </div>`,
  }
}
