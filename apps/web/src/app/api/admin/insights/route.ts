import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_SERVICE_KEY!,
)

const count = (q: any) => q.then((r: { count: number | null }) => r.count ?? 0)

function parseEmbedding(raw: unknown): number[] {
  if (Array.isArray(raw)) return (raw as unknown[]).map((v) => parseFloat(String(v)))
  if (typeof raw === 'string') { try { const p = JSON.parse(raw); return Array.isArray(p) ? p.map((v) => parseFloat(String(v))) : [] } catch { return [] } }
  return []
}

/** PCA → proiezione 2D (top-2 componenti principali). Deterministico (init fissa
 *  + segno normalizzato) così la mappa non "ruota" tra un caricamento e l'altro. */
function pca2(vectors: number[][]): { x: number; y: number }[] {
  const n = vectors.length
  if (n === 0) return []
  const d = vectors[0].length
  const mean = new Array(d).fill(0)
  for (const v of vectors) for (let i = 0; i < d; i++) mean[i] += v[i]
  for (let i = 0; i < d; i++) mean[i] /= n
  const X = vectors.map((v) => v.map((x, i) => x - mean[i]))
  const cVec = (vec: number[]) => {
    const Xv = X.map((row) => { let s = 0; for (let i = 0; i < d; i++) s += row[i] * vec[i]; return s })
    const out = new Array(d).fill(0)
    for (let r = 0; r < n; r++) { const xr = X[r], xv = Xv[r]; for (let i = 0; i < d; i++) out[i] += xr[i] * xv }
    return out
  }
  const norm = (v: number[]) => { const m = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1; return v.map((x) => x / m) }
  const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0)
  const power = (orth?: number[]) => {
    let v = norm(new Array(d).fill(0).map((_, i) => Math.sin(i + 1)))
    for (let it = 0; it < 150; it++) {
      let w = cVec(v)
      if (orth) { const dp = dot(w, orth); for (let i = 0; i < d; i++) w[i] -= dp * orth[i] }
      w = norm(w); v = w
    }
    return v
  }
  const fixSign = (pc: number[]) => { let mi = 0; for (let i = 1; i < d; i++) if (Math.abs(pc[i]) > Math.abs(pc[mi])) mi = i; return pc[mi] < 0 ? pc.map((x) => -x) : pc }
  const pc1 = fixSign(power())
  const pc2 = fixSign(power(pc1))
  return X.map((row) => ({ x: dot(row, pc1), y: dot(row, pc2) }))
}

