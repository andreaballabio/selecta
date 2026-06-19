// Ricerca "descrivi il tuo suono → label" — 100% GRATUITA, nessuna API esterna.
// Traduce le parole della query negli ASSI MISURATI che già abbiamo per ogni
// label (brillantezza, percussività, sub, medi, loudness, coerenza) e ordina le
// label per affinità. Pura funzione, gira nel browser: zero costi, istantanea.

import { featureBars } from './label-display'

export type SoundAxis = 'Brillantezza' | 'Percussività' | 'Sub-bass' | 'Medi' | 'Loudness' | 'Coerenza'

interface Term { words: string[]; axis: SoundAxis; dir: 'hi' | 'lo' }

// Lessico: parole (IT + EN + sinonimi) → asse + direzione. Aggiungerne è banale.
const LEXICON: Term[] = [
  { axis: 'Brillantezza', dir: 'hi', words: ['brillante', 'luminoso', 'bright', 'crisp', 'airy', 'aperto', 'squillante', 'cristallino'] },
  { axis: 'Brillantezza', dir: 'lo', words: ['scuro', 'dark', 'cupo', 'deep', 'profondo', 'underground', 'moody', 'notturno', 'ipnotico', 'hypnotic', 'tenebroso'] },
  { axis: 'Percussività', dir: 'hi', words: ['punchy', 'percussivo', 'groovy', 'driving', 'energico', 'energetic', 'peak', 'club', 'rolling', 'tribale', 'tribal', 'ritmico', 'incalzante', 'ballabile'] },
  { axis: 'Percussività', dir: 'lo', words: ['morbido', 'soft', 'liscio', 'smooth', 'rilassato', 'chill', 'mellow', 'dolce', 'ambient'] },
  { axis: 'Sub-bass', dir: 'hi', words: ['sub', 'sub-heavy', 'subheavy', 'bassy', 'basso', 'bassi', 'pesante', 'heavy', 'potente', 'corposo', 'lowend', 'rotondo', 'rumbling'] },
  { axis: 'Sub-bass', dir: 'lo', words: ['leggero', 'light', 'asciutto', 'snello'] },
  { axis: 'Medi', dir: 'hi', words: ['caldo', 'warm', 'pieno', 'full', 'organico', 'organic', 'rich', 'avvolgente'] },
  { axis: 'Medi', dir: 'lo', words: ['minimal', 'minimale', 'essenziale', 'stripped', 'scarno', 'clean', 'pulito', 'freddo', 'cold'] },
  { axis: 'Loudness', dir: 'hi', words: ['loud', 'forte', 'pumping', 'compresso', 'aggressivo', 'aggressive', 'big', 'massiccio', 'esplosivo'] },
  { axis: 'Loudness', dir: 'lo', words: ['dinamico', 'dynamic', 'arioso', 'morbido-master'] },
  { axis: 'Coerenza', dir: 'hi', words: ['coerente', 'identitario', 'signature', 'consistente', 'niche', 'focalizzato', 'riconoscibile'] },
  { axis: 'Coerenza', dir: 'lo', words: ['vario', 'eclettico', 'versatile', 'varied'] },
]

const STOP = new Set(['con', 'di', 'e', 'il', 'la', 'lo', 'un', 'una', 'the', 'a', 'in', 'da', 'su', 'per', 'and', 'with', 'of', 'to', 'tipo', 'stile', 'come', 'che', 'molto', 'più', 'tra'])

export interface ParsedQuery {
  axes: { axis: SoundAxis; target: number }[] // target 0 (basso) o 100 (alto)
  tokens: string[]                            // parole utili (no stop-word)
}

export function parseSoundQuery(q: string): ParsedQuery {
  const tokens = q.toLowerCase().split(/[^a-zàèéìòù0-9-]+/).filter((w) => w.length > 1 && !STOP.has(w))
  const axes: { axis: SoundAxis; target: number }[] = []
  const seen = new Set<SoundAxis>()
  for (const w of tokens) {
    for (const term of LEXICON) {
      if (!seen.has(term.axis) && term.words.includes(w)) {
        axes.push({ axis: term.axis, target: term.dir === 'hi' ? 100 : 0 })
        seen.add(term.axis)
      }
    }
  }
  return { axes, tokens }
}

export interface ScorableLabel {
  name: string
  primary_genre: string | null
  secondary_genres?: string[] | null
  reference_artists?: string[] | null
  profile: Record<string, unknown> | null
}

/**
 * Affinità 0..1 della label con la query, oppure `null` se va esclusa.
 * - Con descrittori sonori: TUTTE le label sono ordinabili per vicinanza sugli
 *   assi (0.75) + parole che combaciano su genere/nome/artisti (0.25).
 * - Solo parole (nessun descrittore): inclusa solo se almeno una combacia.
 */
export function scoreLabel(p: ParsedQuery, l: ScorableLabel): number | null {
  const hay = [l.name, l.primary_genre, ...(l.secondary_genres ?? []), ...(l.reference_artists ?? [])].join(' ').toLowerCase()
  const hits = p.tokens.filter((t) => hay.includes(t)).length
  const textFrac = p.tokens.length ? hits / p.tokens.length : 0

  if (p.axes.length > 0) {
    const bars = featureBars(l.profile)
    const pct = (a: SoundAxis) => bars.find((b) => b.label === a)?.pct ?? 50
    let s = 0
    for (const { axis, target } of p.axes) s += 1 - Math.abs(pct(axis) - target) / 100
    const soundFit = s / p.axes.length
    return 0.75 * soundFit + 0.25 * textFrac
  }
  return hits > 0 ? textFrac : null
}
