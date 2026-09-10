import { NextResponse } from 'next/server';

export async function GET() {
  const policy = {
    window: '7 days',
    shippingPayer: 'Seller pays on defective',
    restockingFee: '0%',
    warranty: 'No Warranty',
    customNonReturnable: true
  };
  return NextResponse.json({ policy });
}

export async function POST(request: Request) {
  const body = await request.json();
  // Save to DB
  return NextResponse.json({ success: true });
}
