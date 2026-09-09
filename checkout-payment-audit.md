# Checkout & Payment Audit — Phase 0

**Verdict: the web checkout is a mock.** No order is created from cart checkout; no payment gateway is ever invoked in the order path. The backend order endpoint that *should* be used exists and is solid — but is orphaned.

## 1. What actually happens today

**`checkout-page.tsx` "Confirm & Pay" (`src/components/pages/checkout-page.tsx:48-55`):**
`setTimeout(1200ms)` → `clearCart()` → success screen with hardcoded order `#ZY-77402` and fake "Escrow secured" copy. **Zero network calls.** Totals are client-computed (shipping ৳150 hardcoded, 10% tax client-side, lines 43-46); address and card ("Visa 4242") are hardcoded strings (lines 165-168, 213).

**`buy-now-page.tsx:36-42`** — identical mock, fake `#ZY-89241` (line 52).

**The one real purchase path:** `product-detail-page.tsx:392-427` → `POST /api/orders/create-direct` — but that endpoint trusts a **client-sent `unitPrice`** (`create-direct/route.ts:9,23`), skips stock/MOQ checks and stock decrement, and marks the order **`paymentStatus:'paid'` for any non-COD method with no payment at all** (line 31), plus a fake escrow notification (lines 71-73).

**Backend that is actually good (unused):** `POST /api/orders` (`src/app/api/orders/route.ts:62-214`) — `requireUserType(['buyer'])`, server-side price resolution from DB, stock check, MOQ check, server-side coupon, atomic `$transaction` creating order + subOrders + orderItems, stock decrement, server cart clear, `paymentStatus:'unpaid'`. **No frontend code calls it.**

## 2. Wallet top-up: two divergent paths (one is free money)

- **Fake path (what `add-money-page.tsx:43` uses):** `POST /api/wallet/topup` (`wallet/topup/route.ts:32-51`) creates a `walletTopups` row `status:'credited'` and increments the balance **immediately, with no gateway and no verification**.
- **Real path (built and correct, used only by `generic-finance-page.tsx:256`):** `POST /api/wallet/topup/initiate` → real bKash `createPayment()` / SSLCommerz `initSession()` → `redirectUrl` → gateway → callbacks verify server-side (bKash execute + independent `queryPayment` with amount match, `wallet/callback/bkash/route.ts:58`; SSLCommerz `validateTransaction`, `wallet/callback/sslcommerz/route.ts:41,51`; idempotent IPN) → idempotent credit keyed on unique `reference` (`lib/payments/credit.ts:11-48`).

## 3. Full gap list

1. Checkout/buy-now never create an order (client-only timeout mock, fake order numbers).
2. `POST /api/orders` orphaned — correct endpoint, zero callers.
3. `orders/create-direct`: client price trust, no stock/MOQ enforcement, false `paid` status, no idempotency.
4. **No order-payment step exists anywhere** — nothing charges a gateway or wallet for an order; `payments` table is written by nothing; `paymentStatus` flips to 'paid' only when supplier marks delivery (`orders/[id]/track/route.ts:163-166`).
5. `wallet/topup` instant-credit bug + `add-money-page` wired to it.
6. Cart is client-only zustand (`b2b-cart-storage`): sync-to-API only on `'add'` (`cart-store.ts:241-260`); remove/update never synced; checkout uses only `items[0]`, silently dropping multi-item carts.
7. `payment-method-page.tsx` is static UI (fake card, selection not persisted).
8. Sandbox gateway credentials hardcoded as fallbacks (`bkash.ts:14-17`, `sslcommerz.ts:14-15`).
9. Withdraw debits balance immediately with no payout execution or reversal path (`wallet/withdraw/route.ts:32-48`).

## 4. Minimal backend fix list (order matters)

1. Point checkout + buy-now at existing `POST /api/orders` (body: `shippingAddressId`, `items[{productId, variantId, quantity, supplierId}]`, `couponCode`); render returned `totalAmount`.
2. **Create `POST /api/orders/[id]/pay`**: recompute amount server-side → create `payments` row (`pending`, unique `reference` from orderId) → call `createPayment()`/`initSession()` with callback URL → return `{redirectUrl}`. Reuse `lib/payments/*` as-is.
3. Create `POST|GET /api/payments/callback/bkash` + `/sslcommerz` + `/api/payments/ipn/sslcommerz`, mirroring the proven wallet callbacks: verify → mark `payments.paid` + `orders.paymentStatus='paid'` idempotently → 302 to `/?page=orders&payment=success|failed`.
4. Optional: wallet-pay branch inside step 2 (debit wallet atomically with marking paid).
5. Harden `create-direct`: server price lookup, stock/MOQ checks + decrement, always `unpaid`, idempotency key.
6. Disable/feature-flag instant-credit `wallet/topup`; repoint `add-money-page.tsx:43` to `topup/initiate` + redirect.
7. Move sandbox creds to env-only.

## 5. Native Kotlin checkout contract (frozen)

```
login → POST /api/auth/login (Bearer)
cart  → POST/GET /api/cart
order → POST /api/orders            → {orderId, orderNumber, totalAmount, paymentStatus:'unpaid'}
pay   → POST /api/orders/[id]/pay   → {redirectUrl}   (once step 2 above exists)
      → open redirectUrl in Chrome Custom Tab / WebView
      → gateway hits /api/payments/callback/* → 302 ?page=orders&payment=success|failed
      → poll GET /api/orders/[id] until paymentStatus === 'paid'
wallet→ POST /api/wallet/topup/initiate → redirectUrl → poll GET /api/wallet/balance
```

Native never replicates the web's mock pages; checkout ships only after items 1-3 of the fix list are merged and integration-tested end-to-end with sandbox credentials.
