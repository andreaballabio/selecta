// Seeding di account demo + tracce nel catalogo, usando la pipeline reale
// (upload bucket → /api/match → publish). Idempotente per email/handle.
//
//   node scripts/seed-demo.mjs
//
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

// ── env da .env.local ───────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const APP_URL = process.env.APP_URL || 'https://selecta-eta.vercel.app'
const DEMO_DIR = join(homedir(), 'Desktop', 'SelectaDemo')
const BUCKET = 'audio-tracks'

if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Manca SUPABASE_URL / SERVICE_KEY in .env.local'); process.exit(1) }
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const rnd = (a, b) => Math.floor(a + Math.random() * (b - a))
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

// ── sound bucket (port di lib/sound-bucket.ts) ──────────────────────────────
function deriveBucket(f) {
  const onset = f.onset_strength, sub = f.sub_ratio, c = f.spectral_centroid
  if (sub != null && sub > 0.5) return 'rolling-bass'
  if (onset != null && onset < 0.38) return 'hypnotic'
  if (onset != null && onset > 0.62 && (c == null || c > 2800)) return 'peak-time'
  if (c != null && c > 3600) return 'melodic'
  return 'groovy'
}

// ── personas demo (handle → tracce) ─────────────────────────────────────────
const ARTISTS = [
  { handle: 'marco-vinci', name: 'Marco Vinci', city: 'Milano', tagline: 'Groove caldo, dritto in quattro', desc: ['groovy', 'percussivo', 'caldo'],
    files: ['Chico Rose (NL) - POM.mp3', 'Nic Fanciulli, Calussa - Vente.mp3'] },
  { handle: 'nyra', name: 'Nyra', city: 'Berlin', tagline: 'Tech house ipnotica dopo le 3', desc: ['ipnotico', 'dark', 'rolling'],
    files: ['ItaloBros - Tulum.mp3', 'Supernova - Kayomusique.mp3'] },
  { handle: 'deeptone', name: 'Deeptone', city: 'London', tagline: 'Bassline & swing', desc: ['bass-heavy', 'groovy'],
    files: ['Jay de Lys, RSquared - Loaded Clipz (RSquared Extended Remix).mp3', 'RSQUARED - Fantasy.mp3'] },
  { handle: 'pulsar-kid', name: 'Pulsar Kid', city: 'Amsterdam', tagline: 'Peak time, mani in alto', desc: ['energico', 'brillante'],
    files: ['Late Replies - Give It To Me.mp3', 'Souler (ES) - Do It (Chico Rose (NL) Remix).mp3'] },
]
const titleOf = (file) => {
  const base = file.replace(/\.[^.]+$/, '')
  const after = base.includes(' - ') ? base.slice(base.indexOf(' - ') + 3) : base
  return after.replace(/\s*\(.*$/, '').trim() // togli eventuale (... Remix)
}

async function findUserByEmail(email) {
  for (let page = 1; page <= 10; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    const u = data?.users?.find((x) => x.email === email)
    if (u) return u
    if (!data || data.users.length < 200) break
  }
  return null
}

async function ensureUser(a) {
  const email = `demo.${a.handle}@selecta-demo.app`
  let user = await findUserByEmail(email)
  if (!user) {
    const { data, error } = await sb.auth.admin.createUser({
      email, password: 'Demo!' + Math.random().toString(36).slice(2, 12), email_confirm: true,
      user_metadata: { demo: true, display_name: a.name },
    })
    if (error) throw error
    user = data.user
    console.log(`  + utente ${a.name}`)
  } else console.log(`  = utente ${a.name} (esistente)`)

  const profile = {
    user_id: user.id, handle: a.handle, display_name: a.name, city: a.city, tagline: a.tagline,
    genres: ['Tech House'], bpm_range: '124-128', sound_descriptors: a.desc,
    bio: `${a.name} — Tech House da ${a.city}. Account demo Selecta.`,
    contact_email: email, links: {}, updated_at: new Date().toISOString(),
  }
  const { data: existing } = await sb.from('artist_profiles').select('id').eq('user_id', user.id).maybeSingle()
  if (existing) await sb.from('artist_profiles').update(profile).eq('user_id', user.id)
  else await sb.from('artist_profiles').insert(profile)
  return user
}

async function uploadAndAnalyze(file, title, artistName) {
  const path = `demo/${slug(artistName)}-${slug(title)}.mp3`
  const buf = readFileSync(join(DEMO_DIR, file))
  const up = await sb.storage.from(BUCKET).upload(path, buf, { contentType: 'audio/mpeg', upsert: true })
  if (up.error) throw up.error
  const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(path)

  const res = await fetch(`${APP_URL}/api/match`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_url: publicUrl, title, artist: artistName, track_status: 'mastered' }),
  })
  if (!res.ok) throw new Error(`/api/match ${res.status}`)
  const { submission_id } = await res.json()

  for (let i = 0; i < 50; i++) {
    await sleep(4000)
    const s = await fetch(`${APP_URL}/api/match/${submission_id}/status`).then((r) => r.json()).catch(() => ({}))
    if (s.status === 'analyzed') return { id: submission_id, features: s.features || {} }
    if (s.status === 'failed') throw new Error('analisi fallita')
  }
  throw new Error('timeout analisi')
}

async function main() {
  console.log('Seeding demo →', APP_URL)
  const all = readdirSync(DEMO_DIR)
  const users = {}
  const published = [] // { id, userId }

  for (const a of ARTISTS) {
    console.log(`\n# ${a.name}`)
    const user = await ensureUser(a)
    users[a.handle] = user.id
    for (const file of a.files) {
      if (!all.includes(file)) { console.log(`  ! manca ${file}`); continue }
      const title = titleOf(file)
      try {
        process.stdout.write(`  ~ ${title} … `)
        const { id, features } = await uploadAndAnalyze(file, title, a.name)
        await sb.from('user_submissions').update({
          user_id: user.id, published: true, published_at: new Date().toISOString(),
          display_title: title, display_artist: a.name, genre: 'Tech House',
          sound_bucket: deriveBucket(features),
          play_count: rnd(180, 4200), likes_count: rnd(8, 140), saves_count: rnd(3, 70),
        }).eq('id', id)
        published.push({ id, userId: user.id })
        console.log('pubblicata ✓')
      } catch (e) { console.log('errore:', e.message) }
    }
  }

  // ── interazioni: follow + like/save reali (per "salvata da @x") ────────────
  console.log('\n# interazioni')
  const ids = Object.values(users)
  for (const a of ids) for (const b of ids) if (a !== b && Math.random() < 0.7)
    await sb.from('follows').upsert({ follower_id: a, following_id: b }, { onConflict: 'follower_id,following_id' })

  for (const t of published) {
    const others = ids.filter((u) => u !== t.userId).sort(() => Math.random() - 0.5).slice(0, rnd(1, 3))
    for (const u of others) {
      await sb.from('track_likes').upsert({ submission_id: t.id, user_id: u }, { onConflict: 'submission_id,user_id' })
      if (Math.random() < 0.6) await sb.from('track_saves').upsert({ submission_id: t.id, user_id: u }, { onConflict: 'submission_id,user_id' })
    }
  }
  console.log(`\nFatto. ${published.length} tracce pubblicate da ${ids.length} account demo.`)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
