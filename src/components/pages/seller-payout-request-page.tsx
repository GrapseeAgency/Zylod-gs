'use client';

/**
 * seller-payout-request is the SELLER payout rail — the same real rail the
 * wallet page uses (Task 107's hold → admin decision flow). This page exists
 * so old links land on the REAL rail instead of a dead placeholder: one
 * component, one flow, zero duplicated logic.
 */
import { WithdrawMoneyPage } from '@/components/pages/withdraw-money-page';

export function SellerPayoutRequestPagePage() {
  return <WithdrawMoneyPage />;
}

export default SellerPayoutRequestPagePage;
