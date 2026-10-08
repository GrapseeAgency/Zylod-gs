import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { serializeAdminCategory, slugifyName, SLUG_PATTERN } from '@/lib/admin-categories'

/**
 * PATCH  /api/admin/categories/[id] — update a real category row (ADMIN ONLY).
 * DELETE /api/admin/categories/[id] — delete a real category row (ADMIN ONLY).
 *
 * Real behavior (no fake data):
 * - PATCH validates partial fields; slug changes are normalized + uniqueness
 *   checked against OTHER rows (409 on conflict with the real existing slug).
 * - Cycle guard (honest, server-side): when changing parentId, the new parent
 *   may NOT be the category itself or ANY of its descendants (breadth-first
 *   walk over the real children relations) → 422, otherwise the tree could
 *   become unrenderable. A parentId that matches no category → 400.
 * - DELETE refuses to orphan products (real _count > 0 → 409) or leave
 *   subcategories behind (real children > 0 → 409). Otherwise a real delete.
 * - Every change is audit-logged ('category_updated' / 'category_deleted')
 *   with the authenticated admin's id as actor (never client-supplied).
 */

const UpdateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name must be at most 80 characters').optional(),
  slug: z.string().trim().min(1).max(80).optional(),
  // undefined = leave unchanged; null/'' = make top-level; string = must exist.
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

const categoryInclude = {
  parent: { select: { name: true } },
  _count: { select: { products: true, children: true } },
} as const

