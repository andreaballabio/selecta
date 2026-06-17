# Spec — Press Kit / pagina artista (da ricerca, 2026)

> Ready-to-build. Fonti: Bandzoogle, Stagent, BookedKit, Pirate, Reelcrafter,
> Hypebot, Storydoc, About My Sound, Chartlex. Tesi: sostituire l'EPK amatoriale
> (PDF, Linktree, Wix gonfi) con una pagina **viva, data-backed, condivisibile**.

## Sezioni, in ordine di priorità
1. **Hero / identità** — nome, una riga di posizionamento ("Melodic techno from Berlin"), genere + range BPM, città, foto, **una CTA primaria (Contatta / Book)**.
2. **Sound DNA** ⭐ — il differenziatore: impronta visiva dell'identità acustica (energia, mood, texture, BPM, key) + 2-3 descrittori in parole. *Nessun EPK amatoriale ce l'ha.* → dai nostri embedding/feature.
3. **Musica — 3-5 tracce top, player inline** (mai download o salto ad app). La più forte per prima.
4. **Proof / traction** — numeri duri: ascolti, download, posizioni in classifica, interesse label. La **specificità** è ciò di cui i booker si fidano.
5. **Bio** — 2-4 frasi: chi, dove, che suono, un risultato recente. Scannabile.
6. **Press / social proof** — citazioni, piazzamenti, plays notevoli, ognuno con fonte.
7. **Video / live** — un clip 3-5 min (opzionale, ma "un clip live batte qualsiasi descrizione").
8. **Link** — Spotify, SoundCloud, Beatport, Instagram.
9. **Contatti / booking** — email + CTA, zero attrito, ripetuto in alto e in basso.

## I primi 10 secondi (cosa decide un booker/label)
1. **Che suono fanno?** → genere + BPM + Sound DNA, **sopra la piega**.
2. **Sono bravi / tirano?** → play del best track + numeri (ascolti, classifica).
3. **Sono affidabili?** → social proof (classifiche, interesse label, plays notevoli).
4. **Come li contatto?** → contatto trovabile in un tap.
→ Punti 1, 2 e 4 DEVONO stare sopra la piega.

## Errori amatoriali da evitare (= il problema che risolviamo)
- PDF/file scaricabili (non mobile, spam filter) → noi: **URL vivo**.
- Dati stantii → noi: **auto-popolato, sempre aggiornato** (lean into "live/auto-updated").
- Muro di testo / 10 tracce → cap musica a 5, bio a ~4 frasi.
- Asset scadenti (foto sgranate) → minimi di qualità all'upload.
- Linguaggio amatoriale ("aspiring", "up-and-coming") → frasi su **evidenze e numeri**.
- Contatto nascosto / musica dietro un wall (app/download) → streaming inline, contatto in alto.

## Layout one-page (mobile-first, single scroll)
Hero full-bleed → Sound DNA → Musica (player) → Traction (stats) → Bio → Press →
Video → Link → Contatti. Indicatore "auto-aggiornato" come vantaggio strutturale.

## Note implementazione Selecta
- Tabella `artist_profiles` (handle, display_name, tagline, city, genres, bpm_range, photo_url, bio, links jsonb, contact_email, sound_descriptors).
- Sound DNA + stats auto-generati dai dati che abbiamo (analisi, plays/downloads quando esisterà il catalogo).
- B2B white-label: account studio che gestisce più profili, branding proprio (Fase 2).
- URL pubblico `/u/[handle]`. Versioni per audience (venue vs label) come Bandzoogle (futuro).
