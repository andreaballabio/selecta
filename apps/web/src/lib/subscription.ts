import { createAdminClient } from './supabase/admin'

export interface Subscription { user_id: string; tier: string; status: string; provider: string; expires_at: string | null }

export const TIERS = [
  { key: 'producer-pro', name: 'Producer Pro', price: '€9', cadence: 'al mese', perks: ['Tutto del Free', 'Report tecnico PRO completo', 'Statistiche avanzate', 'Featured nel catalogo'] },
  { key: 'dj-pool', name: 'DJ Pool', price: '€15', cadence: 'al mese', perks: ['Download illimitato (WAV/MP3)', 'Scarica per versione', 'Crate con download in blocco', 'Cronologia download'], highlight: true },
  { key: 'label', name: 'Label', price: 'Su misura', cadence: 'B2B', perks: ['Scouting sul tuo sound', 'Download per A&R', 'Classifiche emergenti', 'Contatto diretto producer'] },
] as const

export const TIER_NAME: Record<string, string> = Object.fromEntries(TIERS.map((t) => [t.key, t.name]))

/** Tier che abilitano il download (DJ pool / Label). */
export function canDownload(sub: Subscription | null | undefined): boolean {
  return !!sub && sub.status === 'active' && (sub.tier === 'dj-pool' || sub.tier === 'label')
}

export async function getSubscription(userId: string): Promise<Subscription | null> {
  const sb = createAdminClient()
  const { data } = await sb.from('subscriptions').select('user_id, tier, status, provider, expires_at').eq('user_id', userId).maybeSingle()
  return (data as Subscription) ?? null
}
