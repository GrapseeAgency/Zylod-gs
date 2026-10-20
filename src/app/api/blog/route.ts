import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * Task 99: THE EDITORIAL RAIL (public side). blogPosts sat in the schema
 * from day one while /api/blog was fetched by the blog page and NEVER
 * existed — every visitor landed on "No articles published yet" no matter
 * what. Published posts are pre-purchase content: no auth by design, no
 * author PII, drafts are the SAME 404 as phantom slugs.
 */
export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, 'blog-public', 120, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const posts = await db.blogPosts.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        category: true,
        coverImageUrl: true,
        publishedAt: true,
      },
    })
    return NextResponse.json({ success: true, data: posts, count: posts.length })
  } catch (error) {
    console.error('Blog GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
