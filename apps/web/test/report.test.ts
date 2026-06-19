import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTrackReport, type ReportFeatures } from '../src/lib/report.ts'

const find = (r: ReturnType<typeof buildTrackReport>, id: string) =>
  r.sections.find((s) => s.id === id)
const item = (r: ReturnType<typeof buildTrackReport>, sec: string, id: string) =>
  find(r, sec)?.items.find((i) => i.id === id)

test('traccia pulita → pronta, pre-flight tutto verde', () => {
  const f: ReportFeatures = {
    lufs: -7, sub_ratio: 0.3, spectral_centroid: 2600,
    true_peak_dbtp: -1.0, stereo_correlation: 0.5, crest_db: 10, loopiness: 0.4,
  }
  const r = buildTrackReport(f)
  assert.equal(r.readiness.level, 'ready')
  assert.ok(r.readiness.score >= 80)
  assert.ok(find(r, 'preflight'), 'sezione pre-flight presente')
  assert.equal(item(r, 'preflight', 'truepeak')!.tone, 'good')
  assert.equal(item(r, 'preflight', 'mono')!.tone, 'good')
})

test('traccia problematica → penalizzata, verdetti rossi', () => {
  const f: ReportFeatures = {
    lufs: -3,                       // schiacciato
    true_peak_dbtp: 0.6,            // clipping
    stereo_correlation: -0.5,       // cancella in mono
    crest_db: 4,                    // sovracompresso
    loopiness: 0.92,               // loop
  }
  const r = buildTrackReport(f)
  assert.equal(item(r, 'preflight', 'truepeak')!.tone, 'bad')
  assert.equal(item(r, 'preflight', 'mono')!.tone, 'bad')
  assert.equal(item(r, 'preflight', 'structure')!.tone, 'warn')
  assert.equal(r.readiness.level, 'not')
  assert.ok(r.readiness.score < 60, `score=${r.readiness.score}`)
})

test('check assenti (analisi vecchia) → nessuna sezione pre-flight, niente crash', () => {
  const r = buildTrackReport({ lufs: -8, sub_ratio: 0.3 })
  assert.equal(find(r, 'preflight'), undefined)
  assert.ok(r.sections.length >= 1)       // loudness/profilo ci sono
  assert.ok(r.pending.length >= 1)
})

test('intro: build positivo → ok, in calo → warn, e presente solo se c\'è il dato', () => {
  const good = item(buildTrackReport({ lufs: -7, intro_build: 0.2 }), 'preflight', 'intro')!
  assert.equal(good.tone, 'good')
  assert.equal(good.value, 'in salita')
  const bad = item(buildTrackReport({ lufs: -7, intro_build: -0.2 }), 'preflight', 'intro')!
  assert.equal(bad.tone, 'warn')
  assert.equal(item(buildTrackReport({ lufs: -7 }), 'preflight', 'intro'), undefined) // niente dato → niente item
})

test('clipping abbassa molto la readiness rispetto allo stesso brano pulito', () => {
  const base: ReportFeatures = { lufs: -7, sub_ratio: 0.3, spectral_centroid: 2600, crest_db: 10, stereo_correlation: 0.5, loopiness: 0.4 }
  const clean = buildTrackReport({ ...base, true_peak_dbtp: -1 }).readiness.score
  const clipped = buildTrackReport({ ...base, true_peak_dbtp: 0.8 }).readiness.score
  assert.ok(clean - clipped >= 20, `clean=${clean} clipped=${clipped}`)
})
