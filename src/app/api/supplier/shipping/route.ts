import { NextResponse } from 'next/server';

export async function GET() {
  const settings = {
    zones: [
      { name: 'Dhaka Inside', baseFee: 60, perKgRate: 15, freeShippingThreshold: 50000 },
      { name: 'Dhaka Suburbs', baseFee: 100, perKgRate: 20, freeShippingThreshold: 50000 },
      { name: 'Chittagong', baseFee: 120, perKgRate: 25, freeShippingThreshold: 100000 },
      { name: 'Sylhet', baseFee: 130, perKgRate: 25, freeShippingThreshold: 100000 },
      { name: 'All Bangladesh', baseFee: 150, perKgRate: 30, freeShippingThreshold: 150000 },
    ],
    handlingTime: '1-2 business days',
    couriers: {
      pathao: true,
      redx: true,
      steadfast: false,
      ecourier: false,
      sundarban: false
    }
  };
  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  const body = await request.json();
  // Save to DB
  return NextResponse.json({ success: true });
}
