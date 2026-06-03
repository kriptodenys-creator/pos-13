import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('image')

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'Missing image file' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    await fs.mkdir(uploadsDir, { recursive: true })

    const ext = path.extname(file.name || '').toLowerCase()
    const safeExt = ext && ext.length <= 10 ? ext : ''
    const filename = `img_${Date.now()}_${randomUUID().slice(0, 8)}${safeExt}`

    await fs.writeFile(path.join(uploadsDir, filename), buffer)

    return NextResponse.json({ success: true, imagePath: `/uploads/${filename}` }, { status: 200 })
  } catch (e: any) {
    console.error('[API] upload failed:', e)
    return NextResponse.json(
      { success: false, error: e?.message || 'Failed to upload image' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ success: false, error: 'Method not allowed' }, { status: 405 })
}
