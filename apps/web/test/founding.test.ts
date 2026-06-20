import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeConfig, isOpen, spotsLeft, daysLeft, activePerks, DEFAULT_FOUNDING } from '../src/lib/founding.ts'

const NOW = Date.parse('2026-06-20T00:00:00Z')
const future = '2026-07-20T00:00:00Z'
const past = '2026-06-01T00:00:00Z'

test('isOpen: serve enabled + dentro la data + sotto il tetto', () => {
  assert.equal(isOpen({ enabled: true, deadline: future, cap: 100, perks: [] }, 50, NOW), true)
  assert.equal(isOpen({ enabled: false, deadline: future, cap: 100, perks: [] }, 0, NOW), false) // spento
  assert.equal(isOpen({ enabled: true, deadline: past, cap: 100, perks: [] }, 0, NOW), false)    // scaduto
  assert.equal(isOpen({ enabled: true, deadline: future, cap: 100, perks: [] }, 100, NOW), false) // tetto pieno
})

test('chiude al PRIMO dei due (data O tetto)', () => {
  const c = { enabled: true, deadline: future, cap: 50, perks: [] }
  assert.equal(isOpen(c, 49, NOW), true)
  assert.equal(isOpen(c, 50, NOW), false) // tetto raggiunto anche se la data non è scaduta
  assert.equal(isOpen({ ...c, cap: 1000 }, 49, Date.parse('2026-08-01')), false) // data scaduta anche se sotto tetto
})

test('senza tetto/scadenza → aperto finché enabled', () => {
  assert.equal(isOpen({ enabled: true, deadline: null, cap: null, perks: [] }, 99999, NOW), true)
  assert.equal(spotsLeft({ enabled: true, deadline: null, cap: null, perks: [] }, 10), null)
  assert.equal(daysLeft({ enabled: true, deadline: null, cap: null, perks: [] }, NOW), null)
})

test('spotsLeft e daysLeft', () => {
  assert.equal(spotsLeft({ enabled: true, deadline: null, cap: 100, perks: [] }, 73), 27)
  assert.equal(spotsLeft({ enabled: true, deadline: null, cap: 100, perks: [] }, 120), 0) // mai negativo
  assert.equal(daysLeft({ enabled: true, deadline: future, cap: null, perks: [] }, NOW), 30)
})

test('mergeConfig: difende da input sporco e applica i default', () => {
  assert.deepEqual(mergeConfig(null).perks, DEFAULT_FOUNDING.perks)
  assert.equal(mergeConfig({ enabled: 'yes' }).enabled, false) // solo true esplicito
  assert.equal(mergeConfig({ cap: -5 }).cap, null)             // cap non valido → null
  assert.equal(mergeConfig({ deadline: 'boh' }).deadline, null)
  const c = mergeConfig({ enabled: true, cap: 50.9, deadline: future, perks: [{ label: '  X  ', enabled: false }, { nope: 1 }] })
  assert.equal(c.cap, 50)
  assert.deepEqual(c.perks, [{ label: 'X', enabled: false }])
  assert.deepEqual(activePerks({ enabled: true, deadline: null, cap: null, perks: [{ label: 'A', enabled: true }, { label: 'B', enabled: false }] }), ['A'])
})
