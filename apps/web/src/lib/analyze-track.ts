import type { SupabaseClient } from '@supabase/supabase-js'
import { buildLabelProfile } from '@/lib/label-profile'
import { dz } from '@/lib/deezer'

const WORKER_URL = process.env.HF_WORKER_URL || process.env.WORKER_URL || 'https://andreaballabio-selecta-worker.hf.space'

// ─── Refresh preview URL (Deezer/Spotify) ─────────────────────────────────────

async function getSpotifyToken(): Promise<string | null> {
  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization:
          'Basic ' +
          Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    })
    const data = await res.json()
    return data.access_token ?? null
  } catch {
    return null
  }
}

/** Recupera una preview URL fresca dall'API sorgente (l'URL salvato può scadere). */
async function refreshPreviewUrl(supabase: SupabaseClient, track: Record<string, any>): Promise<string | null> {
  const trackId = track.spotify_track_id // id reale, qualunque sia la sorgente
  if (!trackId) return null

  if (track.audio_source === 'deezer') {
    try {
      // dz() = retry+backoff sugli errori quota → un picco di chiamate non fa
      // fallire l'analisi, riprova invece di marcare la traccia come failed.
      const data = await dz(`track/${trackId}`)
      if (data?.preview && !data.error) {
        await supabase.from('label_ingestion_queue').update({ audio_preview_url: data.preview, analysis_error: null }).eq('id', track.id)
        return data.preview as string
      }
    } catch (e) {
      console.error('[refresh] Deezer error:', e)
    }
    return null
  }

  if (track.audio_source === 'spotify' || !track.audio_source) {
    try {
      const token = await getSpotifyToken()
      if (!token) return null
      const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        if (data.preview_url) {
          await supabase.from('label_ingestion_queue').update({ spotify_preview_url: data.preview_url, audio_preview_url: data.preview_url, analysis_error: null }).eq('id', track.id)
          return data.preview_url as string
        }
      }
    } catch (e) {
      console.error('[refresh] Spotify error:', e)
    }
  }
  return null
}

// ─── Analisi di una singola traccia ───────────────────────────────────────────

export interface AnalyzeResult {
  success: boolean
  track_id: string
  error?: string
  needs_reverify?: boolean
}

/**
 * Analizza UNA traccia della coda: scarica la preview, chiama il worker EffNet,
 * salva feature + embedding, poi ricostruisce il profilo della label.
 * Idempotente: ri-analizzare produce lo stesso embedding (upsert) → sicuro anche
 * se per qualche motivo viene chiamata due volte sulla stessa traccia.
 */
