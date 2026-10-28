'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCartStore } from '@/store/cart-store'
import { loadPage, getChunkForPage, isRegisteredPage, warmPageChunks } from '@/lib/page-loader'
import type { GenericPageType } from '@/lib/page-loader'
import { AppShell } from '@/components/layout/app-shell'
import { SocialConsentModal } from '@/components/shared/social-consent-modal'
import { PageLoader } from '@/components/ui/page-loader'
import { Button } from '@/components/ui/button'

// t187 provenance diagnostics: the native shell's gate reads
// window.__ZylodBundleIdentity (set inline in <head> by the root layout).
// CI emulator runs kept reporting bundle=NONE while the served HTML clearly
// contained the script — this log (forwarded to logcat under ZylodWeb)
// states what the executing document ACTUALLY has.
if (typeof window !== 'undefined') {
  try {
    const id = (window as any).__ZylodBundleIdentity
    console.log('[Zylod] doc identity:', id ? `commit=${id.commit}` : 'MISSING')
  } catch { /* diagnostics only */ }
}

// Lazy-loaded chunk loader — only loaded when a non-core page is requested
let _chunkLoader: any = null
let _chunkLoaderPromise: Promise<any> | null = null

async function getChunkLoader() {
  if (_chunkLoader) return _chunkLoader
  if (_chunkLoaderPromise) return _chunkLoaderPromise

  _chunkLoaderPromise = import('@/lib/chunk-loader').then(mod => {
    _chunkLoader = mod
    return mod
  }).catch(err => {
    _chunkLoaderPromise = null
    throw err
  })

  return _chunkLoaderPromise
}

/** t229: belt-and-braces scroll anchor. navigation-store resets the scroll
 * synchronously inside navigate()/setCurrentPage(), but the new page MOUNTS
 * asynchronously (chunk load) — anything that grabs focus or expands layout
 * after mount (autofocus search inputs, mobile keyboards, late images) can
 * still drag the viewport away from the top. This renders with EVERY page
 * mount: one rAF pass (post-layout) and one short-timeout pass (post-async
 * side effects). Fires only on mount, never during user scrolling. */
function ScrollTopOnMount() {
  useEffect(() => {
    const reset = () => {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }
    const raf = requestAnimationFrame(reset)
    const late = window.setTimeout(reset, 120)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(late)
    }
  }, [])
  return null
}

function PageRenderer({ pageId, pageParams }: { pageId: string; pageParams: Record<string, string> }) {
  const [PageComponent, setPageComponent] = useState<any>(null)
  const [genericType, setGenericType] = useState<GenericPageType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // t219: bump to re-run the resolve effect from the honest failure surface.
  const [resolveTick, setResolveTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    setLoading(true)
    setPageComponent(null)
    setGenericType(null)
    setError(null)

    /* Bounded self-heal (t219): the OOM-restart watchdog can bounce the dev
       server under a browsing user, and a dynamic chunk import can then throw
       — or resolve mid-recompile without the page's export — which used to
       dead-end in an eternal spinner or a gray "Page not found" for a page
       that IS registered. The resolve now retries once after a beat (the
       transient class self-heals invisibly) and only then renders the honest
       failure surface with manual Retry / Reload. Unregistered ids keep the
       original gray fallback with no retry (still the honest unknown-page
       state the audits assert). */
    const retryOnce = (attempt: number, next: () => void) => {
      if (attempt >= 1) return false
      retryTimer = setTimeout(() => { if (!cancelled) next() }, 800)
      return true
    }

    async function resolvePage(attempt: number) {
      try {
        const result = await loadPage(pageId)
        if (cancelled) return

        if (result.component) {
          setPageComponent(() => result.component)
          setLoading(false)
          return
        }

        if (result.needsPageId && result.genericType) {
          setGenericType(result.genericType)
          setLoading(false)
          return
        }

        if (result.needsPageId) {
          const chunkName = getChunkForPage(pageId)
          if (chunkName) {
            try {
              const chunkLoader = await getChunkLoader()
              if (cancelled) return

              let pageResult: any = null
              if (chunkName === 'auth') {
                pageResult = await chunkLoader.loadAuthPage(pageId)
              } else {
                pageResult = await chunkLoader.loadPageFromChunk(chunkName, pageId)
              }

              if (cancelled) return
              if (pageResult && pageResult.component) {
                setPageComponent(() => pageResult.component)
                setLoading(false)
                return
              }

              // Chunk module loaded but no export for this id. For a
              // registry-owned page that is the transient race — retry once;
              // an unregistered id falls through to the honest gray fallback.
              if (isRegisteredPage(pageId) && retryOnce(attempt, () => void resolvePage(attempt + 1))) return
            } catch (e) {
              console.error('Failed to load chunk for page:', pageId, e)
              if (retryOnce(attempt, () => void resolvePage(attempt + 1))) return
              if (!cancelled) {
                setError(`Failed to load: ${pageId}`)
                setLoading(false)
              }
              return
            }
          }
        }

        setPageComponent(null)
        setLoading(false)
      } catch (e) {
        if (retryOnce(attempt, () => void resolvePage(attempt + 1))) return
        if (!cancelled) {
          console.error('Error resolving page:', pageId, e)
          setError(`Error: ${pageId}`)
          setLoading(false)
        }
      }
    }

    void resolvePage(0)
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [pageId, resolveTick])

  if (loading) {
    return <PageLoader />
  }

  if (error) {
    return <PageLoadError message={error} onRetry={() => setResolveTick((t) => t + 1)} />
  }

  if (genericType) {
    return (
      <>
        <ScrollTopOnMount />
        <GenericPageRenderer genericType={genericType} pageId={pageId} pageParams={pageParams} />
      </>
    )
  }

  if (PageComponent) {
    // t228: key the host by pageId+params so a same-component navigation
    // (e.g. product-detail → product-detail for a different id) REMOUNTS
    // instead of leaking the previous page's internal state.
    // t229: ScrollTopOnMount rides every mount — the async mount no longer
    // risks landing mid-page when late effects (autofocus/keyboard) scroll.
    return (
      <>
        <ScrollTopOnMount />
        <PageComponent key={pageId + (pageParams && Object.keys(pageParams).length ? '?' + new URLSearchParams(pageParams).toString() : '')} />
      </>
    )
  }
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <p className="text-lg text-gray-600 dark:text-gray-400 dark:text-gray-500">Page not found: {pageId}</p>
      </div>
    </div>
  )
}

