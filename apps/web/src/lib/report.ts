/**
 * Report PRO — logica di valutazione della traccia.
 *
 * Le regole sono ANCORATE A NUMERI REALI (ricerca 2026, fonti: Spotify ufficiale,
 * AES TD1008, Ian Shepherd/MeterPlugs, riferimenti club/Beatport):
 *   - Streaming normalizza a -14 LUFS (Spotify/YouTube/Tidal), Apple -16, true peak -1 dBTP.
 *   - Club / Beatport / DJ promo: -8 ↔ -6 LUFS integrati (Beatport NON normalizza → si masterizza "hot").
 *   - "Demo-ready": loudness in finestra sensata, niente clipping, sub mono, drop non schiacciato.
 *
 * v1 lavora sui dati che il worker calcola già (integrated LUFS + profilo spettrale).
 * v2 (worker esteso) aggiungerà true-peak, PSR, LRA, correlazione di fase, sub-mono:
 * i 4 check da "scarto in 2 secondi" per le label.
 */

export interface ReportFeatures {
  bpm?: number | null
  key?: string | null
  scale?: string | null
  lufs?: number | null
  duration?: number | null
  energy?: number | null
  spectral_centroid?: number | null   // Hz
  spectral_rolloff?: number | null    // Hz
  zero_crossing_rate?: number | null
  onset_strength?: number | null      // 0..1
  sub_ratio?: number | null           // peso del basso (band-derived ~0.2-0.6)
  mid_presence?: number | null        // presenza medi
  tempo_stability?: number | null
  spectral_contrast?: number | null
}

export type Tone = 'good' | 'warn' | 'bad' | 'info'

export interface ReportItem {
  id: string
  title: string
  /** valore mostrato in grande (es. "-7.2 LUFS") */
  value: string
  tone: Tone
  /** verdetto in una riga */
  verdict: string
  /** consiglio azionabile (può essere vuoto) */
  advice?: string
}

export interface ReportSection {
  id: string
  title: string
  items: ReportItem[]
}

export interface TrackReport {
  readiness: { level: 'ready' | 'almost' | 'not'; score: number; headline: string }
  sections: ReportSection[]
  /** check non ancora disponibili (worker v2) — mostrati come "in arrivo" per onestà */
  pending: string[]
}

// Target di riferimento (numeri reali)
const STREAMING_LUFS = -14
const CLUB_LUFS_LOW = -8
const CLUB_LUFS_HIGH = -6

const fmt = (n: number, d = 1) => (n >= 0 ? '+' : '') + n.toFixed(d)

// ── Loudness (la metrica regina, completamente ancorata) ────────────────────
function loudnessItems(f: ReportFeatures): ReportItem[] {
  const lufs = f.lufs
  if (lufs == null || !isFinite(lufs)) return []

  const toStreaming = lufs - STREAMING_LUFS // >0 = più loud del target streaming
  const items: ReportItem[] = []

  let tone: Tone
  let verdict: string
  let advice: string

  if (lufs > -5) {
    tone = 'bad'
    verdict = 'Master schiacciato: oltre -5 LUFS si perde il punch del drop.'
    advice = `Su streaming verrà comunque abbassato di ~${Math.abs(toStreaming).toFixed(0)} dB (a -14). Allenta il limiter: punta a -6/-7 LUFS per il club, e fai una versione a -14 per lo streaming.`
  } else if (lufs >= CLUB_LUFS_HIGH) {
    // -6 .. -5
    tone = 'good'
    verdict = 'Loudness da club, ottima per Beatport / DJ promo.'
    advice = `Per lo streaming verrà normalizzata a -14 LUFS (~${Math.abs(toStreaming).toFixed(0)} dB più bassa): rendi anche una versione master a -14 LUFS, -1 dBTP.`
  } else if (lufs >= CLUB_LUFS_LOW) {
    // -8 .. -6
    tone = 'good'
    verdict = 'Loudness ideale per il club (-8/-6 LUFS).'
    advice = 'Per lo streaming valuta una seconda versione a -14 LUFS, -1 dBTP.'
  } else if (lufs >= -12) {
    // -12 .. -8
    tone = 'warn'
    verdict = 'Loudness moderata: ok per lo streaming, un po’ bassa per il club.'
    advice = `Per il club puoi spingere ~${(CLUB_LUFS_LOW - lufs).toFixed(0)} dB in più di impatto (verso -8 LUFS) senza schiacciare.`
  } else if (lufs >= -16) {
    // -16 .. -12
    tone = 'warn'
    verdict = 'Piuttosto bassa: in un set DJ suonerà debole accanto ad altre tracce.'
    advice = `Alza il master di ~${(CLUB_LUFS_LOW - lufs).toFixed(0)} dB verso il target club (-8 LUFS).`
  } else {
    tone = 'bad'
    verdict = 'Troppo bassa: la traccia sembra non finita.'
    advice = 'Porta il master verso -8/-6 LUFS (club) o -14 LUFS (streaming). Ora è sotto ogni standard di release.'
  }

  items.push({
    id: 'lufs',
    title: 'Loudness integrata',
    value: `${lufs.toFixed(1)} LUFS`,
    tone,
    verdict,
    advice,
  })

  // riga informativa con i due target
  items.push({
    id: 'lufs-targets',
    title: 'Rispetto ai target',
    value: `${fmt(toStreaming)} dB`,
    tone: 'info',
    verdict: `Streaming (-14 LUFS): ${fmt(toStreaming)} dB · Club (-8/-6): ${fmt(lufs - CLUB_LUFS_LOW)} dB`,
    advice: 'Beatport riproduce i file così come sono (non normalizza) → si masterizza più hot del club che dello streaming. Per questo conviene avere due master.',
  })

  return items
}

