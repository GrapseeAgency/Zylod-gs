# Zylod Design Tokens — Authoritative (Phase 0 Freeze)

**Source of truth:** `src/app/globals.css` (Tailwind v4 `@theme inline`). `tailwind.config.ts` is stale legacy — ignore it.
**Rule:** Compose screens and any future web cleanup take colors from here. Never copy hex values out of page components.
**Dark mode = class-based** (`next-themes attribute="class"`). Two themes only: `light`, `dark`. The advertised "OLED Obsidian" does not exist server-side (mapped to `dark`) — do not implement a third theme.

This document resolves the light tokens from oklch → sRGB hex (values below are exact conversions) and resolves the dark-theme CSS remap layer (`globals.css:199-247`) into semantic values, so the dark palette is fully explicit.

---

## 1. Semantic palette

### Light

| Token | Hex | Web var | Notes |
|---|---|---|---|
| background | `#FBFAF9` | `--background` | warm off-white |
| onBackground / foreground | `#1C130C` | `--foreground` | warm near-black |
| card | `#FEFDFC` | `--card` | |
| onCard | `#1C130C` | `--card-foreground` | |
| popover | `#FEFDFC` | `--popover` | |
| onPopover | `#1C130C` | `--popover-foreground` | |
| primary | `#C90019` | `--primary` | oklch(0.52 0.22 25). CSS comment claims `#E53935` — the comment is wrong; the token value is authoritative |
| onPrimary | `#FEF7F2` | `--primary-foreground` | |
| secondary | `#F7F0EB` | `--secondary` | |
| onSecondary | `#291F18` | `--secondary-foreground` | |
| muted | `#F5EFEA` | `--muted` | |
| onMuted | `#6C6158` | `--muted-foreground` | |
| accent | `#FEDBD7` | `--accent` | soft red tint |
| onAccent | `#2B1E1D` | `--accent-foreground` | |
| destructive | `#E7000B` | `--destructive` | oklch(0.577 0.245 27.325) |
| border | `#E6E0DB` | `--border` | |
| input | `#E6E0DB` | `--input` | |
| ring | `#C90019` | `--ring` | same as primary |
| success | `#008C41` | `--success` | |
| onSuccess | `#F3FBF5` | `--success-foreground` | |
| warning | `#DFA11A` | `--warning` | |
| onWarning | `#2E1E01` | `--warning-foreground` | |

### Dark ("Hot Deals" palette)

| Token | Hex | Notes |
|---|---|---|
| background | `#121212` | |
| onBackground | `#F5F5F5` | |
| card | `#1E1E1E` | |
| onCard | `#F5F5F5` | |
| popover | `#1E1E1E` | |
| onPopover | `#F5F5F5` | |
| primary | `#C8102E` | |
| onPrimary | `#FFFFFF` | |
| secondary | `#262626` | |
| onSecondary | `#E5E5E5` | |
| muted | `#262626` | |
| onMuted | `#9CA3AF` | |
| accent | `#331B20` | |
| onAccent | `#FF8FA0` | |
| destructive | `#FF6467` | |
| border | `#2E2E2E` | |
| input | `#2E2E2E` | |
| ring | `#C8102E` | |
| success | `#00A045` | |
| onSuccess | `#EAF1EB` | |
| warning | `#F0B135` | |
| onWarning | `#2E1E01` | |

## 2. Resolved web-utility remap (dark-mode truth for hardcoded pages)

The web forces dark on hardcoded light utilities (`.dark` rules, `globals.css:210-247`). When porting any page that uses raw Tailwind utilities, translate through this table:

| Web utility (light intent) | Light value | Dark (remapped) |
|---|---|---|
| `bg-white` / `bg-white/95·90·80` | `#FFFFFF` | `#1E1E1E` (95% α) |
| `bg-slate-50`, `bg-gray-50` | `#F8FAFC` / `#F9FAFB` | `#161616` |
| `bg-slate-100`, `bg-gray-100` | `#F1F5F9` / `#F3F4F6` | `#262626` |
| `bg-slate-200`, `bg-gray-200` | `#E2E8F0` / `#E5E7EB` | `#333333` |
| hover `bg-slate-50/gray-50` | – | `#232323` |
| hover/active `bg-slate-100/gray-100` | – | `#2C2C2C` |
| `text-slate-900/800`, `text-gray-900/800` | `#0F172A`-ish | `#F5F5F5` |
| `text-slate-700`, `text-gray-700` | | `#D4D4D4` |
| `text-slate-600`, `text-gray-600` | | `#B3B3B3` |
| `text-slate-500`, `text-gray-500` | | `#9CA3AF` (= onMuted) |
| `text-slate-400`, `text-gray-400` | | `#7A7A7A` |
| `text-slate-300` | | `#666666` |
| `border-slate-100/200/300`, `border-gray-*` | | `#262626` (100) / `#2E2E2E` (200–300) |
| `bg-rose-50/red-50` chip | | `rgba(200,16,46,0.12)` |
| `border-rose-100/200/red-*` chip | | `rgba(200,16,46,0.35)` |
| `text-rose-600/700/red-600/700` | | `#FF6B81` |
| `bg-green-50/emerald-50` chip | | `rgba(34,197,94,0.12)` |
| `text-green-600/700/emerald-*` | | `#4ADE80` |
| shadows xs–2xl | – | `0 4px 16px rgba(0,0,0,0.4)` |
| skeleton surface | `--muted` | `#2A2A2A` |

