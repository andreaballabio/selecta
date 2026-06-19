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
  // Check tecnici "da A&R" (worker v2; possono mancare sulle analisi vecchie)
  true_peak_dbtp?: number | null      // dBTP, >0 = clipping inter-sample
  crest_db?: number | null            // punch / compressione
  stereo_correlation?: number | null  // 1=mono, <0=cancella in mono
  loopiness?: number | null           // 0..1, alto = loop statico
  intro_build?: number | null         // l'energia sale nei primi ~30s?
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
    const tone: Tone = 'info'
    const verdict = o > 0.6 ? 'Groove molto percussivo e transient-rich.' : o < 0.35 ? 'Groove smooth, poco percussivo.' : 'Groove bilanciato.'
    items.push({ id: 'groove', title: 'Groove', value: `${Math.round(o * 100)}`, tone, verdict })
  }

  return items
}

// ── Pre-flight A&R: i check che fanno scartare in 2 secondi ──────────────────
function preflightItems(f: ReportFeatures): ReportItem[] {
  const items: ReportItem[] = []

  if (f.true_peak_dbtp != null && isFinite(f.true_peak_dbtp)) {
    const tp = f.true_peak_dbtp
    let tone: Tone = 'good', verdict = 'True peak con margine sicuro.', advice: string | undefined
    if (tp > 0) { tone = 'bad'; verdict = 'Clipping inter-sample (oltre 0 dBTP): distorce su molti lettori/DSP.'; advice = 'Abbassa il limiter e tieni il true peak a −1 dBTP.' }
    else if (tp > -0.3) { tone = 'warn'; verdict = 'True peak a ridosso di 0: rischio clipping inter-sample.'; advice = 'Lascia almeno −1 dBTP di margine.' }
    items.push({ id: 'truepeak', title: 'True peak', value: `${tp.toFixed(1)} dBTP`, tone, verdict, advice })
  }

  if (f.stereo_correlation != null && isFinite(f.stereo_correlation)) {
    const c = f.stereo_correlation
    let tone: Tone = 'good', verdict = 'Compatibile in mono.', advice: string | undefined
    if (c < -0.1) { tone = 'bad'; verdict = 'Fuori fase: in mono (impianti club) parte del suono si cancella.'; advice = 'Controlla la fase; tieni i bassi in mono.' }
    else if (c < 0.2) { tone = 'warn'; verdict = 'Immagine molto larga: verifica come regge in mono.'; advice = 'Restringi lo stereo sotto i ~150 Hz.' }
    items.push({ id: 'mono', title: 'Compatibilità mono', value: c.toFixed(2), tone, verdict, advice })
  }

  if (f.crest_db != null && isFinite(f.crest_db)) {
    const cr = f.crest_db
    let tone: Tone = 'good', verdict = 'Punch e dinamica in range.', advice: string | undefined
    if (cr < 6) { tone = 'warn'; verdict = 'Master molto compresso: poco punch sul drop.'; advice = 'Allenta compressione/limiter per ridare transiente.' }
    else if (cr > 18) { tone = 'info'; verdict = 'Molto dinamico: in un set DJ può suonare più basso degli altri brani.' }
    items.push({ id: 'crest', title: 'Punch (crest)', value: `${cr.toFixed(1)} dB`, tone, verdict, advice })
  }

  if (f.loopiness != null && isFinite(f.loopiness)) {
    const lp = f.loopiness
    let tone: Tone = 'good', verdict = 'La traccia evolve (non è un loop statico).', advice: string | undefined
    if (lp > 0.85) { tone = 'warn'; verdict = 'Sembra un loop: poca evoluzione. Le label cercano composizioni, non idee.'; advice = 'Aggiungi intro/break/drop con stacchi di energia.' }
    else if (lp > 0.7) { tone = 'info'; verdict = 'Struttura piuttosto uniforme: valuta più dinamica tra le sezioni.' }
    items.push({ id: 'structure', title: 'Struttura', value: `${Math.round((1 - lp) * 100)}/100`, tone, verdict, advice })
  }

  if (f.intro_build != null && isFinite(f.intro_build)) {
    const ib = f.intro_build
    let tone: Tone = 'info', verdict = 'Intro con una leggera evoluzione.'
    let advice: string | undefined
    if (ib >= 0.08) { tone = 'good'; verdict = 'L’intro costruisce energia: ottima per il mix DJ e per agganciare nei primi secondi.' }
    else if (ib <= -0.08) { tone = 'warn'; verdict = 'L’energia parte alta e poi cala: poca intro mixabile.'; advice = 'Aggiungi un’intro che sale (8/16 battute) per DJ e A&R.' }
    else { tone = 'info'; verdict = 'Intro piuttosto piatta nei primi ~30s.'; advice = 'Un build iniziale aiuta ad agganciare nei primi 15 secondi, dove gli A&R decidono.' }
    items.push({ id: 'intro', title: 'Intro / primi secondi', value: ib >= 0.08 ? 'in salita' : ib <= -0.08 ? 'in calo' : 'piatta', tone, verdict, advice })
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
  // penalità ancorate (coerenti coi verdetti mostrati: -8..-5 è "da club", nessuna penalità)
  if (lufs > -5) score -= 35           // schiacciato
  else if (lufs < -16) score -= 35     // troppo basso
  else if (lufs < -12) score -= 15     // bassino per il club

  // profilo estremo
  if (f.sub_ratio != null && (f.sub_ratio > 0.55 || f.sub_ratio < 0.15)) score -= 8
  if (f.spectral_centroid != null && (f.spectral_centroid > 4200 || f.spectral_centroid < 1400)) score -= 6

  // Check tecnici "da scarto" (quando disponibili dal worker v2)
  if (f.true_peak_dbtp != null && f.true_peak_dbtp > 0) score -= 20      // clipping inter-sample
  if (f.stereo_correlation != null && f.stereo_correlation < -0.1) score -= 15 // cancella in mono
  if (f.loopiness != null && f.loopiness > 0.85) score -= 10             // loop che non evolve
  if (f.crest_db != null && f.crest_db < 6) score -= 5                   // master schiacciato (coerente con l'item <6)

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

  // Pre-flight per primo: è il gate che decide lo scarto in 2 secondi.
  const preflight = preflightItems(f)
  if (preflight.length) sections.push({ id: 'preflight', title: 'Pre-flight A&R · scarto in 2 secondi', items: preflight })

  const loud = loudnessItems(f)
  if (loud.length) sections.push({ id: 'loudness', title: 'Loudness & master', items: loud })

  const profile = soundProfileItems(f)
  if (profile.length) sections.push({ id: 'profile', title: 'Profilo del suono', items: profile })

  return {
    readiness: computeReadiness(f),
    sections,
    pending: [
      'Loudness range (LRA) e PSR del drop precisi',
      'Sub in mono / centratura del basso',
    ],
  }
}
