'use client';

import React from 'react';
import { BadgeCheck, ShieldAlert, Timer, ExternalLink, ShieldOff } from 'lucide-react';
import { useNavigationStore } from '@/store/navigation-store';

/**
 * THE STOREFRONT TRUST ROLLUP (Task 96) — Task 92's per-product
 * certification rail, aggregated onto the store level and rendered from the
 * SERVER-COMPUTED rollup on GET /api/supplier/storefront. This component
 * invents NOTHING: every row, count and issuer comes from the rail; an
 * empty store renders an honest empty state, and an expired certificate is
 * badged — never hidden (hiding it would be a softer lie).
 */

export interface StorefrontCertRollup {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
  issuers: string[];
  recent: Array<{
    id: string;
    certName: string;
    issuedBy: string;
    issuedAt: string;
    expiresAt: string | null;
    status: string;
    productId: string;
    productName: string;
  }>;
}

const STATUS_META: Record<string, { label: string; cls: string; Icon: typeof BadgeCheck }> = {
  active: { label: 'Valid', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', Icon: BadgeCheck },
  expiring_soon: { label: 'Expiring soon', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', Icon: Timer },
  expired: { label: 'Expired', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', Icon: ShieldAlert },
};

export const StorefrontCertifications = ({ rollup }: { rollup: StorefrontCertRollup | null | undefined }) => {
  const navigate = useNavigationStore((s) => s.navigate);

  if (!rollup || rollup.total === 0) {
    return (
      <div className="text-center py-10" aria-live="polite">
        <ShieldOff className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">No certifications on file</h3>
        <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
          This store has not published any product certifications yet. Compliance claims on Zylod come only from documents the supplier filed — never from the platform.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-live="polite">
      {/* Honest counters — expired is shown, not hidden */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3 text-center">
          <div className="text-lg font-bold text-green-600 dark:text-green-400 flex items-center justify-center gap-1">
            {rollup.active}
            <BadgeCheck className="w-4 h-4" />
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Valid</div>
        </div>
        <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3 text-center">
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
            {rollup.expiringSoon}
            <Timer className="w-4 h-4" />
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Expiring soon</div>
        </div>
        <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3 text-center">
          <div className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center justify-center gap-1">
            {rollup.expired}
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Expired</div>
        </div>
      </div>

      {/* Issuers actually on file */}
      {rollup.issuers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {rollup.issuers.map((issuer) => (
            <span
              key={issuer}
              className="text-[11px] px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
            >
              {issuer}
            </span>
          ))}
        </div>
      )}

      {/* Recent rows with real product attribution */}
      <div className="space-y-2">
        {rollup.recent.map((cert) => {
          const meta = STATUS_META[cert.status] ?? STATUS_META.active;
          const { Icon } = meta;
          return (
            <div
              key={cert.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{cert.certName}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {cert.issuedBy}
                    {cert.expiresAt
                      ? ` · valid until ${new Date(cert.expiresAt).toLocaleDateString()}`
                      : ' · no expiry on file'}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('product-detail', { productId: cert.productId })}
                    className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1 min-h-[24px]"
                  >
                    {cert.productName}
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${meta.cls}`}>
                  <Icon className="w-3 h-3" />
                  {meta.label}
                </span>
              </div>
            </div>
          );
        })}
        {rollup.total > rollup.recent.length && (
          <p className="text-[11px] text-gray-400 text-center">
            Showing the {rollup.recent.length} most recent of {rollup.total} filed certifications.
          </p>
        )}
      </div>
    </div>
  );
};

export default StorefrontCertifications;
