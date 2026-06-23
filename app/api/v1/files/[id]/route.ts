import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { signedUrl } from '@/lib/storage'
import { authBearerUser, preflight, jsonCors, companyOf } from '@/lib/agent-auth'

// Phase E: 給 agent app 跨來源用的 Bearer-JWT 版取簽名URL endpoint。
// 鏡像 app/api/files/[id]/route.ts，唯一差異：身分來自 Authorization Bearer JWT（authBearerUser）。
// 越權防護：查詢用 company_id == companyOf(user) 限本人公司 scope，跨公司檔案查無 → 404。

export async function OPTIONS(req: NextRequest) {
  return preflight(req)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await authBearerUser(req)
  if (!user) return jsonCors(req, { error: 'Unauthorized' }, { status: 401 })

  const companyId = companyOf(user)
  const svc = createServiceClient()
  const db = svc.schema('aido')

  const { data: file } = await db.from('user_files').select('*')
    .eq('id', Number(id)).eq('company_id', companyId).single()
  if (!file) return jsonCors(req, { error: '檔案不存在' }, { status: 404 })
  try {
    const url = await signedUrl(file.file_path)
    return jsonCors(req, { url, fileName: file.file_name, mimeType: file.mime_type ?? null })
  } catch (e) {
    return jsonCors(req, { error: (e as Error).message }, { status: 500 })
  }
}
