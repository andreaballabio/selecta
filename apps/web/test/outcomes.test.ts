import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeOutcomeStats, isValidStatus, OUTCOME_STATUSES } from '../src/lib/outcomes.ts'

test('isValidStatus accetta solo gli stati noti', () => {
  for (const s of OUTCOME_STATUSES) assert.ok(isValidStatus(s))
  assert.equal(isValidStatus('boh'), false)
  assert.equal(isValidStatus(null), false)
  assert.equal(isValidStatus(42), false)
})

test('computeOutcomeStats: conteggi e tassi', () => {
  const rows = [
    { status: 'sent' }, { status: 'sent' },
    { status: 'no_reply' },
    { status: 'rejected' },
    { status: 'interested' },
    { status: 'signed' }, { status: 'signed' },
  ]
  const s = computeOutcomeStats(rows)
  assert.equal(s.total, 7)
  assert.equal(s.signed, 2)
  assert.equal(s.interested, 1)
  assert.equal(s.rejected, 1)
  assert.equal(s.responded, 4) // rejected + interested + 2 signed
  assert.ok(Math.abs(s.responseRate - 4 / 7) < 1e-9)
  assert.ok(Math.abs(s.signRate - 2 / 7) < 1e-9)
})

test('computeOutcomeStats: lista vuota → zeri, niente divisione per zero', () => {
  const s = computeOutcomeStats([])
  assert.equal(s.total, 0)
  assert.equal(s.responseRate, 0)
  assert.equal(s.signRate, 0)
})
