export const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf',
])

// Magic byte signatures for server-side MIME verification.
// file.type is client-controlled and can be spoofed; this checks the actual bytes.
function detectMime(buf: Buffer): string | null {
  if (buf.length < 4) return null
  const b = buf
  // JPEG: FF D8 FF
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg'
  // PNG: 89 50 4E 47
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'image/png'
  // GIF: 47 49 46 38 (GIF8)
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif'
  // PDF: 25 50 44 46 (%PDF)
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf'
  // WebP: RIFF????WEBP (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
  if (buf.length >= 12 &&
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
  // HEIC/HEIF: ISO Base Media — bytes 4-7 = 'ftyp', bytes 8-11 = major brand
  if (buf.length >= 12 &&
      b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = buf.slice(8, 12).toString('ascii')
    if (['heic', 'heis', 'hevc', 'hevx', 'heim', 'heix', 'hevm', 'mif1', 'msf1'].includes(brand)) {
      return 'image/heic'
    }
  }
  return null
}

// Returns true when the buffer's actual content matches the claimed MIME type.
// image/heif is treated as equivalent to image/heic (same container, different brand).
export function verifyMagicBytes(buf: Buffer, claimedType: string): boolean {
  const detected = detectMime(buf)
  if (!detected) return false
  if (detected === 'image/heic' && claimedType === 'image/heif') return true
  return detected === claimedType
}
