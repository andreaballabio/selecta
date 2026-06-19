import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nearestPeers, type PeerTrack } from '../src/lib/peer-graph.ts'

const E = (dir: number, dim = 8) => Array.from({ length: dim }, (_, i) => (i === dir ? 1 : 0) + 0.01 * ((i * 7) % 3))

test('trova i producer più vicini ed esclude te stesso', () => {
  const me = [E(0)]
  const candidates: PeerTrack[] = [
    { userId: 'me', artist: 'Me', embedding: E(0) },      // io → escluso
    { userId: 'a', artist: 'A', embedding: E(0) },        // vicinissimo
    { userId: 'b', artist: 'B', embedding: E(3) },        // lontano
    { userId: 'c', artist: 'C', embedding: E(0) },        // vicino
  ]
  const peers = nearestPeers(me, candidates, { excludeUserIds: ['me'], center: false, k: 5 })
  assert.ok(!peers.some((p) => p.userId === 'me'))
  assert.equal(peers[0].userId === 'a' || peers[0].userId === 'c', true)
  assert.ok(peers[peers.length - 1].userId === 'b') // il più lontano in fondo
})

test('un producer con più tracce compare UNA volta (migliore)', () => {
  const me = [E(0)]
  const candidates: PeerTrack[] = [
    { userId: 'a', artist: 'A', trackTitle: 't1', embedding: E(3) }, // lontana
    { userId: 'a', artist: 'A', trackTitle: 't2', embedding: E(0) }, // vicina
  ]
  const peers = nearestPeers(me, candidates, { center: false })
  assert.equal(peers.length, 1)
  assert.equal(peers[0].trackTitle, 't2') // tiene la traccia migliore
})

test('minScore filtra i poco affini', () => {
  const me = [E(0)]
  const candidates: PeerTrack[] = [{ userId: 'b', artist: 'B', embedding: E(3) }]
  const peers = nearestPeers(me, candidates, { center: false, minScore: 0.9 })
  assert.equal(peers.length, 0)
})

test('input vuoti → nessun crash', () => {
  assert.deepEqual(nearestPeers([], [{ userId: 'a', artist: 'A', embedding: E(0) }]), [])
  assert.deepEqual(nearestPeers([E(0)], []), [])
})
