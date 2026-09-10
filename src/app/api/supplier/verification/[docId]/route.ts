import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const { docId } = await params
    let supplier = await db.supplierProfiles.findFirst({
      where: { userId: auth.user.id }
    })

    const supplierId = supplier ? supplier.id : auth.user.id

    await db.sellerVerificationDocuments.deleteMany({
      where: {
        id: docId,
        supplierId
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Document removed successfully'
    })
  } catch (error) {
    console.error('Verification doc DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const { docId } = await params
    const body = await request.json()
    const { status, fileUrl, fileName } = body

    const updated = await db.sellerVerificationDocuments.update({
      where: { id: docId },
      data: {
        ...(status && { status }),
        ...(fileUrl && { fileUrl }),
        ...(fileName && { fileName }),
        uploadedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Document updated successfully'
    })
  } catch (error) {
    console.error('Verification doc PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
