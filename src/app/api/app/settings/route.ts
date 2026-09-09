import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/app/settings
 * Retrieves all public system & app configuration settings grouped by category.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined

    const settings = await db.appSystemSettings.findMany({
      where: {
        isPublic: true,
        ...(category ? { category } : {}),
      },
      orderBy: { key: 'asc' },
    })

    const settingsMap = settings.reduce((acc: Record<string, string>, s) => {
      acc[s.key] = s.value
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      data: {
        settings: settingsMap,
        list: settings,
        total: settings.length,
      },
    })
  } catch (error) {
    console.error('App settings GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/app/settings
 * Updates or creates a system setting.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { key, value, category = 'general', description } = body

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Key and value are required' }, { status: 400 })
    }

    const setting = await db.appSystemSettings.upsert({
      where: { key },
      update: { value: String(value), category, description },
      create: { key, value: String(value), category, description },
    })

    return NextResponse.json({
      success: true,
      message: `Setting ${key} updated`,
      data: setting,
    })
  } catch (error) {
    console.error('App settings POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
