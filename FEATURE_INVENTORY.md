# Inventario funzionalità — SoundCloud + ID by Rivoli (DJ pool) → mapping Selecta

Ricognizione per decidere cosa implementare/migliorare in Selecta.
Legenda stato Selecta: ✅ presente · 🟡 parziale · ❌ mancante · ⛔ escluso di proposito (Fase 2: download/pagamenti).

---

## PARTE A — SOUNDCLOUD

### A1. Account & profilo
- Profilo pubblico (avatar, header/cover, bio, link social, città). — Selecta: 🟡 (press kit /u/handle)
- **Spotlight**: fissa fino a 5 tracce/playlist in cima al profilo. — ❌
- Conteggi pubblici: follower/following, n. tracce, n. like. — 🟡 (follower non mostrati ovunque)
- Profilo "Pro/Verified", badge. — ❌
- Network/feed: i tuoi upload e repost finiscono nel Feed dei follower. — ❌ (manca feed)

### A2. Gestione tracce (upload & track manager)
- Upload tracce, EP, **Album**, con copertina. — 🟡 (singola traccia, no EP/album)
- **Privacy**: Public / Private (link privato condivisibile) / **Scheduled** (pubblicazione programmata). — 🟡 (solo pubblica/bozza)
- **Permessi traccia**: abilita/disabilita download, embed, riproduzione in-app, "Quiet mode". — 🟡 (no download by design)
- **Metadata**: titolo, descrizione, genere, tag, **ISRC**, **label/publisher**, **buy/link** allo store. — 🟡 (titolo/artista/genere/cover)
- Sostituisci file mantenendo URL/statistiche; modifica post-upload. — ❌
- **Track manager**: lista delle tue tracce con azioni rapide. — ✅ (dashboard "Le mie tracce")
- **Statistiche per traccia** (Insights): play, like, repost, commenti, download, andamento, città/paesi ascoltatori, skip. — 🟡 (mostriamo play/like/save, no geo/skip/andamento)

### A3. Playlist / Set / Album
- Crea **playlist** (raccolte di proprie tracce o altrui), pubbliche o private. — ❌
- Album & EP come tipo dedicato. — ❌
- Aggiungi-a-playlist da qualsiasi traccia; riordina; copertina playlist. — ❌
- Playlist nella Library + condivisibili + repostabili. — ❌

### A4. Categorie & tassonomia
- **Generi** ufficiali (per upload e per i chart). — 🟡 (solo "Tech House" + 5 sound-bucket AI)
- **Tag** liberi + pagine-tag navigabili (`/tags/...`). — ❌
- Pagine genere dedicate. — 🟡 (bucket = /library?bucket=)

