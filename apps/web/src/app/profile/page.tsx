'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Save, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react'

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const LINK_FIELDS = ['spotify', 'soundcloud', 'beatport', 'instagram'] as const

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [host, setHost] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [id, setId] = useState<string | null>(null)
  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [tagline, setTagline] = useState('')
  const [city, setCity] = useState('')
  const [genres, setGenres] = useState('')
  const [bpmRange, setBpmRange] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [bio, setBio] = useState('')
  const [descriptors, setDescriptors] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [links, setLinks] = useState<Record<string, string>>({})

  useEffect(() => {
    if (typeof window !== 'undefined') setHost(window.location.host)
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      const { data } = await (supabase as any)
        .from('artist_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (data) {
        setId(data.id)
        setHandle(data.handle ?? '')
        setDisplayName(data.display_name ?? '')
        setTagline(data.tagline ?? '')
        setCity(data.city ?? '')
        setGenres((data.genres ?? []).join(', '))
        setBpmRange(data.bpm_range ?? '')
        setPhotoUrl(data.photo_url ?? '')
        setBio(data.bio ?? '')
        setDescriptors((data.sound_descriptors ?? []).join(', '))
        setContactEmail(data.contact_email ?? '')
        setLinks(data.links ?? {})
      } else {
        setContactEmail(user.email ?? '')
      }
      setLoading(false)
    })()
  }, [router, supabase])

  const save = async () => {
    setError(null)
    setSaved(false)
    const cleanHandle = slugify(handle)
    if (!cleanHandle) { setError('Scegli un handle (es. tuo-nome-artista)'); return }
    if (!displayName.trim()) { setError('Inserisci il nome d’arte'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const payload = {
        user_id: user.id,
        handle: cleanHandle,
        display_name: displayName.trim(),
        tagline: tagline.trim(),
        city: city.trim(),
        genres: genres.split(',').map(s => s.trim()).filter(Boolean),
        bpm_range: bpmRange.trim(),
        photo_url: photoUrl.trim(),
        bio: bio.trim(),
        sound_descriptors: descriptors.split(',').map(s => s.trim()).filter(Boolean),
        contact_email: contactEmail.trim(),
        links: Object.fromEntries(Object.entries(links).filter(([, v]) => v?.trim())),
        updated_at: new Date().toISOString(),
      }
      const res = id
        ? await (supabase as any).from('artist_profiles').update(payload).eq('id', id)
        : await (supabase as any).from('artist_profiles').insert(payload).select('id').single()
      if (res.error) throw res.error
      if (!id && res.data?.id) setId(res.data.id)
      setHandle(cleanHandle)
      setSaved(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Salvataggio fallito'
      setError(msg.includes('duplicate') ? 'Questo handle è già preso, scegline un altro.' : msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  const input = 'w-full rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-text placeholder-faint focus:border-accent focus:outline-none'
  const label = 'mb-1.5 block text-sm font-medium text-text'

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text">La tua press kit</h1>
            <p className="text-sm text-muted">La pagina che condividi con locali, PR e label</p>
          </div>
          {handle && id && (
            <Link href={`/u/${handle}`} target="_blank" className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-text hover:text-text">
              Vedi <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Nome d’arte</label>
              <input className={input} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Es. Marco Rossi" />
            </div>
            <div>
              <label className={label}>Handle (URL)</label>
              <input className={input} value={handle} onChange={e => setHandle(e.target.value)} placeholder="marco-rossi" />
              <p className="mt-1 text-xs text-faint">{host || 'selecta'}/u/{slugify(handle) || '...'}</p>
            </div>
          </div>

          <div>
            <label className={label}>Tagline <span className="text-faint">(una riga)</span></label>
            <input className={input} value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Melodic techno from Milano" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={label}>Generi</label>
              <input className={input} value={genres} onChange={e => setGenres(e.target.value)} placeholder="techno, tech house" />
            </div>
            <div>
              <label className={label}>Range BPM</label>
              <input className={input} value={bpmRange} onChange={e => setBpmRange(e.target.value)} placeholder="126-130" />
            </div>
            <div>
              <label className={label}>Città</label>
              <input className={input} value={city} onChange={e => setCity(e.target.value)} placeholder="Milano" />
            </div>
          </div>

          <div>
            <label className={label}>Foto (URL)</label>
            <input className={input} value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="https://..." />
          </div>

          <div>
            <label className={label}>Il tuo suono <span className="text-faint">(parole chiave, separate da virgola)</span></label>
            <input className={input} value={descriptors} onChange={e => setDescriptors(e.target.value)} placeholder="ipnotico, percussivo, dark" />
          </div>

          <div>
            <label className={label}>Bio <span className="text-faint">(2-4 frasi)</span></label>
            <textarea className={`${input} min-h-[110px] resize-y`} value={bio} onChange={e => setBio(e.target.value)} placeholder="Chi sei, da dove vieni, il tuo suono, un risultato recente." />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {LINK_FIELDS.map((k) => (
              <div key={k}>
                <label className={`${label} capitalize`}>{k}</label>
                <input className={input} value={links[k] ?? ''} onChange={e => setLinks(prev => ({ ...prev, [k]: e.target.value }))} placeholder="https://..." />
              </div>
            ))}
          </div>

          <div>
            <label className={label}>Email di contatto</label>
            <input className={input} value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="booking@..." />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 rounded-lg border border-surface-2 bg-surface-2 p-3 text-sm text-accent">
              <CheckCircle className="h-4 w-4 shrink-0" /> Salvato! La tua press kit è online su <Link href={`/u/${handle}`} target="_blank" className="underline">/u/{handle}</Link>
            </div>
          )}

          <button
            onClick={save}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            {saving ? 'Salvataggio...' : 'Salva press kit'}
          </button>
        </div>
      </div>
    </div>
  )
}
