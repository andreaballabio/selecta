/**
 * Esegue il validation harness del matching SUL CATALOGO REALE (sola lettura).
 * Uso:  node --env-file=.env.local scripts/eval-live.ts
 *
 * Legge le tracce analizzate da label_ingestion_queue (id, label_id, embedding),
 * calcola precision@k leave-one-out e stampa il report. Nessuna scrittura.
 */
import { createClient } from '@supabase/supabase-js'
import { evaluatePrecision, type EvalTrack } from '../src/lib/eval-matching.ts'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
if (!url || !key) { console.error('Mancano NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const sb = createClient(url, key)

function parseEmb(raw: unknown): number[] {
  if (typeof raw === 'string') { try { const p = JSON.parse(raw); return Array.isArray(p) ? p.map(Number) : [] } catch { return [] } }
  if (Array.isArray(raw)) return (raw as unknown[]).map(Number)
  return []
}

const rows: { label_id: string; audio_embedding: unknown }[] = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from('label_ingestion_queue')
    .select('label_id, audio_embedding')
    .eq('analysis_status', 'analyzed')
    .not('audio_embedding', 'is', null)
    .range(from, from + 999)
  if (error) { console.error('Errore lettura:', error.message); process.exit(1) }
  if (!data || data.length === 0) break
  rows.push(...(data as typeof rows))
  if (data.length < 1000) break
}

const catalog: EvalTrack[] = rows
  .map((r) => ({ labelId: r.label_id, embedding: parseEmb(r.audio_embedding) }))
  .filter((t) => t.labelId && t.embedding.length === 64)

console.log(`\nTracce caricate: ${rows.length} | con embedding 64-dim valido: ${catalog.length}`)

const r = evaluatePrecision(catalog, { minTracksPerLabel: 3, topKWindows: 5, center: true })
const pct = (x: number) => (x * 100).toFixed(1) + '%'
console.log('\n================  VALIDAZIONE MATCHING (leave-one-out)  ================')
console.log(`Tracce valutate:   ${r.tracksEvaluated}`)
console.log(`Label coperte:     ${r.labelsCovered}`)
console.log(`Precision@1:       ${pct(r.precisionAt1)}   ← la label giusta è la 1ª`)
console.log(`Precision@3:       ${pct(r.precisionAt3)}   ← la label giusta è in top-3`)
console.log(`Precision@5:       ${pct(r.precisionAt5)}   ← la label giusta è in top-5`)
console.log(`MRR:               ${r.mrr.toFixed(3)}        (1.0 = perfetto)`)
console.log(`\nBaseline a caso ≈ ${pct(1 / Math.max(1, r.labelsCovered))} (1/label) per @1.`)
console.log('\n— Top 8 label per accuratezza (hit in top-5) —')
for (const l of r.perLabel.slice(0, 8)) console.log(`  ${pct(l.hitRateTop5).padStart(6)}  rank medio ${l.avgRank.toFixed(1).padStart(5)}  (${l.tracks} tracce)  ${l.labelId.slice(0, 8)}`)
console.log('\n— Peggiori 5 label —')
for (const l of r.perLabel.slice(-5)) console.log(`  ${pct(l.hitRateTop5).padStart(6)}  rank medio ${l.avgRank.toFixed(1).padStart(5)}  (${l.tracks} tracce)  ${l.labelId.slice(0, 8)}`)
console.log('=======================================================================\n')
