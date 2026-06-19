// Loop di esito degli invii: invio → risposta → firma.
// Ogni evento ("inviata a X", "risposto", "firmata") è DATO PROPRIETARIO che
// nessun concorrente ha → nel tempo permette di predire l'accettazione reale,
// non solo l'affinità di suono. È il fossato di lungo periodo.
//
// File SELF-CONTAINED → testabile con `node --test`.

export const OUTCOME_STATUSES = ['sent', 'no_reply', 'rejected', 'interested', 'signed'] as const
export type OutcomeStatus = (typeof OUTCOME_STATUSES)[number]

export const STATUS_LABEL: Record<OutcomeStatus, string> = {
  sent: 'Inviata',
  no_reply: 'Nessuna risposta',
  rejected: 'Rifiutata',
  interested: 'Interessati',
  signed: 'Firmata',
}

/** Stati che contano come "ha risposto" (la label ha dato un segnale). */
const RESPONDED: ReadonlySet<string> = new Set(['rejected', 'interested', 'signed'])

export function isValidStatus(s: unknown): s is OutcomeStatus {
  return typeof s === 'string' && (OUTCOME_STATUSES as readonly string[]).includes(s)
}

export interface OutcomeLike { status: string }

export interface OutcomeStats {
  total: number
  responded: number
  interested: number
  signed: number
  rejected: number
  responseRate: number // risposte / inviate (0..1)
  signRate: number     // firmate / inviate (0..1)
}

export function computeOutcomeStats(rows: OutcomeLike[]): OutcomeStats {
  const total = rows.length
  let responded = 0, interested = 0, signed = 0, rejected = 0
  for (const r of rows) {
    if (RESPONDED.has(r.status)) responded++
    if (r.status === 'interested') interested++
    else if (r.status === 'signed') signed++
    else if (r.status === 'rejected') rejected++
  }
  return {
    total,
    responded,
    interested,
    signed,
    rejected,
    responseRate: total ? responded / total : 0,
    signRate: total ? signed / total : 0,
  }
}
