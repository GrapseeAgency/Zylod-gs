'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Scale, Milestone as MilestoneIcon, Plus, Trash2, Loader2, Pencil, FileX2, FileCheck2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Task 106: THE COMPANY CONSOLE — the platform's own voice. Two rails whose
 * public readers have existed since day one but whose writers did not:
 *  - Legal documents: nine fixed slots (the docType slugs the public pages
 *    actually fetch). docType is @unique, so editing keeps the SAME row —
 *    the console can never mint a document no page serves.
 *  - Company milestones: the About timeline. A draft is invisible on the
 *    public rail while the console keeps the row.
 * Server errors render verbatim; the console never invents success.
 */

interface LegalDocument {
  id: string;
  docType: string;
  titleEn: string;
  titleBn: string | null;
  contentEn: string;
  contentBn: string | null;
  version: string;
  effectiveDate: string;
  isActive: boolean;
  updatedAt: string;
}

interface LegalSlot {
  docType: string;
  label: string;
  filled: boolean;
  document: LegalDocument | null;
}

interface Milestone {
  id: string;
  year: number;
  month: number | null;
  title: string;
  description: string;
  iconType: string | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
}

const ICONS = ['star', 'rocket', 'users', 'package', 'globe', 'award', 'building', 'trending'];

const EMPTY_LEGAL_FORM = { titleEn: '', titleBn: '', contentEn: '', contentBn: '', version: '1.0', effectiveDate: '', isActive: true };
const EMPTY_MILESTONE_FORM = { year: String(new Date().getFullYear()), month: '', title: '', description: '', iconType: 'star', sortOrder: '0', isPublished: true };