export async function GET() {
  // ── KPI (count queries leggere, niente lettura massiva) ──────────────────────
  const q = () => supabase.from('label_ingestion_queue').select('id', { count: 'exact', head: true })
  const [tracks, analyzed, analyzing, failed] = await Promise.all([
    count(q()),
    count(q().eq('analysis_status', 'analyzed')),
    count(q().eq('analysis_status', 'analyzing')),
    count(q().eq('analysis_status', 'failed')),
  ])
  const pending = Math.max(0, tracks - analyzed - analyzing - failed)

  // ── Labels + profili ─────────────────────────────────────────────────────────
  const [{ data: labels }, { data: profiles }] = await Promise.all([
    supabase.from('labels').select('id, name, primary_genre, cataloged_tracks, created_at'),
    supabase.from('label_profiles').select('label_id, avg_embedding, confidence_score, analyzed_tracks_count, avg_spectral_centroid, avg_onset_strength, avg_sub_ratio, avg_mid_presence, avg_lufs, avg_tempo_stability, std_sub_ratio, std_onset_strength, std_spectral_centroid, updated_at'),
  ])
  const profById = new Map((profiles ?? []).map((p) => [p.label_id, p]))
  const labelList = (labels ?? [])

  // ── Generi ────────────────────────────────────────────────────────────────────
  const genreMap = new Map<string, { labels: number; tracks: number }>()
  for (const l of labelList) {
    const g = l.primary_genre || '—'
    const e = genreMap.get(g) ?? { labels: 0, tracks: 0 }
    e.labels++; e.tracks += l.cataloged_tracks ?? 0
    genreMap.set(g, e)
  }
  const genres = [...genreMap.entries()].map(([genre, v]) => ({ genre, ...v })).sort((a, b) => b.tracks - a.tracks)

  // ── Mappa: solo label con profilo + embedding valido ─────────────────────────
  const mapped = labelList
    .map((l) => ({ l, p: profById.get(l.id) }))
    .filter((x) => x.p && parseEmbedding(x.p.avg_embedding).length === 64)

  const embeddings = mapped.map((x) => parseEmbedding(x.p!.avg_embedding))
  const coords = pca2(embeddings)

  // coerenza interna: min-max delle std fra label, media, invertita (1 = molto coerente)
  const stdKeys = ['std_sub_ratio', 'std_onset_strength', 'std_spectral_centroid'] as const
  const ranges: Record<string, { min: number; max: number }> = {}
  for (const k of stdKeys) {
    const vals = mapped.map((x) => Number(x.p![k]) || 0)
    ranges[k] = { min: Math.min(...vals, 0), max: Math.max(...vals, 1e-9) }
  }
  const coherenceOf = (p: any) => {
    let s = 0
    for (const k of stdKeys) { const { min, max } = ranges[k]; const v = Number(p[k]) || 0; s += max > min ? (v - min) / (max - min) : 0 }
    return 1 - s / stdKeys.length // 1 = molto coerente, 0 = molto eclettico
  }

  const mapLabels = mapped.map((x, i) => ({
    name: x.l.name,
    genre: x.l.primary_genre || '—',
    tracks: x.p!.analyzed_tracks_count ?? x.l.cataloged_tracks ?? 0,
    confidence: x.p!.confidence_score ?? 0,
    solid: (x.p!.analyzed_tracks_count ?? 0) >= 20,
    sim: coords[i],
    feat: {
      brightness: x.p!.avg_spectral_centroid ?? 0, // Dark ↔ Bright
      punch: x.p!.avg_onset_strength ?? 0,          // Smooth ↔ Punchy
      sub: x.p!.avg_sub_ratio ?? 0,
      mid: x.p!.avg_mid_presence ?? 0,
      lufs: x.p!.avg_lufs ?? 0,
    },
    coherence: coherenceOf(x.p!),
  }))

  // ── Classifica label (tutte, per numero tracce) ──────────────────────────────
  const ranking = labelList
    .map((l) => {
      const p = profById.get(l.id)
      return { name: l.name, genre: l.primary_genre || '—', tracks: l.cataloged_tracks ?? 0, analyzed: p?.analyzed_tracks_count ?? 0, confidence: p?.confidence_score ?? 0, solid: (p?.analyzed_tracks_count ?? 0) >= 20 }
    })
    .sort((a, b) => b.tracks - a.tracks)

  // ── Evoluzione: tracce aggiunte (created_at) e analizzate (analyzed_at) per giorno ─
  const PAGE = 1000
  const rows: { created_at: string | null; analyzed_at: string | null }[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('label_ingestion_queue').select('created_at, analyzed_at').range(from, from + PAGE - 1)
    if (error || !data || data.length === 0) break
    rows.push(...(data as typeof rows))
    if (data.length < PAGE) break
  }
  const day = (s: string | null) => (s ? s.slice(0, 10) : null)
  const addedByDay = new Map<string, number>()
  const analyzedByDay = new Map<string, number>()
  for (const r of rows) {
    const a = day(r.created_at); if (a) addedByDay.set(a, (addedByDay.get(a) ?? 0) + 1)
    const b = day(r.analyzed_at); if (b) analyzedByDay.set(b, (analyzedByDay.get(b) ?? 0) + 1)
  }
  const days = [...new Set([...addedByDay.keys(), ...analyzedByDay.keys()])].sort()
  let cumA = 0, cumB = 0
  const evolution = days.map((dte) => { cumA += addedByDay.get(dte) ?? 0; cumB += analyzedByDay.get(dte) ?? 0; return { date: dte, added: cumA, analyzed: cumB } })

  const avgConfidence = (profiles ?? []).length ? (profiles ?? []).reduce((s, p) => s + (p.confidence_score ?? 0), 0) / (profiles ?? []).length : 0

  return NextResponse.json({
    kpi: {
      labels: labelList.length,
      tracks, analyzed, analyzing, pending, failed,
      analyzedPct: tracks > 0 ? Math.round((analyzed / tracks) * 100) : 0,
      avgConfidence,
      profiledLabels: mapped.length,
    },
    genres,
    map: mapLabels,
    ranking,
    evolution,
  })
}
