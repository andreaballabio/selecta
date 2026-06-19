import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareToReference, closeness } from '../src/lib/reference-match.ts'

test('in linea su tutto → status ok, nessun consiglio, closeness 100%', () => {
  const f = { lufs: -7, sub_ratio: 0.32, spectral_centroid: 2800, onset_strength: 0.5, mid_presence: 0.25 }
  const axes = compareToReference(f, { ...f })
  assert.equal(axes.length, 5)
  assert.ok(axes.every((a) => a.status === 'ok' && a.advice === ''))
  assert.ok(axes.every((a) => Math.abs(a.magnitude) < 1e-9))
  assert.equal(closeness(axes), 100)
})

test('master più basso → status low, consiglio "alza", barra negativa', () => {
  const axes = compareToReference({ lufs: -12 }, { lufs: -7 })
  const lufs = axes.find((a) => a.key === 'lufs')!
  assert.equal(lufs.status, 'low')
  assert.ok(lufs.magnitude < 0)
  assert.match(lufs.advice, /alzalo|più basso/i)
  assert.equal(lufs.word, 'più quiet')
})

test('troppo brillante → status high, consiglio "scurisci"', () => {
  const axes = compareToReference({ spectral_centroid: 4500 }, { spectral_centroid: 2800 })
  const b = axes.find((a) => a.key === 'spectral_centroid')!
  assert.equal(b.status, 'high')
  assert.ok(b.magnitude > 0)
  assert.match(b.advice, /scurisci/i)
})

test('meno sub → consiglio "+ low-end"', () => {
  const axes = compareToReference({ sub_ratio: 0.2 }, { sub_ratio: 0.38 })
  const s = axes.find((a) => a.key === 'sub_ratio')!
  assert.equal(s.status, 'low')
  assert.match(s.advice, /low-end|sub/i)
})

test('magnitudine satura a ±1 e valori mancanti saltati', () => {
  const axes = compareToReference({ lufs: -30 }, { lufs: -7 }) // diff enorme
  assert.equal(axes.find((a) => a.key === 'lufs')!.magnitude, -1)
  assert.equal(compareToReference({ lufs: -7 }, { sub_ratio: 0.3 }).length, 0) // nessun asse in comune
})
