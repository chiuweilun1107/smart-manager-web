import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

/**
 * AES-256-GCM 對稱加密，用於 national_id / bank_account 等敏感欄位的應用層加密。
 * 金鑰由 APP_ENCRYPTION_KEY env 派生 (scrypt)。production 必設強金鑰。
 * 格式: base64(iv[12] + authTag[16] + ciphertext)
 */
function getKey(): Buffer {
  const secret = process.env.APP_ENCRYPTION_KEY || 'dev-only-insecure-key-change-in-prod'
  return scryptSync(secret, 'aido-fixed-salt-v1', 32)
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

export function decrypt(payload: string): string {
  const raw = Buffer.from(payload, 'base64')
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(12, 28)
  const enc = raw.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

/** 取末 4 碼供顯示遮罩 (e.g. ****1234) */
export function last4(s: string): string {
  return s.length <= 4 ? s : s.slice(-4)
}