## 3. Brand & misc constants

| Constant | Value | Notes |
|---|---|---|
| Brand red (dark / marketing) | `#C8102E` | hardcoded ×480 across pages |
| Brand red (light token) | `#C90019` | actual token value |
| **Unification decision (pending web cleanup)** | adopt `#C8102E` as the single brand red in *future web* work; native ports the two-mode values above verbatim until then | fidelity first |
| Destructive red | `#E7000B` / `#FF6467` | distinct from brand red — never substitute |
| Radius | base 10px → sm 6 / md 8 / lg 10 / xl 14 (Compose: 6/8/10/14 dp) | `--radius: 0.625rem` |
| Bottom nav height | 64dp + safe-area inset | `--bottom-nav-h` |
| Bottom nav items | Home · Categories · Hot Deals · Cart · Profile (active: primary color + 16×2dp top indicator bar; badge = distinct item count) | `mobile-bottom-nav.tsx` |
| Skeleton shimmer | 1.6s sweep, white 50% (light) / 7% (dark) | `skeleton-shimmer` |

## 4. Quick-Access chip palette (per-item spec, kept verbatim from web)

These carry their own icon color + pastel gradient (`mobile-promo-icon-grid.tsx`). They are light-mode artifacts (no dark remap exists for inline styles) — port as-is in both themes; dark-mode fix is a listed web-cleanup item.

Explore `#C8102E` · Trending `#E53935` · Flash Sale `#F57C00` · Daily Deals `#E53935` · New Arrivals `#1565C0` · Clearance `#C62828` · Seasonal `#2E7D32` · Brands `#6A1B9A` (+ More sheet: Categories `#1976D2`, Coupons `#C62828`, Suppliers `#E53935`, Trade Assurance `#1976D2`, Easy Payments `#388E3C`, Fast Shipping `#6A1B9A`, Top Deals `#F57C00`, Bulk Orders `#00695C`, RFQ `#37474F`, Support `#C8102E`, Cross-border `#1976D2`, Factory Direct `#388E3C`) — each on a 135° pastel gradient of its hue family (red `#FFEBEE→#FFCDD2`, orange `#FFF3E0→#FFE0B2`, blue `#E3F2FD→#BBDEFB`, green `#E8F5E9→#C8E6C9`, purple `#F3E5F5→#E1BEE7`, teal `#E0F2F1→#B2DFDB`, grey `#ECEFF1→#CFD8DC`).

## 5. Typography

**Web reality:** `--font-sans: var(--font-geist-sans)` points at variables that are defined nowhere (`globals.css:10-11`) — the entire site renders in the **browser default font**. This is a bug, not a design decision.

**Native decision:** use the platform system font (Roboto). This is a deliberate improvement; when the web later ships a real webfont, re-evaluate.

| Role | Size/weight (from mobile spec) |
|---|---|
| Top bar title / wordmark | 18sp, Bold |
| Section header ("Quick Access") | 12sp, SemiBold |
| Product title | 10sp, Medium, 2-line clamp, 13sp line height |
| Product price | 11sp, Bold, primary color |
| "N sold" | 8sp, muted |
| Nav label | 10sp, Medium (SemiBold when active) |
| Body/labels | 10–12sp, Medium |

## 6. Known web theme debts (documented, NOT ported)

1. Two brand reds (see §3) — unify web-side to `#C8102E`.
2. Broken font variables — fix web-side with a real `next/font` choice.
3. `dark:` variants exist in only 88 places — the remap layer is the real dark spec; keep it as spec until per-page cleanup.
4. Theme-settings page is hardcoded light (`bg-slate-50`) — cleanup candidate.
5. `Theme.ZylodWholesale` (View shell) uses `@color/primary_red` + dark nav bar regardless of theme — native Compose shell ignores it and derives from these tokens.
