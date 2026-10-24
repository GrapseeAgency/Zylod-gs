'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Smartphone, Wrench, Activity, Plus, Loader2, Trash2, Pencil } from 'lucide-react';
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
 * Task 109: PLATFORM STATUS CONSOLE — releases, maintenance windows, and
 * the service log. Three rails whose public readers (update-check,
 * maintenance check, diagnostics probes) were real from day one but whose
 * writers did not exist: the update payload could only serve its degraded
 * hardcoded '2.4.5', maintenance could never fire, and the service journal
 * stayed empty. Server errors render verbatim; nothing is decorative.
 */

interface Release { id: string; platform: string; versionNumber: string; versionCode: number; isMandatory: boolean; changelogEn: string; apkDownloadUrl: string | null; isPublished: boolean; releasedAt: string }
interface Window { id: string; title: string; messageEn: string; scheduledStart: string; scheduledEnd: string; isActive: boolean; affectedServices: string }
interface Observation { id: string; serviceName: string; status: string; responseTimeMs: number; checkedAt: string }

const EMPTY_REL = { platform: 'android', versionNumber: '', versionCode: '', changelogEn: '', apkDownloadUrl: '', isMandatory: false, isPublished: true };
const EMPTY_WIN = { title: '', messageEn: '', start: '', end: '', isActive: false, affectedServices: 'all' };
const EMPTY_OBS = { serviceName: '', status: 'healthy', responseTimeMs: '0', details: '' };