/** t219: honest, actionable failure surface for a page whose chunk could not
 *  be resolved after the bounded retry — replaces the dead-end red text and
 *  the eternal-spinner class. Retry re-runs the in-place resolve; Reload is
 *  the full-app escape hatch (session and cart survive both). */
function PageLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-sm">
        <p className="text-lg text-red-500">{message}</p>
        <p className="text-sm text-muted-foreground">
          The connection may have dropped or the app was updating. Your session and cart are safe.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={onRetry}>Try again</Button>
          <Button onClick={() => window.location.reload()}>Reload app</Button>
        </div>
      </div>
    </div>
  )
}

function GenericPageRenderer({ genericType, pageId, pageParams }: { genericType: GenericPageType; pageId: string; pageParams: Record<string, string> }) {
  const [Comp, setComp] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  // t219: a failed generic-chunk load used to setComp(null) + setLoading(false)
  // and then hit `if (loading || !Comp) return <PageLoader />` FOREVER — the
  // eternal-spinner class on long-tail pages. Real failure state now.
  const [failed, setFailed] = useState(false)
  const [resolveTick, setResolveTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)

    async function load() {
      try {
        const chunkLoader = await getChunkLoader()
        if (cancelled) return
        const component = await chunkLoader.loadGenericComponent(genericType)
        if (cancelled) return
        setComp(() => component)
        setLoading(false)
      } catch {
        if (!cancelled) {
          setComp(null)
          setFailed(true)
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [genericType, resolveTick])

  if (failed) {
    return (
      <PageLoadError
        message={`Failed to load: ${pageId}`}
        onRetry={() => setResolveTick((t) => t + 1)}
      />
    )
  }

  if (loading || !Comp) {
    return <PageLoader />
  }

  return <Comp key={pageId} pageId={pageId} pageParams={pageParams} />
}

export function AppEntry() {
  const { currentPage, pageParams } = useNavigationStore()

  /* ─── t195 SESSION RECONCILIATION at boot ───
     The persisted auth store and the httpOnly session cookie can disagree
     (storage wipes, the clear-cache page, quota evictions). When the store
     says "guest" but the cookie is still live, the app used to show "Login"
     in the header while the session could still browse addresses and place
     REAL orders — the reported "buying without an account" zombie state.
     The SERVER session is the single source of truth: one cookie-authed
     probe per boot, then the store is forced to match it in both directions.
     Runs BEFORE cart hydration below so syncWithApi sees the reconciled
     user. */
  useEffect(() => {
    // t216: the probe MUST run against the REHYDRATED store. It used to read
    // the store synchronously at effect time and could race zustand-persist
    // hydration — a dead-cookie visitor then stayed a zombie "Md Kailem"
    // header while every API 401'd. Hydrate first, probe after, and always
    // read the store FRESH inside the probe.
    const runProbe = async () => {
      try {
        const res = await fetch('/api/auth/session-info', { credentials: 'include' })
        if (res.ok) {
          if (!useAuthStore.getState().isAuthenticated) {
            // Cookie is live but the store lost the user → rehydrate from
            // the server profile so header/UI match the real session.
            try {
              const me = await fetch('/api/profile/me', { credentials: 'include' })
              if (me.ok) {
                const data = await me.json().catch(() => null)
                const u = data?.data
                if (u?.id) {
                  useAuthStore.getState().login(
                    {
                      id: u.id,
                      userType: u.userType,
                      email: u.email ?? null,
                      phone: u.phone ?? null,
                      fullName: u.fullName || u.buyerProfile?.fullName || u.supplierProfile?.contactPersonName || null,
                      businessName: u.supplierProfile?.companyName || null,
                      avatarUrl: u.avatarUrl || null,
                      isProfileComplete: u.isProfileComplete ?? false,
                      profileCompletionPct: u.profileCompletionPct ?? 0,
                      verificationStatus: u.supplierProfile?.verificationStatus,
                      rejectionReason: u.supplierProfile?.rejectionReason ?? null,
                      companyName: u.supplierProfile?.companyName,
                      supplierSlug: u.supplierProfile?.slug,
                    },
                    useAuthStore.getState().token ?? '', // token lives in the cookie; store value is display-only
                  )
                  void useCartStore.getState().syncWithApi(u.id)
                }
              }
            } catch { /* profile fetch failed — stay as-is */ }
          }
        } else if (res.status === 401) {
          // Server verdict: NO valid session. Any persisted "logged in"
          // state is a lie — clear it so the UI can never order as a ghost.
          if (useAuthStore.getState().isAuthenticated) {
            useAuthStore.setState({ isAuthenticated: false, user: null, token: null })
          }
        }
      } catch { /* network error — keep existing state, APIs will 401 anyway */ }
    }

    if (useAuthStore.persist.hasHydrated()) {
      void runProbe()
      return
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => { void runProbe() })
    return unsub
  }, [])

  /* ─── Server-cart hydration at boot ───
     One read-side twin for the write-side sync: an authenticated buyer
     returning to the app gets their server cart pulled into the local
     store once, so the header badge and any cart surface reflect the
     cross-session truth without re-adding anything. Merge semantics are
     the store's own (local kept, API-only rows added). */
  useEffect(() => {
    const user = useAuthStore.getState().user
    if (user?.id) void useCartStore.getState().syncWithApi(user.id)
  }, [])

  /* ─── t228 chunk warm-up at boot ───
     After the first render settles (idle), silently pre-fetch the
     most-linked page chunks through page-loader's warmPageChunks() so the
     first cold navigation renders instantly instead of the "Loading…"
     spinner. Fire-and-forget; once per session; no routing changes. */
  useEffect(() => {
    warmPageChunks()
  }, [])

  // First-time onboarding: show welcome/onboarding flow to new users on mobile.
  // Once seen, store flag in localStorage so it never shows again on that device.
  useEffect(() => {
    const search = new URLSearchParams(window.location.search)
    const deepLinkPage = search.get('page')

    // Handle deep-link first — deep links always take priority over onboarding
    if (deepLinkPage) {
      const params: Record<string, string> = {}
      search.forEach((value, key) => {
        if (key !== 'page') params[key] = value
      })
      // Replace (not push) for the initial deep link so the back button
      // isn't wasted on a throwaway history entry.
      useNavigationStore.getState().setCurrentPage(deepLinkPage, params)
      // t208: the URL is NOT stripped anymore. setCurrentPage's replaceState
      // writes `?page=<id>&<params>` back into the address bar, so a manual
      // refresh (or a copied URL) re-lands on the same page instead of Home.
      // The old code deleted ?page= here, which is what broke refresh.
      return
    }

    // Only show onboarding on mobile and only if not yet seen
    const isMobileDevice = window.innerWidth < 768
    const hasSeenOnboarding = localStorage.getItem('zylod-onboarding-seen') === 'true'

    if (isMobileDevice && !hasSeenOnboarding) {
      useNavigationStore.getState().setCurrentPage('welcome')
    }
     
  }, [])

  return (
    <>
      <AppShell>
        <Suspense fallback={
          <div className="flex min-h-[70vh] items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <img src="/zylod-logo.svg" alt="Zylod" className="h-10 w-auto animate-pulse" />
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                <div className="h-2 w-2 rounded-full bg-primary animate-bounce"></div>
              </div>
            </div>
          </div>
        }>
          <PageRenderer pageId={currentPage} pageParams={pageParams} />
        </Suspense>
      </AppShell>
      <SocialConsentModal />
    </>
  )
}

export default AppEntry
