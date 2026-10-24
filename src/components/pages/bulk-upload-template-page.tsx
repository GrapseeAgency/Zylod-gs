'use client';
import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Loader2, FileSpreadsheet } from 'lucide-react';

/**
 * Task 77 — the REAL template page (the old one listed two invented .xlsx
 * files that existed nowhere). Now it generates a downloadable CSV with the
 * EXACT server-expected header and example rows carrying the SELLER'S REAL
 * category ids from the live category tree — so the ids in the template are
 * copy-paste valid, not guessed.
 */

interface CatNode {
  id: string
  name: string
  children?: CatNode[]
}

export function BulkUploadTemplatePage() {
  const { goBack, navigate } = useNavigationStore();
  const { token } = useAuthStore();
  const [cats, setCats] = useState<CatNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/categories', { headers });
        const json = await res.json().catch(() => null);
        if (!cancelled && json?.success && Array.isArray(json.data)) {
          setCats(json.data as CatNode[]);
        }
      } catch {
        /* courtesy rail — the generic template still downloads */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true };
  }, [token]);

  // Flatten the tree into leaf-usable rows (roots + two levels).
  const flat: Array<{ id: string; label: string }> = [];
  for (const c of cats) {
    flat.push({ id: c.id, label: c.name });
    for (const ch of c.children ?? []) {
      flat.push({ id: ch.id, label: `${c.name} → ${ch.name}` });
    }
  }
  const example = flat[0];

  const header = 'name,categoryId,unit,moq,basePrice,stockQuantity';
  const sampleRows = [
    `Wholesale cotton t-shirt (pack of 12),${example?.id ?? 'REPLACE_WITH_CATEGORY_ID'},dozen,5,1800,120`,
    `Stainless steel rod 12mm,${cats[0]?.children?.[0]?.id ?? example?.id ?? 'REPLACE_WITH_CATEGORY_ID'},kg,50,240,800`,
    `LED bulb 12W carton,${example?.id ?? 'REPLACE_WITH_CATEGORY_ID'},carton,2,6400,30`,
  ];
  const csv = [header, ...sampleRows].join('\n');

  const download = () => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zylod-bulk-upload-template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 p-4 md:p-6 md:py-8">
      <div className="max-w-3xl mx-auto">
        <button onClick={goBack} className="mb-4 flex items-center gap-1 text-sm font-bold text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:text-gray-100" aria-label="Back">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-xl md:text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Bulk Upload Template</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-5 leading-relaxed">
          The server expects the header <code className="bg-gray-100 dark:bg-gray-900 px-1 rounded font-mono text-[11px]">{header}</code> — exactly these columns, one product per row, max 100 rows per upload.
          The template below carries your LIVE category ids, so the categoryId column is valid on the first try.
        </p>

        <div className="bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-gray-200">
            <FileSpreadsheet className="w-4 h-4 text-primary" /> Valid units: pcs · dozen · kg · carton · box · set
          </div>
          <pre className="bg-slate-900 text-slate-100 text-[11px] font-mono rounded-xl p-3 overflow-x-auto leading-relaxed">{csv}</pre>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={download} className="flex-1 h-11 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-xs gap-2">
              <Download className="w-4 h-4" /> Download template CSV
            </Button>
            <Button variant="outline" onClick={() => navigate('bulk-upload-products')} className="flex-1 h-11 rounded-2xl text-xs font-bold border-gray-200 dark:border-gray-800">
              Go to upload
            </Button>
          </div>
          {loading && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading your live category ids…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
export default BulkUploadTemplatePage;