export function AdminAppStatusManager() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [windows, setWindows] = useState<Window[]>([]);
  const [obs, setObs] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [relOpen, setRelOpen] = useState(false);
  const [rel, setRel] = useState(EMPTY_REL);
  const [relErr, setRelErr] = useState('');
  const [relSaving, setRelSaving] = useState(false);
  const [relEditing, setRelEditing] = useState<Release | null>(null);

  const [winOpen, setWinOpen] = useState(false);
  const [win, setWin] = useState(EMPTY_WIN);
  const [winErr, setWinErr] = useState('');
  const [winSaving, setWinSaving] = useState(false);

  const [obsOpen, setObsOpen] = useState(false);
  const [ob, setOb] = useState(EMPTY_OBS);
  const [obsErr, setObsErr] = useState('');
  const [obsSaving, setObsSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, w, o] = await Promise.all([
        fetch('/api/admin/app-versions', { credentials: 'include' }),
        fetch('/api/admin/maintenance', { credentials: 'include' }),
        fetch('/api/admin/diagnostics', { credentials: 'include' }),
      ]);
      if (r.status === 401 || w.status === 401 || o.status === 401) {
        setRefreshError('Admin session required — sign in again to manage platform status.');
        return;
      }
      const [rj, wj, oj] = await Promise.all([r.json(), w.json(), o.json()]);
      if (!rj?.success || !wj?.success || !oj?.success) {
        setRefreshError(rj?.error || wj?.error || oj?.error || 'Failed to load platform status');
        return;
      }
      setReleases(rj.data ?? []);
      setWindows(wj.data ?? []);
      setObs(oj.data ?? []);
      setRefreshError('');
    } catch {
      setRefreshError('Could not reach the platform status service');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveRelease = async () => {
    setRelErr('');
    const code = Number(rel.versionCode);
    if (!/^\d+\.\d+\.\d+$/.test(rel.versionNumber)) { setRelErr('Version must be semver (e.g. 2.4.0).'); return; }
    if (!Number.isInteger(code) || code < 1) { setRelErr('versionCode must be a positive integer.'); return; }
    if (rel.changelogEn.trim().length < 1) { setRelErr('English changelog is required.'); return; }
    setRelSaving(true);
    try {
      const res = await fetch(relEditing ? `/api/admin/app-versions/${relEditing.id}` : '/api/admin/app-versions', {
        method: relEditing ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: rel.platform,
          versionNumber: rel.versionNumber,
          versionCode: code,
          changelogEn: rel.changelogEn,
          isMandatory: rel.isMandatory,
          isPublished: rel.isPublished,
          ...(rel.apkDownloadUrl.trim() ? { apkDownloadUrl: rel.apkDownloadUrl } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) { toast.success(relEditing ? 'Release updated' : 'Release saved'); setRelOpen(false); setRelEditing(null); load(); }
      else setRelErr(json?.error || `Could not save (HTTP ${res.status})`);
    } catch { setRelErr('Could not reach the service'); } finally { setRelSaving(false); }
  };

  const saveWindow = async () => {
    setWinErr('');
    if (!win.title.trim() || !win.messageEn.trim()) { setWinErr('Title and message are required.'); return; }
    if (!win.start || !win.end) { setWinErr('Both window times are required.'); return; }
    const s = new Date(win.start).toISOString();
    const e = new Date(win.end).toISOString();
    if (new Date(e).getTime() <= new Date(s).getTime()) { setWinErr('End must be after start.'); return; }
    setWinSaving(true);
    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: win.title, messageEn: win.messageEn, scheduledStart: s, scheduledEnd: e, isActive: win.isActive, affectedServices: win.affectedServices }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) { toast.success('Maintenance window saved'); setWinOpen(false); load(); }
      else setWinErr(json?.error || `Could not save (HTTP ${res.status})`);
    } catch { setWinErr('Could not reach the service'); } finally { setWinSaving(false); }
  };

  const saveObservation = async () => {
    setObsErr('');
    if (!ob.serviceName.trim()) { setObsErr('Service name is required.'); return; }
    const rt = Number(ob.responseTimeMs) || 0;
    setObsSaving(true);
    try {
      const res = await fetch('/api/admin/diagnostics', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceName: ob.serviceName, status: ob.status, responseTimeMs: rt, ...(ob.details.trim() ? { details: ob.details } : {}) }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) { toast.success('Observation logged'); setObsOpen(false); load(); }
      else setObsErr(json?.error || `Could not save (HTTP ${res.status})`);
    } catch { setObsErr('Could not reach the service'); } finally { setObsSaving(false); }
  };

  const remove = async (kind: 'app-versions' | 'maintenance', id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/${kind}/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) { toast.success('Deleted'); load(); }
      else { const json = await res.json().catch(() => null); toast.error(json?.error || `Could not delete (HTTP ${res.status})`); }
    } catch { toast.error('Could not reach the service'); } finally { setBusyId(null); }
  };

  const statusBadge = (s: string) => s === 'healthy' ? 'bg-green-500/10 text-green-600' : s === 'degraded' ? 'bg-amber-500/10 text-amber-600' : 'bg-rose-500/10 text-rose-600';

  return (
    <div className="space-y-6">
      {refreshError && (
        <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2" role="alert">{refreshError}</p>
      )}
      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : (
        <>
          {/* Releases */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold flex items-center gap-1.5"><Smartphone className="h-4 w-4" /> App releases</h3>
              <div className="flex-1" />
              <Button size="sm" onClick={() => { setRelEditing(null); setRel(EMPTY_REL); setRelErr(''); setRelOpen(true); }}><Plus className="h-4 w-4 mr-1.5" /> New release</Button>
            </div>
            {releases.length === 0 ? (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-4 text-center">No releases yet — the update check serves its degraded fallback until the first release is published here.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {releases.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold">{r.platform} {r.versionNumber}</span>
                        <Badge variant="secondary" className="text-[10px]">code {r.versionCode}</Badge>
                        {r.isMandatory && <Badge variant="secondary" className="text-[10px] bg-rose-500/10 text-rose-600 border-0">mandatory</Badge>}
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${r.isPublished ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'}`}>{r.isPublished ? 'Published' : 'Draft'}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{r.changelogEn}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${r.versionNumber}`} onClick={() => { setRelEditing(r); setRel({ platform: r.platform, versionNumber: r.versionNumber, versionCode: String(r.versionCode), changelogEn: r.changelogEn, apkDownloadUrl: r.apkDownloadUrl ?? '', isMandatory: r.isMandatory, isPublished: r.isPublished }); setRelErr(''); setRelOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" disabled={busyId === r.id} aria-label={`Delete ${r.versionNumber}`} onClick={() => remove('app-versions', r.id)}>{busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Maintenance */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold flex items-center gap-1.5"><Wrench className="h-4 w-4" /> Maintenance windows</h3>
              <div className="flex-1" />
              <Button size="sm" onClick={() => { setWin(EMPTY_WIN); setWinErr(''); setWinOpen(true); }}><Plus className="h-4 w-4 mr-1.5" /> New window</Button>
            </div>
            {windows.length === 0 ? (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-4 text-center">No maintenance windows — the maintenance endpoint honestly answers &quot;none&quot;.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {windows.map((w) => (
                  <div key={w.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold truncate">{w.title}</span>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${w.isActive ? 'bg-rose-500/10 text-rose-600' : 'bg-muted text-muted-foreground'}`}>{w.isActive ? 'ACTIVE' : 'scheduled'}</span>
                        <Badge variant="secondary" className="text-[10px]">{w.affectedServices}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(w.scheduledStart).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} → {new Date(w.scheduledEnd).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive shrink-0" disabled={busyId === w.id} aria-label={`Delete ${w.title}`} onClick={() => remove('maintenance', w.id)}>{busyId === w.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}</Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Service log */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold flex items-center gap-1.5"><Activity className="h-4 w-4" /> Service log</h3>
              <div className="flex-1" />
              <Button size="sm" onClick={() => { setOb(EMPTY_OBS); setObsErr(''); setObsOpen(true); }}><Plus className="h-4 w-4 mr-1.5" /> Log observation</Button>
            </div>
            {obs.length === 0 ? (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-4 text-center">The journal is empty — the diagnostics page still runs its live probes, but no service observations have been logged.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {obs.map((o) => (
                  <div key={o.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold">{o.serviceName}</span>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${statusBadge(o.status)}`}>{o.status}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{o.responseTimeMs}ms</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(o.checkedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Release dialog */}
      <Dialog open={relOpen} onOpenChange={(o) => { if (!o) { setRelOpen(false); setRelEditing(null); } }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{relEditing ? 'Edit release' : 'New release'}</DialogTitle>
            <DialogDescription>semver + a unique integer versionCode per platform. Drafts never reach the update check.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium block mb-1">Platform</Label>
                <select value={rel.platform} onChange={(e) => setRel({ ...rel, platform: e.target.value })} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm" aria-label="Platform">
                  <option value="android">android</option>
                  <option value="ios">ios</option>
                  <option value="web">web</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-medium block mb-1">Version (semver) *</Label>
                <Input value={rel.versionNumber} onChange={(e) => setRel({ ...rel, versionNumber: e.target.value })} placeholder="2.5.0" aria-label="Version number" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium block mb-1">versionCode (integer) *</Label>
              <Input type="number" value={rel.versionCode} onChange={(e) => setRel({ ...rel, versionCode: e.target.value })} min="1" aria-label="Version code" />
            </div>
            <div>
              <Label className="text-xs font-medium block mb-1">Changelog (English) *</Label>
              <Input value={rel.changelogEn} onChange={(e) => setRel({ ...rel, changelogEn: e.target.value })} maxLength={4000} placeholder="What changed in this release" aria-label="Changelog" />
            </div>
            <div>
              <Label className="text-xs font-medium block mb-1">APK download URL</Label>
              <Input value={rel.apkDownloadUrl} onChange={(e) => setRel({ ...rel, apkDownloadUrl: e.target.value })} maxLength={500} placeholder="https://…/zylod-2.5.0.apk" aria-label="APK URL" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <p className="text-sm font-medium">Mandatory update</p>
                <Switch checked={rel.isMandatory} onCheckedChange={(c) => setRel({ ...rel, isMandatory: c })} aria-label="Mandatory" />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <p className="text-sm font-medium">Published</p>
                <Switch checked={rel.isPublished} onCheckedChange={(c) => setRel({ ...rel, isPublished: c })} aria-label="Published" />
              </div>
            </div>
            {relErr && <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded px-2 py-1.5" role="alert">{relErr}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRelOpen(false); setRelEditing(null); }}>Cancel</Button>
            <Button onClick={saveRelease} disabled={relSaving}>{relSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}{relEditing ? 'Save changes' : 'Save release'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maintenance dialog */}
      <Dialog open={winOpen} onOpenChange={setWinOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New maintenance window</DialogTitle>
            <DialogDescription>Start must be before end. ACTIVE windows fire the maintenance endpoint immediately (whitelisted IPs bypass it).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs font-medium block mb-1">Title *</Label><Input value={win.title} onChange={(e) => setWin({ ...win, title: e.target.value })} maxLength={120} aria-label="Title" /></div>
            <div><Label className="text-xs font-medium block mb-1">Message (English) *</Label><Input value={win.messageEn} onChange={(e) => setWin({ ...win, messageEn: e.target.value })} maxLength={2000} aria-label="Message" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-medium block mb-1">Start *</Label><Input type="datetime-local" value={win.start} onChange={(e) => setWin({ ...win, start: e.target.value })} aria-label="Start" /></div>
              <div><Label className="text-xs font-medium block mb-1">End *</Label><Input type="datetime-local" value={win.end} onChange={(e) => setWin({ ...win, end: e.target.value })} aria-label="End" /></div>
            </div>
            <div>
              <Label className="text-xs font-medium block mb-1">Affected services</Label>
              <select value={win.affectedServices} onChange={(e) => setWin({ ...win, affectedServices: e.target.value })} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm" aria-label="Affected services">
                <option value="all">all</option><option value="checkout">checkout</option><option value="api">api</option><option value="search">search</option>
              </select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <p className="text-sm font-medium">Active now</p>
              <Switch checked={win.isActive} onCheckedChange={(c) => setWin({ ...win, isActive: c })} aria-label="Active" />
            </div>
            {winErr && <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded px-2 py-1.5" role="alert">{winErr}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWinOpen(false)}>Cancel</Button>
            <Button onClick={saveWindow} disabled={winSaving}>{winSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Save window</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Observation dialog */}
      <Dialog open={obsOpen} onOpenChange={setObsOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log service observation</DialogTitle>
            <DialogDescription>What was checked, what was found, when. The diagnostics page serves the last 10.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs font-medium block mb-1">Service name *</Label><Input value={ob.serviceName} onChange={(e) => setOb({ ...ob, serviceName: e.target.value })} maxLength={60} placeholder="courier_api" aria-label="Service name" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium block mb-1">Status</Label>
                <select value={ob.status} onChange={(e) => setOb({ ...ob, status: e.target.value })} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm" aria-label="Status">
                  <option value="healthy">healthy</option><option value="degraded">degraded</option><option value="down">down</option>
                </select>
              </div>
              <div><Label className="text-xs font-medium block mb-1">Response (ms)</Label><Input type="number" min="0" value={ob.responseTimeMs} onChange={(e) => setOb({ ...ob, responseTimeMs: e.target.value })} aria-label="Response time" /></div>
            </div>
            <div><Label className="text-xs font-medium block mb-1">Details</Label><Input value={ob.details} onChange={(e) => setOb({ ...ob, details: e.target.value })} maxLength={1000} aria-label="Details" /></div>
            {obsErr && <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded px-2 py-1.5" role="alert">{obsErr}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setObsOpen(false)}>Cancel</Button>
            <Button onClick={saveObservation} disabled={obsSaving}>{obsSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Log</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminAppStatusManager;
