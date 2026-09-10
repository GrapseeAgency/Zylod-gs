import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ theme: 'Red', showBadges: true, showVideo: false });
}
export async function PATCH() {
  return NextResponse.json({ success: true });
}