export function AdminCompanyManager() {
  const [slots, setSlots] = useState<LegalSlot[]>([]);
  const [legalStats, setLegalStats] = useState<{ published: number; parked: number; empty: number } | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [mStats, setMStats] = useState<{ total: number; published: number; drafts: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [legalOpen, setLegalOpen] = useState(false);
  const [legalForm, setLegalForm] = useState(EMPTY_LEGAL_FORM);
  const [legalError, setLegalError] = useState('');
  const [savingLegal, setSavingLegal] = useState(false);
  const [legalTarget, setLegalTarget] = useState<LegalSlot | null>(null);
  const [legalDeleteTarget, setLegalDeleteTarget] = useState<LegalSlot | null>(null);

  const [mOpen, setMOpen] = useState(false);
  const [mForm, setMForm] = useState(EMPTY_MILESTONE_FORM);
  const [mError, setMError] = useState('');
  const [savingM, setSavingM] = useState(false);
  const [mEditing, setMEditing] = useState<Milestone | null>(null);
  const [mDeleteTarget, setMDeleteTarget] = useState<Milestone | null>(null);

  const load = useCallback(async () => {
    try {
      const [legalRes, mRes] = await Promise.all([
        fetch('/api/admin/legal', { credentials: 'include' }),
        fetch('/api/admin/milestones', { credentials: 'include' }),
      ]);
      const legalJson = await legalRes.json().catch(() => null);
      const mJson = await mRes.json().catch(() => null);
      if (legalRes.status === 401 || legalRes.status === 403 || mRes.status === 401 || mRes.status === 403) {
        setRefreshError('Admin session required — sign in again to manage company content.');
        return;
      }
      if (!legalRes.ok || !legalJson?.success) {
        setRefreshError(legalJson?.error || `Failed to load legal slots (HTTP ${legalRes.status})`);
        return;
      }
      if (!mRes.ok || !mJson?.success) {
        setRefreshError(mJson?.error || `Failed to load milestones (HTTP ${mRes.status})`);
        return;
      }
      setSlots(legalJson.data ?? []);
      const published = (legalJson.data ?? []).filter((s: LegalSlot) => s.filled && s.document?.isActive).length;
      const parked = (legalJson.data ?? []).filter((s: LegalSlot) => s.filled && !s.document?.isActive).length;
      setLegalStats({ published, parked, empty: (legalJson.data ?? []).length - published - parked });
      setMilestones(mJson.data ?? []);
      setMStats(mJson.stats ?? null);
      setRefreshError('');
    } catch {
      setRefreshError('Could not reach the company content service');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openLegal = (slot: LegalSlot) => {
    setLegalTarget(slot);
    const d = slot.document;
    setLegalForm(d ? {
      titleEn: d.titleEn,
      titleBn: d.titleBn ?? '',
      contentEn: d.contentEn,
      contentBn: d.contentBn ?? '',
      version: d.version,
      effectiveDate: d.effectiveDate.slice(0, 10),
      isActive: d.isActive,
    } : EMPTY_LEGAL_FORM);
    setLegalError('');
    setLegalOpen(true);
  };

  const saveLegal = async () => {
    if (!legalTarget) return;
    setLegalError('');
    if (legalForm.titleEn.trim().length < 3) { setLegalError('Title must be at least 3 characters.'); return; }
    if (legalForm.contentEn.trim().length < 40) { setLegalError('Legal content must be at least 40 characters.'); return; }
    if (!legalForm.version.trim()) { setLegalError('Version is required (e.g. 1.0).'); return; }
    setSavingLegal(true);
    try {
      const res = await fetch(`/api/admin/legal/${legalTarget.docType}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titleEn: legalForm.titleEn,
          titleBn: legalForm.titleBn.trim() || null,
          contentEn: legalForm.contentEn,
          contentBn: legalForm.contentBn.trim() || null,
          version: legalForm.version,
          ...(legalForm.effectiveDate ? { effectiveDate: new Date(`${legalForm.effectiveDate}T00:00:00Z`).toISOString() } : {}),
          isActive: legalForm.isActive,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        toast.success(json.data.isActive ? `${legalTarget.label} saved — live on the public page` : `${legalTarget.label} saved — parked (public page refuses)`);
        setLegalOpen(false);
        setLegalTarget(null);
        load();
      } else {
        setLegalError(json?.error || `Could not save (HTTP ${res.status})`);
      }
    } catch {
      setLegalError('Could not reach the legal content service');
    } finally {
      setSavingLegal(false);
    }
  };

  const doDeleteLegal = async () => {
    if (!legalDeleteTarget) return;
    setBusyKey(`legal-del-${legalDeleteTarget.docType}`);
    try {
      const res = await fetch(`/api/admin/legal/${legalDeleteTarget.docType}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        toast.success(`${legalDeleteTarget.label} removed — the slot is empty again`);
        load();
      } else {
        const json = await res.json().catch(() => null);
        toast.error(json?.error || `Could not delete (HTTP ${res.status})`);
      }
    } catch {
      toast.error('Could not reach the legal content service');
    } finally {
      setBusyKey(null);
      setLegalDeleteTarget(null);
    }
  };

  const openMilestone = (m: Milestone | null) => {
    setMEditing(m);
    setMForm(m ? {
      year: String(m.year),
      month: m.month ? String(m.month) : '',
      title: m.title,
      description: m.description,
      iconType: m.iconType ?? 'star',
      sortOrder: String(m.sortOrder),
      isPublished: m.isPublished,
    } : EMPTY_MILESTONE_FORM);
    setMError('');
    setMOpen(true);
  };

  const saveMilestone = async () => {
    setMError('');
    const year = Number(mForm.year);
    if (!Number.isInteger(year) || year < 1990 || year > 2100) { setMError('Year must be a whole number between 1990 and 2100.'); return; }
    const month = mForm.month.trim() ? Number(mForm.month) : null;
    if (month !== null && (!Number.isInteger(month) || month < 1 || month > 12)) { setMError('Month must be 1–12.'); return; }
    if (mForm.title.trim().length < 3) { setMError('Title must be at least 3 characters.'); return; }
    if (mForm.description.trim().length < 10) { setMError('Description must be at least 10 characters.'); return; }
    setSavingM(true);
    try {
      const payload = {
        year,
        ...(month !== null ? { month } : { month: null }),
        title: mForm.title,
        description: mForm.description,
        iconType: mForm.iconType,
        sortOrder: Number(mForm.sortOrder) || 0,
        isPublished: mForm.isPublished,
      };
      const res = await fetch(mEditing ? `/api/admin/milestones/${mEditing.id}` : '/api/admin/milestones', {
        method: mEditing ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if ((res.status === 200 || res.status === 201) && json?.success) {
        toast.success(mEditing ? 'Milestone updated' : json.data.isPublished ? 'Milestone published — live on the About timeline' : 'Milestone saved as draft');
        setMOpen(false);
        setMEditing(null);
        load();
      } else {
        setMError(json?.error || `Could not save (HTTP ${res.status})`);
      }
    } catch {
      setMError('Could not reach the milestones service');
    } finally {
      setSavingM(false);
    }
  };

  const toggleMilestone = async (m: Milestone) => {
    setBusyKey(`m-${m.id}`);
    try {
      const res = await fetch(`/api/admin/milestones/${m.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !m.isPublished }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        toast.success(json.data.isPublished ? 'Published — live on the About timeline' : 'Unpublished — the timeline now hides it');
        load();
      } else {
        toast.error(json?.error || `Could not update (HTTP ${res.status})`);
      }
    } catch {
      toast.error('Could not reach the milestones service');
    } finally {
      setBusyKey(null);
    }
  };

  const doDeleteMilestone = async () => {
    if (!mDeleteTarget) return;
    setBusyKey(`m-del-${mDeleteTarget.id}`);
    try {
      const res = await fetch(`/api/admin/milestones/${mDeleteTarget.id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        toast.success('Milestone deleted');
        load();
      } else {
        const json = await res.json().catch(() => null);
        toast.error(json?.error || `Could not delete (HTTP ${res.status})`);
      }
    } catch {
      toast.error('Could not reach the milestones service');
    } finally {
      setBusyKey(null);
      setMDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      {refreshError && (
        <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2" role="alert">
          {refreshError}
        </p>
      )}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* ── Legal documents ─────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-sm font-bold flex items-center gap-1.5"><Scale className="h-4 w-4" /> Legal documents</h3>
              {legalStats && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-0">{legalStats.published} live</Badge>
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-0">{legalStats.parked} parked</Badge>
                  <Badge variant="secondary" className="border-0">{legalStats.empty} empty</Badge>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              The nine documents the public pages fetch by slug. Parking one makes the public page refuse (the same 404 as never written); deleting removes the row entirely.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {slots.map((slot) => {
                const d = slot.document;
                const busy = busyKey === `legal-del-${slot.docType}`;
                return (
                  <div key={slot.docType} className="flex items-center gap-3 rounded-lg border p-3">
                    {slot.filled && d?.isActive ? (
                      <FileCheck2 className="h-4 w-4 shrink-0 text-green-600" />
                    ) : slot.filled ? (
                      <FileX2 className="h-4 w-4 shrink-0 text-amber-600" />
                    ) : (
                      <FileX2 className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold truncate">{slot.label}</h4>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          slot.filled && d?.isActive ? 'bg-green-500/10 text-green-600' : slot.filled ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'
                        }`}>
                          {slot.filled && d?.isActive ? 'Live' : slot.filled ? 'Parked' : 'Not written'}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        /{slot.docType}
                        {d ? ` · v${d.version} · effective ${new Date(d.effectiveDate).toLocaleDateString('en-GB')}` : ' · the public page shows its honest pending state'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="outline" size="sm" className="h-8" onClick={() => openLegal(slot)} aria-label={`Edit ${slot.label}`}>
                        <Pencil className="h-3 w-3 mr-1" /> {slot.filled ? 'Edit' : 'Write'}
                      </Button>
                      {slot.filled && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setLegalDeleteTarget(slot)} aria-label={`Delete ${slot.label}`} disabled={busy}>
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Company milestones ───────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-sm font-bold flex items-center gap-1.5"><MilestoneIcon className="h-4 w-4" /> Company milestones</h3>
              {mStats && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-0">{mStats.published} live</Badge>
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-0">{mStats.drafts} drafts</Badge>
                </div>
              )}
              <div className="flex-1" />
              <Button size="sm" onClick={() => openMilestone(null)}>
                <Plus className="h-4 w-4 mr-1.5" /> Add milestone
              </Button>
            </div>
            {milestones.length === 0 ? (
              <div className="text-center py-10 rounded-xl border border-dashed">
                <MilestoneIcon className="h-9 w-9 mx-auto text-muted-foreground/30 mb-2" />
                <h3 className="text-sm font-semibold">No milestones yet</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                  The About timeline is an honest empty frame until the company story is written here.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {milestones.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="shrink-0 text-center w-14">
                      <div className="text-sm font-bold leading-none">{m.year}</div>
                      <div className="text-[10px] text-muted-foreground">{m.month ? new Date(2000, m.month - 1, 1).toLocaleString('en', { month: 'short' }) : '—'}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold truncate">{m.title}</h4>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          m.isPublished ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'
                        }`}>
                          {m.isPublished ? 'Live' : 'Draft'}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{m.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={m.isPublished}
                        disabled={busyKey === `m-${m.id}`}
                        onCheckedChange={() => toggleMilestone(m)}
                        aria-label={`${m.isPublished ? 'Unpublish' : 'Publish'} ${m.title}`}
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openMilestone(m)} aria-label={`Edit ${m.title}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setMDeleteTarget(m)} aria-label={`Delete ${m.title}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Legal editor dialog */}
      <Dialog open={legalOpen} onOpenChange={(o) => { if (!o) { setLegalOpen(false); setLegalTarget(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{legalTarget?.filled ? 'Edit' : 'Write'} {legalTarget?.label}</DialogTitle>
            <DialogDescription>
              Slug: /{legalTarget?.docType} — fixed by the public page that fetches it. Parking a document makes the public page refuse; the version and effective date are shown to visitors.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium block mb-1">Title (English) *</label>
                <Input value={legalForm.titleEn} onChange={(e) => setLegalForm({ ...legalForm, titleEn: e.target.value })} maxLength={160} placeholder="Terms of Service" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Version *</label>
                <Input value={legalForm.version} onChange={(e) => setLegalForm({ ...legalForm, version: e.target.value })} maxLength={24} placeholder="1.0" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Title (Bangla)</label>
              <Input value={legalForm.titleBn} onChange={(e) => setLegalForm({ ...legalForm, titleBn: e.target.value })} maxLength={160} placeholder="শর্তাবলী (optional)" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Content (English) * — blank lines split sections</label>
              <Textarea value={legalForm.contentEn} onChange={(e) => setLegalForm({ ...legalForm, contentEn: e.target.value })} rows={10} placeholder="1. Acceptance of terms&#10;&#10;By using Zylod you agree…" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Content (Bangla)</label>
              <Textarea value={legalForm.contentBn} onChange={(e) => setLegalForm({ ...legalForm, contentBn: e.target.value })} rows={4} placeholder="বাংলা অনুবাদ (optional)" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1">Effective date</label>
                <Input type="date" value={legalForm.effectiveDate} onChange={(e) => setLegalForm({ ...legalForm, effectiveDate: e.target.value })} aria-label="Effective date" />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3 self-end">
                <div>
                  <p className="text-sm font-medium">Active (live)</p>
                  <p className="text-xs text-muted-foreground">Off = parked; the public page refuses.</p>
                </div>
                <Switch checked={legalForm.isActive} onCheckedChange={(c) => setLegalForm({ ...legalForm, isActive: c })} aria-label="Document active" />
              </div>
            </div>
            {legalError && (
              <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded px-2 py-1.5" role="alert">{legalError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setLegalOpen(false); setLegalTarget(null); }}>Cancel</Button>
            <Button onClick={saveLegal} disabled={savingLegal || !legalForm.titleEn.trim() || !legalForm.contentEn.trim()}>
              {savingLegal ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Legal delete confirmation */}
      <AlertDialog open={!!legalDeleteTarget} onOpenChange={(o) => { if (!o) setLegalDeleteTarget(null); }}>
        <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{legalDeleteTarget?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the row entirely — the slot returns to "Not written" and the public page shows its honest pending state. Cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDeleteLegal} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Milestone editor dialog */}
      <Dialog open={mOpen} onOpenChange={(o) => { if (!o) { setMOpen(false); setMEditing(null); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mEditing ? 'Edit milestone' : 'Add milestone'}</DialogTitle>
            <DialogDescription>
              The About timeline shows published milestones, oldest year first. Drafts stay console-only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1">Year *</label>
                <Input type="number" value={mForm.year} onChange={(e) => setMForm({ ...mForm, year: e.target.value })} min={1990} max={2100} aria-label="Year" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Month (optional)</label>
                <Input type="number" value={mForm.month} onChange={(e) => setMForm({ ...mForm, month: e.target.value })} min={1} max={12} aria-label="Month" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Title *</label>
              <Input value={mForm.title} onChange={(e) => setMForm({ ...mForm, title: e.target.value })} maxLength={140} placeholder="Zylod launches B2B wholesale marketplace" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Description *</label>
              <Textarea value={mForm.description} onChange={(e) => setMForm({ ...mForm, description: e.target.value })} rows={3} maxLength={2000} placeholder="What happened and why it mattered." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1">Icon</label>
                <select value={mForm.iconType} onChange={(e) => setMForm({ ...mForm, iconType: e.target.value })} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" aria-label="Icon type">
                  {ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Sort order</label>
                <Input type="number" value={mForm.sortOrder} onChange={(e) => setMForm({ ...mForm, sortOrder: e.target.value })} min={0} max={9999} aria-label="Sort order" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Published</p>
                <p className="text-xs text-muted-foreground">Drafts stay console-only.</p>
              </div>
              <Switch checked={mForm.isPublished} onCheckedChange={(c) => setMForm({ ...mForm, isPublished: c })} aria-label="Published" />
            </div>
            {mError && (
              <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded px-2 py-1.5" role="alert">{mError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setMOpen(false); setMEditing(null); }}>Cancel</Button>
            <Button onClick={saveMilestone} disabled={savingM || !mForm.title.trim() || !mForm.description.trim()}>
              {savingM ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {mEditing ? 'Save changes' : mForm.isPublished ? 'Publish' : 'Save draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Milestone delete confirmation */}
      <AlertDialog open={!!mDeleteTarget} onOpenChange={(o) => { if (!o) setMDeleteTarget(null); }}>
        <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{mDeleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. {mDeleteTarget?.isPublished ? 'The timeline will drop it immediately.' : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDeleteMilestone} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AdminCompanyManager;
