import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/profile/privacy — User privacy options.
 * PUT /api/profile/privacy — Update privacy preferences.
 */
export async function GET() {
  return NextResponse.json({
    data: {
      options: [
        {
          id: 'profile-visibility',
          label: 'Profile Visibility',
          description: 'Allow other verified merchants to see your basic business profile in the directory.',
          enabled: true,
        },
        {
          id: 'supplier-data-sharing',
          label: 'Supplier Data Sharing',
          description: 'Share aggregated purchasing trends with key suppliers to receive negotiated bulk rates.',
          enabled: false,
        },
        {
          id: 'marketing-analytics',
          label: 'Marketing Analytics',
          description: 'Opt-in to anonymous analytics tracking to help us improve platform performance.',
          enabled: true,
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