'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Newspaper, Plus, Trash2, Loader2, Eye, EyeOff, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Task 99: THE EDITORIAL CONSOLE — the third tab of the admin content page,
 * beside Banners and Deals. Writes the blogPosts rows the public blog page
 * has been faithfully asking for since day one (/api/blog never existed).
 * Publishing is a REAL state machine: draft → publish stamps the date once;
 * unpublish keeps the row but the public rails refuse it. The server
 * slugifies the title — the console never invents a URL.
 */

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

interface Stats {
  total: number;
  published: number;
  drafts: number;
}

const EMPTY_FORM = { title: '', content: '', excerpt: '', category: '', coverImageUrl: '', publishNow: false };

export function AdminBlogManager() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/blog', { credentials: 'include' });
      const json = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 403) {
        setRefreshError('Admin session required — sign in again to manage the blog.');
        return;
      }
      if (!res.ok || !json?.success) {
        setRefreshError(json?.error || `Failed to load posts (HTTP ${res.status})`);
        return;
      }
      setPosts(json.data ?? []);
      setStats(json.stats ?? null);
      setRefreshError('');
    } catch {
      setRefreshError('Could not reach the blog service');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setDialogOpen(true);
  };

  const openEdit = (p: Post) => {
    setEditing(p);
    setForm({
      title: p.title,
      content: '',
      excerpt: p.excerpt ?? '',
      category: p.category ?? '',
      coverImageUrl: '',
      publishNow: p.isPublished,
    });
    setFormError('');
    setDialogOpen(true);
  };

  const save = async () => {
    setFormError('');
    if (form.title.trim().length < 4) { setFormError('Title must be at least 4 characters.'); return; }
    if (!editing && form.content.trim().length < 20) { setFormError('Content must be at least 20 characters.'); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        ...(form.content.trim() ? { content: form.content } : {}),
        ...(form.excerpt.trim() ? { excerpt: form.excerpt } : { excerpt: null }),
        ...(form.category.trim() ? { category: form.category } : { category: null }),
        ...(form.coverImageUrl.trim() ? { coverImageUrl: form.coverImageUrl } : { coverImageUrl: null }),
      };
      if (!editing) payload.isPublished = form.publishNow;
      const res = await fetch(editing ? `/api/admin/blog/${editing.id}` : '/api/admin/blog', {
        method: editing ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if ((res.status === 201 || res.status === 200) && json?.success) {
        toast.success(editing ? 'Post updated' : json.data.isPublished ? 'Published — it is live on the blog' : 'Saved as draft');
        setDialogOpen(false);
        setEditing(null);
        load();
      } else {
        setFormError(json?.error || `Could not save (HTTP ${res.status})`);
      }
    } catch {
      setFormError('Could not reach the blog service');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (p: Post) => {
    setBusyId(p.id);
    try {
      const res = await fetch(`/api/admin/blog/${p.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !p.isPublished }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        toast.success(json.data.isPublished ? 'Published — live on the blog' : 'Unpublished — the public link now refuses');
        load();
      } else {
        toast.error(json?.error || `Could not update (HTTP ${res.status})`);
      }
    } catch {
      toast.error('Could not reach the blog service');
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      const res = await fetch(`/api/admin/blog/${deleteTarget.id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        toast.success('Post deleted');
        load();
      } else {
        const json = await res.json().catch(() => null);
        toast.error(json?.error || `Could not delete (HTTP ${res.status})`);
      }
    } catch {
      toast.error('Could not reach the blog service');
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="rounded-lg bg-muted px-3 py-2">
          <div className="text-lg font-bold leading-none">{stats?.total ?? '…'}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</div>
        </div>
        <div className="rounded-lg bg-green-500/10 px-3 py-2">
          <div className="text-lg font-bold leading-none text-green-600">{stats?.published ?? '…'}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Published</div>
        </div>
        <div className="rounded-lg bg-amber-500/10 px-3 py-2">
          <div className="text-lg font-bold leading-none text-amber-600">{stats?.drafts ?? '…'}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Drafts</div>
        </div>
        <div className="flex-1" />
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> New post
        </Button>
      </div>

      {refreshError && (
        <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2" role="alert">
          {refreshError}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-dashed">
          <Newspaper className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
          <h3 className="text-sm font-semibold">No posts yet</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            The public blog is honest empties until the editorial team writes the first piece.
          </p>
          <Button size="sm" variant="outline" className="mt-3" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> Write the first post
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold truncate">{p.title}</h4>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    p.isPublished ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    {p.isPublished ? 'Live' : 'Draft'}
                  </span>
                  {p.category && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{p.category}</span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  /{p.slug}
                  {p.publishedAt ? ` · published ${new Date(p.publishedAt).toLocaleDateString('en-GB')}` : ' · never published'}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1">
                  {p.isPublished ? <Eye className="h-3.5 w-3.5 text-green-600" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                  <Switch
                    checked={p.isPublished}
                    disabled={busyId === p.id}
                    onCheckedChange={() => togglePublish(p)}
                    aria-label={`${p.isPublished ? 'Unpublish' : 'Publish'} ${p.title}`}
                  />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)} aria-label={`Edit ${p.title}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(p)} aria-label={`Delete ${p.title}`}>
                  {busyId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit post' : 'New post'}</DialogTitle>
            <DialogDescription>
              The URL slug derives from the title server-side. Publishing stamps the date once — unpublishing keeps the row but the public link refuses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium block mb-1">Title *</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={140} placeholder="How to vet a supplier before a bulk order" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Content * {editing ? '(leave empty to keep the current body)' : ''}</label>
              <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={8} placeholder="Write the piece… blank lines separate paragraphs." />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Excerpt</label>
              <Textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} maxLength={300} placeholder="One-sentence summary shown on the list (optional)" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1">Category</label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={40} placeholder="Sourcing guide" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Cover image URL</label>
                <Input value={form.coverImageUrl} onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })} placeholder="https://cdn.example.com/cover.jpg" />
              </div>
            </div>
            {!editing && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Publish immediately</p>
                  <p className="text-xs text-muted-foreground">Otherwise it is saved as a draft.</p>
                </div>
                <Switch checked={form.publishNow} onCheckedChange={(c) => setForm({ ...form, publishNow: c })} aria-label="Publish immediately" />
              </div>
            )}
            {formError && (
              <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded px-2 py-1.5" role="alert">{formError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDialogOpen(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.title.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editing ? 'Save changes' : form.publishNow ? 'Publish' : 'Save draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. {deleteTarget?.isPublished ? 'The public link will start refusing immediately.' : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AdminBlogManager;