// ── Profilo del suono (indicativo, descrittivo) ─────────────────────────────
function soundProfileItems(f: ReportFeatures): ReportItem[] {
  const items: ReportItem[] = []

  // Brillantezza (spectral centroid in Hz)
  if (f.spectral_centroid != null) {
    const c = f.spectral_centroid
    let tone: Tone = 'good'
    let verdict = 'Bilanciamento tonale equilibrato.'
    if (c > 3800) { tone = 'warn'; verdict = 'Mix brillante / aperto in alto: verifica che non risulti affaticante su un impianto.' }
    else if (c < 1600) { tone = 'warn'; verdict = 'Mix scuro / cupo: potrebbe mancare di aria e presenza.' }
    items.push({ id: 'centroid', title: 'Brillantezza', value: `${Math.round(c)} Hz`, tone, verdict })
  }

  // Peso del basso (sub_ratio band-derived)
  if (f.sub_ratio != null) {
    const s = f.sub_ratio
    let tone: Tone = 'good'
    let verdict = 'Basso ben presente e bilanciato.'
    if (s > 0.5) { tone = 'warn'; verdict = 'Molto peso sul basso: rischio di "boom" su impianti potenti — controlla sub e kick.' }
    else if (s < 0.18) { tone = 'warn'; verdict = 'Poco basso: per techno/tech house il low-end di solito è più sostenuto.' }
    items.push({ id: 'sub', title: 'Peso del basso', value: `${Math.round(s * 100)}%`, tone, verdict })
  }

  // Groove / percussività (onset_strength)
  if (f.onset_strength != null) {
    const o = f.onset_strength
    let tone: Tone = 'info'
    let verdict = o > 0.6 ? 'Groove molto percussivo e transient-rich.' : o < 0.35 ? 'Groove smooth, poco percussivo.' : 'Groove bilanciato.'
    items.push({ id: 'groove', title: 'Groove', value: `${Math.round(o * 100)}`, tone, verdict })
  }

  return items
}

// ── Readiness complessiva ────────────────────────────────────────────────────
function computeReadiness(f: ReportFeatures): TrackReport['readiness'] {
  let score = 100
  const lufs = f.lufs

  if (lufs == null) {
    return { level: 'almost', score: 60, headline: 'Loudness non rilevata.' }
  }
  // penalità ancorate
  if (lufs > -5) score -= 35           // schiacciato
  else if (lufs < -16) score -= 35     // troppo basso
  else if (lufs < -12) score -= 15     // bassino per il club
  else if (lufs > -6 && lufs <= -5) score -= 5

  // profilo estremo
  if (f.sub_ratio != null && (f.sub_ratio > 0.55 || f.sub_ratio < 0.15)) score -= 8
  if (f.spectral_centroid != null && (f.spectral_centroid > 4200 || f.spectral_centroid < 1400)) score -= 6

  score = Math.max(20, Math.min(100, score))
  const level = score >= 80 ? 'ready' : score >= 60 ? 'almost' : 'not'
  const headline =
    level === 'ready' ? 'Tecnicamente pronta da inviare.'
    : level === 'almost' ? 'Quasi pronta — un paio di ritocchi e ci sei.'
    : 'Non ancora pronta: sistema i punti rossi prima di inviarla.'
  return { level, score, headline }
}

export function buildTrackReport(f: ReportFeatures): TrackReport {
  const sections: ReportSection[] = []

  const loud = loudnessItems(f)
  if (loud.length) sections.push({ id: 'loudness', title: 'Loudness & master', items: loud })

  const profile = soundProfileItems(f)
  if (profile.length) sections.push({ id: 'profile', title: 'Profilo del suono', items: profile })

  return {
    readiness: computeReadiness(f),
    sections,
    pending: [
      'True peak (dBTP) e clipping inter-sample',
      'Punch del drop (PSR) e dinamica (LRA)',
      'Compatibilità mono e sub centrato',
    ],
  }
}
