import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

async function signOutAndClear() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  // signOut() clears Supabase sb-*-auth-token cookies, but middleware.ts sets its
  // own `pa=1` pre-auth shortcut cookie (Max-Age=300) that bypasses auth checks.
  // Must clear it too, or the user stays "logged in" for up to 5 min after logout.
  const cookieStore = await cookies()
  cookieStore.delete('pa')
}

export async function POST() {
  await signOutAndClear()
  // Return JSON (not redirect) — the client fetches this then navigates via router.
  return NextResponse.json({ ok: true })
}

export async function GET() {
  await signOutAndClear()
  return NextResponse.json({ ok: true })
}
