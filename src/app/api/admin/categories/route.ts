import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import {
  serializeAdminCategory,
  slugifyName,
  SLUG_PATTERN,
  ADMIN_CATEGORIES_DATA_NOTES,
} from '@/lib/admin-categories'

/**
 * GET   /api/admin/categories — full flat category list for the admin tree (ADMIN ONLY).
 * POST  /api/admin/categories — create a real category row (ADMIN ONLY).
 *
 * Real behavior (no fake data):
 * - GET returns ALL categories (active AND inactive) with real _count
 *   aggregates for products and children, the parent's real name, and real
 *   tree stats. Sort: parentId-null-first, then sortOrder asc, then name.
 * - POST auto-generates a slug from the name when none is given (lowercase,
 *   ASCII-folded, hyphenated) and honestly refuses duplicates (409), a
 *   missing parent (400), and names that produce no slug-safe characters (400).
 * - Every create is audit-logged ('category_created') with the authenticated
 *   admin's id as actor (never client-supplied).
 */

const CreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name must be at most 80 characters'),
  slug: z.string().trim().min(1).max(80).optional(),
  // '' / null mean "top level"; a non-empty string must reference a real category.
  parentId: z.union([z.null(), z.literal(''), z.string().trim().min(1)]).optional(),
  sortOrder: z.number().int('Sort order must be a whole number').min(0, 'Sort order must be at least 0').optional(),
  isActive: z.boolean().optional(),
  iconUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), {
      message: 'iconUrl must be an http(s) URL or empty',
    })
    .optional(),
})

/** Admin list shape: every category (active or not) + real counts + stats. */
export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-categories-list', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const rows = await db.categories.findMany({
      include: {
        parent: { select: { name: true } },
        _count: { select: { products: true, children: true } },
      },
    })

    // parentId-null-first, then sortOrder asc, then name (spec order).
    rows.sort((a, b) => {
      const rootDiff = (a.parentId === null ? 0 : 1) - (b.parentId === null ? 0 : 1)
      if (rootDiff !== 0) return rootDiff
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
      return a.name.localeCompare(b.name)
    })

    const categories = rows.map(serializeAdminCategory)

    // Real stats derived from the same rows that were returned.
    const stats = {
      total: rows.length,
      active: rows.filter((r) => r.isActive).length,
      inactive: rows.filter((r) => !r.isActive).length,
      roots: rows.filter((r) => r.parentId === null).length,
    }

    return NextResponse.json({
      success: true,
      data: { categories, stats, dataNotes: ADMIN_CATEGORIES_DATA_NOTES },
    })
  } catch (error) {
    console.error('Admin categories GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-categories-create', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { name, slug, parentId, sortOrder, isActive, iconUrl } = parsed.data

    // Resolve the parent first (must exist → 400).
    let resolvedParentId: string | null = null
    if (typeof parentId === 'string' && parentId.length > 0) {
      const parent = await db.categories.findUnique({ where: { id: parentId }, select: { id: true, name: true } })
      if (!parent) {
        return NextResponse.json(
          { error: 'Parent category not found — the requested parent id does not match any existing category.' },
          { status: 400 }
        )
      }
      resolvedParentId = parent.id
    }

    // Slug: explicit (normalized) or auto-generated from the name.
    const requestedSlug = typeof slug === 'string' && slug.length > 0 ? slugifyName(slug) : slugifyName(name)
    if (requestedSlug.length === 0 || !SLUG_PATTERN.test(requestedSlug)) {
      return NextResponse.json(
        {
          error:
            'Could not produce a valid slug — slugs may contain only lowercase letters, numbers and hyphens, and auto-generation found no slug-safe characters in the name. Provide an explicit slug.',
        },
        { status: 400 }
      )
    }

    const slugConflict = await db.categories.findUnique({
      where: { slug: requestedSlug },
      select: { id: true, name: true },
    })
    if (slugConflict) {
      return NextResponse.json(
        {
          error: `Slug "${requestedSlug}" is already used by the existing category "${slugConflict.name}". Choose a different slug.`,
        },
        { status: 409 }
      )
    }

    const created = await db.categories.create({
      data: {
        name,
        slug: requestedSlug,
        parentId: resolvedParentId,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
        iconUrl: iconUrl != null && iconUrl.length > 0 ? iconUrl : null,
      },
      include: {
        parent: { select: { name: true } },
        _count: { select: { products: true, children: true } },
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'category_created',
        entityType: 'categories',
        entityId: created.id,
        metadata: JSON.stringify({
          name: created.name,
          slug: created.slug,
          parentId: created.parentId,
          sortOrder: created.sortOrder,
          isActive: created.isActive,
          adminId: auth.user.id,
        }),
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: serializeAdminCategory(created),
        message: `Category "${created.name}" created.`,
      },
      { status: 201 }
    )
  } catch (error) {
    // Unique-slug race: another request inserted the same slug between the
    // check and this create — surface the same honest 409.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'That slug was just claimed by another category. Choose a different slug.' },
        { status: 409 }
      )
    }
    console.error('Admin categories POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
