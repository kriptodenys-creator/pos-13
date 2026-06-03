import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionCookieName, verifyAdminSessionToken } from '@/lib/adminAuth'

export async function GET(request: NextRequest) {
  const cookieName = getAdminSessionCookieName()
  const token = request.cookies.get(cookieName)?.value
  const { valid, payload } = await verifyAdminSessionToken(token)

  return NextResponse.json({ authenticated: valid, payload: valid ? payload : undefined })
}
