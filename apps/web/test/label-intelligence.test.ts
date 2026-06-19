import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveIntel, type LabelAgg } from '../src/lib/label-intelligence.ts'

// Scenario: BIG = calamita (tante label ci finiscono); DUP = quasi-duplicato di BIG;
// GOOD = riconoscibile (hit alto); ECL = eclettica (hit basso, confusione sparsa).
const labels: LabelAgg[] = [
  { id: 'BIG', name: 'Big', tracks: 400, n: 100, hit5: 0.9, confusion: [{ id: 'GOOD', name: 'Good', count: 3 }] },
  { id: 'DUP', name: 'Dup', tracks: 15, n: 10, hit5: 0.0, confusion: [{ id: 'BIG', name: 'Big', count: 10 }] }, // 100% → BIG
  { id: 'GOOD', name: 'Good', tracks: 200, n: 80, hit5: 0.85, confusion: [{ id: 'BIG', name: 'Big', count: 8 }] },
  { id: 'ECL', name: 'Ecl', tracks: 75, n: 40, hit5: 0.05, confusion: [{ id: 'BIG', name: 'Big', count: 7 }, { id: 'GOOD', name: 'Good', count: 6 }, { id: 'DUP', name: 'Dup', count: 5 }] },
]

test('reliable riflette hit@5 reale (non i centroidi)', () => {
  const { metrics } = deriveIntel(labels)
  const m = (id: string) => metrics.find((x) => x.id === id)!
  assert.equal(m('GOOD').reliable, true)   // hit 0.85
  assert.equal(m('BIG').reliable, true)    // hit 0.9
  assert.equal(m('ECL').reliable, false)   // hit 0.05 → sfocato
  assert.equal(m('DUP').reliable, false)   // hit 0.0 → sfocato
})

test('genericWeight: la calamita (BIG) pesa meno di tutte', () => {
  const { metrics } = deriveIntel(labels)
  const w = new Map(metrics.map((m) => [m.id, m.genericWeight]))
  assert.ok(w.get('BIG')! < w.get('GOOD')!, `BIG ${w.get('BIG')} deve pesare meno di GOOD ${w.get('GOOD')}`)
  for (const v of w.values()) assert.ok(v >= 0.6 - 1e-9 && v <= 1 + 1e-9)
})

test('similarTo = destinazione di confusione principale', () => {
  const { metrics } = deriveIntel(labels)
  const dup = metrics.find((m) => m.id === 'DUP')!
  assert.equal(dup.similarToName, 'Big')
  assert.equal(dup.similarPct, 1) // 10/10
})

test('famiglie: DUP assorbito da BIG nella stessa famiglia (NON le fonde)', () => {
  const { metrics, families } = deriveIntel(labels)
  const fam = families.find((f) => f.members.some((m) => m.id === 'DUP'))
  assert.ok(fam, 'DUP deve stare in una famiglia con BIG')
  assert.ok(fam!.members.some((m) => m.id === 'BIG'))
  assert.equal(fam!.name, 'Big') // BIG ha più tracce
  // restano entità distinte
  assert.equal(metrics.filter((m) => m.id === 'BIG' || m.id === 'DUP').length, 2)
})

test('ECL (eclettica, confusione sparsa <50%) non finisce in una famiglia', () => {
  const { families } = deriveIntel(labels)
  assert.ok(!families.some((f) => f.members.some((m) => m.id === 'ECL')))
})

test('input vuoto → nessun crash', () => {
  assert.deepEqual(deriveIntel([]), { metrics: [], families: [] })
})
