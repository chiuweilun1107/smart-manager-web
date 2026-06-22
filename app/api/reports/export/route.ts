import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { toCsv } from '@/lib/export'

const STATUS_MAP: Record<string, string> = {
  draft: '草稿', in_review: '審核中', approved: '已核准', rejected: '已駁回', returned: '退回', cancelled: '已取消'
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const svc = createServiceClient()
  const db = svc.schema('aido')
  const { data: aiDoUser } = await db.from('users').select('id, company_id').eq('auth_user_id', user.id).single()
  if (!aiDoUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: rows } = await db.from('requests')
    .select('request_no, module_code, title, status, amount, created_at')
    .eq('company_id', aiDoUser.company_id ?? 1).order('created_at', { ascending: false }).limit(5000)

  const mapped = (rows || []).map(r => ({
    ...r, status: STATUS_MAP[r.status] || r.status,
    created_at: r.created_at ? new Date(r.created_at).toLocaleDateString('zh-TW') : '',
  }))
  const csv = toCsv(mapped, [
    { key: 'request_no', label: '單號' }, { key: 'module_code', label: '類別' },
    { key: 'title', label: '標題' }, { key: 'status', label: '狀態' },
    { key: 'amount', label: '金額' }, { key: 'created_at', label: '申請日' },
  ])
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="aido-requests-report.csv"`,
    },
  })
}
