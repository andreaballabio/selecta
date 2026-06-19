import { test } from 'node:test'
import assert from 'node:assert/strict'
import { versionInfo, pickVersionSubset } from '../src/lib/embedding-version.ts'

test('catalogo NON taggato → no-op (ritorna tutto)', () => {
  const cat = [{ embedding_version: null }, { embedding_version: undefined }, {}]
  const r = pickVersionSubset(cat, null)
  assert.equal(r.subset.length, 3)
  assert.equal(r.mixed, false)
})

test('catalogo single-version → no-op (ritorna tutto, anche le null)', () => {
  const cat = [{ embedding_version: 'effnet' }, { embedding_version: 'effnet' }, { embedding_version: null }]
  const r = pickVersionSubset(cat, 'effnet')
  assert.equal(r.subset.length, 3)
  assert.equal(r.mixed, false)
  assert.equal(r.usedVersion, 'effnet')
})

test('catalogo MISTO → tiene la versione utente + le non taggate, esclude l\'altra', () => {
  const cat = [
    { id: 1, embedding_version: 'effnet' },
    { id: 2, embedding_version: 'effnet' },
    { id: 3, embedding_version: 'v6' },
    { id: 4, embedding_version: null },
  ] as { id: number; embedding_version: string | null }[]
  const r = pickVersionSubset(cat, 'effnet')
  assert.equal(r.mixed, true)
  assert.equal(r.usedVersion, 'effnet')
  const ids = r.subset.map((t) => t.id).sort()
  assert.deepEqual(ids, [1, 2, 4]) // niente v6, ma la null resta
})

test('misto + versione utente ignota → usa la maggioritaria', () => {
  const cat = [
    { embedding_version: 'effnet' }, { embedding_version: 'effnet' }, { embedding_version: 'effnet' },
    { embedding_version: 'v6' },
  ]
  const r = pickVersionSubset(cat, null)
  assert.equal(r.usedVersion, 'effnet')
  assert.equal(r.subset.length, 3)
})

test('versionInfo: distribuzione, untagged, mixed', () => {
  const info = versionInfo([
    { embedding_version: 'effnet' }, { embedding_version: 'effnet' },
    { embedding_version: 'v6' }, { embedding_version: null },
  ])
  assert.deepEqual(info.distribution, { effnet: 2, v6: 1 })
  assert.equal(info.untagged, 1)
  assert.equal(info.mixed, true)
  assert.equal(info.dominant, 'effnet')
})
