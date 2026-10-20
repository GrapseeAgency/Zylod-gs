import { z } from 'zod'
import { db } from '@/lib/db'

/**
 * Task 99: THE EDITORIAL RAIL — shared helpers (route files export nothing
 * beyond HTTP handlers). The URL slug derives from the title server-side and
 * uniquifies on clash; publish stamps publishedAt exactly once.
 */

export const blogSchema = z
  .object({
    title: z.string().trim().min(4).max(140),
    content: z.string().trim().min(20).max(50_000),
    excerpt: z.string().trim().max(300).optional().nullable(),
    category: z.string().trim().min(2).max(40).optional().nullable(),
    coverImageUrl: z.string().url().optional().nullable(),
    isPublished: z.boolean().optional(),
  })
  .strict()

export function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
    .replace(/^-+|-+$/g, '')
  return base || 'post'
}

export async function uniqueSlug(title: string): Promise<string> {
  const base = slugifyTitle(title)
  let candidate = base
  let n = 2
  while (n < 100) {
    const clash = await db.blogPosts.findUnique({ where: { slug: candidate }, select: { id: true } })
    if (!clash) return candidate
    candidate = `${base}-${n++}`
  }
  return `${base}-${Date.now()}`
}

export function shapePost(p: {
  id: string
  slug: string
  title: string
  content?: string
  excerpt: string | null
  category: string | null
  coverImageUrl: string | null
  isPublished: boolean
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    ...(p.content !== undefined ? { content: p.content } : {}),
    excerpt: p.excerpt,
    category: p.category,
    coverImageUrl: p.coverImageUrl,
    isPublished: p.isPublished,
    publishedAt: p.publishedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}
