import { NextResponse } from 'next/server';

export async function GET() {
  const payoutsData = {
    balances: {
      available: 250000,
      inEscrow: 54500,
      lifetimePayouts: 1850000
    },
    methods: [
      { id: 'm1', type: 'Bank EFT', details: '**** **** 4598 (City Bank)', isDefault: true },
      { id: 'm2', type: 'bKash Merchant', details: '0171****321', isDefault: false },
    ],
    history: [
      { id: 'PAY-1004', amount: 150000, status: 'Completed', date: '2026-08-10', ref: 'EFT-889921', method: 'Bank EFT' },
      { id: 'PAY-1005', amount: 50000, status: 'Processing', date: '2026-08-15', ref: 'BK-554421', method: 'bKash Merchant' },
      { id: 'PAY-1006', amount: 25000, status: 'Pending', date: '2026-08-18', ref: '-', method: 'Bank EFT' },
    ]
  };

  return NextResponse.json(payoutsData);
}

export async function POST(request: Request) {
  const body = await request.json();
  // Handle payout request logic
  return NextResponse.json({ success: true, message: 'Payout requested successfully', data: body });
}
