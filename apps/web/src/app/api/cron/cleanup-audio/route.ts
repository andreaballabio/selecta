import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Cron di pulizia dello Storage (bucket audio-tracks) — evita di sforare la
 * quota: ogni analisi carica l'audio intero e senza pulizia resta lì per sempre.
 *
 * Regole (conservative — MAI toccate le tracce pubblicate né le bozze di
 * utenti registrati):
 *  1. ORFANI: file non referenziati da user_submissions.file_url né
 *     track_versions.file_url → cancellati.
 *  2. FALLITE: submission con analysis_status='failed' più vecchie di 7 giorni
 *     → cancellato il file, file_url azzerato (la riga resta per diagnostica).
 *  3. ANONIME ABBANDONATE: submission non pubblicate di utenti anonimi
 *     (cartella "anonymous*") più vecchie di 30 giorni e mai reclamate
 *     → cancellati file e riga.
 *
 * Sicurezza: stesso pattern degli altri cron del repo — se CRON_SECRET è
 * impostato lo esigiamo (Bearer), altrimenti fallback sull'User-Agent di
 * Vercel Cron. Le regole sono conservative e idempotenti, quindi anche un
 * trigger spurio non può cancellare nulla di referenziato.
 * Schedule in vercel.json. Test manuale:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<sito>/api/cron/cleanup-audio
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const BUCKET = 'audio-tracks'
const DAY = 24 * 3600 * 1000

const toPath = (u: string | null) => {
  if (!u) return null
  const m = String(u).split('?')[0].match(/audio-tracks\/(.+)$/)
  return m ? decodeURIComponent(m[1]) : String(u)
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization') ?? ''
  const ua = request.headers.get('user-agent') ?? ''
  const secret = process.env.CRON_SECRET
  const allowed = secret ? auth === `Bearer ${secret}` : ua.includes('vercel-cron')
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = createAdminClient()
  const report = { orphansDeleted: 0, failedCleared: 0, anonDeleted: 0, freedMB: 0, errors: [] as string[] }

  // ── riferimenti protetti ──
  const [{ data: subs, error: e1 }, { data: vers, error: e2 }] = await Promise.all([
    sb.from('user_submissions').select('id, file_url, published, analysis_status, created_at, user_id'),
    sb.from('track_versions').select('file_url'),
  ])
  if (e1 || e2) return NextResponse.json({ error: (e1 ?? e2)!.message }, { status: 500 })
  const rows = (subs ?? []) as { id: string; file_url: string | null; published: boolean | null; analysis_status: string | null; created_at: string; user_id: string | null }[]
  const refs = new Set<string>()
  for (const r of rows) { const p = toPath(r.file_url); if (p) refs.add(p) }
  for (const v of (vers ?? []) as { file_url: string | null }[]) { const p = toPath(v.file_url); if (p) refs.add(p) }

  // ── lista completa del bucket (ricorsiva, un livello di cartelle) ──
  type F = { path: string; size: number }
  const files: F[] = []
  const listDir = async (prefix: string) => {
    let offset = 0
    for (;;) {
      const { data, error } = await sb.storage.from(BUCKET).list(prefix, { limit: 1000, offset })
      if (error) { report.errors.push(`list ${prefix}: ${error.message}`); return }
      if (!data || data.length === 0) return
      for (const it of data) {
        if ((it as { id: string | null }).id === null) await listDir(prefix ? `${prefix}/${it.name}` : it.name)
        else files.push({ path: (prefix ? prefix + '/' : '') + it.name, size: (it.metadata as { size?: number } | null)?.size ?? 0 })
      }
      if (data.length < 1000) return
      offset += 1000
    }
  }
  await listDir('')

  const remove = async (paths: string[]) => {
    for (let i = 0; i < paths.length; i += 50) {
      const batch = paths.slice(i, i + 50)
      const { error } = await sb.storage.from(BUCKET).remove(batch)
      if (error) report.errors.push(`remove: ${error.message}`)
    }
  }
  const sizeOf = new Map(files.map((f) => [f.path, f.size]))
  const freed = (paths: string[]) => paths.reduce((s, p) => s + (sizeOf.get(p) ?? 0), 0)

  // 1) orfani
  const orphans = files.filter((f) => !refs.has(f.path)).map((f) => f.path)
  if (orphans.length) { await remove(orphans); report.orphansDeleted = orphans.length; report.freedMB += freed(orphans) }

  const now = Date.now()

  // 2) fallite > 7 giorni → via il file, riga conservata senza file_url
  const failed = rows.filter((r) => r.analysis_status === 'failed' && r.file_url && now - Date.parse(r.created_at) > 7 * DAY)
  if (failed.length) {
    const paths = failed.map((r) => toPath(r.file_url)!).filter(Boolean)
    await remove(paths)
    report.freedMB += freed(paths)
    const { error } = await sb.from('user_submissions').update({ file_url: null }).in('id', failed.map((r) => r.id))
    if (error) report.errors.push(`null file_url: ${error.message}`)
    report.failedCleared = failed.length
  }

  // 3) anonime non pubblicate > 30 giorni (cartella "anonymous*") → file + riga
  const anon = rows.filter((r) => {
    const p = toPath(r.file_url)
    return p?.startsWith('anonymous') && !r.published && now - Date.parse(r.created_at) > 30 * DAY
  })
  if (anon.length) {
    const paths = anon.map((r) => toPath(r.file_url)!).filter(Boolean)
    await remove(paths)
    report.freedMB += freed(paths)
    const { error } = await sb.from('user_submissions').delete().in('id', anon.map((r) => r.id))
    if (error) report.errors.push(`delete anon: ${error.message}`)
    report.anonDeleted = anon.length
  }

  report.freedMB = Math.round(report.freedMB / 1024 / 1024 * 10) / 10
  return NextResponse.json({ ok: true, ...report })
}
