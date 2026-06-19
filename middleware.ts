import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Lighthouse audit bypass — only active when AUDIT_BYPASS_TOKEN is set server-side
  const bypassToken = request.headers.get('x-audit-bypass')
  if (bypassToken && process.env.AUDIT_BYPASS_TOKEN && bypassToken === process.env.AUDIT_BYPASS_TOKEN) {
    return NextResponse.next()
  }

  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]
  const raw = request.cookies.get(`sb-${ref}-auth-token`)?.value
    ?? (request.cookies.get(`sb-${ref}-auth-token.0`)?.value ?? '')
      + (request.cookies.get(`sb-${ref}-auth-token.1`)?.value ?? '')

  let authenticated = false
  if (raw) {
    let sessionJson = raw.startsWith('base64-')
      ? raw.slice(7).replace(/-/g, '+').replace(/_/g, '/')
      : raw
    try {
      const jwt: string = JSON.parse(raw.startsWith('base64-') ? atob(sessionJson) : sessionJson).access_token
      const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      authenticated = payload.exp > Date.now() / 1000
    } catch { /* invalid token = not authenticated */ }
  }

  if (!authenticated && !pathname.startsWith('/login') && !pathname.startsWith('/api/seed')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (authenticated && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|svg|jpg|jpeg|webp|woff2|ico)$).*)']
}
