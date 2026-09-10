import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendNotification } from '@/lib/notifications'

/**
 * POST /api/careers/apply
 * Submit a job application.
 * Body: { jobId, applicantName, applicantEmail, applicantPhone?, resumeUrl?, coverLetter?, portfolioUrl?, linkedInUrl?, yearsExp? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      jobId, applicantName, applicantEmail, applicantPhone,
      resumeUrl, coverLetter, portfolioUrl, linkedInUrl, yearsExp
    } = body

    if (!jobId || !applicantName || !applicantEmail) {
      return NextResponse.json({ error: 'jobId, applicantName, and applicantEmail are required' }, { status: 400 })
    }

    // Verify job exists and is active
    const job = await db.jobListings.findFirst({
      where: {
        OR: [{ id: jobId }, { slug: jobId }],
        isActive: true,
      },
    })

    if (!job) {
      return NextResponse.json({ error: 'Job listing not found or no longer accepting applications' }, { status: 404 })
    }

    // Check for duplicate application
    const existing = await db.jobApplications.findFirst({
      where: { jobId: job.id, applicantEmail },
    })

    if (existing) {
      return NextResponse.json({ error: 'You have already applied for this position' }, { status: 409 })
    }

    const application = await db.jobApplications.create({
      data: {
        jobId: job.id,
        applicantName,
        applicantEmail,
        applicantPhone: applicantPhone || null,
        resumeUrl: resumeUrl || null,
        coverLetter: coverLetter || null,
        portfolioUrl: portfolioUrl || null,
        linkedInUrl: linkedInUrl || null,
        yearsExp: yearsExp ? parseInt(String(yearsExp)) : null,
        status: 'submitted',
      },
    })

    // Increment application count on job
    await db.jobListings.update({
      where: { id: job.id },
      data: { applicationCount: { increment: 1 } },
    })

    // Log acknowledgment contact submission
    await db.contactSubmissions.create({
      data: {
        name: applicantName,
        email: applicantEmail,
        phone: applicantPhone || null,
        category: 'careers',
        subject: `Application received: ${job.title}`,
        message: `Thank you for applying for "${job.title}" at Zylod. Your application ID is ${application.id.slice(-8).toUpperCase()}. Our HR team will review and contact you shortly.`,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Application submitted successfully! We will review and be in touch.',
      data: {
        applicationId: application.id,
        applicationRef: `APP-${application.id.slice(-8).toUpperCase()}`,
        jobTitle: job.title,
        status: 'submitted',
        appliedAt: application.appliedAt,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Career apply POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
