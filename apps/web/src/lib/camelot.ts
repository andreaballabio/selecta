/**
 * Conversione (key, scale) → notazione Camelot (es. 8A / 6B), lo standard DJ per
 * l'armonic mixing. La ruota Camelot: lettera A = minore, B = maggiore.
 */
const MAJOR: Record<string, string> = {
  C: '8B', 'C#': '3B', DB: '3B', D: '10B', 'D#': '5B', EB: '5B', E: '12B', F: '7B',
  'F#': '2B', GB: '2B', G: '9B', 'G#': '4B', AB: '4B', A: '11B', 'A#': '6B', BB: '6B', B: '1B',
}
const MINOR: Record<string, string> = {
  C: '5A', 'C#': '12A', DB: '12A', D: '7A', 'D#': '2A', EB: '2A', E: '9A', F: '4A',
  'F#': '11A', GB: '11A', G: '6A', 'G#': '1A', AB: '1A', A: '8A', 'A#': '3A', BB: '3A', B: '10A',
}

function normKey(key: string): string {
  const k = key.trim()
  if (!k) return ''
  // Prima lettera maiuscola + eventuale accidentale
  const letter = k[0].toUpperCase()
  const rest = k.slice(1).replace('♯', '#').replace('♭', 'b')
  if (rest.startsWith('#')) return (letter + '#')
  if (rest.toLowerCase().startsWith('b')) return (letter + 'B') // es. "Bb" → "BB" (chiave del map flats)
  return letter
}

function isMinor(scale?: string | null): boolean {
  const s = (scale ?? '').toLowerCase()
  return s.startsWith('min') || s === 'm' || s === 'a' || s.includes('minor')
}

/** Ritorna il codice Camelot, o null se non determinabile. */
export function toCamelot(key?: string | null, scale?: string | null): string | null {
  if (!key) return null
  const nk = normKey(key)
  const table = isMinor(scale) ? MINOR : MAJOR
  // prova esatta, poi varianti (C# vs DB già gestite dalle chiavi nel map)
  return table[nk] ?? table[nk.toUpperCase()] ?? null
}

/** "F# minor" → "F#m · 11A" (etichetta compatta per i DJ). */
export function keyLabel(key?: string | null, scale?: string | null): string | null {
  if (!key) return null
  const cam = toCamelot(key, scale)
  const suffix = isMinor(scale) ? 'm' : ''
  return `${key}${suffix}${cam ? ` · ${cam}` : ''}`
}
