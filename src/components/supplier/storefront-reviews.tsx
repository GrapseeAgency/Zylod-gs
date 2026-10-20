'use client';

import React, { useState } from 'react';
import { Star, MessageSquarePlus, Trash2, Loader2, MessageSquareDashed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

/**
 * THE STOREFRONT REVIEWS TAB (Task 105) — the read half of the
 * supplierReviews circuit. The table always had a reader (this storefront's
 * API embeds reviews and the header shows the aggregates) but no writer and
 * no list UI, so a store's Reviews stat could only ever read 0 and every
 * buyer-facing promise of social proof stayed empty.
 *
 * - rows come from the storefront API's public projection: rating, comment,
 *   buyerName (display name only), createdAt, and `mine` — the server marks
 *   which row belongs to the signed-in viewer (no buyer identifiers leave).
 * - "Write a review" opens the dialog for any visitor; the server is the
 *   eligibility judge (buyer-only, real-order-only, one-per-buyer) and its
 *   error comes back verbatim — the UI never guesses eligibility.
 * - a `mine` row carries a Remove affordance → DELETE, then the parent
 *   refreshes so the aggregates recompute visibly.
 */

export interface StorefrontReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  buyerName: string;
  mine?: boolean;
}

interface Props {
  supplierId: string;
  rows: StorefrontReviewRow[];
  avg?: number;
  count?: number;
  onChanged?: () => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function Stars({ value, size = 'w-3.5 h-3.5' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${size} ${i <= value ? 'text-amber-400' : 'text-gray-200 dark:text-gray-600'}`}
          fill={i <= value ? 'currentColor' : 'none'}
        />
      ))}
    </span>
  );
}

export default function StorefrontReviews({ supplierId, rows, avg, count, onChanged }: Props) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pick, setPick] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const openDialog = () => {
    setPick(0);
    setComment('');
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!pick) {
      toast({ title: 'Pick a rating first', description: 'Tap the stars to rate this supplier.' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/suppliers/${encodeURIComponent(supplierId)}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rating: pick, ...(comment.trim() ? { comment: comment.trim() } : {}) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        // The server is the eligibility judge — its words, verbatim.
        toast({ title: 'Cannot publish review', description: json?.error || `Request failed (${res.status})` });
        return;
      }
      toast({ title: 'Review published', description: 'Thank you — your rating is now part of this store’s average.' });
      setDialogOpen(false);
      onChanged?.();
    } catch (e) {
      console.error(e);
      toast({ title: 'Could not reach the review service', description: 'Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const removeMine = async (reviewId: string) => {
    setRemovingId(reviewId);
    try {
      const res = await fetch(`/api/suppliers/${encodeURIComponent(supplierId)}/reviews`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast({ title: 'Could not remove review', description: json?.error || `Request failed (${res.status})` });
        return;
      }
      toast({ title: 'Review removed' });
      onChanged?.();
    } catch (e) {
      console.error(e);
      toast({ title: 'Could not reach the review service', description: 'Please try again.' });
    } finally {
      setRemovingId(null);
    }
  };

  const hasRows = rows.length > 0;

  return (
    <div className="space-y-4" aria-label="Store reviews">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {typeof avg === 'number' && count ? avg.toFixed(1) : '—'}
          </span>
          <Stars value={Math.round(avg ?? 0)} />
          <span className="text-xs text-gray-500">{count ?? 0} review{(count ?? 0) === 1 ? '' : 's'}</span>
        </div>
        <Button size="sm" onClick={openDialog} className="gap-1.5">
          <MessageSquarePlus className="w-4 h-4" />
          Write a review
        </Button>
      </div>

      {!hasRows ? (
        <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
          <MessageSquareDashed className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">No reviews yet</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
            Reviews come only from buyers with a real order from this store — the first one hasn&apos;t been written yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Stars value={r.rating} />
                  <p className="text-xs text-gray-500 mt-1">
                    {r.buyerName} · {formatDate(r.createdAt)}
                    {r.mine ? ' · you' : ''}
                  </p>
                </div>
                {r.mine && (
                  <button
                    onClick={() => removeMine(r.id)}
                    disabled={removingId === r.id}
                    aria-label="Remove my review"
                    className="p-1.5 text-gray-300 hover:text-red-600 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    {removingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                )}
              </div>
              {r.comment && (
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 whitespace-pre-line">{r.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review this supplier</DialogTitle>
            <DialogDescription>
              Ratings are limited to buyers with a real order from this store — one review per buyer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  onClick={() => setPick(i)}
                  aria-label={`Rate ${i} star${i > 1 ? 's' : ''}`}
                  className="p-1 rounded-full hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-8 h-8 ${i <= pick ? 'text-amber-400' : 'text-gray-200 dark:text-gray-600'}`}
                    fill={i <= pick ? 'currentColor' : 'none'}
                  />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="How was the product quality, communication, and delivery? (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={submitting || !pick} className="gap-1.5">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Publish review
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
