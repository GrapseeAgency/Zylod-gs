import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ promotions: [{ id: 1, title: 'Summer Wholesale Sale', status: 'Active', redemptions: 45, revenue: 150000 }] });
}
export async function POST(req: Request) {
  return NextResponse.json({ success: true });
}