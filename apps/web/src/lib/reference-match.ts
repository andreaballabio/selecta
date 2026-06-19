// Reference Matching — confronta il SUONO della tua traccia con una reference
// (il sound medio della label che hai matchato) e dà consigli ANCORATI AI NUMERI:
// "alza il master di ~3 dB", "+13% di sub", "scurisci di ~600 Hz".
//
// È la differenza tra "trova la label" e "ti dico COME avvicinarti a quel suono".
// Unica fonte di verità per barre + parole + consigli. SELF-CONTAINED → testabile.

export interface FeatureSet {
  lufs?: number | null
  sub_ratio?: number | null
  spectral_centroid?: number | null
  onset_strength?: number | null
  mid_presence?: number | null
}

export type AxisStatus = 'ok' | 'low' | 'high' // low = sei sotto il target · high = sopra

export interface AxisCompare {
  key: string
  axis: string
  user: string        // valore tuo formattato
  ref: string         // valore target formattato
  userVal: number
  refVal: number
  magnitude: number   // -1..1 (segno: + = sei SOPRA il target) → per la barra divergente
  status: AxisStatus
  word: string        // "in linea" / più loud / più scuro …
  advice: string      // consiglio azionabile (vuoto se "in linea")
}

interface AxisDef {
  key: keyof FeatureSet
  axis: string
  fmt: (v: number) => string
  tol: number          // soglia "in linea"
  scale: number        // differenza che riempie mezza barra
  moreWord: string     // parola quando sei sopra
  lessWord: string     // parola quando sei sotto
  adviceBelow: (d: number) => string // sei sotto il target (d = |diff|)
  adviceAbove: (d: number) => string // sei sopra il target (d = |diff|)
}

const AXES: AxisDef[] = [
  {
    key: 'lufs', axis: 'Loudness', fmt: (v) => `${v.toFixed(1)} LUFS`, tol: 1.5, scale: 6,
    moreWord: 'più loud', lessWord: 'più quiet',
    adviceBelow: (d) => `Master più basso di ~${d.toFixed(0)} dB: alzalo verso il loro livello (senza schiacciare il drop).`,
    adviceAbove: (d) => `Master più loud di ~${d.toFixed(0)} dB: puoi allentare il limiter — su streaming verrà comunque normalizzato.`,
  },
  {
    key: 'sub_ratio', axis: 'Sub-bass', fmt: (v) => `${Math.round(v * 100)}%`, tol: 0.05, scale: 0.15,
    moreWord: 'più sub', lessWord: 'meno sub',
    adviceBelow: (d) => `Meno sub di loro (~${Math.round(d * 100)}%): dai più peso/energia al low-end (kick + sub).`,
    adviceAbove: (d) => `Più sub di loro (~${Math.round(d * 100)}%): controlla che il basso non rimbombi su impianti grossi.`,
  },
  {
    key: 'spectral_centroid', axis: 'Brillantezza', fmt: (v) => `${Math.round(v)} Hz`, tol: 400, scale: 1500,
    moreWord: 'più brillante', lessWord: 'più scuro',
    adviceBelow: (d) => `Mix più scuro di ~${Math.round(d)} Hz: apri le alte (aria/presenza) per avvicinarti al loro sound.`,
    adviceAbove: (d) => `Mix più brillante di ~${Math.round(d)} Hz: scurisci un po' (alti/aria) per non risultare affaticante.`,
  },
  {
    key: 'onset_strength', axis: 'Groove / punch', fmt: (v) => `${Math.round(v * 100)}`, tol: 0.1, scale: 0.3,
    moreWord: 'più percussivo', lessWord: 'più smooth',
    adviceBelow: () => 'Groove meno percussivo del loro: rendi i transienti più marcati (kick/perc in evidenza).',
    adviceAbove: () => 'Groove più percussivo del loro: il loro sound è più smooth, valuta di ammorbidire.',
  },
  {
    key: 'mid_presence', axis: 'Medi', fmt: (v) => `${Math.round(v * 100)}%`, tol: 0.06, scale: 0.15,
    moreWord: 'medi più presenti', lessWord: 'medi più contenuti',
    adviceBelow: () => 'Medi più scarni dei loro: aggiungi corpo/calore nelle medie frequenze.',
    adviceAbove: () => 'Medi più carichi dei loro: alleggerisci le medie per un mix più pulito.',
  },
]

const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Confronto per-asse fra la tua traccia (`user`) e la reference (`ref`). Solo
 *  gli assi con entrambi i valori presenti. */
export function compareToReference(user: FeatureSet, ref: FeatureSet): AxisCompare[] {
  const out: AxisCompare[] = []
  for (const a of AXES) {
    const u = num(user[a.key]), r = num(ref[a.key])
    if (u == null || r == null) continue
    const d = u - r
    const status: AxisStatus = Math.abs(d) <= a.tol ? 'ok' : d > 0 ? 'high' : 'low'
    out.push({
      key: a.key, axis: a.axis,
      user: a.fmt(u), ref: a.fmt(r), userVal: u, refVal: r,
      magnitude: clamp(d / a.scale, -1, 1),
      status,
      word: status === 'ok' ? 'in linea' : d > 0 ? a.moreWord : a.lessWord,
      advice: status === 'ok' ? '' : d > 0 ? a.adviceAbove(Math.abs(d)) : a.adviceBelow(Math.abs(d)),
    })
  }
  return out
}

/** Quanto sei "vicino" alla reference: % di assi in linea. */
export function closeness(axes: AxisCompare[]): number {
  if (!axes.length) return 0
  return Math.round((axes.filter((a) => a.status === 'ok').length / axes.length) * 100)
}
