import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { tapAllAdmins } from '@/lib/warehouses'
import { blogSchema, shapePost } from '@/lib/blog'

/**
 * Task 99: edit / publish / unpublish / delete one editorial post. The slug
 * is NOT editable (the public URL is history). Publishing stamps publishedAt
 * exactly once — the first publication date is history, not a moving target;
 * unpublishing keeps the row and the stamp but the public rails refuse it.
 */

const patchSchema = blogSchema.partial()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-blog-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      )
    }
    const existing = await db.blogPosts.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }
    const d = parsed.data
    const publishing = d.isPublished === true && !existing.isPublished
    const row = await db.blogPosts.update({
      where: { id: existing.id },
      data: {
        ...(d.title !== undefined && { title: d.title }),
        ...(d.content !== undefined && { content: d.content }),
        ...(d.excerpt !== undefined && { excerpt: d.excerpt || null }),
        ...(d.category !== undefined && { category: d.category || null }),
        ...(d.coverImageUrl !== undefined && { coverImageUrl: d.coverImageUrl || null }),
        ...(d.isPublished !== undefined && {
          isPublished: d.isPublished,
          // First publish stamps; later toggles never move the date.
          ...(publishing && !existing.publishedAt ? { publishedAt: new Date() } : {}),
        }),
      },
    })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'blog_updated',
        entityType: 'blogPosts',
        entityId: row.id,
        metadata: JSON.stringify({
          ...(d.title !== undefined && { title: { from: existing.title, to: row.title } }),
          ...(d.isPublished !== undefined && { isPublished: { from: existing.isPublished, to: row.isPublished } }),
        }),
      },
    })
    await tapAllAdmins('blog:changed', { action: 'updated', id: row.id, title: row.title, isPublished: row.isPublished })
    return NextResponse.json({ success: true, data: shapePost(row), message: 'Post updated' })
  } catch (error) {
    console.error('Admin blog PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-blog-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const removed = await db.blogPosts.deleteMany({ where: { id } })
    if (removed.count === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'blog_deleted',
        entityType: 'blogPosts',
        entityId: id,
        metadata: JSON.stringify({}),
      },
    })
    await tapAllAdmins('blog:changed', { action: 'deleted', id })
    return NextResponse.json({ success: true, message: 'Post deleted' })
  } catch (error) {
    console.error('Admin blog DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
