// Guard sulla VERSIONE dell'embedding.
//
// Il worker può produrre l'embedding in spazi diversi (EffNet neurale vs "v6"
// hand-crafted vs librosa). Confrontare col coseno vettori di versioni diverse
// è SPAZZATURA. Questa guard fa sì che il match confronti solo vettori dello
// STESSO spazio. È un NO-OP quando il catalogo è single-version o non taggato
// (caso normale) → zero impatto sul comportamento attuale.
//
// File SELF-CONTAINED (nessun import) → testabile con `node --test`.

export interface Versioned { embedding_version?: string | null }

export interface VersionInfo {
  distribution: Record<string, number> // versione → n. tracce (esclude i null)
  untagged: number                     // tracce senza versione
  distinct: string[]
  mixed: boolean                       // ≥2 versioni note diverse → catalogo da rianalizzare
  dominant: string | null
}

export function versionInfo(catalog: Versioned[]): VersionInfo {
  const distribution: Record<string, number> = {}
  let untagged = 0
  for (const t of catalog) {
    const v = t.embedding_version
    if (v) distribution[v] = (distribution[v] ?? 0) + 1
    else untagged++
  }
  const distinct = Object.keys(distribution)
  const dominant = distinct.length ? distinct.sort((a, b) => distribution[b] - distribution[a])[0] : null
  return { distribution, untagged, distinct, mixed: distinct.length > 1, dominant }
}

/**
 * Sottoinsieme del catalogo confrontabile con la traccia utente.
 * - Catalogo non taggato (tutte null) → ritorna tutto (comportamento attuale).
 * - Catalogo single-version → ritorna tutto (le null sono compatibili).
 * - Catalogo MISTO → tiene solo la versione dell'utente (se nota) o la
 *   maggioritaria, più le tracce non taggate (ambigue), ed ESCLUDE l'altra
 *   versione nota → niente confronti fra spazi diversi.
 */
export function pickVersionSubset<T extends Versioned>(
  catalog: T[],
  userVersion?: string | null,
): { subset: T[]; usedVersion: string | null; mixed: boolean } {
  const info = versionInfo(catalog)
  if (info.distinct.length === 0) return { subset: catalog, usedVersion: null, mixed: false }
  if (info.distinct.length === 1) return { subset: catalog, usedVersion: info.distinct[0], mixed: false }
  // Misto: scegli la versione di riferimento.
  const chosen = (userVersion && info.distribution[userVersion]) ? userVersion : info.dominant
  const subset = catalog.filter((t) => !t.embedding_version || t.embedding_version === chosen)
  return { subset, usedVersion: chosen, mixed: true }
}
