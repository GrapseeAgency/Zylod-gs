'use client'

import React, { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  /** Optional fallback renderer; receives the reset handler. */
  fallback?: (reset: () => void, error: Error) => ReactNode
}

interface State {
  error: Error | null
  /** A token that bumps whenever the boundary should clear. Changing this key
   *  on a child (e.g. via route key) also resets the boundary. */
  resetToken: number
}

/**
 * Production error boundary for Zylod.
 *
 * Catches render-time crashes anywhere in the tree and shows a clean,
 * on-brand recovery UI — never raw component stacks to end users.
 *
 * Errors are logged to the console for developer visibility and keyed
 * by a resetToken so navigation to a new route clears the boundary.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetToken: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Developer-only logging — no UI exposure of the stack.
    console.error('[Zylod] Render error caught:', error, info.componentStack)
  }

  reset = () => {
    this.setState({ error: null, resetToken: this.state.resetToken + 1 })
  }

  render() {
    const { error } = this.state
    if (!error) {
      // Re-key children so the boundary resets when we clear.
      return <React.Fragment key={this.state.resetToken}>{this.props.children}</React.Fragment>
    }

    if (this.props.fallback) {
      return <>{this.props.fallback(this.reset, error)}</>
    }

    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full flex items-center justify-center bg-red-50">
            <AlertTriangle className="h-7 w-7 text-red-500" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
              We hit an unexpected issue loading this page. Please try again — your cart and account are safe.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Button onClick={this.reset} className="bg-primary text-primary-foreground">
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Try again
            </Button>
            <Button variant="outline" onClick={() => { window.location.href = '/' }}>
              Go home
            </Button>
          </div>
          {/* In development, surface the message (no stack) for faster triage. */}
          {process.env.NODE_ENV !== 'production' && (
            <p className="text-xs text-muted-foreground/70 pt-2 break-words font-mono">
              {error.message}
            </p>
          )}
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
