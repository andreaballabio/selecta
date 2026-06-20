// Founding Members — logica PURA (config + apertura). I primi iscritti ottengono
// vantaggi a vita; la "finestra" si chiude al primo tra: scadenza data RAGGIUNTA
// o tetto membri RAGGIUNTO. Tutti i parametri e i benefici sono configurabili
// dall'admin (salvati in app_settings). File SELF-CONTAINED → testabile.

export interface FoundingPerk { label: string; enabled: boolean }

export interface FoundingConfig {
  enabled: boolean
  deadline: string | null   // ISO date/datetime; null = nessuna scadenza
  cap: number | null        // tetto membri; null = nessun tetto
  perks: FoundingPerk[]
}

export const DEFAULT_FOUNDING: FoundingConfig = {
  enabled: false,
  deadline: null,
  cap: null,
  perks: [
    { label: 'Report PRO completo — a vita', enabled: true },
    { label: 'Statistiche avanzate', enabled: true },
    { label: 'Download illimitati quando aprirà il DJ pool', enabled: true },
    { label: 'Featured nel catalogo', enabled: true },
    { label: 'Badge "Founding Member" sul profilo', enabled: true },
  ],
}

/** Normalizza un valore (da jsonb, può essere parziale/null) in una config valida. */
export function mergeConfig(raw: unknown): FoundingConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const perks = Array.isArray(r.perks)
    ? (r.perks as unknown[])
        .map((p) => (p && typeof p === 'object' ? p as Record<string, unknown> : {}))
        .filter((p) => typeof p.label === 'string' && (p.label as string).trim())
        .map((p) => ({ label: (p.label as string).trim().slice(0, 120), enabled: p.enabled !== false }))
    : DEFAULT_FOUNDING.perks
  return {
    enabled: r.enabled === true,
    deadline: typeof r.deadline === 'string' && !Number.isNaN(Date.parse(r.deadline)) ? r.deadline : null,
    cap: typeof r.cap === 'number' && r.cap > 0 ? Math.floor(r.cap) : null,
    perks: perks.length ? perks : DEFAULT_FOUNDING.perks,
  }
}

/** La finestra Founding è aperta? Chiude al PRIMO tra scadenza e tetto raggiunti. */
export function isOpen(c: FoundingConfig, count: number, now: number = Date.now()): boolean {
  if (!c.enabled) return false
  if (c.deadline && Date.parse(c.deadline) <= now) return false
  if (c.cap != null && count >= c.cap) return false
  return true
}

export function spotsLeft(c: FoundingConfig, count: number): number | null {
  return c.cap != null ? Math.max(0, c.cap - count) : null
}

export function daysLeft(c: FoundingConfig, now: number = Date.now()): number | null {
  if (!c.deadline) return null
  return Math.max(0, Math.ceil((Date.parse(c.deadline) - now) / 86_400_000))
}

export const activePerks = (c: FoundingConfig): string[] => c.perks.filter((p) => p.enabled).map((p) => p.label)
