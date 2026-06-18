// Helper condiviso per le chiamate all'API pubblica di Deezer.
//
// Limite Deezer: ~50 richieste / 5 secondi per IP. Sopra il limite NON arriva
// (di solito) un ban: Deezer risponde HTTP 200 con { error: { code: 4 } }
// ("Quota limit exceeded") → senza retry l'album verrebbe scartato in silenzio e
// vedresti MENO tracce di quante esistono. Per importare tante label di fila in
// sicurezza:
//   • dz() ritenta con backoff esponenziale sugli errori quota/servizio occupato
//   • DZ_BATCH / DZ_THROTTLE_MS tengono il ritmo sotto il limite (~8 req/s)

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// code 4 = quota superata · code 700 = servizio temporaneamente occupato
const QUOTA_CODES = new Set([4, 700])

/** GET su Deezer con retry+backoff sugli errori di quota. Non lancia mai:
 *  in caso estremo restituisce l'ultima risposta (eventualmente null). */
export async function dz(path: string, retries = 4): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    let json: any = null
    try {
      const r = await fetch(`https://api.deezer.com/${path}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      })
      json = await r.json()
    } catch {
      json = null
    }
    const quota = json?.error && QUOTA_CODES.has(json.error.code)
    if (json != null && !quota) return json
    if (attempt >= retries) return json
    // backoff: ~0.5s, 1s, 2s, 4s (cap) + jitter per non sincronizzare i retry
    await sleep(Math.min(4000, 500 * 2 ** attempt) + Math.random() * 250)
  }
}

// Ritmo della fase "dettagli album": blocchi piccoli + pausa → ~8 req/s, sotto
// il tetto di Deezer con margine. Il backoff di dz() copre eventuali picchi.
export const DZ_BATCH = 6
export const DZ_THROTTLE_MS = 350
