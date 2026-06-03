import { NextResponse } from 'next/server'
import { getAdminSessionCookieName } from '@/lib/adminAuth'

export async function POST() {
  const cookieName = getAdminSessionCookieName()

  const res = NextResponse.json({ success: true })
  res.cookies.set(cookieName, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })

  return res
}
