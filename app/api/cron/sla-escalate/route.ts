import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Vercel Cron: 每小時掃一次超 SLA 的 active approval_steps → 寄站內通知（at-most-once per step） */
export async function GET(req: NextRequest) {
  // CRON_SECRET 未設時拒絕所有請求（防止 dev 環境 Bearer undefined 繞過）
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Server misconfiguration: CRON_SECRET not set' }, { status: 500 })
  }
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createServiceClient()
  const now = new Date()

  const { data: steps } = await svc.schema('aido').from('approval_steps')
    .select('id, request_id, step_no, started_at, config_json, approver_user_id, approver_role_id')
    .eq('status', 'active')
    .not('started_at', 'is', null)

  let escalated = 0
  for (const step of (steps || [])) {
    let config: { sla_hours?: number } = {}
    try { config = JSON.parse(String(step.config_json || '{}')) } catch { /* skip malformed */ }
    if (!config.sla_hours) continue

    const started = new Date(String(step.started_at))
    const deadline = new Date(started.getTime() + config.sla_hours * 3_600_000)
    if (now < deadline) continue

    // at-most-once：用 related_entity_type + related_entity_id 對映現有 notifications schema
    const { count } = await svc.schema('aido').from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('related_entity_type', 'sla_overdue')
      .eq('related_entity_id', step.id)
    if ((count ?? 0) > 0) continue

    const { data: reqRow } = await svc.schema('aido').from('requests')
      .select('title, company_id').eq('id', step.request_id).single()
    if (!reqRow) continue

    const base = {
      company_id: reqRow.company_id,
      related_entity_type: 'sla_overdue',
      related_entity_id: step.id,
      channel: 'in_app',
      status: 'queued',
      title: 'SLA 到期提醒',
      body: `「${reqRow.title}」第 ${Math.round(step.step_no / 10)} 關已超過 ${config.sla_hours}h，請盡快簽核`,
    }

    if (step.approver_user_id) {
      await svc.schema('aido').from('notifications').insert({ ...base, user_id: step.approver_user_id })
      escalated++
    } else if (step.approver_role_id) {
      const { data: roleUsers } = await svc.schema('aido').from('users')
        .select('id').eq('primary_role_id', step.approver_role_id).eq('status', 'active')
      for (const u of (roleUsers || [])) {
        await svc.schema('aido').from('notifications').insert({ ...base, user_id: u.id })
        escalated++
      }
    }
  }

  return NextResponse.json({ ok: true, checked: steps?.length ?? 0, escalated })
}
