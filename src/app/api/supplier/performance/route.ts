import { NextResponse } from 'next/server';

export async function GET() {
  const performanceData = {
    leaderboard: [
      { id: '1', name: 'Industrial Grade Drill', revenue: 135000, views: 5400, cartAdds: 650, returnRate: 1.2 },
      { id: '2', name: 'LED Flood Lights (Bulk)', revenue: 90000, views: 3200, cartAdds: 410, returnRate: 0.8 },
      { id: '3', name: 'Safety Helmets (Pack of 50)', revenue: 40000, views: 2800, cartAdds: 290, returnRate: 2.5 },
    ],
    funnel: {
      impressions: 45000,
      productClicks: 12500,
      inquiries: 850,
      orders: 310
    },
    alerts: [
      { sku: 'SKU-774', name: 'Aluminum Sheets', issue: 'High Drop-off Rate', recommendation: 'Update Photos' },
      { sku: 'SKU-892', name: 'Nylon Ropes', issue: 'Low Conversion', recommendation: 'Add Tier Pricing' },
    ]
  };

  return NextResponse.json(performanceData);
}
