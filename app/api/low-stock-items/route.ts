import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Placeholder: return empty low stock items for now
    // TODO: Implement actual low stock logic if needed
    return NextResponse.json({ items: [] })
  } catch (error) {
    console.error('[API] Low stock items error:', error)
    return NextResponse.json({ error: 'Failed to fetch low stock items' }, { status: 500 })
  }
}
