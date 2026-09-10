import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const history = await (db as any).searchHistory.findMany({
      where: { userId: auth.user.id },
      orderBy: { searchedAt: 'desc' },
      take: 30,
    })
    return NextResponse.json({ success: true, data: history })
  } catch (error) {
    console.error('SearchHistory GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const term = searchParams.get('term')
    if (term) {
      await (db as any).searchHistory.deleteMany({ where: { userId: auth.user.id, query: term } })
    } else {
      await (db as any).searchHistory.deleteMany({ where: { userId: auth.user.id } })
    }
    return NextResponse.json({ success: true, message: 'Search history cleared' })
  } catch (error) {
    console.error('SearchHistory DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}