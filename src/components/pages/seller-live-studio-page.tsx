'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '@/store/navigation-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ArrowLeft, Radio, Loader2, CalendarClock, Eye, Play, Square,
  ExternalLink, Package, Plus, RefreshCw, Video,
} from 'lucide-react';

interface FeaturedProduct {
  id: string;
  name: string;
  basePrice: number;
  thumbnailUrl: string | null;
  isActive: boolean;
  isApproved: boolean;
}

interface StreamRow {
  id: string;
  title: string;
  description: string;
  streamUrl: string | null;
  isLive: boolean;
  viewerCount: number;
  scheduledAt: string;
  endedAt: string | null;
  featuredProducts: FeaturedProduct[];
}

const bdt = (n: number) => `৳${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function stateOf(s: StreamRow): 'live' | 'ended' | 'scheduled' {
  if (s.isLive) return 'live';
  if (s.endedAt) return 'ended';
  return 'scheduled';
}

export function SellerLiveStudioPage() {
  const navigate = useNavigationStore((state) => state.navigate);
  const goBack = useNavigationStore((state) => state.goBack);

  const [streams, setStreams] = useState<StreamRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // schedule dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [products, setProducts] = useState<FeaturedProduct[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [when, setWhen] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/supplier/live-shopping');
      const json = await res.json().catch(() => null);
      if (res.status === 401) {
        setAuthRequired(true);
        setError('');
      } else if (res.status === 403) {
        setAuthRequired(false);
        setError(json?.error || 'A seller profile is required.');
      } else if (res.ok && json?.success && json?.data) {
        setStreams(json.data.streams);
        setError('');
      } else {
        setError(json?.error || 'Failed to load broadcasts.');
      }
    } catch {
      setError('Network error loading broadcasts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDialog = async () => {
    setDialogOpen(true);
    setPicked(new Set());
    try {
      const res = await fetch('/api/supplier/products?status=approved&limit=50');
      const json = await res.json().catch(() => null);
      const rows = json?.data?.items ?? json?.data?.products ?? (Array.isArray(json?.data) ? json.data : []);
      setProducts(Array.isArray(rows) ? rows : []);
    } catch {
      setProducts([]);
    }
  };

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const schedule = async () => {
    if (title.trim().length < 3 || description.trim().length < 3) {
      toast.error('A broadcast needs a real title and description (3+ characters).');
      return;
    }
    try {
      setCreating(true);
      const res = await fetch('/api/live-shopping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          ...(when ? { scheduledAt: new Date(when).toISOString() } : {}),
          ...(streamUrl.trim() ? { streamUrl: streamUrl.trim() } : {}),
          ...(picked.size > 0 ? { featuredProductIds: [...picked] } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 201) {
        toast.success('Broadcast scheduled — it goes live only when YOU start it.');
        setDialogOpen(false);
        setTitle(''); setDescription(''); setWhen(''); setStreamUrl('');
        await load();
      } else {
        toast.error(json?.error || `Could not schedule (${res.status}).`);
      }
    } catch {
      toast.error('Network error scheduling the broadcast.');
    } finally {
      setCreating(false);
    }
  };

  const control = async (stream: StreamRow, action: 'start' | 'end') => {
    try {
      setBusyId(stream.id);
      const res = await fetch(`/api/live-shopping/${stream.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        toast.success(action === 'start' ? 'YOU ARE LIVE — the room is open.' : 'Broadcast ended.');
        await load();
      } else {
        toast.error(json?.error || `Control failed (${res.status}).`);
      }
    } catch {
      toast.error('Network error controlling the broadcast.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 dark:bg-gray-800 px-4 md:px-6 py-4 shadow-sm sticky top-0 z-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={goBack} className="md:hidden p-2 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 dark:hover:bg-gray-700 transition" aria-label="Go back">
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300 dark:text-gray-200" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <Radio className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="font-bold text-gray-900 dark:text-gray-100 dark:text-white text-base md:text-xl truncate">Live Studio</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Schedule broadcasts and control the room</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={load} aria-label="Refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={openDialog} className="bg-rose-600 hover:bg-rose-700 text-white h-9">
            <Plus className="w-4 h-4 mr-1" /> Schedule
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-4 pb-24 md:pb-8">
        {/* Doctrine strip */}
        <div className="rounded-2xl border border-rose-100 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 px-4 py-3 text-xs text-rose-800 dark:text-rose-200">
          A schedule is a promise, not a live state: the room opens only when you press <strong>Go Live</strong> — buyers watching the
          public feed see it the moment you do. Going live and ending are audited.
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-900 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 dark:border-gray-700 p-5 space-y-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        ) : authRequired ? (
          <div className="bg-white dark:bg-gray-900 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 dark:border-gray-700 p-8 text-center space-y-3">
            <Video className="w-10 h-10 mx-auto text-gray-300" />
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-white">Sign in as a seller to run your Live Studio</p>
            <Button size="sm" onClick={() => navigate('login')}>Sign In</Button>
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-gray-900 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 dark:border-gray-700 p-8 text-center text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300">{error}</div>
        ) : !streams || streams.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 dark:border-gray-700 p-8 text-center space-y-3">
            <Radio className="w-10 h-10 mx-auto text-gray-300" />
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-white">No broadcasts yet</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Schedule your first live factory tour — pick the products you will feature.</p>
            <Button size="sm" onClick={openDialog} className="bg-rose-600 hover:bg-rose-700 text-white">
              <Plus className="w-4 h-4 mr-1" /> Schedule a broadcast
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {streams.map((s) => {
              const st = stateOf(s);
              const busy = busyId === s.id;
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-gray-900 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 dark:border-gray-700 p-4 sm:p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {st === 'live' && (
                          <Badge className="bg-red-600 text-white gap-1">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white dark:bg-gray-900 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-white dark:bg-gray-900" />
                            </span>
                            LIVE
                          </Badge>
                        )}
                        {st === 'scheduled' && <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">SCHEDULED</Badge>}
                        {st === 'ended' && <Badge variant="outline" className="border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-950">ENDED</Badge>}
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 dark:text-white text-sm sm:text-base truncate">{s.title}</h3>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 line-clamp-2 mt-1">{s.description}</p>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                      <div className="flex items-center justify-end gap-1 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                        <CalendarClock className="w-3.5 h-3.5" /> {fmtWhen(s.scheduledAt)}
                      </div>
                      {st === 'live' && (
                        <div className="flex items-center justify-end gap-1 text-xs font-semibold text-red-600">
                          <Eye className="w-3.5 h-3.5" /> {s.viewerCount} watching
                        </div>
                      )}
                      {s.endedAt && (
                        <div className="text-[11px] text-gray-400 dark:text-gray-500 dark:text-gray-400">ended {fmtWhen(s.endedAt)}</div>
                      )}
                    </div>
                  </div>

                  {s.featuredProducts.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Package className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 dark:text-gray-400" />
                      {s.featuredProducts.map((p) => (
                        <Badge key={p.id} variant="secondary" className="text-[11px] font-medium">
                          {p.name} · {bdt(p.basePrice)}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    {st === 'scheduled' && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => control(s, 'start')}
                        className="bg-red-600 hover:bg-red-700 text-white h-9"
                      >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 mr-1" />} Go Live
                      </Button>
                    )}
                    {st === 'live' && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => control(s, 'end')}
                        variant="outline"
                        className="border-red-200 text-red-700 hover:bg-red-50 h-9"
                      >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4 mr-1" />} End Broadcast
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate('live-shopping-detail', { id: s.id })}
                      className="h-9 text-gray-600 dark:text-gray-400 dark:text-gray-500"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" /> View buyer room
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {/* Schedule dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule a live broadcast</DialogTitle>
            <DialogDescription>
              Featured products must belong to your store. The room opens only when you press Go Live.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ls-title">Title</Label>
              <Input id="ls-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Live from the loom — monsoon collection" maxLength={160} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ls-desc">Description</Label>
              <Textarea id="ls-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What buyers will see and hear on the floor" maxLength={2000} rows={3} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ls-when">Goes-live plan (optional)</Label>
                <Input id="ls-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ls-url">Stream URL (optional)</Label>
                <Input id="ls-url" value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} placeholder="https://…" maxLength={500} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Featured products ({picked.size} picked)</Label>
              {products.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Loading your approved products…</p>
              ) : (
                <div className="max-h-44 overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-800 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-800">
                  {products.map((p) => (
                    <label key={p.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-800 dark:hover:bg-gray-900">
                      <input
                        type="checkbox"
                        checked={picked.has(p.id)}
                        onChange={() => togglePick(p.id)}
                        className="accent-rose-600"
                      />
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate flex-1">{p.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 flex-shrink-0">{bdt(p.basePrice)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <Button
              onClick={schedule}
              disabled={creating}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white h-10"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Radio className="w-4 h-4 mr-1" />}
              Schedule broadcast
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SellerLiveStudioPage;
