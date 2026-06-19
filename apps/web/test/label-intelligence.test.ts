import { test } from 'node:test'
import assert from 'node:assert/strict'
import { labelMetrics, soundFamilies, type LabelVec } from '../src/lib/label-intelligence.ts'

// 3 "isole" + 1 label centrale vicina a tutte.
const E = (dir: number, dim = 8, amp = 1) => Array.from({ length: dim }, (_, i) => (i === dir ? amp : 0))

const labels: LabelVec[] = [
  { id: 'A1', name: 'A1', centroid: E(0), tracks: 100 },
  { id: 'A2', name: 'A2', centroid: E(0).map((x) => x + 0.02), tracks: 50 }, // gemella di A1
  { id: 'B', name: 'B', centroid: E(3), tracks: 80 },
  { id: 'C', name: 'C', centroid: E(5), tracks: 80 },
  { id: 'HUB', name: 'HUB', centroid: [0.5, 0, 0, 0.5, 0, 0.5, 0, 0], tracks: 200 }, // vicina a tutte
]

test('genericWeight: la label centrale (HUB) è più smorzata delle isole', () => {
  const m = labelMetrics(labels)
  const w = new Map(m.map((x) => [x.id, x.genericWeight]))
  assert.ok(w.get('HUB')! < w.get('B')!, `HUB ${w.get('HUB')} dovrebbe pesare meno di B ${w.get('B')}`)
  assert.ok(w.get('HUB')! >= 0.6 - 1e-9) // mai sotto il floor
  for (const v of w.values()) assert.ok(v <= 1 + 1e-9 && v >= 0.6 - 1e-9)
})

test('nearest: A1 e A2 si riconoscono come gemelle (NON le fonde)', () => {
  const m = labelMetrics(labels)
  const a1 = m.find((x) => x.id === 'A1')!
  assert.equal(a1.nearestId, 'A2')
  assert.ok(a1.nearestSim > 0.5)
  // restano due label distinte nell'output
  assert.equal(m.filter((x) => x.id === 'A1' || x.id === 'A2').length, 2)
})

test('distinctiveness/affidabilità: le gemelle sono meno distinte delle isole', () => {
  const m = labelMetrics(labels)
  const a1 = m.find((x) => x.id === 'A1')!
  const b = m.find((x) => x.id === 'B')!
  assert.ok(a1.distinctiveness < b.distinctiveness)
})

test('soundFamilies: A1+A2 nella stessa famiglia, B e C separate', () => {
  const fams = soundFamilies(labels, 0.5)
  const famOf = (id: string) => fams.findIndex((f) => f.members.some((mm) => mm.id === id))
  assert.equal(famOf('A1'), famOf('A2')) // stessa famiglia
  assert.notEqual(famOf('A1'), famOf('B'))
  // la famiglia prende il nome dal membro con più tracce
  const famA = fams[famOf('A1')]
  assert.equal(famA.name, 'A1') // A1 ha 100 tracce > A2 50
})

test('input minimo (1 label) → nessun crash, valori neutri', () => {
  const m = labelMetrics([{ id: 'x', name: 'x', centroid: E(0), tracks: 3 }])
  assert.equal(m.length, 1)
  assert.equal(m[0].genericWeight, 1)
  assert.equal(m[0].reliable, true)
})
