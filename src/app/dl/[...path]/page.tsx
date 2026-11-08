import { redirect } from 'next/navigation'
import { db } from '@/lib/db'

/**
 * t283: /dl/<slug>[/<id>] — the PUBLIC web deep-link route.
 *
 * The app has generated these URLs since the QR/link-generator surfaces
 * shipped (qr-deeplink-page.tsx + link-generator-page.tsx emit
 * https://zylod.com/dl/product/<id>, /dl/store/<id>, /dl/deal/<id>,
 * /dl/live/<id>, /dl/rfq), but no web route ever existed — every printed
 * QR code and copied campaign link 404'd. The native DeepLinkParser gained
 * the /dl/ branch in the same round; this route is the web half.
 *
 * Resolution order (mirrors /api/app/deep-links):
 *   1. deepLinkRoutes table row for the slug (isActive) — data-driven
 *      target + clickCount/lastClickedAt analytics. Best-effort: a missing
 *      table (fresh DB before seeding) falls through, never 500s.
 *   2. CANONICAL_DL_TARGETS — the code-level floor so the route works on
 *      any DB state (the same class of find as t281's "nothing seeded
 *      appVersions on any CI path").
 *   3. Unknown slug → home, the same `matched:false → 'home'` contract the
 *      API route implements.
 *
 * The entity id rides the second path segment as the universal `id` param
 * — every target page reads it as a fallback (product-detail: productId||id,
 * seller-storefront: supplierId||id, live-shopping-detail: id,
 * order-detail: orderId||id). Marketing params (utm_*) forward intact.
 *
 * t290 — the /dl/order target converged on BOTH surfaces: the web sent
 * order deep links to shipping-tracker (courier telemetry only) while the
 * native parser sent the same link to order-detail (t206 B5 precedent —
 * the richer typed order view with status, items, payment and the tracking
 * leg). A scanned order QR should land on the ORDER, so web now targets
 * order-detail too; the seed row + TARGET_NORMALIZATION carry stale DBs.
 */

const CANONICAL_DL_TARGETS: Record<string, string> = {
  product: 'product-detail',
  supplier: 'seller-storefront',
  store: 'seller-storefront', // link-generator SCHEME_MAP emits "store"
  deal: 'exclusive-deal-detail',
  live: 'live-shopping-detail',
  rfq: 'rfq-list',
  order: 'order-detail', // t290 convergence — native precedent (t206 B5)
}

// Stale seed targets normalize to the live pageIds (the t277 D9 retirement
// of supplier-storefront in favor of seller-storefront; the t290 /dl/order
// convergence retires the shipping-tracker dl target for stale DB rows —
// table-driven resolution normalizes before redirecting).
const TARGET_NORMALIZATION: Record<string, string> = {
  'supplier-storefront': 'seller-storefront',
  'shipping-tracker': 'order-detail',
}

export default async function DeepLinkRoute({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { path = [] } = await params
  const query = await searchParams

  const slug = (path[0] ?? '').toLowerCase()
  const entityId = path[1]

  let targetPage: string | null = null

  // 1. Data-driven: the deepLinkRoutes table (best-effort).
  try {
    const route = await db.deepLinkRoutes.findFirst({
      where: { slug, isActive: true },
      select: { id: true, targetPage: true },
    })
    if (route) {
      targetPage = route.targetPage
      // Count the click AFTER resolving the target; a failed counter must
      // never block the redirect.
      db.deepLinkRoutes
        .update({
          where: { id: route.id },
          data: { clickCount: { increment: 1 }, lastClickedAt: new Date() },
        })
        .catch(() => {})
    }
  } catch {
    // Table missing (fresh DB before seeding) — the canonical floor below
    // still resolves the link.
  }

  // 2. Code-level canonical floor.
  if (!targetPage) targetPage = CANONICAL_DL_TARGETS[slug] ?? null

  // 3. Normalize stale targets.
  if (targetPage && TARGET_NORMALIZATION[targetPage]) {
    targetPage = TARGET_NORMALIZATION[targetPage]
  }

  if (!targetPage) {
    // Unknown/absent slug — same contract as /api/app/deep-links
    // (matched:false → home). A typo'd printed QR lands on the storefront,
    // not a 404.
    redirect('/')
  }

  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (key === 'page') continue // the caller never overrides the target
    const first = Array.isArray(value) ? value[0] : value
    if (first != null) usp.set(key, first)
  }
  if (entityId) usp.set('id', entityId) // path segment wins over ?id=

  const qs = usp.toString()
  redirect(`/?page=${encodeURIComponent(targetPage)}${qs ? `&${qs}` : ''}`)
}
