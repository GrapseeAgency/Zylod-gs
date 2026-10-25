// Manual replacements for min-h-screen early-return loading wrappers.
// Each entry: file, [ [oldExact, newExact], ... ] — old must occur exactly once.
const fs = require('fs');

const edits = [
  {
    file: 'src/components/pages/business-profile-page.tsx',
    old: `      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500 dark:text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs font-bold">Loading Business Profile...</span>
        </div>
      </div>`,
    new: `      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <PageLoader label="Loading Business Profile…" className="min-h-0" />
      </div>`,
  },
  {
    file: 'src/components/pages/edit-profile-page.tsx',
    old: `      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500 dark:text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs font-bold">Loading Profile...</span>
        </div>
      </div>`,
    new: `      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <PageLoader label="Loading Profile…" className="min-h-0" />
      </div>`,
  },
  {
    file: 'src/components/pages/profile-page.tsx',
    old: `      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs font-bold">Loading Profile...</span>
        </div>
      </div>`,
    new: `      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <PageLoader label="Loading Profile…" className="min-h-0" />
      </div>`,
  },
  {
    file: 'src/components/pages/tax-information-page.tsx',
    old: `      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500 dark:text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs font-bold">Loading Tax Information...</span>
        </div>
      </div>`,
    new: `      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <PageLoader label="Loading Tax Information…" className="min-h-0" />
      </div>`,
  },
  {
    file: 'src/components/pages/freight-tracking-page.tsx',
    old: `      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-900 dark:text-slate-100">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>`,
    new: `      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-900 dark:text-slate-100">
        <PageLoader className="min-h-0" />
      </div>`,
  },
  {
    file: 'src/components/pages/import-export-tracker-page.tsx',
    old: `      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-900 dark:text-slate-100">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>`,
    new: `      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-900 dark:text-slate-100">
        <PageLoader className="min-h-0" />
      </div>`,
  },
  {
    file: 'src/components/pages/reschedule-delivery-page.tsx',
    old: `      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-900 dark:text-slate-100">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>`,
    new: `      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-900 dark:text-slate-100">
        <PageLoader className="min-h-0" />
      </div>`,
  },
  {
    file: 'src/components/pages/missed-delivery-page.tsx',
    old: `      <div className="min-h-[60vh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>`,
    new: `      <div className="min-h-[60vh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <PageLoader className="min-h-0" />
      </div>`,
  },
  {
    file: 'src/components/pages/order-receipt-page.tsx',
    old: `      <div className="min-h-[60vh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>`,
    new: `      <div className="min-h-[60vh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <PageLoader className="min-h-0" />
      </div>`,
  },
  {
    file: 'src/components/pages/refund-status-page.tsx',
    old: `      <div className="min-h-[60vh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>`,
    new: `      <div className="min-h-[60vh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <PageLoader className="min-h-0" />
      </div>`,
  },
  {
    file: 'src/components/pages/shipping-tracker-page.tsx',
    old: `      <div className="min-h-[60vh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>`,
    new: `      <div className="min-h-[60vh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <PageLoader className="min-h-0" />
      </div>`,
  },
  {
    file: 'src/components/pages/transaction-detail-page.tsx',
    old: `      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>`,
    new: `      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <PageLoader className="min-h-0" />
      </div>`,
  },
  {
    file: 'src/components/pages/save-for-later-detail-page.tsx',
    old: `    return <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;`,
    new: `    return <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center"><PageLoader className="min-h-0" /></div>;`,
  },
  {
    file: 'src/components/pages/seller-edit-product-page.tsx',
    old: `    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center" role="status" aria-label="Loading product">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );`,
    new: `    return <PageLoader />;`,
  },
  {
    file: 'src/components/pages/store-customization-page.tsx',
    old: `    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center" role="status" aria-label="Loading store settings">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );`,
    new: `    return <PageLoader />;`,
  },
  {
    file: 'src/components/pages/shared-wishlist-page.tsx',
    old: `      <div className="flex-1 bg-gray-50 dark:bg-gray-950 flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>`,
    new: `      <div className="flex-1 bg-gray-50 dark:bg-gray-950 flex items-center justify-center h-screen">
        <PageLoader className="min-h-0" />
      </div>`,
  },
  {
    file: 'src/components/pages/wishlist-share-page.tsx',
    old: `      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>`,
    new: `      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950 items-center justify-center">
        <PageLoader className="min-h-0" />
      </div>`,
  },
];

let ok = 0, fail = 0;
for (const e of edits) {
  let src = fs.readFileSync(e.file, 'utf8');
  const count = src.split(e.old).length - 1;
  if (count !== 1) {
    console.error(`!! ${e.file}: old block found ${count} times (expected 1)`);
    fail++;
    continue;
  }
  src = src.replace(e.old, e.new);
  // add import if missing
  if (!src.includes('@/components/ui/page-loader')) {
    const lines = src.split('\n');
    let depth = 0, lastImportEnd = -1, sawImport = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (depth === 0) {
        if (/^\s*import\s/.test(line)) sawImport = true;
        else if (line.trim() === '' || /^\s*(\/\/|\/\*)/.test(line)) continue;
        else break;
      }
      for (const ch of line) {
        if (ch === '{' || ch === '(') depth++;
        else if (ch === '}' || ch === ')') depth = Math.max(0, depth - 1);
      }
      if (depth === 0 && sawImport) lastImportEnd = i + 1;
    }
    lines.splice(lastImportEnd, 0, "import { PageLoader } from '@/components/ui/page-loader'");
    src = lines.join('\n');
  }
  fs.writeFileSync(e.file, src);
  ok++;
}
console.log(`ok: ${ok}, failed: ${fail}`);
