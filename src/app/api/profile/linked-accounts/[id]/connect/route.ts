import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return NextResponse.json({
    success: true,
    message: `Account ${id} connected successfully`,
    data: { id, connected: true },
  })
}
