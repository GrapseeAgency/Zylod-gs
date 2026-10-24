'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '@/store/navigation-store';
import {
  ArrowLeft, Loader2, Radio, CalendarClock, CheckCircle2, Archive,
  PlusCircle, Play, Square, Eye, ExternalLink, X, PackageSearch, Inbox,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * Seller "Go Live" console (Task 165) — the host-side UI for the broadcast
 * rails Task 142 made honest: schedule a session (POST /api/live-shopping),
 * see YOUR OWN streams with real state, and start/end the broadcast
 * (PATCH /api/live-shopping/[id]). Before this page those rails had zero
 * UI consumers — creation was API-side only.
 */

interface FeaturedProduct {
  id: string;
  name: string;
  basePrice: number;
  thumbnailUrl: string | null;
  isActive: boolean;
}

interface StreamRow {
  id: string;
  title: string;
  description: string;
  isLive: boolean;
  viewerCount: number;
  scheduledAt: string;
  endedAt: string | null;
  streamUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  featuredProducts: FeaturedProduct[];
}

interface ConsoleData {
  stats: { liveNow: number; scheduled: number; ended: number };
  streams: StreamRow[];
}

interface PickerProduct {
  id: string;
  name: string;
  basePrice: number;
}

const bdt = (n: number) =>
  `৳${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function SellerLiveConsolePage() {
  const navigate = useNavigationStore((state) => state.navigate);
  const goBack = useNavigationStore((state) => state.goBack);

  const [data, setData] = useState<ConsoleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);

  // Create form state
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [thumbUrl, setThumbUrl] = useState('');
  const [picker, setPicker] = useState<PickerProduct[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');

  // Per-row control state
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const loadConsole = useCallback(async () => {
    try {
      const res = await fetch('/api/supplier/live-streams');
      const json = await res.json().catch(() => null);
      if (res.status === 401) {
        setAuthRequired(true);
        setError('');
      } else if (res.ok && json?.success && json?.data) {
        setData(json.data);
        setError('');
        setAuthRequired(false);
      } else {
        setError(json?.error || 'Failed to load your broadcast console');
        setData(null);
      }
    } catch {
      setError('Could not reach the broadcast console service');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConsole();
  }, [loadConsole]);

  // Featured-product picker source: the seller's OWN active catalog.
  useEffect(() => {
    if (!formOpen || picker.length > 0) return;
    fetch('/api/supplier/products?status=active&limit=50')
      .then(res => res.json())
      .then(json => {
        if (json?.success && Array.isArray(json?.data?.items)) {
          setPicker(json.data.items.map((p: { id: string; name: string; basePrice: number }) => ({
            id: p.id, name: p.name, basePrice: p.basePrice,
          })));
        }
      })
      .catch(() => { /* picker stays empty — creation still works without featured products */ });
  }, [formOpen, picker.length]);

  const resetForm = () => {
    setTitle(''); setDescription(''); setScheduledAt('');
    setStreamUrl(''); setThumbUrl(''); setSelectedIds([]);
    setPickerOpen(false); setFormError('');
  };

  const handleCreate = async () => {
    setFormError('');
    if (title.trim().length < 3 || description.trim().length < 3) {
      setFormError('Give the broadcast a title and a description (at least 3 characters each).');
      return;
    }
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
      };
      if (scheduledAt) body.scheduledAt = new Date(scheduledAt).toISOString();
      if (streamUrl.trim()) body.streamUrl = streamUrl.trim();
      if (thumbUrl.trim()) body.thumbnailUrl = thumbUrl.trim();
      if (selectedIds.length > 0) body.featuredProductIds = selectedIds;

      const res = await fetch('/api/live-shopping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 201) {
        resetForm();
        setFormOpen(false);
        setToast('Broadcast scheduled — start it when the factory floor is ready.');
        await loadConsole();
        setTimeout(() => setToast(''), 4000);
      } else {
        setFormError(json?.error || `Scheduling failed (${res.status})`);
      }
    } catch {
      setFormError('Could not reach the scheduling service');
    } finally {
      setCreating(false);
    }
  };

  const handleControl = async (stream: StreamRow, action: 'start' | 'end') => {
    setBusyId(stream.id);
    setRowError(null);
    try {
      const res = await fetch(`/api/live-shopping/${stream.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        setToast(action === 'start'
          ? 'You are LIVE — the public room is open.'
          : 'Broadcast ended — the session is archived with its end time.');
        setTimeout(() => setToast(''), 4000);
        await loadConsole();
      } else {
        setRowError(json?.error || `Could not ${action} the broadcast (${res.status})`);
      }
    } catch {
      setRowError('Could not reach the broadcast control service');
    } finally {
      setBusyId(null);
    }
  };

  const toggleProduct = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8 dark:bg-gray-900"
    >
      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-50 bg-white dark:bg-gray-900 dark:bg-gray-800 border-b px-4 py-3 flex items-center gap-3">
        <button onClick={goBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:bg-gray-700" aria-label="Go back">
          <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300 dark:text-gray-200" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-white">Go Live console</h1>
      </header>

      <main className="p-4 space-y-6 md:p-6 md:max-w-5xl md:mx-auto md:pt-6">
        <div className="hidden md:flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 dark:text-white">Go Live console</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Schedule factory-floor broadcasts, feature your own products, and control when the room is actually live.
            </p>
          </div>
          <Button onClick={() => setFormOpen(o => !o)} className="shrink-0">
            {formOpen ? <><X className="h-4 w-4 mr-2" />Close form</> : <><PlusCircle className="h-4 w-4 mr-2" />Schedule broadcast</>}
          </Button>
        </div>

        {/* Mobile schedule trigger */}
        <Button className="md:hidden w-full" onClick={() => setFormOpen(o => !o)}>
          {formOpen ? <><X className="h-4 w-4 mr-2" />Close form</> : <><PlusCircle className="h-4 w-4 mr-2" />Schedule broadcast</>}
        </Button>

        {toast && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-900 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200" role="status" data-testid="live-console-toast">
            {toast}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : authRequired ? (
          <Card className="border-none shadow-sm dark:bg-gray-800">
            <CardContent className="p-8 text-center space-y-3">
              <Radio className="w-10 h-10 text-gray-300 mx-auto" />
              <h2 className="text-base font-bold dark:text-white">Seller sign-in required</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Sign in with a supplier account to schedule and control broadcasts.</p>
              <button onClick={() => navigate('login')} className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground">
                Sign In
              </button>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-none shadow-sm dark:bg-gray-800">
            <CardContent className="p-6 text-center text-sm text-gray-600 dark:text-gray-400 dark:text-gray-300">{error}</CardContent>
          </Card>
        ) : data ? (
          <>
            {/* Honest counters from the real rows */}
            <div className="grid grid-cols-3 gap-3" data-testid="live-console-stats">
              <Card className="border-none shadow-sm dark:bg-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <Radio className="w-4 h-4" />
                    <span className="text-xs font-medium">Live now</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-white" data-testid="live-console-live-now">{data.stats.liveNow}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">rooms open to buyers</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm dark:bg-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
                    <CalendarClock className="w-4 h-4" />
                    <span className="text-xs font-medium">Scheduled</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-white" data-testid="live-console-scheduled">{data.stats.scheduled}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">waiting to go live</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm dark:bg-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <Archive className="w-4 h-4" />
                    <span className="text-xs font-medium">Ended</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-white" data-testid="live-console-ended">{data.stats.ended}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">archived sessions</p>
                </CardContent>
              </Card>
            </div>

            {/* Schedule form */}
            {formOpen && (
              <Card className="border shadow-sm dark:bg-gray-800" data-testid="live-console-form">
                <CardContent className="p-4 md:p-6 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="live-title" className="text-xs font-medium">Title *</Label>
                      <Input id="live-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Knitting line walkthrough — winter stock" className="dark:bg-gray-900" maxLength={160} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="live-scheduled" className="text-xs font-medium">Scheduled for (optional — defaults to now)</Label>
                      <Input id="live-scheduled" type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="dark:bg-gray-900" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="live-desc" className="text-xs font-medium">What buyers will see *</Label>
                    <Textarea id="live-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the walkthrough: the machines, the lots, the prices you'll show live." className="dark:bg-gray-900 min-h-20" maxLength={2000} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="live-stream-url" className="text-xs font-medium">Stream URL (optional)</Label>
                      <Input id="live-stream-url" value={streamUrl} onChange={e => setStreamUrl(e.target.value)} placeholder="rtmp:// or https:// ingest endpoint" className="dark:bg-gray-900" maxLength={500} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="live-thumb-url" className="text-xs font-medium">Thumbnail URL (optional)</Label>
                      <Input id="live-thumb-url" value={thumbUrl} onChange={e => setThumbUrl(e.target.value)} placeholder="https://… cover image" className="dark:bg-gray-900" maxLength={500} />
                    </div>
                  </div>

                  {/* Featured products picker — own active catalog only */}
                  <div className="space-y-2">
                    <button type="button" onClick={() => setPickerOpen(o => !o)} className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-primary" aria-expanded={pickerOpen}>
                      <PackageSearch className="h-4 w-4" />
                      Featured products {selectedIds.length > 0 && <Badge className="text-[10px]">{selectedIds.length} selected</Badge>}
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 font-normal">(your own active listings)</span>
                    </button>
                    {pickerOpen && (
                      <div className="max-h-48 overflow-y-auto rounded-md border dark:border-gray-700 divide-y dark:divide-gray-700">
                        {picker.length === 0 ? (
                          <p className="p-3 text-xs text-gray-500 dark:text-gray-400">No active products found — approve listings first, or schedule without featured products.</p>
                        ) : picker.map(p => (
                          <label key={p.id} className="flex items-center gap-3 p-3 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 dark:hover:bg-gray-700/50">
                            <Checkbox checked={selectedIds.includes(p.id)} onCheckedChange={() => toggleProduct(p.id)} aria-label={`Feature ${p.name}`} />
                            <span className="flex-1 truncate text-gray-800 dark:text-gray-200">{p.name}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">{bdt(p.basePrice)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {formError && (
                    <p className="text-sm text-red-600 dark:text-red-400" role="alert">{formError}</p>
                  )}

                  <div className="flex items-center gap-3">
                    <Button onClick={handleCreate} disabled={creating} data-testid="live-console-submit">
                      {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarClock className="h-4 w-4 mr-2" />}
                      Schedule broadcast
                    </Button>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      A schedule is NOT live — buyers see it as upcoming until you press Start.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Streams list */}
            {data.streams.length === 0 ? (
              <Card className="border-dashed dark:bg-gray-800">
                <CardContent className="p-10 text-center space-y-2">
                  <Inbox className="w-10 h-10 text-gray-300 mx-auto" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-200">No broadcasts yet</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Schedule your first factory-floor walkthrough — buyers watch from the Live Shopping page.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3" data-testid="live-console-list">
                {data.streams.map(s => (
                  <Card key={s.id} className={`border-none shadow-sm dark:bg-gray-800 ${s.isLive ? 'ring-2 ring-red-500' : ''}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {s.isLive ? (
                          <Badge className="bg-red-600 hover:bg-red-600 text-white text-[10px] gap-1" data-testid={`live-state-${s.id}`}>
                            <Radio className="h-3 w-3 animate-pulse" /> LIVE
                          </Badge>
                        ) : s.endedAt ? (
                          <Badge className="bg-gray-200 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 text-[10px]">ENDED</Badge>
                        ) : (
                          <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-300 text-[10px]">SCHEDULED</Badge>
                        )}
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 dark:text-white text-sm flex-1 min-w-40">{s.title}</h3>
                        {s.isLive && (
                          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400" title="Live viewers">
                            <Eye className="h-3.5 w-3.5" /> {s.viewerCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-300 line-clamp-2">{s.description}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Scheduled: {fmtDateTime(s.scheduledAt)}</span>
                        {s.endedAt && <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Ended: {fmtDateTime(s.endedAt)}</span>}
                      </div>

                      {/* Featured products — resolved from the real catalog */}
                      {s.featuredProducts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {s.featuredProducts.map(p => (
                            <span key={p.id} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-900 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                              {p.name} · {bdt(p.basePrice)}
                            </span>
                          ))}
                        </div>
                      )}

                      {rowError && busyId === s.id && <p className="text-xs text-red-600 dark:text-red-400" role="alert">{rowError}</p>}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {s.isLive ? (
                          <Button size="sm" variant="destructive" onClick={() => handleControl(s, 'end')} disabled={busyId === s.id} data-testid={`live-end-${s.id}`}>
                            {busyId === s.id ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Square className="h-3.5 w-3.5 mr-1.5" />}
                            End broadcast
                          </Button>
                        ) : !s.endedAt ? (
                          <Button size="sm" onClick={() => handleControl(s, 'start')} disabled={busyId === s.id} data-testid={`live-start-${s.id}`}>
                            {busyId === s.id ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                            Go live
                          </Button>
                        ) : (
                          <span className="text-[11px] text-gray-400 dark:text-gray-500">Session archived</span>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => navigate('live-shopping-detail', { id: s.id })}>
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Public room
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : null}
      </main>
    </motion.div>
  );
}
