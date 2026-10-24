import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * Returns `undefined` during SSR / first paint (before the matchMedia effect
 * runs), then `true`/`false` based on viewport width. Callers that need a
 * loading state can branch on `=== undefined`; callers that just need a
 * boolean can coerce with `!!`.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
