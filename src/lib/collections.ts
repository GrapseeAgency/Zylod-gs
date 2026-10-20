import { randomBytes } from 'crypto'

/**
 * Task 97: THE COLLECTIONS RAIL — shared helpers. Lives in lib (route files
 * export nothing beyond HTTP handlers). A SHARED collection mints a 24-byte
 * hex secret token; the owner projection includes it ONLY while the
 * collection stays SHARED — a PRIVATE collection never leaks its token.
 */

export const COLLECTION_PRIVACY = ['PRIVATE', 'PUBLIC', 'SHARED'] as const
export type CollectionPrivacy = (typeof COLLECTION_PRIVACY)[number]

export function mintShareToken(): string {
  return randomBytes(24).toString('hex')
}

/** Collection shape served to its OWNER (token included when SHARED). */
export function ownerProjection(c: {
  id: string
  name: string
  description: string | null
  privacy: string
  coverColor: string | null
  coverImageUrl: string | null
  shareToken: string | null
  createdAt: Date
  updatedAt: Date
  _count?: { items: number }
  items?: Array<Record<string, unknown>>
}) {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    privacy: c.privacy,
    coverColor: c.coverColor,
    coverImageUrl: c.coverImageUrl,
    shareToken: c.privacy === 'SHARED' ? c.shareToken : null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    ...('_count' in c ? { _count: c._count } : {}),
    ...('items' in c ? { items: c.items } : {}),
  }
}

/**
 * The PUBLIC shared-link projection — what a guest who holds the secret
 * token may see. No owner identity, no token reflection, no timestamps of
 * the owner's account.
 */
export function sharedProjection(c: {
  id: string
  name: string
  description: string | null
  coverColor: string | null
  coverImageUrl: string | null
  createdAt: Date
  items?: Array<Record<string, unknown>>
}) {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    coverColor: c.coverColor,
    coverImageUrl: c.coverImageUrl,
    createdAt: c.createdAt,
    ...('items' in c ? { items: c.items } : {}),
  }
}
