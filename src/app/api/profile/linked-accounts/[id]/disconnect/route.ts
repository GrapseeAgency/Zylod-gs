import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return NextResponse.json({
    success: true,
    message: `Account ${id} disconnected successfully`,
    data: { id, connected: false },
  })
}
