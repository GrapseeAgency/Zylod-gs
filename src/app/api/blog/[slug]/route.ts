import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * Task 99: one published post by slug. A DRAFT and a phantom slug are the
 * SAME 404 — half-written editorials must never be discoverable, and the
 * reader learns nothing about what exists unpublished.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rl = checkRateLimit(request, 'blog-public', 120, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { slug } = await params
    const post = await db.blogPosts.findUnique({
      where: { slug },
      select: {
        slug: true,
        title: true,
        content: true,
        excerpt: true,
        category: true,
        coverImageUrl: true,
        publishedAt: true,
        isPublished: true,
      },
    })
    if (!post || !post.isPublished) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }
    const { isPublished: _ignored, ...publicPost } = post
    return NextResponse.json({ success: true, data: publicPost })
  } catch (error) {
    console.error('Blog slug GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
