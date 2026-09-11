import { create } from 'zustand'

// PageId is a plain string for memory efficiency
// 400+ union literals caused OOM in Turbopack dev server (4GB container)
export type PageId = string

interface NavigationState {
  currentPage: PageId
  pageParams: Record<string, string>
  previousPage: PageId | null
  previousPageParams: Record<string, string> | null

  navigate: (page: PageId, params?: Record<string, string>) => void
  setCurrentPage: (page: PageId, params?: Record<string, string>) => void
  goBack: () => void
}

/** Build a URL search string from params (used for History API entries). */
function paramsToSearch(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString()
  return qs ? `?${qs}` : ''
}

/** Parse pageId + params from a History API state object. */
function fromHistoryState(state: any): { page: PageId; params: Record<string, string> } | null {
  if (state && typeof state.page === 'string') {
    return { page: state.page, params: state.params ?? {} }
  }
  return null
}

function parsePage(page: string): { targetPage: PageId; params: Record<string, string> } {
  let targetPage = page.replace(/^\//, '')
  const params: Record<string, string> = {}
  if (targetPage.includes('?')) {
    const [p, query] = targetPage.split('?')
    targetPage = p
    try {
      const parsed = new URLSearchParams(query)
      parsed.forEach((value, key) => {
        params[key] = value
      })
    } catch {}
  }
  return { targetPage, params }
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  currentPage: 'home' as PageId,
  pageParams: {},
  previousPage: null,
  previousPageParams: null,

  navigate: (page, params = {}) => {
    const { currentPage, pageParams } = get()
    const { targetPage, params: embeddedParams } = parsePage(page)
    const combinedParams = { ...embeddedParams, ...params }

    // User-initiated navigation pushes a real history entry so the browser
    // + Android hardware back button can traverse it.
    window.history.pushState(
      { page: targetPage, params: combinedParams },
      '',
      window.location.pathname + paramsToSearch(combinedParams),
    )

    set({
      previousPage: currentPage,
      previousPageParams: pageParams,
      currentPage: targetPage,
      pageParams: combinedParams,
    })
  },

  // Alias for navigate — used by sidebar, promo features, product cards.
  // This REPLACES the current history entry instead of pushing, so repeated
  // in-place navigation from the sidebar doesn't pile up a deep back-stack.
  setCurrentPage: (page, params = {}) => {
    const { currentPage, pageParams } = get()
    const { targetPage, params: embeddedParams } = parsePage(page)
    const combinedParams = { ...embeddedParams, ...params }

    window.history.replaceState(
      { page: targetPage, params: combinedParams },
      '',
      window.location.pathname + paramsToSearch(combinedParams),
    )

    set({
      previousPage: currentPage,
      previousPageParams: pageParams,
      currentPage: targetPage,
      pageParams: combinedParams,
    })

    // Fresh page always starts at the top — otherwise the new page renders
    // with the window still scrolled to the previous page's depth, which
    // looks like the design is "cut in half" until you scroll up enormously.
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  },

  goBack: () => {
    const { currentPage, previousPage, previousPageParams } = get()

    // Prefer the store's own navigation trail — always lands on the page
    // the user actually came FROM, never a random browser history entry.
    if (previousPage && previousPage !== currentPage) {
      window.history.back() // triggers popstate, which syncs the store
      return
    }
    if (currentPage !== 'home') {
      // No stored trail but not on home — go back to home directly
      set({
        previousPage: currentPage,
        previousPageParams: get().pageParams,
        currentPage: 'home',
        pageParams: {},
      })
    }
    // Already on home — let the host (Android) handle minimising the app.
  },
}))

// ─── Global popstate listener ───
// Triggered by the Android hardware back button (which maps to history.back())
// and by the browser's own back button. Sync the Zustand store from the
// History API state object we pushed earlier.
if (typeof window !== 'undefined') {
  // Never let the browser restore a stale scroll position on reload —
  // every page mount starts at the top.
  history.scrollRestoration = 'manual'

  window.addEventListener('popstate', (event) => {
    const parsed = fromHistoryState(event.state)
    if (parsed) {
      const { currentPage, pageParams } = useNavigationStore.getState()
      useNavigationStore.setState({
        previousPage: currentPage,
        previousPageParams: pageParams,
        currentPage: parsed.page,
        pageParams: parsed.params,
      })
      // Back navigation also lands at the top — we don't retain per-page
      // scroll positions, so restoring depth would show mid-page content.
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }
  })

  // Native-host soft-navigation contract: the embedded shells (Android
  // WebView / iOS WKWebView) probe this flag before driving in-page
  // navigation with history.pushState + a synthetic popstate (no document
  // reload). It flips only after THIS module — which owns the popstate
  // listener — has executed, so a synthetic event can never be lost. Browsers
  // never read it; the assignment is inert outside the native shells.
  ;(window as any).__zylodSpaReady = true

  // Establish the initial entry's state so going back to the very root still
  // resolves. IMPORTANT: does NOT strip the '?page=' deep-link param — AppEntry
  // reads window.location.search on mount to handle deep links, so we must not
  // rewrite the URL before its effect consumes it. Only tag the state object,
  // leaving the current URL (and its query) untouched.
  setTimeout(() => {
    const s = useNavigationStore.getState()
    const hasDeepLink = new URLSearchParams(window.location.search).has('page')
    if (!hasDeepLink) {
      window.history.replaceState(
        { page: s.currentPage, params: s.pageParams },
        '',
        window.location.pathname + paramsToSearch(s.pageParams),
      )
    }
  }, 0)
}