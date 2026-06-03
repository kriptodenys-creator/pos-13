import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getAdminSessionCookieName, verifyAdminSessionToken } from '@/lib/adminAuth'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protect admin UI and admin APIs
  const isAdminPage = pathname.startsWith('/admin')
  const isAdminApi = pathname.startsWith('/api/admin')

  // Allow login page and pin verify endpoint
  const isAdminLoginPage = pathname === '/admin/login'
  const isPinVerifyApi = pathname === '/api/pin-verify'

  if (!(isAdminPage || isAdminApi)) {
    return NextResponse.next()
  }

  if (isAdminLoginPage || isPinVerifyApi) {
    return NextResponse.next()
  }

  const cookieName = getAdminSessionCookieName()
  const token = request.cookies.get(cookieName)?.value

  // NOTE: middleware can be async in Next.js
  return (async () => {
    const { valid } = await verifyAdminSessionToken(token)

    if (!valid) {
    if (isAdminApi) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
    }

    return NextResponse.next()
  })()
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
