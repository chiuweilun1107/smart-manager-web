import { createServiceClient } from './supabase/server'

export const ATTACHMENTS_BUCKET = 'attachments'

/** 上傳檔案到 Supabase Storage，路徑 company/user/timestamp-name 做租戶隔離 */
export async function uploadFile(opts: {
  companyId: number
  userId: number
  fileName: string
  contentType: string
  body: Buffer
}): Promise<{ path: string; size: number }> {
  const svc = createServiceClient()
  const safeName = opts.fileName.replace(/[^\w.\-]/g, '_')
  const path = `${opts.companyId}/${opts.userId}/${Date.now()}-${safeName}`
  const { error } = await svc.storage.from(ATTACHMENTS_BUCKET).upload(path, opts.body, {
    contentType: opts.contentType || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return { path, size: opts.body.length }
}

/** 產生限時簽名 URL (預設 1hr)，前端用來下載私有附件 */
export async function signedUrl(path: string, expiresIn = 3600): Promise<string> {
  const svc = createServiceClient()
  const { data, error } = await svc.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(path, expiresIn)
  if (error) throw new Error(error.message)
  return data.signedUrl
}
