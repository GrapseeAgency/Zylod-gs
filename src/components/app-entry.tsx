'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { useAuthStore } from '@/store/auth-store'
import { useCartStore } from '@/store/cart-store'
import { loadPage, getChunkForPage } from '@/lib/page-loader'
import type { GenericPageType } from '@/lib/page-loader'
import { AppShell } from '@/components/layout/app-shell'
import { SocialConsentModal } from '@/components/shared/social-consent-modal'
import { PageLoader } from '@/components/ui/page-loader'

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

function PageRenderer({ pageId, pageParams }: { pageId: string; pageParams: Record<string, string> }) {
  const [PageComponent, setPageComponent] = useState<any>(null)
  const [genericType, setGenericType] = useState<GenericPageType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setPageComponent(null)
    setGenericType(null)
    setError(null)

    async function resolvePage() {
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
            } catch (e) {
              console.error('Failed to load chunk for page:', pageId, e)
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
        if (!cancelled) {
          console.error('Error resolving page:', pageId, e)
          setError(`Error: ${pageId}`)
          setLoading(false)
        }
      }
    }

    resolvePage()
    return () => { cancelled = true }
  }, [pageId])

  if (loading) {
    return <PageLoader />
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-red-500">{error}</p>
        </div>
      </div>
    )
  }

  if (genericType) {
    return <GenericPageRenderer genericType={genericType} pageId={pageId} pageParams={pageParams} />
  }

  if (PageComponent) {
    return <PageComponent />
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <p className="text-lg text-gray-600 dark:text-gray-400 dark:text-gray-500">Page not found: {pageId}</p>
      </div>
    </div>
  )
}

function GenericPageRenderer({ genericType, pageId, pageParams }: { genericType: GenericPageType; pageId: string; pageParams: Record<string, string> }) {
  const [Comp, setComp] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

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
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [genericType])

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
    const auth = useAuthStore.getState()
    ;(async () => {
      try {
        const res = await fetch('/api/auth/session-info', { credentials: 'include' })
        if (res.ok) {
          if (!auth.isAuthenticated) {
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
          if (auth.isAuthenticated) {
            useAuthStore.setState({ isAuthenticated: false, user: null, token: null })
          }
        }
      } catch { /* network error — keep existing state, APIs will 401 anyway */ }
    })()
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
      search.delete('page')
      const qs = search.toString()
      window.history.replaceState(
        { page: deepLinkPage, params },
        '',
        qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
      )
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
