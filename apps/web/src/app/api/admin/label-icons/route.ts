import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/require-admin'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! || process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// GET — elenco label con la loro icona (o null). Se la colonna icon_url non
// esiste ancora, segnala needsMigration così la pagina mostra l'avviso.
export async function GET() {
  const denied = await requireAdminApi(); if (denied) return denied
  try {
    const withIcon = await supabase
      .from('labels')
      .select('id, name, slug, primary_genre, cataloged_tracks, icon_url')
      .order('cataloged_tracks', { ascending: false })

    if (withIcon.error) {
      // probabilmente manca la colonna → fallback senza icon_url
      const base = await supabase
        .from('labels')
        .select('id, name, slug, primary_genre, cataloged_tracks')
        .order('cataloged_tracks', { ascending: false })
      if (base.error) return NextResponse.json({ error: base.error.message }, { status: 500 })
      return NextResponse.json({ needsMigration: true, labels: (base.data ?? []).map((l) => ({ ...l, icon_url: null })) })
    }
    return NextResponse.json({ labels: withIcon.data ?? [] })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'errore' }, { status: 500 })
  }
}

// POST — carica un PNG (multipart: id + file) → Storage, salva l'URL pubblico.
//        Oppure rimuove l'icona (JSON: { id, remove: true }).
export async function POST(request: NextRequest) {
  const denied = await requireAdminApi(); if (denied) return denied
  try {
    const ct = request.headers.get('content-type') || ''

    if (ct.includes('multipart/form-data')) {
      const form = await request.formData()
      const id = form.get('id')
      const file = form.get('file')
      if (typeof id !== 'string' || !id || !(file instanceof File)) {
        return NextResponse.json({ error: 'id e file richiesti' }, { status: 400 })
      }
      if (file.size > 2_000_000) return NextResponse.json({ error: 'Immagine troppo grande (max 2MB)' }, { status: 400 })
      const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
      const path = `${id}.${ext}`
      const up = await supabase.storage.from('label-icons').upload(path, file, { contentType: file.type || 'image/png', upsert: true })
      if (up.error) {
        const hint = /bucket/i.test(up.error.message) ? ' — esegui la migration 0019 (crea il bucket label-icons)' : ''
        return NextResponse.json({ error: up.error.message + hint }, { status: 500 })
      }
      const { data: pub } = supabase.storage.from('label-icons').getPublicUrl(path)
      const url = `${pub.publicUrl}?v=${Date.now()}` // cache-busting
      const { error } = await supabase.from('labels').update({ icon_url: url }).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, icon_url: url })
    }

    // rimozione
    const { id } = await request.json() as { id?: string }
    if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 })
    const { error } = await supabase.from('labels').update({ icon_url: null }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, icon_url: null })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'errore' }, { status: 500 })
  }
}