/** Real ids of the category itself + every descendant (breadth-first walk). */
async function selfAndDescendantIds(categoryId: string): Promise<Set<string>> {
  const all = await db.categories.findMany({ select: { id: true, parentId: true } })
  const childrenOf = new Map<string, string[]>()
  for (const row of all) {
    if (!row.parentId) continue
    const list = childrenOf.get(row.parentId)
    if (list) list.push(row.id)
    else childrenOf.set(row.parentId, [row.id])
  }
  const ids = new Set<string>([categoryId])
  const queue = [categoryId]
  while (queue.length > 0) {
    const current = queue.shift() as string
    for (const childId of childrenOf.get(current) ?? []) {
      if (!ids.has(childId)) {
        ids.add(childId)
        queue.push(childId)
      }
    }
  }
  return ids
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-categories-update', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { name, slug, parentId, sortOrder, isActive, iconUrl } = parsed.data

    const existing = await db.categories.findUnique({ where: { id }, include: categoryInclude })
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    const data: Prisma.categoriesUpdateInput = {}
    const changedFields: string[] = []
    const before: Record<string, unknown> = {}
    const after: Record<string, unknown> = {}

    if (name !== undefined && name !== existing.name) {
      data.name = name
      changedFields.push('name')
      before.name = existing.name
      after.name = name
    }

    if (slug !== undefined) {
      const normalizedSlug = slugifyName(slug)
      if (normalizedSlug.length === 0 || !SLUG_PATTERN.test(normalizedSlug)) {
        return NextResponse.json(
          {
            error:
              'Slug must contain only lowercase letters, numbers and single hyphens (no spaces or other characters).',
          },
          { status: 400 }
        )
      }
      if (normalizedSlug !== existing.slug) {
        const conflict = await db.categories.findFirst({
          where: { slug: normalizedSlug, id: { not: id } },
          select: { id: true, name: true },
        })
        if (conflict) {
          return NextResponse.json(
            {
              error: `Slug "${normalizedSlug}" is already used by the existing category "${conflict.name}". Choose a different slug.`,
            },
            { status: 409 }
          )
        }
        data.slug = normalizedSlug
        changedFields.push('slug')
        before.slug = existing.slug
        after.slug = normalizedSlug
      }
    }

    if (parentId !== undefined) {
      const newParentId = typeof parentId === 'string' && parentId.length > 0 ? parentId : null
      if (newParentId !== existing.parentId) {
        if (newParentId !== null) {
          const parent = await db.categories.findUnique({
            where: { id: newParentId },
            select: { id: true, name: true },
          })
          if (!parent) {
            return NextResponse.json(
              { error: 'Parent category not found — the requested parent id does not match any existing category.' },
              { status: 400 }
            )
          }

          // CYCLE GUARD: the new parent must not be this category or any of
          // its descendants — walking real children breadth-first.
          const selfAndDescendants = await selfAndDescendantIds(id)
          if (selfAndDescendants.has(newParentId)) {
            return NextResponse.json(
              {
                error:
                  newParentId === id
                    ? `Cannot set "${existing.name}" as its own parent — a category cannot be its own ancestor.`
                    : `Cannot move "${existing.name}" under "${parent.name}" — "${parent.name}" is a descendant of "${existing.name}", which would create a cycle in the category tree.`,
              },
              { status: 422 }
            )
          }
        }
        // The checked update input exposes the FK only through the relation:
        // connect sets the parent, disconnect: true clears it (top-level).
        data.parent = newParentId ? { connect: { id: newParentId } } : { disconnect: true }
        changedFields.push('parentId')
        before.parentId = existing.parentId
        after.parentId = newParentId
      }
    }

    if (sortOrder !== undefined && sortOrder !== existing.sortOrder) {
      data.sortOrder = sortOrder
      changedFields.push('sortOrder')
      before.sortOrder = existing.sortOrder
      after.sortOrder = sortOrder
    }

    if (isActive !== undefined && isActive !== existing.isActive) {
      data.isActive = isActive
      changedFields.push('isActive')
      before.isActive = existing.isActive
      after.isActive = isActive
    }

    if (iconUrl !== undefined) {
      const normalizedIcon = iconUrl.length > 0 ? iconUrl : null
      if (normalizedIcon !== existing.iconUrl) {
        data.iconUrl = normalizedIcon
        changedFields.push('iconUrl')
        before.iconUrl = existing.iconUrl
        after.iconUrl = normalizedIcon
      }
    }

    let updated = existing
    if (changedFields.length > 0) {
      updated = await db.categories.update({
        where: { id },
        data,
        include: categoryInclude,
      })

      await db.auditLogs.create({
        data: {
          actorId: auth.user.id,
          action: 'category_updated',
          entityType: 'categories',
          entityId: updated.id,
          metadata: JSON.stringify({
            changedFields,
            before,
            after,
            adminId: auth.user.id,
          }),
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: serializeAdminCategory(updated),
      message:
        changedFields.length > 0
          ? `Category "${updated.name}" updated (${changedFields.join(', ')}).`
          : `No changes — the category already matches the submitted values.`,
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'That slug was just claimed by another category. Choose a different slug.' },
        { status: 409 }
      )
    }
    console.error('Admin categories PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-categories-delete', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    const existing = await db.categories.findUnique({
      where: { id },
      include: categoryInclude,
    })
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Real guards from real _count aggregates — never orphan rows.
    if (existing._count.products > 0) {
      return NextResponse.json(
        {
          error: `Category "${existing.name}" has ${existing._count.products} product${existing._count.products === 1 ? '' : 's'}; move or reassign the products first.`,
        },
        { status: 409 }
      )
    }
    if (existing._count.children > 0) {
      return NextResponse.json(
        {
          error: `Category "${existing.name}" has ${existing._count.children} subcategor${existing._count.children === 1 ? 'y' : 'ies'}; delete or move them first.`,
        },
        { status: 409 }
      )
    }

    await db.categories.delete({ where: { id } })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'category_deleted',
        entityType: 'categories',
        entityId: existing.id,
        metadata: JSON.stringify({
          name: existing.name,
          slug: existing.slug,
          parentId: existing.parentId,
          adminId: auth.user.id,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      message: `Category "${existing.name}" deleted.`,
    })
  } catch (error) {
    console.error('Admin categories DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
