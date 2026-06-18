import { NextRequest, NextResponse } from 'next/server'
import { dz, sleep, DZ_BATCH, DZ_THROTTLE_MS } from '@/lib/deezer'

/**
 * Cerca una label per nome su Deezer. Deezer non ha l'entità "label", quindi la
 * ricostruiamo: cerchiamo gli album che combaciano e raccogliamo le stringhe-label
 * DISTINTE (dai dettagli album), così l'admin sceglie quella canonica.
 */
export async function GET(request: NextRequest) {
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ error: 'Query troppo corta' }, { status: 400 })

  // Album che hanno questo nome nel campo label
  const res = await dz(`search/album?q=label:${encodeURIComponent(`"${q}"`)}&limit=40`)
  const albums: { id: number }[] = res?.data ?? []
  if (albums.length === 0) return NextResponse.json({ labels: [], total: 0 })

  // Campiona i dettagli per leggere il campo label esatto (a blocchi, rate-limit safe)
  const sample = albums.slice(0, 18)
  const counts = new Map<string, { count: number; cover: string | null; latest: string }>()
  for (let i = 0; i < sample.length; i += DZ_BATCH) {
    const batch = sample.slice(i, i + DZ_BATCH)
    const details = await Promise.all(batch.map((a) => dz(`album/${a.id}`).catch(() => null)))
    if (i + DZ_BATCH < sample.length) await sleep(DZ_THROTTLE_MS)
    for (const d of details) {
      const lab = d?.label
      if (!lab) continue
      const c = counts.get(lab) ?? { count: 0, cover: d?.cover_medium ?? null, latest: '' }
      c.count++
      if ((d?.release_date ?? '') > c.latest) c.latest = d.release_date
      counts.set(lab, c)
    }
  }

  const labels = [...counts.entries()]
    .map(([name, c]) => ({ name, releases: c.count, cover: c.cover, latest: c.latest }))
    .sort((a, b) => b.releases - a.releases)

  return NextResponse.json({ labels, total: res?.total ?? albums.length })
}
