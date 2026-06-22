import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const svc = createServiceClient()
  const db = svc.schema('aido')
  const { data: aiDoUser } = await db.from('users').select('id, company_id, primary_role_id, roles!users_primary_role_id_fkey(code)').eq('auth_user_id', user.id).single()
  if (!aiDoUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const companyId = aiDoUser.company_id ?? 1

  const { data: requests } = await db.from('requests')
    .select('status, module_code, amount, created_at, requester_user_id')
    .eq('company_id', companyId).order('created_at', { ascending: false }).limit(2000)

  const byStatus: Record<string, number> = {}
  const byModule: Record<string, number> = {}
  const byMonth: Record<string, number> = {}
  let totalAmount = 0
  for (const r of requests || []) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1
    byModule[r.module_code] = (byModule[r.module_code] || 0) + 1
    const m = String(r.created_at).slice(0, 7)
    byMonth[m] = (byMonth[m] || 0) + 1
    totalAmount += Number(r.amount) || 0
  }
  return NextResponse.json({
    total: requests?.length || 0,
    byStatus, byModule, byMonth, totalAmount,
    rows: requests || [],
  })
}
