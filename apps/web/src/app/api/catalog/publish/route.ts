import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { deriveSoundBucket } from '@/lib/sound-bucket'

/**
 * Pubblica (o ritira) una propria analisi nel catalogo pubblico.
 * Solo il PROPRIETARIO può pubblicare la SUA traccia analizzata, e solo con
 * consenso esplicito (è l'autore di una traccia originale + accetta i termini).
 */
export async function POST(request: NextRequest) {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const submissionId = typeof body.submission_id === 'string' ? body.submission_id : ''
  if (!submissionId) {
    return NextResponse.json({ error: 'submission_id required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!,
  )

  // La submission deve essere dell'utente ed essere stata analizzata.
  const { data: sub } = await supabase
    .from('user_submissions')
    .select('id, user_id, analysis_status, file_url, title, artist, onset_strength, sub_ratio, spectral_centroid, mid_presence, bpm')
    .eq('id', submissionId)
    .maybeSingle()

  if (!sub || sub.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Ritiro dal catalogo.
  if (body.publish === false) {
    await supabase.from('user_submissions')
      .update({ published: false })
      .eq('id', submissionId)
    return NextResponse.json({ published: false })
  }

  // Pubblicazione: consenso obbligatorio + traccia analizzata.
  if (body.consent !== true) {
    return NextResponse.json({ error: 'Consenso richiesto' }, { status: 400 })
  }
  if (sub.analysis_status !== 'analyzed') {
    return NextResponse.json({ error: 'Analisi non completata' }, { status: 400 })
  }
  // L'audio non viene conservato dopo l'analisi (a meno di pubblicazione):
  // se è già stato scartato, la traccia non è più pubblicabile così com'è.
  if (!(sub as { file_url?: string | null }).file_url) {
    return NextResponse.json({ error: 'L’audio di questa analisi non è più disponibile: rianalizza la traccia per pubblicarla.' }, { status: 400 })
  }

  const bucket = deriveSoundBucket(sub)
  const displayTitle = (typeof body.title === 'string' && body.title.trim()) || sub.title || 'Senza titolo'
  const displayArtist = (typeof body.artist === 'string' && body.artist.trim()) || sub.artist || null
  const coverUrl = typeof body.cover_url === 'string' && body.cover_url.trim() ? body.cover_url.trim() : null
  const genre = (typeof body.genre === 'string' && body.genre.trim()) || 'Tech House'

  const { error } = await supabase.from('user_submissions')
    .update({
      published: true,
      published_at: new Date().toISOString(),
      display_title: displayTitle,
      display_artist: displayArtist,
      cover_url: coverUrl,
      genre,
      sound_bucket: bucket.key,
    })
    .eq('id', submissionId)

  if (error) {
    console.error('[catalog/publish] error:', error)
    return NextResponse.json({ error: 'Pubblicazione fallita' }, { status: 500 })
  }

  return NextResponse.json({ published: true, bucket: bucket.key })
}
