import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ tickets: [{ id: 101, subject: 'Payment Delay', status: 'Open', createdAt: new Date().toISOString() }] });
}
export async function POST(req: Request) {
  return NextResponse.json({ success: true });
}