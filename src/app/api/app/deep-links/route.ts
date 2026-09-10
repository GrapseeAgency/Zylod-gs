import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/app/deep-links
 * Lists or resolves deep link routes.
 * Query params: ?slug=product or ?url=zylod://product/123
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')
    const rawUrl = searchParams.get('url')

    if (slug) {
      const route = await db.deepLinkRoutes.findUnique({
        where: { slug },
      })

      if (route) {
        // Increment click counter
        await db.deepLinkRoutes.update({
          where: { id: route.id },
          data: {
            clickCount: { increment: 1 },
            lastClickedAt: new Date(),
          },
        })
      }

      return NextResponse.json({
        success: true,
        data: route,
      })
    }

    if (rawUrl) {
      // Parse custom scheme zylod:// or https://zylod.com/dl/...
      let path = rawUrl.replace(/^zylod:\/\//, '/').replace(/^https?:\/\/[^/]+/, '')
      const segments = path.split('/').filter(Boolean)
      const primarySlug = segments[0] || ''

      const route = await db.deepLinkRoutes.findFirst({
        where: {
          isActive: true,
          OR: [
            { slug: primarySlug },
            { pathPattern: { contains: primarySlug } },
          ],
        },
      })

      if (route) {
        await db.deepLinkRoutes.update({
          where: { id: route.id },
          data: {
            clickCount: { increment: 1 },
            lastClickedAt: new Date(),
          },
        })

        return NextResponse.json({
          success: true,
          data: {
            matched: true,
            targetPage: route.targetPage,
            paramValue: segments[1] || null,
            route,
          },
        })
      }

      return NextResponse.json({
        success: true,
        data: {
          matched: false,
          targetPage: 'home',
        },
      })
    }

    // Return list of all registered deep link patterns
    const routes = await db.deepLinkRoutes.findMany({
      where: { isActive: true },
      orderBy: { clickCount: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: routes,
    })
  } catch (error) {
    console.error('Deep link resolution GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
