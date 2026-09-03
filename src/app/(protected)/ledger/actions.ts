'use server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/dal'

export async function checkPdfJob(jobId: string) {
  await requireAuth()
  try {
    const jobs = await prisma.$queryRaw<any[]>`
      SELECT status, pdf_url FROM pdf_jobs WHERE id = ${jobId} LIMIT 1
    `
    const job = jobs?.[0]
    if (!job) return { error: 'Job not found' }
    return {
      status: job.status,
      pdfUrl: job.pdf_url
    }
  } catch (error: any) {
    return { error: error.message || 'Error fetching job' }
  }
}
