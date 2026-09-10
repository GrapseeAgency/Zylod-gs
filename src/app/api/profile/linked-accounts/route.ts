import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/profile/linked-accounts — Real user auth provider & third-party integration state.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const user = await db.users.findUnique({
      where: { id: auth.user.id },
      select: { authProvider: true, email: true },
    })

    const accounts = [
      {
        id: 'google-oauth',
        name: 'Google Single Sign-On',
        description: 'Sign in to Zylod using your Google account.',
        connected: user?.authProvider === 'google',
        email: user?.authProvider === 'google' ? user.email : null,
      },
      {
        id: 'bkash-merchant',
        name: 'bKash Merchant Account',
        description: 'Direct bKash settlement for wholesale transactions.',
        connected: false,
      },
      {
        id: 'nagad-merchant',
        name: 'Nagad Merchant Account',
        description: 'Direct Nagad settlement for wholesale transactions.',
        connected: false,
      },
    ]

    return NextResponse.json({ success: true, data: { accounts } })
  } catch (error) {
    console.error('Linked accounts GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}