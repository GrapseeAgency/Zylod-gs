import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

const SUPPORTED_LANGUAGES = [
  { id: 'en', name: 'English', nativeName: 'English', country: 'United States', region: 'Global' },
  { id: 'bn', name: 'Bengali', nativeName: 'বাংলা', country: 'Bangladesh', region: 'National' },
  { id: 'es', name: 'Spanish', nativeName: 'Español', country: 'Spain', region: 'Europe / LATAM' },
  { id: 'fr', name: 'French', nativeName: 'Français', country: 'France', region: 'Europe / Africa' },
  { id: 'ar', name: 'Arabic', nativeName: 'العربية', country: 'United Arab Emirates', region: 'Middle East' },
]

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  let selectedId = 'en'

  if (auth.authenticated && auth.user) {
    try {
      const prefs = await db.notificationPreferences.findUnique({
        where: { userId: auth.user.id },
      })
      if (prefs && (prefs as any).language) {
        selectedId = (prefs as any).language
      }
    } catch {}
  }

  return NextResponse.json({
    success: true,
    data: {
      selectedId,
      languages: SUPPORTED_LANGUAGES,
    },
  })
}

export async function PUT(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const selectedId = body.selectedId || 'en'

    await db.notificationPreferences.upsert({
      where: { userId: auth.user.id },
      create: { userId: auth.user.id },
      update: {},
    })

    return NextResponse.json({
      success: true,
      data: {
        selectedId,
        languages: SUPPORTED_LANGUAGES,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}