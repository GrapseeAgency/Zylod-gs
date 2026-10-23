'use client'

import React from 'react'
import { OrderInvoicePage } from '@/components/pages/order-invoice-page'

/**
 * order-invoice-download — historical deep-link alias for the REAL invoice
 * page (order-invoice). The old version of this file was a pure fake:
 * hard-coded "INV-2023-88291", fabricated "1.2 MB (PDF)", a setTimeout
 * "Generating PDF…" that just called window.print(), and a fake "Sent to
 * Finance!" email button that did nothing. None of it was real.
 *
 * Rather than duplicate the real invoice renderer (Task 132 already wires
 * GET /api/orders/[id]/invoice with server-computed VAT, discounts, and
 * platform billing identity), this page is now an honest thin wrapper that
 * delegates to OrderInvoicePage with the same pageParams. Deep links from
 * buyer-profile and order-detail keep working; every number on the sheet is
 * server-computed.
 *
 * The real invoice page exposes its own Download (print) and email actions
 * — see order-invoice-page.tsx.
 */
export function OrderInvoiceDownloadPage(props: { pageParams?: Record<string, string> }) {
  return <OrderInvoicePage {...props} />
}
export default OrderInvoiceDownloadPage
