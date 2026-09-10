import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    data: {
      mode: 'light',
      accessibility: [
        {
          id: 'high-contrast',
          label: 'High Contrast Mode',
          description: 'Increases visibility of text, borders, and UI elements.',
          enabled: false,
        },
        {
          id: 'compact-density',
          label: 'Compact Grid Density',
          description: 'Fits more wholesale items & SKU rows per screen.',
          enabled: false,
        },
        {
          id: 'reduce-motion',
          label: 'Reduce Motion',
          description: 'Minimizes transitions across the catalog.',
          enabled: false,
        },
      ],
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
    return NextResponse.json({ success: true, data: body.data })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}