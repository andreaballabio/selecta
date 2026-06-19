// Label Intelligence — derivata dai dati di CONFUSIONE REALI (a livello di traccia),
// non dai centroidi (la media inganna: vedi label eclettiche). L'input arriva da un
// leave-one-out sul campione (nel job): per ogni label sappiamo quanto le sue tracce
// la ritrovano (hit@5) e verso quali altre label "scappano" (confusione).
//
// Da questi derivo, in automatico:
//  - reliable / hit5     : affidabilità reale del match (hit@5 alto = riconoscibile)
//  - genericWeight       : smorza le label "calamita" (tante altre ci finiscono sopra)
//  - similarTo           : la label verso cui scappa di più (info, MAI fusione)
//  - famiglie            : label quasi-duplicate (una assorbita dall'altra ≥ soglia)
//
// File SELF-CONTAINED (nessun import) → testabile con `node --test`.

export interface ConfTarget { id: string; name: string; count: number }
export interface LabelAgg {
  id: string; name: string; tracks: number
  n: number            // tracce nel campione
  hit5: number         // 0..1 — quanto le sue tracce ritrovano la label giusta in top-5
  confusion: ConfTarget[] // verso chi vanno quando la #1 NON è la label giusta
}

export interface IntelResult {
  id: string; name: string; tracks: number
  hit5: number
  reliable: boolean
  genericWeight: number          // [floor..1] — basso = label generica/calamita
  similarToId: string | null
  similarToName: string | null
  similarPct: number             // quota delle sue tracce che vanno lì (0..1)
  family: string | null
}
export interface Family { name: string; members: { id: string; name: string; tracks: number }[] }

export interface DeriveOptions {
  weightFloor?: number   // peso minimo per la label più "calamita" (default 0.6)
  reliableMin?: number   // hit@5 sotto cui la label è "sfocata" (default 0.5)
  familyMinPct?: number  // quota di confusione per dire "A è assorbita da B" (default 0.5)
}

export function deriveIntel(labels: LabelAgg[], opts: DeriveOptions = {}): { metrics: IntelResult[]; families: Family[] } {
  const floor = opts.weightFloor ?? 0.6
  const reliableMin = opts.reliableMin ?? 0.5
  const famMin = opts.familyMinPct ?? 0.5
  if (labels.length === 0) return { metrics: [], families: [] }

  // Confusione in ENTRATA per label = quante tracce di ALTRE label ci finiscono.
  // È la "calamita": più è alta, più la label è generica → peso più basso (IDF).
  const inCount = new Map<string, number>()
  for (const l of labels) for (const c of l.confusion) inCount.set(c.id, (inCount.get(c.id) ?? 0) + c.count)
  const maxIn = Math.max(1, ...inCount.values())

  // Top destinazione di confusione per ogni label (per "simile a" e famiglie).
  const topOf = new Map<string, { t: ConfTarget; pct: number } | null>()
  for (const l of labels) {
    const top = [...l.confusion].sort((a, b) => b.count - a.count)[0]
    topOf.set(l.id, top && l.n > 0 ? { t: top, pct: top.count / l.n } : null)
  }

  // Famiglie: union-find. Colleghiamo A e B se A→B (o B→A) supera famMin
  // (= "A è in gran parte assorbita da B"): cattura i quasi-duplicati/sub-label
  // SENZA fondere label distinte (soglia alta).
  const idx = new Map(labels.map((l, i) => [l.id, i]))
  const parent = labels.map((_, i) => i)
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])))
  const union = (a: number, b: number) => { parent[find(a)] = find(b) }
  for (const l of labels) {
    const top = topOf.get(l.id)
    if (top && top.pct >= famMin) {
      const j = idx.get(top.t.id)
      if (j !== undefined) union(idx.get(l.id)!, j)
    }
  }
  const groups = new Map<number, number[]>()
  for (const l of labels) { const r = find(idx.get(l.id)!); const a = groups.get(r) ?? []; a.push(idx.get(l.id)!); groups.set(r, a) }
  const familyName = new Map<string, string>()
  const families: Family[] = []
  for (const members of groups.values()) {
    const ms = members.map((i) => ({ id: labels[i].id, name: labels[i].name, tracks: labels[i].tracks })).sort((a, b) => b.tracks - a.tracks)
    const fname = ms[0].name
    for (const m of ms) familyName.set(m.id, fname)
    if (ms.length > 1) families.push({ name: fname, members: ms })
  }
  families.sort((a, b) => b.members.length - a.members.length)

  const metrics: IntelResult[] = labels.map((l) => {
    const top = topOf.get(l.id)
    return {
      id: l.id, name: l.name, tracks: l.tracks,
      hit5: Math.round(l.hit5 * 1000) / 1000,
      reliable: l.hit5 >= reliableMin,
      genericWeight: Math.round((1 - ((inCount.get(l.id) ?? 0) / maxIn) * (1 - floor)) * 1000) / 1000,
      similarToId: top ? top.t.id : null,
      similarToName: top ? top.t.name : null,
      similarPct: top ? Math.round(top.pct * 1000) / 1000 : 0,
      family: familyName.get(l.id) ?? null,
    }
  })

  return { metrics, families }
}
