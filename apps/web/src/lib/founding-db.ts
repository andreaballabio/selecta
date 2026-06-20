import type { SupabaseClient } from '@supabase/supabase-js'
import { mergeConfig, isOpen, type FoundingConfig } from './founding'

const KEY = 'founding'

/** Legge la config Founding da app_settings (con default se assente). */
export async function getFoundingConfig(sb: SupabaseClient): Promise<FoundingConfig> {
  const { data } = await sb.from('app_settings').select('value').eq('key', KEY).maybeSingle()
  return mergeConfig((data as { value?: unknown } | null)?.value)
}

/** Salva la config Founding. */
export async function setFoundingConfig(sb: SupabaseClient, config: FoundingConfig): Promise<void> {
  await sb.from('app_settings').upsert({ key: KEY, value: config, updated_at: new Date().toISOString() }, { onConflict: 'key' })
}

export async function foundingCount(sb: SupabaseClient): Promise<number> {
  const { count } = await sb.from('founding_members').select('user_id', { count: 'exact', head: true })
  return count ?? 0
}

export async function isFoundingMember(sb: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await sb.from('founding_members').select('user_id').eq('user_id', userId).maybeSingle()
  return !!data
}

/**
 * Assegna lo stato Founding all'utente SE la finestra è aperta (entro la data E
 * sotto il tetto) e non lo è già. Idempotente. Ritorna true se l'utente è founding.
 */
export async function ensureFounding(sb: SupabaseClient, userId: string): Promise<boolean> {
  if (await isFoundingMember(sb, userId)) return true
  const config = await getFoundingConfig(sb)
  const count = await foundingCount(sb)
  if (!isOpen(config, count)) return false
  const { error } = await sb.from('founding_members').upsert({ user_id: userId }, { onConflict: 'user_id' })
  return !error
}
