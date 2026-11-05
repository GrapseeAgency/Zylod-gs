import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { authenticateRequest } from '@/lib/auth'
import { db } from '@/lib/db'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const rl = checkRateLimit(request, 'profile-photo', 10, 60000)

    if (!rl.ok) return rateLimitResponse(rl)


    const formData = await request.formData()
    const photoFile = (formData.get('photo') || formData.get('avatar')) as File | null
    const coverFile = formData.get('cover') as File | null
    const file = photoFile || coverFile
    const isCover = Boolean(coverFile && !photoFile)

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Image file too large (max 10MB)' }, { status: 400 })
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPG, PNG, WebP and GIF images are supported' }, { status: 400 })
    }

    const ext = path.extname(file.name || '') || '.jpg'
    const safeExt = ext.replace(/[^a-z0-9.]/gi, '').slice(0, 8)
    const id = crypto.randomBytes(8).toString('hex')
    const subfolder = isCover ? 'covers' : 'avatars'
    const filename = `${auth.user.id}-${id}${safeExt}`
    const dir = path.join(process.cwd(), 'public', 'uploads', subfolder)
    const filePath = path.join(dir, filename)

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    const fileUrl = `/uploads/${subfolder}/${filename}`

    // t280: PERSIST the avatar upload — the route used to write the file and
    // return the URL without touching the database, so every sign-in/refresh
    // lost the avatar (the web stored it only in client state, the native had
    // nothing at all; the remove button's PATCH { avatarUrl: null } was
    // silently ignored by me/route.ts). Avatars land on users.avatarUrl, the
    // single source of truth both clients read (me GET). Cover uploads keep
    // the legacy ephemeral behavior — no column exists for them.
    if (!isCover) {
      await db.users.update({
        where: { id: auth.user.id },
        data: { avatarUrl: fileUrl },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        url: fileUrl,
        avatarUrl: isCover ? undefined : fileUrl,
        coverUrl: isCover ? fileUrl : undefined,
        updatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Photo upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
