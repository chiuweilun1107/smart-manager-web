import { NextRequest, NextResponse } from 'next/server'
import { verifyApiKey } from '@/lib/apikey'
import { createServiceClient } from '@/lib/supabase/server'

/** 對外 REST API：用 Bearer API key 認證，company-scoped */
export async function GET(req: NextRequest) {
  const key = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  const ctx = await verifyApiKey(key)
  if (!ctx) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  const svc = createServiceClient()
  const { data } = await svc.schema('aido').from('requests')
    .select('id, request_no, module_code, title, status, amount, created_at')
    .eq('company_id', ctx.companyId).order('created_at', { ascending: false }).limit(100)
  return NextResponse.json({ data: data || [] })
}
