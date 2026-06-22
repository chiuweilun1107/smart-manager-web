import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { signedUrl } from '@/lib/storage'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const svc = createServiceClient()
  const db = svc.schema('aido')
  const { data: aiDoUser } = await db.from('users').select('id, company_id').eq('auth_user_id', user.id).single()
  if (!aiDoUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: file } = await db.from('user_files').select('*')
    .eq('id', Number(id)).eq('company_id', aiDoUser.company_id ?? 1).single()
  if (!file) return NextResponse.json({ error: '檔案不存在' }, { status: 404 })
  try {
    const url = await signedUrl(file.file_path)
    return NextResponse.json({ url, fileName: file.file_name })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
