import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: noticeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: job } = await supabase
    .from('pdf_jobs')
    .select('id, html_content, filename, status, pdf_url')
    .eq('job_type', 'notice')
    .eq('reference_id', noticeId)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!job) {
    return NextResponse.json({ error: 'No PDF job found for this notice' }, { status: 404 })
  }

  if (job.status === 'done' && job.pdf_url) {
    return NextResponse.json({ pdf_url: job.pdf_url })
  }

  if (!job.html_content) {
    return NextResponse.json({ error: 'No HTML content stored for this notice' }, { status: 400 })
  }

  await supabase.from('pdf_jobs').update({ status: 'processing' }).eq('id', job.id)

  try {
    const cfEnv = (await getCloudflareContext({ async: true })).env as Record<string, string | undefined>
    const apiKey = cfEnv.HTML2PDF_API_KEY ?? process.env.HTML2PDF_API_KEY
    if (!apiKey) throw new Error('HTML2PDF_API_KEY not configured')

    const pdfRes = await fetch('https://api.html2pdf.app/v1/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html: job.html_content,
        apiKey,
        output: 'pdf',
        page: {
          format: 'Letter',
          margin: { top: '72pt', right: '72pt', bottom: '72pt', left: '72pt' },
        },
      }),
    })

    if (!pdfRes.ok) {
      const errText = await pdfRes.text()
      throw new Error(`html2pdf.app error ${pdfRes.status}: ${errText}`)
    }

    const pdfBytes = await pdfRes.arrayBuffer()

    const serviceRoleKey = cfEnv.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured')

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    )

    const filename = `${job.filename ?? `notice_${noticeId}`}.pdf`
    const storagePath = `notices/${filename}`

    const { error: uploadError } = await admin.storage
      .from('pdf-output')
      .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true })

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

    const { data: { publicUrl } } = admin.storage
      .from('pdf-output')
      .getPublicUrl(storagePath)

    await supabase.from('pdf_jobs').update({
      status: 'done',
      pdf_url: publicUrl,
      completed_at: new Date().toISOString(),
    }).eq('id', job.id)

    return NextResponse.json({ pdf_url: publicUrl })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await supabase.from('pdf_jobs').update({
      status: 'error',
      error_message: message,
    }).eq('id', job.id)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
