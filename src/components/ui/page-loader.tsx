'use client';

import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

interface PageLoaderProps {
  /** Optional label text. Defaults to "Loading…". */
  label?: string;
  /** Extra classes on the wrapper. */
  className?: string;
}

/**
 * THE single standard page-loading animation for the whole website
 * (mobile web + desktop). Use it for every page-level loading state —
 * when `isLoading`/`loading` is true and the main content area is empty.
 *
 * Interaction feedback (small spinners inside buttons during submit) is NOT
 * page loading — keep those inline.
 */
export function PageLoader({ label, className }: PageLoaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center min-h-[60vh] gap-3',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{label ?? 'Loading…'}</p>
    </div>
  );
}

export default PageLoader;
