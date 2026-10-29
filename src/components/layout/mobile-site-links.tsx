'use client'

import { useState } from 'react'
import { useNavigationStore } from '@/store/navigation-store'
import { ChevronDown } from 'lucide-react'
import { BuildBadge } from '@/components/layout/build-badge'

/**
 * MobileSiteLinks (t220)
 *
 * The desktop Footer exposes ~77 site links (company, legal, support). The
 * mobile layout intentionally has no footer — the bottom bar owns navigation —
 * but that left EVERY legal/company page (privacy, terms, payment-terms,
 * careers, press, investor-relations, sitemap…) unreachable on phones: a real
 * coverage gap found in the t220 audit (mobile home exposed ZERO legal links).
 *
 * This component adds a compact, collapsible site-links section rendered by
 * AppShell above the bottom bar on every non-fullscreen mobile page. It uses
 * the same SPA navigate() as the footer (same scroll-to-top, same registry),
 * so every link is a real registered pageId — no fakes.
 *
 * In the native shells the block is page content (not nav chrome): Tier-3
 * pages rendered in the WebView show it too, giving native users one-tap
 * access to the legal pages the native bar does not carry.
 */

type LinkDef = { id: string; label: string }

const GROUPS: { title: string; links: LinkDef[] }[] = [
  {
    title: 'Support',
    links: [
      { id: 'help-center', label: 'Help Center' },
      { id: 'contact-us', label: 'Contact Us' },
      { id: 'track-order', label: 'Track Order' },
      { id: 'faq', label: 'FAQ' },
      { id: 'shipping-policy', label: 'Shipping Policy' },
      { id: 'dispute-resolution-guide', label: 'Dispute Resolution' },
    ],
  },
  {
    title: 'Company',
    links: [
      { id: 'about-us', label: 'About Zylod' },
      { id: 'careers-page', label: 'Careers' },
      { id: 'press-media', label: 'Press & Media' },
      { id: 'investor-relations', label: 'Investor Relations' },
      { id: 'sitemap', label: 'Sitemap' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { id: 'terms-of-service', label: 'Terms of Service' },
      { id: 'privacy-policy', label: 'Privacy Policy' },
      { id: 'payment-terms', label: 'Payment Terms & Escrow' },
      { id: 'cookie-policy', label: 'Cookie Policy' },
      { id: 'buyer-protection-policy', label: 'Buyer Protection' },
      { id: 'community-guidelines', label: 'Community Guidelines' },
      { id: 'dmca-policy', label: 'DMCA Policy' },
    ],
  },
]

export function MobileSiteLinks() {
  const { navigate } = useNavigationStore()
  const [open, setOpen] = useState(false)

  return (
    <section
      aria-label="Site links and legal"
      className="border-t border-border/60 bg-muted/40"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left active:opacity-80 transition-opacity"
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Site links &amp; legal
          </span>
          {/* t229h: the build badge was desktop-Footer-only, but the mobile
              layout renders THIS component instead of <Footer> — the Android
              WebView (mobile width) never showed any build identifier, which
              is exactly the stale-APK confusion the badge exists to kill. */}
          <BuildBadge />
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                {group.title}
              </p>
              <nav aria-label={group.title} className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {group.links.map((link) => (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => navigate(link.id)}
                    className="min-h-[36px] truncate py-1 text-left text-[13px] text-foreground/80 active:text-foreground transition-colors"
                  >
                    {link.label}
                  </button>
                ))}
              </nav>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