export async function analyzeSingleTrack(supabase: SupabaseClient, trackId: string): Promise<AnalyzeResult> {
  try {
    const { data: track, error } = await supabase.from('label_ingestion_queue').select('*').eq('id', trackId).single()
    if (error || !track) return { success: false, track_id: trackId, error: 'Traccia non trovata' }

    let audioUrl: string | null = track.audio_preview_url ?? track.spotify_preview_url
    // Le preview Deezer scadono in fretta: per le tracce Deezer prendiamo SEMPRE
    // una URL fresca prima di chiamare il worker → evita un tentativo 403
    // garantito (dimezza il tempo per traccia e il carico sul worker).
    if (track.audio_source === 'deezer' && track.spotify_track_id) {
      const fresh = await refreshPreviewUrl(supabase, track)
      if (fresh) audioUrl = fresh
    }
    if (!audioUrl) audioUrl = await refreshPreviewUrl(supabase, track)

    if (!audioUrl) {
      await supabase.from('label_ingestion_queue').update({
        analysis_status: 'failed',
        analysis_error: 'Nessun preview audio disponibile (URL scaduto e refresh fallito)',
      }).eq('id', trackId)
      return { success: false, track_id: trackId, error: 'Nessun preview audio' }
    }

    await supabase.from('label_ingestion_queue').update({ analysis_status: 'analyzing' }).eq('id', trackId)

    const callWorker = (url: string) =>
      fetch(`${WORKER_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          track_id: trackId, file_url: url, artist_level: 'established',
          title: track.track_title, artist: track.artist_name, is_preview: true, track_status: 'unknown',
        }),
        signal: AbortSignal.timeout(120000),
      }) as Promise<Response>

    let lastError: Error | null = null
    let response: Response | null = null

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await callWorker(audioUrl!)
        if (response.ok) { lastError = null; break }

        if (response.status >= 500) {
          const errorBody = await response.text()
          // CDN 403 → URL scaduto: azzera e riprova con URL fresco
          if (errorBody.includes('403') || errorBody.toLowerCase().includes('forbidden')) {
            await supabase.from('label_ingestion_queue').update({ audio_preview_url: null, spotify_preview_url: null }).eq('id', trackId)
            const freshUrl = await refreshPreviewUrl(supabase, track)
            if (freshUrl) {
              audioUrl = freshUrl
              response = await callWorker(freshUrl)
              if (response.ok) lastError = null
              else lastError = new Error(`Worker failed after URL refresh: ${response.status}`)
            } else {
              lastError = new Error('Preview URL scaduto e refresh fallito (403 CDN)')
              response = null
            }
            break
          }
          lastError = new Error(`Worker error: ${response.status} - ${errorBody.slice(0, 200)}`)
          if (attempt < 3) { await new Promise(r => setTimeout(r, 5000 * attempt)); continue }
          break
        }

        const errorText = await response.text()
        throw new Error(`Worker error: ${response.status} - ${errorText}`)
      } catch (fetchError: any) {
        lastError = fetchError
        if (attempt < 3) await new Promise(r => setTimeout(r, 5000 * attempt))
      }
    }

    if (lastError || !response || !response.ok) throw lastError || new Error('Worker failed after 3 attempts')

    let result = await response.json()

    // Worker segnala 403 CDN nel body → refresh + retry
    if (!result.success) {
      const errLow = (result.error ?? '').toLowerCase()
      if (errLow.includes('403') || errLow.includes('forbidden') || errLow.includes('expired')) {
        await supabase.from('label_ingestion_queue').update({ spotify_preview_url: null, audio_preview_url: null }).eq('id', trackId)
        const freshUrl = await refreshPreviewUrl(supabase, track)
        if (freshUrl) {
          const retryResp = await callWorker(freshUrl)
          if (retryResp.ok) result = await retryResp.json()
        }
      }
    }

    if (!result.success) {
      await supabase.from('label_ingestion_queue').update({
        analysis_status: 'failed',
        analysis_error: result.error?.slice(0, 500) || 'Download preview fallito',
        spotify_preview_url: null, audio_preview_url: null,
      }).eq('id', trackId)
      return { success: false, track_id: trackId, error: result.error || 'Analisi fallita', needs_reverify: true }
    }

    if (!result.features) throw new Error('Nessuna feature ricevuta dal worker')
    const features = result.features

    const { error: updateError } = await supabase.from('label_ingestion_queue').update({
      analysis_status: 'analyzed',
      bpm: features.bpm, key: features.key, scale: features.scale, energy: features.energy,
      lufs: features.lufs, duration: features.duration, audio_embedding: features.embedding,
      onset_strength: features.onset_strength ?? null, sub_ratio: features.sub_ratio ?? null,
      mid_presence: features.mid_presence ?? null, tempo_stability: features.tempo_stability ?? null,
      spectral_contrast: features.spectral_contrast ?? null, spectral_centroid: features.spectral_centroid ?? null,
      spectral_rolloff: features.spectral_rolloff ?? null, zero_crossing_rate: features.zero_crossing_rate ?? null,
      analyzed_at: new Date().toISOString(),
    }).eq('id', trackId)

    if (updateError) throw new Error(`Errore salvataggio: ${updateError.message}`)

    // Profilo label: chiamata diretta in-process (vedi lib/label-profile)
    try { await buildLabelProfile(supabase, track.label_id) } catch (e) { console.error('profile build failed:', e) }

    return { success: true, track_id: trackId }
  } catch (error: any) {
    await supabase.from('label_ingestion_queue').update({
      analysis_status: 'failed',
      analysis_error: error.message?.slice(0, 500) || 'Errore sconosciuto',
    }).eq('id', trackId)
    return { success: false, track_id: trackId, error: error.message }
  }
}

// ─── Drain della coda (usato dal cron in background) ──────────────────────────

/**
 * Analizza fino a `limit` tracce pending della coda GLOBALE (tutte le label).
 * Prima auto-guarisce le tracce bloccate in 'analyzing' senza embedding (es. una
 * function crashata a metà) rimettendole pending. Pensata per girare a intervalli
 * dal cron Vercel → l'analisi prosegue anche a computer spento.
 */
export async function drainQueue(
  supabase: SupabaseClient,
  limit = 8,
  maxMs = 80000,
): Promise<{ processed: number; ok: number; fail: number; timedOut: boolean }> {
  // self-heal: tracce 'analyzing' senza embedding → tornano pending
  await supabase.from('label_ingestion_queue')
    .update({ analysis_status: 'pending' })
    .eq('analysis_status', 'analyzing')
    .is('audio_embedding', null)

  // candidati: matched, non ancora analizzati (pending o null), preview/sorgente disponibile
  const { data: cands } = await supabase
    .from('label_ingestion_queue')
    .select('id')
    .eq('status', 'matched')
    .is('audio_embedding', null)
    .or('analysis_status.eq.pending,analysis_status.is.null')
    .order('release_date', { ascending: false })
    .limit(limit)

  const ids = (cands ?? []).map((c: { id: string }) => c.id)
  const start = Date.now()
  let ok = 0, fail = 0, processed = 0
  for (const id of ids) {
    const r = await analyzeSingleTrack(supabase, id)
    processed++
    r.success ? ok++ : fail++
    // TETTO DI TEMPO: ferma la run ben prima dell'intervallo del cron (2 min) →
    // due esecuzioni non possono MAI accavallarsi sul worker. Le tracce non fatte
    // restano pending e le prende la run successiva.
    if (Date.now() - start >= maxMs) break
  }
  return { processed, ok, fail, timedOut: processed < ids.length }
}
