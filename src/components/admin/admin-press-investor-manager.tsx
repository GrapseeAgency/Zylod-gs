'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Newspaper, FileBarChart, Plus, Loader2, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

/**
 * Task 110: PRESS & INVESTOR CONSOLE — the writers for the four public
 * pages (media kit, investor relations, financial filings, annual report)
 * whose readers existed from day one. assetType/docType are constrained to
 * the exact vocabularies those pages group by; unpublishing parks a
 * document while the console keeps the row.
 */

interface Asset { id: string; assetType: string; title: string; fileUrl: string; isPublic: boolean }
interface Doc { id: string; docType: string; title: string; fiscalYear: string | null; fiscalQ: string | null; fileUrl: string; isPublished: boolean }

const ASSET_TYPES = ['logo', 'brand_guideline', 'photography', 'executive_photo', 'product_screenshot', 'press_photo'];
const DOC_TYPES = ['annual_report', 'quarterly_report', 'financial_filing', 'investor_presentation', 'shareholder_letter'];

const EMPTY_A = { assetType: 'logo', title: '', fileUrl: '', isPublic: true };
const EMPTY_D = { docType: 'annual_report', title: '', fiscalYear: '', fiscalQ: '', fileUrl: '', summary: '', isPublished: true };

export function AdminPressInvestorManager() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [aOpen, setAOpen] = useState(false);
  const [aForm, setAForm] = useState(EMPTY_A);
  const [aErr, setAErr] = useState('');
  const [aSaving, setASaving] = useState(false);
  const [dOpen, setDOpen] = useState(false);
  const [dForm, setDForm] = useState(EMPTY_D);
  const [dErr, setDErr] = useState('');
  const [dSaving, setDSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, d] = await Promise.all([
        fetch('/api/admin/media-kit', { credentials: 'include' }),
        fetch('/api/admin/investor-docs', { credentials: 'include' }),
      ]);
      if (a.status === 401 || d.status === 401) { setRefreshError('Admin session required.'); return; }
      const [aj, dj] = await Promise.all([a.json(), d.json()]);
      if (!aj?.success || !dj?.success) { setRefreshError(aj?.error || dj?.error || 'Failed to load'); return; }
      setAssets(aj.data ?? []);
      setDocs(dj.data ?? []);
      setRefreshError('');
    } catch { setRefreshError('Could not reach the press & investor service'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveAsset = async () => {
    setAErr('');
    if (!aForm.title.trim()) { setAErr('Title is required.'); return; }
    if (!/^https:\/\//.test(aForm.fileUrl.trim()) && !aForm.fileUrl.trim().startsWith('/uploads/') && !aForm.fileUrl.trim().startsWith('/')) { setAErr('File URL must be https:// or a /uploads/ path.'); return; }
    setASaving(true);
    try {
      const res = await fetch('/api/admin/media-kit', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetType: aForm.assetType, title: aForm.title, fileUrl: aForm.fileUrl, isPublic: aForm.isPublic }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) { toast.success('Asset added'); setAOpen(false); setAForm(EMPTY_A); load(); }
      else setAErr(json?.error || `Could not save (HTTP ${res.status})`);
    } catch { setAErr('Could not reach the service'); } finally { setASaving(false); }
  };

  const saveDoc = async () => {
    setDErr('');
    if (!dForm.title.trim()) { setDErr('Title is required.'); return; }
    if (!/^https:\/\//.test(dForm.fileUrl.trim()) && !dForm.fileUrl.trim().startsWith('/uploads/') && !dForm.fileUrl.trim().startsWith('/')) { setDErr('File URL must be https:// or a /uploads/ path.'); return; }
    setDSaving(true);
    try {
      const res = await fetch('/api/admin/investor-docs', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docType: dForm.docType, title: dForm.title, fileUrl: dForm.fileUrl, isPublished: dForm.isPublished,
          ...(dForm.fiscalYear.trim() ? { fiscalYear: dForm.fiscalYear } : {}),
          ...(dForm.fiscalQ.trim() ? { fiscalQ: dForm.fiscalQ } : {}),
          ...(dForm.summary.trim() ? { summary: dForm.summary } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) { toast.success('Document added'); setDOpen(false); setDForm(EMPTY_D); load(); }
      else setDErr(json?.error || `Could not save (HTTP ${res.status})`);
    } catch { setDErr('Could not reach the service'); } finally { setDSaving(false); }
  };

  const remove = async (kind: 'media-kit' | 'investor-docs', id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/${kind}/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) { toast.success('Deleted'); load(); }
      else { const json = await res.json().catch(() => null); toast.error(json?.error || `Could not delete (HTTP ${res.status})`); }
    } catch { toast.error('Could not reach the service'); } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-6">
      {refreshError && <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2" role="alert">{refreshError}</p>}
      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold flex items-center gap-1.5"><Newspaper className="h-4 w-4" /> Media kit assets</h3>
              <div className="flex-1" />
              <Button size="sm" onClick={() => { setAForm(EMPTY_A); setAErr(''); setAOpen(true); }}><Plus className="h-4 w-4 mr-1.5" /> Add asset</Button>
            </div>
            {assets.length === 0 ? (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-4 text-center">The press page is an honest empty frame until the first asset is added.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {assets.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold truncate">{a.title}</span>
                        <Badge variant="secondary" className="text-[10px]">{a.assetType}</Badge>
                        {!a.isPublic && <span className="text-[10px] font-bold uppercase text-amber-600">private</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5 font-mono">{a.fileUrl}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive shrink-0" disabled={busyId === a.id} aria-label={`Delete ${a.title}`} onClick={() => remove('media-kit', a.id)}>
                      {busyId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold flex items-center gap-1.5"><FileBarChart className="h-4 w-4" /> Investor documents</h3>
              <div className="flex-1" />
              <Button size="sm" onClick={() => { setDForm(EMPTY_D); setDErr(''); setDOpen(true); }}><Plus className="h-4 w-4 mr-1.5" /> Add document</Button>
            </div>
            {docs.length === 0 ? (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-4 text-center">The investor pages serve honest empties until the first document is published here.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {docs.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold truncate">{d.title}</span>
                        <Badge variant="secondary" className="text-[10px]">{d.docType}</Badge>
                        {d.fiscalYear && <span className="text-[10px] text-muted-foreground font-mono">FY {d.fiscalYear}{d.fiscalQ ? ` · Q${d.fiscalQ.replace(/^q/i, '')}` : ''}</span>}
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${d.isPublished ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'}`}>{d.isPublished ? 'Live' : 'Draft'}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5 font-mono">{d.fileUrl}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive shrink-0" disabled={busyId === d.id} aria-label={`Delete ${d.title}`} onClick={() => remove('investor-docs', d.id)}>
                      {busyId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <Dialog open={aOpen} onOpenChange={setAOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add media kit asset</DialogTitle>
            <DialogDescription>The asset type groups it on the public press page.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium block mb-1">Asset type</Label>
              <select value={aForm.assetType} onChange={(e) => setAForm({ ...aForm, assetType: e.target.value })} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm" aria-label="Asset type">
                {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><Label className="text-xs font-medium block mb-1">Title *</Label><Input value={aForm.title} onChange={(e) => setAForm({ ...aForm, title: e.target.value })} maxLength={140} aria-label="Asset title" /></div>
            <div><Label className="text-xs font-medium block mb-1">File URL * (https:// or /uploads/)</Label><Input value={aForm.fileUrl} onChange={(e) => setAForm({ ...aForm, fileUrl: e.target.value })} maxLength={500} aria-label="File URL" /></div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <p className="text-sm font-medium">Public</p>
              <Switch checked={aForm.isPublic} onCheckedChange={(c) => setAForm({ ...aForm, isPublic: c })} aria-label="Public" />
            </div>
            {aErr && <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded px-2 py-1.5" role="alert">{aErr}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAOpen(false)}>Cancel</Button>
            <Button onClick={saveAsset} disabled={aSaving}>{aSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Add asset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dOpen} onOpenChange={setDOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add investor document</DialogTitle>
            <DialogDescription>Drafts stay console-only — the public pages filter isPublished.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium block mb-1">Document type</Label>
              <select value={dForm.docType} onChange={(e) => setDForm({ ...dForm, docType: e.target.value })} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm" aria-label="Document type">
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><Label className="text-xs font-medium block mb-1">Title *</Label><Input value={dForm.title} onChange={(e) => setDForm({ ...dForm, title: e.target.value })} maxLength={160} aria-label="Document title" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-medium block mb-1">Fiscal year</Label><Input value={dForm.fiscalYear} onChange={(e) => setDForm({ ...dForm, fiscalYear: e.target.value })} maxLength={20} placeholder="2026" aria-label="Fiscal year" /></div>
              <div><Label className="text-xs font-medium block mb-1">Quarter</Label><Input value={dForm.fiscalQ} onChange={(e) => setDForm({ ...dForm, fiscalQ: e.target.value })} maxLength={10} placeholder="Q1" aria-label="Quarter" /></div>
            </div>
            <div><Label className="text-xs font-medium block mb-1">File URL * (https:// or /uploads/)</Label><Input value={dForm.fileUrl} onChange={(e) => setDForm({ ...dForm, fileUrl: e.target.value })} maxLength={500} aria-label="File URL" /></div>
            <div><Label className="text-xs font-medium block mb-1">Summary</Label><Input value={dForm.summary} onChange={(e) => setDForm({ ...dForm, summary: e.target.value })} maxLength={1000} aria-label="Summary" /></div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <p className="text-sm font-medium">Published</p>
              <Switch checked={dForm.isPublished} onCheckedChange={(c) => setDForm({ ...dForm, isPublished: c })} aria-label="Published" />
            </div>
            {dErr && <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded px-2 py-1.5" role="alert">{dErr}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDOpen(false)}>Cancel</Button>
            <Button onClick={saveDoc} disabled={dSaving}>{dSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Add document</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminPressInvestorManager;
