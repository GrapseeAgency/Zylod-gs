import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { tapAllAdmins } from '@/lib/warehouses'
import { blogSchema, uniqueSlug, shapePost } from '@/lib/blog'

/**
 * Task 99: THE EDITORIAL RAIL (admin side). The platform's editorial team
 * writes once — sourcing guides, market news — and the public blog serves
 * exactly what was published. House contract: requireUserType 401-first,
 * rate limits, Zod STRICT, server-side slugify (the URL derives from the
 * title, uniquified on clash — a title clash must never 500), publish
 * stamps publishedAt ONCE (the first publication date is history, not a
 * moving target), audits + admin-room taps.
 */

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-blog-list', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const [posts, groupBy] = await Promise.all([
      db.blogPosts.findMany({ orderBy: { updatedAt: 'desc' } }),
      db.blogPosts.groupBy({ by: ['isPublished'], _count: { isPublished: true } }),
    ])
    const stats = { total: 0, published: 0, drafts: 0 }
    for (const g of groupBy) {
      stats.total += g._count.isPublished
      if (g.isPublished) stats.published += g._count.isPublished
      else stats.drafts += g._count.isPublished
    }
    return NextResponse.json({ success: true, data: posts.map(shapePost), stats })
  } catch (error) {
    console.error('Admin blog GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-blog-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const parsed = blogSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      )
    }
    const d = parsed.data
    const isPublished = d.isPublished ?? false
    const row = await db.blogPosts.create({
      data: {
        authorId: auth.user.id,
        title: d.title,
        slug: await uniqueSlug(d.title),
        content: d.content,
        excerpt: d.excerpt || null,
        category: d.category || null,
        coverImageUrl: d.coverImageUrl || null,
        isPublished,
        publishedAt: isPublished ? new Date() : null,
      },
    })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'blog_created',
        entityType: 'blogPosts',
        entityId: row.id,
        metadata: JSON.stringify({ title: row.title, slug: row.slug, isPublished }),
      },
    })
    await tapAllAdmins('blog:changed', { action: 'created', id: row.id, title: row.title, isPublished })
    return NextResponse.json({ success: true, data: shapePost(row), message: 'Post created' }, { status: 201 })
  } catch (error) {
    console.error('Admin blog POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
