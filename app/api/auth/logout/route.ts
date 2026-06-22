import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  // Return JSON (not redirect) — the client fetches this then navigates via router.
  // signOut() clears auth cookies through the server client's setAll, which Next.js
  // applies to this response automatically.
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
