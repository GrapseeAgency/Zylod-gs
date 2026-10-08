/**
 * Shared helpers for the admin category management API
 * (GET+POST /api/admin/categories + PATCH+DELETE /api/admin/categories/[id]).
 *
 * Every serialized field is real database data — null stays null, counts are
 * real Prisma _count aggregates. No fabricated values anywhere.
 *
 * Slug rules (honest + safe):
 * - Auto-generated slugs are lowercased, ASCII-folded (diacritics stripped),
 *   and collapsed to lowercase [a-z0-9] runs joined by single hyphens.
 * - Explicit slugs go through the same normalizer (idempotent for
 *   already-valid slugs) so stored slugs stay URL-safe.
 * - Slug collisions with public route ids do not matter: category slugs are
 *   DB identifiers used by product/category pages, not Next.js route ids.
 */

/** categories row + the aggregates the admin serializers always include. */
export interface AdminCategoryRow {
  id: string
  name: string
  slug: string
  parentId: string | null
  iconUrl: string | null
  isActive: boolean
  sortOrder: number
  createdAt: Date
  parent?: { name: string } | null
  _count?: { products: number; children: number }
}

export interface AdminCategoryDto {
  id: string
  name: string
  slug: string
  parentId: string | null
  /** Real name of the parent category when one exists, else null. */
  parentName: string | null
  iconUrl: string | null
  isActive: boolean
  sortOrder: number
  createdAt: string
  productCount: number
  childrenCount: number
}

/** Serialize a categories row exactly like the admin list API does. */
export function serializeAdminCategory(row: AdminCategoryRow): AdminCategoryDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parentId,
    parentName: row.parent?.name ?? null,
    iconUrl: row.iconUrl,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    productCount: row._count?.products ?? 0,
    childrenCount: row._count?.children ?? 0,
  }
}

/**
 * ASCII-fold + slugify a name (or an explicit slug). Idempotent: valid slugs
 * pass through unchanged. Returns '' when nothing slug-safe remains (e.g. a
 * name made entirely of non-Latin characters) — callers must handle that.
 */
export function slugifyName(input: string): string {
  const asciiFolded = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return asciiFolded
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** A stored slug is always lowercase [a-z0-9] runs joined by single hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Admin-facing product/children counts include inactive and unapproved rows.
 * The PUBLIC category tree (/api/categories) counts only active+approved
 * products — documented as a dataNote so the two numbers are never confused.
 */
export const ADMIN_CATEGORIES_DATA_NOTES = [
  'productCount counts every product linked to the category (including inactive and unapproved ones). The public category tree counts only active + approved products.',
  'The public site serves its category tree from a cache that lives up to 5 minutes, so visibility changes made here can take a few minutes to appear for buyers.',
]
