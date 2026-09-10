import { NextResponse } from 'next/server';

export async function GET() {
  const revenueData = {
    summary: {
      grossRevenue: 850000,
      commissionFees: 42500, // 5%
      deliveryDeductions: 15000,
      netRevenue: 792500,
      availableForPayout: 250000
    },
    monthlyComparison: [
      { month: 'May', revenue: 210000, growth: 5.2 },
      { month: 'June', revenue: 235000, growth: 11.9 },
      { month: 'July', revenue: 280000, growth: 19.1 },
      { month: 'August', revenue: 125000, growth: null }, // Current month
    ],
    ledger: [
      { id: 'ORD-8921', date: '2026-08-17T10:30:00Z', gross: 15000, commission: 750, net: 14250 },
      { id: 'ORD-8922', date: '2026-08-17T14:45:00Z', gross: 25000, commission: 1250, net: 23750 },
      { id: 'ORD-8923', date: '2026-08-18T09:15:00Z', gross: 8000, commission: 400, net: 7600 },
    ]
  };

  return NextResponse.json(revenueData);
}