### A5. Interazione sociale
- **Like** alle tracce. — ✅
- **Repost** (ricondividi traccia/playlist ai tuoi follower; non puoi repostare le tue). — ❌
- **Commenti temporizzati** (ancorati a un punto della waveform, mostrati come avatar sulla forma d'onda). — 🟡 (commenti semplici, non sulla waveform)
- **Follow / Following**. — ✅
- **Messaggi diretti (DM)** tra utenti (collab, fan), con controllo privacy (solo chi seguo). — ❌
- **Condivisione**: link, **embed player** (widget), social. — ❌ (no embed)
- **Notifiche** (like, follow, commenti, repost). — ❌

### A6. Library (la tua raccolta)
- **Likes** (tracce che ti piacciono). — 🟡 (like sì, ma manca una pagina "Mi piace")
- **Playlist** salvate/create. — ❌
- **Following** (tracce/playlist di chi segui). — ❌
- **Cronologia ascolti** (History). — ❌
- **Le tue tracce** / **Album** / **Stazioni** salvate. — 🟡 (le tue tracce in dashboard)
- **Salvati offline** (Go+). — ⛔

### A7. Discovery
- **Search** globale (tracce, artisti, playlist, tag). — ❌
- **Charts**: **Top 50** (aggiornata ogni giorno, top settimana) + **New & Hot** (settimanale, tracce recenti in salita) + **Next Pro Chart** (talenti indipendenti/non firmati) + **chart per genere** (con AI). — 🟡 (classifica hot + "del mese" per bucket; manca Top50/New&Hot separati e per-genere)
- **Your Mix / MegaMix**: playlist personalizzate algoritmiche su gusti/ascolti. — ❌
- **Stations**: stazione infinita generata da una traccia/ricerca/Library. — ❌
- **Autoplay / Related**: a fine traccia continua con tracce simili. — 🟡 (abbiamo "tracce simili" via cosine, ma il player non fa autoplay continuo)
- **Trending / New** per genere. — ✅ (tendenze + nuove uscite)
- Pagina **Discover** con caroselli tematici ("More of what you like", ecc.). — 🟡 (library con sezioni)

### A8. Player
- **Waveform** interattiva (clic per seek, commenti sull'onda). — ❌ (barra lineare)
- **Next Up / Coda**: vedi/gestisci la coda, aggiungi "riproduci dopo", riordina, svuota. — 🟡 (coda + pannello + jump; manca riordino/“riproduci dopo”/svuota)
- **Shuffle**, **Repeat** (off/all/one). — ✅
- **Autoplay/Station** a fine coda (continua con simili). — ❌
- Volume, **continuous play** tra pagine. — 🟡 (persistente sì, volume no)
- **Embed player** (widget esterno) + player visuale. — ❌

### A9. Strumenti creator & monetizzazione (SoundCloud for Artists)
- **Insights** avanzati: andamento play, **top tracce**, **top fan** (primi 10/100…), **geo** (città/paesi), heatmap engagement, skip. — 🟡 (stats base)
- **Fans tool**: scopri/gestisci i fan più affezionati. — ❌
- **Monetizzazione**: Premier / **Fan-Powered Royalties** (paghi in base agli ascolti reali dei tuoi fan), royalties da Go+. — ❌ (modello diverso; nostra Fase 2/3)
- **Distribuzione** (Repost): pubblica su Spotify/Apple/altri DSP tenendo SoundCloud come hub, dashboard unificata. — ❌
- **Programmazione release** + pre-save. — ❌

### A10. Abbonamenti ascoltatore
- **Go** (ascolto senza pubblicità). — ⛔
- **Go+** (offline, alta qualità, catalogo completo). — ⛔

---

## PARTE B — ID BY RIVOLI / DJ POOL

### B1. Modello & accesso
- **Abbonamento mensile** (≈€19.99; offerta primo mese), pagamento carta. — ⛔ (Fase 2)
- **Login passwordless (magic-link)** via email. — ❌ (noi: email+password)
- Account: fatturazione, metodi pagamento, stato abbonamento. — ❌

### B2. Catalogo & curation
- Catalogo **curato per stile/genere** (House, Tech House, Techno, Hip-Hop, RnB, Afro, Pop…). — 🟡 (solo Tech House + bucket)
- **Aggiornamenti settimanali** / nuove uscite costanti, "crates"/pack curati. — 🟡 (nuove uscite sì, no pack curati)
- Edit **esclusivi** del collettivo di producer. — ❌ (concetto label/curation)

### B3. Versioni & edit per traccia (cuore del DJ pool)
Una traccia ha **più versioni** scaricabili:
- **Original / Extended** (versione lunga con intro/outro mixabili). — ❌
- **Intro/Outro edit** (16/32 battute di beat per beatmatch). — ❌
- **Short / Radio edit** (versione accorciata). — ❌
- **Clean / Dirty** (censurata vs esplicita). — ❌
- **Acapella / Acapella out / Instrumental**. — ❌
- **Transition edit** (cambio di tempo). — ❌
- **Quick hitter**, **remix/edit** vari. — ❌
> In Selecta oggi: 1 sola versione per traccia.

### B4. Metadata DJ per traccia
- **BPM** e **Key** in notazione **Camelot/Open Key** (es. 6A, 124 BPM). — 🟡 (mostriamo BPM e key; key non in Camelot)
- Genere, anno, label, durata, versione. — 🟡
- Filename ordinato per software DJ (Serato/Rekordbox) con BPM/key nel nome. — ❌

### B5. Download (utilità centrale)
- **Download illimitato** dietro abbonamento. — ⛔ (Fase 2)
- Scelta formato: **WAV** (max qualità) + **MP3 320**. — ⛔
- **Download per versione** (scarichi l'edit che ti serve). — ⛔
- **Cronologia download** / ri-download. — ❌

### B6. Crate & organizzazione DJ
- **Crates / preferiti**: metti tracce nel crate "al volo" e poi scarichi in blocco. — 🟡 (abbiamo "Salva" → crate, ma no download in blocco)
- **Search & filtri**: per **genere, BPM, key, tipo di versione, data/novità**. — ❌ (no ricerca/filtri avanzati; solo filtro per bucket)
- Ordina per popolarità/novità. — 🟡 (classifiche)

### B7. Integrazione workflow DJ
- Naming/tag ottimizzati per librerie DJ. — ❌
- Compatibilità con software (cue, key, BPM nei metadati del file). — ❌

---

## PARTE C — SINTESI: cosa manca a Selecta, raggruppato (per decidere)

### 🎵 Gestione tracce & catalogo
1. **Playlist** (crea, aggiungi-a-playlist, pubbliche/private) ⭐
2. **Generi reali multipli + tag** (oltre Tech House) e pagine genere/tag ⭐
3. **Metadata estesi** (label, anno, link "ascolta/compra", ISRC)
4. **Privacy traccia**: programmazione pubblicazione, link privato
5. **Versioni/edit multipli** per traccia (extended/intro/acapella…) — tipico DJ pool
6. **Modifica traccia** post-pubblicazione (titolo/cover/genere)

### 🔎 Discovery
7. **Search globale** (tracce, artisti, playlist) ⭐⭐
8. **Filtri avanzati**: BPM, key, genere, novità ⭐ (super DJ-friendly)
9. **Charts strutturate**: Top settimana, New & Hot, per-genere, "Emergenti/non firmati" ⭐
10. **Mix personalizzato** ("Per te", su like/ascolti) ⭐
11. **Autoplay/Stazione**: a fine coda continua con tracce simili (riusa il cosine) ⭐⭐
12. Pagina **Discover** con caroselli tematici

### 💬 Interazione
13. **Repost / ricondividi** + **Feed** dei follower ⭐
14. **Commenti temporizzati sulla waveform** ⭐ (firma SoundCloud)
15. **Notifiche** (like/follow/commenti) ⭐
16. **Messaggi diretti (DM)**
17. **Condivisione**: link social + **embed player**

### 🎧 Player
18. **Waveform interattiva** ⭐⭐ (molto "SoundCloud")
19. **Coda avanzata**: "riproduci dopo", riordina, svuota
20. **Autoplay continuo** a fine coda
21. **Volume**

### 👤 Profilo & creator
22. **Spotlight** (fissa tracce sul profilo) ⭐
23. **Insights avanzati**: geo ascoltatori, top fan, andamento, skip ⭐
24. **Pagina "Mi piace"** + **Cronologia ascolti** nella Library
25. **Following feed** (tracce di chi segui)

### 💳 DJ pool / monetizzazione (Fase 2 — richiede legale/Stripe)
26. **Download** (WAV/MP3) per versione, dietro **abbonamento** ⛔→Fase 2 ⭐⭐
27. **Crate con download in blocco** + **cronologia download**
28. **Login magic-link**
29. **Tier abbonamento** (DJ pool, Producer Pro, Label B2B) + billing
30. **Key in Camelot** + filename DJ-ready

---

### Già solidi in Selecta (da non rifare)
Like, **Salva/crate**, Follow, Commenti (base), Play-count, **classifica hot + del mese**, **player con coda/shuffle/repeat/prev-next**, tracce simili (cosine), sound-bucket AI, press kit/Sound DNA, account hub, **il match con le label (il gancio unico che SoundCloud/Rivoli non hanno)**.

---

## Fonti
SoundCloud Help Center: [Anatomy](https://help.soundcloud.com/hc/en-us/articles/115003570748-Anatomy-of-SoundCloud), [Reposts](https://help.soundcloud.com/hc/en-us/articles/115003567488-Repost-Tracks-Playlists), [Stations](https://help.soundcloud.com/hc/en-us/articles/115003565208-Stations-and-how-they-work), [Next Up/Queue](https://help.soundcloud.com/hc/en-us/articles/115000331394-Next-up-Play-Queue), [Charts](https://help.soundcloud.com/hc/en-us/articles/115003567608-Charts-and-how-it-works), [Permessi traccia](https://help.soundcloud.com/hc/en-us/articles/31423603670043-Manage-your-track-s-permissions), [Privacy upload](https://help.soundcloud.com/hc/en-us/articles/31632660977307-Changing-Privacy-Settings-When-Uploading-A-Track), [Direct Messages](https://help.soundcloud.com/hc/en-us/articles/10643669361435-Direct-Messages), [Spotlight](https://help.soundcloud.com/hc/en-us/articles/115003448687-Spotlight), [Insights](https://help.soundcloud.com/hc/en-us/articles/115003564988-Insights-Overview-page). · [SoundCloud for Artists](https://artists.soundcloud.com/). · DJ pool: [ID by Rivoli](https://www.idbyrivoli.com/), [Record pool FAQ](https://recordpool.idbyrivoli.com/faq), [DJcity — guida ai record pool](https://support.djcity.com/hc/en-us/articles/32309991023508-A-DJ-s-guide-to-record-pools-everything-you-need-to-know), [tipi di edit](https://blog.rpool.id/article.php?slug=difference-between-intro-outro-radio-edits).
