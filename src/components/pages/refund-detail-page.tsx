'use client'

import React from 'react'
import { RefundStatusPage } from '@/components/pages/refund-status-page'

/**
 * refund-detail — historical deep-link alias for the REAL refund status
 * page (Task 169). The old version of this file was a pure fake: a
 * hard-coded credit note ("REF-2910-A", invented 1450/145/25/1330 money
 * math, "3x Premium Widgets", a fake "Corporate Visa ••42" target, and an
 * unconditional "Refund Approved" heading) regardless of any real data.
 *
 * The real per-return view (refund-status-page) renders the actual returns
 * rail — real returnNumber, real status, the real refunds ledger, real
 * items — with honest 401/404 gates. This page is an honest thin wrapper
 * that delegates to it with the same pageParams, accepting refundId /
 * returnId / id. Deep links keep working; every number is server-computed.
 */
export function RefundDetailPage(props: { pageParams?: Record<string, string> }) {
  return <RefundStatusPage {...props} />
}
export default RefundDetailPage
