import { NextResponse } from 'next/server';

export async function GET() {
  // Simulating fetching live data for supplier analytics
  const analyticsData = {
    overview: {
      gmv: 450000,
      totalOrders: 1250,
      aov: 360,
      conversionRate: 4.2,
      pageViews: 25000,
    },
    salesPerformance: [
      { date: '2026-08-11', bdt: 12000, previousBdt: 10000 },
      { date: '2026-08-12', bdt: 15000, previousBdt: 14000 },
      { date: '2026-08-13', bdt: 11000, previousBdt: 12000 },
      { date: '2026-08-14', bdt: 18000, previousBdt: 11000 },
      { date: '2026-08-15', bdt: 22000, previousBdt: 19000 },
      { date: '2026-08-16', bdt: 25000, previousBdt: 21000 },
      { date: '2026-08-17', bdt: 30000, previousBdt: 24000 },
    ],
    trafficSources: [
      { source: 'Search', percentage: 45 },
      { source: 'Direct', percentage: 25 },
      { source: 'Category Browser', percentage: 20 },
      { source: 'Flash Deals', percentage: 10 },
    ],
    topProducts: [
      { id: '1', name: 'Industrial Grade Drill', unitsSold: 450, revenue: 135000 },
      { id: '2', name: 'LED Flood Lights (Bulk)', unitsSold: 300, revenue: 90000 },
      { id: '3', name: 'Safety Helmets (Pack of 50)', unitsSold: 200, revenue: 40000 },
      { id: '4', name: 'Heavy Duty Caster Wheels', unitsSold: 180, revenue: 27000 },
      { id: '5', name: 'Copper Wiring (100m Roll)', unitsSold: 120, revenue: 36000 },
    ]
  };

  return NextResponse.json(analyticsData);
}
