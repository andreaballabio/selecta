# Selecta — Social Catalog / "DJ pool sociale": analisi onesta & piano

> Valutazione franca dell'idea: trasformare le tracce analizzate in un **catalogo
> pubblico** (diviso per sound via matching AI) dove le tracce si **streammano,
> scaricano, votano**, guadagnano visibilità, girano tra i DJ e possono essere
> notate dalle label. Ispirazione: ID by Rivoli (un **DJ pool**: €19.99/mese,
> catalogo curato per stile, download WAV/MP3, licenza ICE Direct, collettivo di
> 100+ producer). **Nota: ID by Rivoli NON è UGC/social — è curation+download.**

---

## 0. VERDETTO ONESTO (leggi prima questo)

- **Tecnicamente realizzabile? Sì**, al 100%. È CRUD + storage + streaming + il
  matching che hai già. Niente di esotico.
- **Come business è DIFFICILE.** Ci sono due rischi *mortali*, documentati, che
  hanno ucciso decine di piattaforme: il **cold-start a due lati** e il
  **"perché non dovrei usare SoundCloud?"**. Non sono dettagli: sono LA partita.
- **Va fatto? Sì, ma:** (a) **in modo incrementale** con cancelli di verifica,
  (b) **solo su brani ORIGINALI** (mai edit/remix/bootleg — lì servono licenze
  costose), (c) partendo da **"vetrina curata"**, non da "social aperto a tutti",
  (d) **dopo** aver validato il matching (oggi non ancora confermato).
- **La cosa più importante:** NON provare a essere SoundCloud. Perdi. Il tuo
  vantaggio è **la curation per SUONO** (il matching) e **lo scouting label**.
  Il social è il *livello contenuti* che alimenta DJ pool e A&R Copilot, non un
  fine in sé.

In una frase: **fattibile e coerente con Selecta, ma è una fase 2-3, non adesso,
e va scopata in piccolo per non bruciare soldi/tempo su un cold-start.**

---

## 1. La tua idea, scomposta

È un **ibrido di tre modelli** che di solito esistono separati:

| Pezzo | Da chi | Cosa porta |
|---|---|---|
| Stream + like + profili + visibilità (UGC) | SoundCloud | rete, ritorno, scoperta |
| Download per DJ (pool a sub) | ID by Rivoli / ZIPDJ | ricavo, utilità reale per i DJ |
| "Notato dalle label" (scouting) | LabelRadar / A&R | il sogno del producer |
| **Curation per suono + matching** | **Selecta (tu)** | **il collante che nessuno ha** |

Il collante è la cosa nuova. Senza, sei un clone peggiore di tre prodotti
esistenti. Con, sei "il catalogo di techno non firmata **organizzato per come
suona**, dove i DJ pescano e le label scoutano".

---

## 2. Perché è COERENTE con Selecta (non un pivot a caso)

La traccia che l'utente analizza è **già**: scaricata, decodificata, con
embedding, bucketizzata per suono. Pubblicarla in un catalogo è *quasi gratis* in
termini di lavoro AI. E lo **stesso motore**:
- organizza il catalogo per similarità (niente firehose);
- alimenta l'**A&R Copilot** (le label sfogliano il pool pre-filtrato per il loro
  sound — vedi STRATEGY.md §6);
- dà ai DJ "tracce che suonano come X".

Quindi il social non è una distrazione *se* resta agganciato al motore. Diventa
distrazione se diventa "facciamo un SoundCloud".

---

## 3. Analisi di mercato

| Piattaforma | Modello | Forza | Debolezza che sfrutti |
|---|---|---|---|
| **SoundCloud** | UGC social streaming, freemium + distrib. | Default per producer elettronici, enorme rete | Firehose: nessuna curation per suono, scoperta debole, ha tradito gli artisti originali per inseguire le label |
| **Bandcamp** | Vendita diretta tracce/merch | Ottimo per fanbase/vendite | Non è scoperta né pool DJ; community, non matching |
| **Audius** | Streaming "decentralizzato" per elettronica | Cap-table cripto, mira ai producer SoundCloud | Monetizzazione debole, problemi di takedown, nicchia |
| **Beatport / Beatport Hype** | Store + promo per label | Standard d'acquisto DJ | Orientato a label/release, non a non-firmati/scoperta |
| **DJ pool** (ID by Rivoli, ZIPDJ, BPM Supreme, DigitalDJPool) | Sub mensile, download curati | Utilità reale per DJ, ricavo ricorrente | **Curation umana, no scoperta dei non-firmati, no social** |
| **LabelRadar / Trackstack** | Inbox demo per label | Infrastruttura submission | Inbox passiva, niente catalogo pubblico né community |
| **Vampr** | "Tinder" per collaborazioni musicali | Social/collab | Non è catalogo/pool né scouting per suono |

**Dove ti infili:** lo spazio vuoto è **"catalogo pubblico di tracce non firmate,
curato dall'AI per suono, con utilità DJ-pool e scouting label"**. Nessuno occupa
esattamente quel punto. Ma — onestà — ognuno di quei player presidia un *pezzo*, e
il tuo vantaggio è solo la **curation+matching**: deve essere percepibile da
subito, o l'utente torna su SoundCloud.

---

## 4. PRO (perché potrebbe valere)

1. **Retention & network effect:** il match è un evento "una tantum"; un catalogo
   sociale dà un *motivo per tornare* (stream, like, classifiche, follower). Cambia
   il prodotto da tool a destinazione.
2. **Moat di contenuto + dati:** ogni upload arricchisce l'atlante acustico → il
   matching e l'A&R Copilot migliorano. Difendibile, cresce con l'uso.
3. **Riuso quasi totale:** analisi, embedding, storage, bucketing per suono già
   esistono. L'incremento tecnico è "viste + player + voti", non "nuovo cervello".
4. **Riempie i due lati che già ti servono:** più tracce → A&R Copilot più ricco;
   più DJ → distribuzione reale per i producer (incentivo a caricare).
5. **Più linee di ricavo** sullo stesso contenuto (vedi §7).
6. **Storytelling forte:** "la classifica del techno non firmato che le label
   guardano" è un gancio marketing potente.

---

## 5. CONTRO & DIFFICOLTÀ (oneste, nessuna nascosta)

1. **Cold-start a due lati — IL killer.** Senza ascoltatori/DJ i producer non
   caricano; senza tracce di qualità i DJ non vengono. È il problema #1 che fa
   morire queste piattaforme. SoundCloud ci ha messo anni + capitali; Audius arranca
   sulla monetizzazione. **Devi avere un piano esplicito per il lato che parte per
   primo** (di solito: tu curi a mano i primi contenuti e porti tu i primi DJ).
2. **"Perché non SoundCloud?"** Se la differenza (curation per suono, scouting) non
   è ovvia in 10 secondi, l'utente non si sposta. La differenziazione non è un
   "nice to have": è sopravvivenza.
3. **Curation vs apertura — tensione di fondo.** Il valore di un pool = **è curato**
   (ID by Rivoli ha producer selezionati). Apri l'UGC a tutti e ottieni un firehose
   di roba scadente → diventi un SoundCloud peggiore. **Riconciliazione:** il
   matching fa da *gate di qualità + auto-bucketing*, e tieni una soglia (es. solo
   tracce sopra una qualità mix/loudness, o approvazione, o "verified producer").
4. **Legale / licenze — la zona grigia (importante).** *Non sono un avvocato,
   serve consulenza.* Punti reali:
   - **Solo ORIGINALI.** Se permetti edit/remix/bootleg (come fa ID by Rivoli) entri
     nel copyright altrui → serve una licenza tipo "ICE Direct" (costosa, complessa).
     **Evitali del tutto all'inizio.**
   - **Concessione di licenza via Terms of Service:** chi carica deve garantire di
     detenere i diritti e concederti licenza di hosting/stream/(download) +
     manleva. Standard per le piattaforme UGC.
   - **Diritti di esecuzione/streaming (SIAE/SoundReef in IT):** lo streaming
     pubblico *può* generare obblighi verso le collecting society anche per indie.
     Le grandi hanno licenze blanket; una startup si appoggia a ToS + safe harbor,
     ma **va verificato con un legale e messo a budget.**
   - **Takedown/DMCA:** servono processo di rimozione e (in prospettiva) content-ID.
     Qualcuno caricherà tracce non sue: devi poterle togliere in fretta.
5. **Moderazione contenuti:** spam, furti, qualità. Manuale all'inizio (= tuo
   tempo), poi tooling. Costo nascosto reale.
6. **Equità verso i producer:** se i DJ pagano per scaricare, i producer vengono
   pagati? ID by Rivoli paga il suo collettivo. Se carichi gratis "per esposizione"
   e tu incassi, l'incentivo producer regge solo finché la *visibilità/scouting* ha
   valore reale. Va disegnato (revenue-share o pool di payout) o sarai percepito
   come sfruttatore.
7. **Distrazione dal core non validato.** Il matching **non è ancora confermato che
   funzioni** (test v6 in sospeso). Costruire il social ora = costruire la casa sul
   tetto. **Prima il match deve funzionare e attrarre**, poi il catalogo.

---

## 6. COSTI (concreti)

La buona notizia: **il costo che tutti temono — la banda di streaming — si
abbatte con l'architettura giusta.**

### Storage & streaming — usa **Cloudflare R2** (egress ZERO)
- R2: **$0.015/GB-mese, banda in uscita gratuita**. S3 invece fa pagare ~$0.09/GB
  in uscita: una piattaforma che serve 10TB/mese paga **~$1.050/mese su S3 vs ~$15
  su R2**. Per streaming è la differenza tra vivere e morire.
- Stima reale:
  - copia stream MP3 ~192kbps ≈ **8 MB/traccia**; master WAV (per download) ≈ 50 MB.
  - **1.000 tracce** ≈ 58 GB → **~$0.90/mese**. **10.000 tracce** ≈ 580 GB →
    **~$8,7/mese**. *Egress incluso.* In pratica: **trascurabile per anni.**
- Transcoding all'upload (ffmpeg su un worker/serverless): costo minimo.

### Altri costi
| Voce | Quando | Costo realistico |
|---|---|---|
| Storage/banda (R2) | da subito | ~€1–10/mese fino a 10k tracce |
| Transcoding | da subito | ~€0 a piccola scala (riusa worker) |
| Moderazione | da Fase 1 | il TUO tempo all'inizio; poi part-time |
| ToS + manleva (legale) | prima di aprire upload | €300–1.500 una tantum |
| Consulenza licenze/SIAE | prima di stream pubblico | €500–2.000 una tantum (necessaria) |
| DMCA agent (se vuoi safe harbor US) | opzionale | ~$6 + registrazione |
| Pagamenti (Stripe) per DJ pool | Fase 2 | ~1.5–3% + €0.25 a transazione |
| Sviluppo | per fase | vedi §8 (tempo, non cash, se lo fai tu) |

**Conclusione costi:** in **denaro** è economico finché sei piccolo (decine di €/
mese + qualche centinaio una tantum di legale). Il vero costo è **tempo di
sviluppo e moderazione**, non l'infrastruttura.

---

## 7. GUADAGNI POTENZIALI (modelli + numeri realistici, non hockey-stick)

| Linea | Chi paga | Prezzo | Note onesta |
|---|---|---|---|
| **DJ pool** (download illimitati) | DJ | €12–20/mese | Il ricavo più diretto. Ma servono *catalogo di qualità + massa*: €0 finché non li hai |
| **Producer Pro** | producer | €6–10/mese | Analytics, featured, priorità scouting. Conversione bassa ma sticky |
| **Label B2B (A&R Copilot sul catalogo)** | label | €50–150/mese | Ticket alto, pochi clienti. Il più sano (vedi STRATEGY.md) |
| **Featured / boost** | producer | €/spot | Visibilità a pagamento (attenzione a non degradare la curation) |
| **Fee su firma/sync** | label/artisti | % | Difficile da tracciare/forzare; trattalo come bonus, non base |

**Scenari realistici (anno 1, SE craccki il cold-start — grande "se"):**
- *Conservativo:* 50 DJ × €15 + 5 label × €60 = **~€1.050/mese** (~€12k/anno).
- *Medio:* 200 DJ × €15 + 15 label × €80 + 100 Pro × €8 = **~€5.000/mese** (~€60k/anno).
- *Onestà brutale:* la maggior parte di queste righe è **€0 finché non hai
  contenuti + pubblico**. I ricavi sono **posticipati** e **dipendono interamente**
  dal risolvere il cold-start. Non modellare crescite esponenziali: modella "riesco
  a portare i primi 30 DJ e 300 tracce buone?".

---

## 8. PIANO D'AZIONE realizzabile (a cancelli)

Regola d'oro: **ogni fase ha un cancello (metrica). Non passi alla successiva se
non lo superi.** Così rischi poco e impari presto.

### ⚙️ Prerequisito (PRIMA di tutto)
Il **matching v6 funziona e attrae** (test in sospeso). Se il gancio non aggancia,
il social non ha su cosa poggiare. **Non costruire nulla di sotto finché questo non
è verde.**

### Fase 0 — "Vetrina curata" (2–4 settimane part-time, costo ~€0)
Il minimo che crea valore di rete senza i rischi grossi.
- Alla fine dell'analisi: opzione **"Pubblica nel catalogo Selecta"** (consenso
  esplicito + accetti ToS con licenza).
- **Solo originali.** Pagina catalogo pubblica navigabile **per sound-bucket**
  (usi gli embedding: "Techno ipnotica", "Tech house groove", ecc.).
- **Stream only** (MP3 via R2). **Like/❤️.** Niente download, niente pagamenti.
- Player + "tracce simili" (riusi il cosine!).
- **Cancello:** in N settimane, X% di chi analizza pubblica E il catalogo genera
  ritorni/ascolti ripetuti. Se nessuno pubblica o nessuno ascolta → **stop, hai
  speso pochissimo.**

### Fase 1 — Social leggero (3–6 settimane)
- Profili producer, follow, **classifiche** ("Sound del mese" per bucket), commenti.
- Il 👍/👎 sul match (da STRATEGY.md) qui diventa anche segnale sociale + dati.
- Moderazione manuale + report-abuso.
- **Cancello:** esiste un *core* di utenti che torna ogni settimana (retention).

### Fase 2 — DJ pool (1–2 mesi + legale)
- Download (WAV/MP3) **dietro sub** per i DJ. Stripe.
- **Modello payout producer** chiaro (revenue-share o pool) — decidilo PRIMA.
- ToS/licenze finalizzate con un legale. Processo takedown solido.
- **Cancello:** abbastanza catalogo di qualità + abbastanza DJ che *userebbero*
  davvero il pool (intervista/lista d'attesa prima di costruire i pagamenti).

### Fase 3 — Scouting label (riusa A&R Copilot)
- Le label sfogliano il catalogo **pre-filtrato per il loro sound** + classifiche.
- "Questa traccia in salita è all'88% nel tuo catalogo." Notifiche.
- Monetizzi lato label (la riga di ricavo più sana).
- **Cancello:** label disposte a pagare per lo scouting curato.

---

## 9. RACCOMANDAZIONE FINALE (senza giri di parole)

1. **Adesso:** fai funzionare il **match** (test v6). Niente social finché non è
   verde. È il prerequisito non negoziabile.
2. **Poi, a basso costo:** la **Fase 0 (vetrina curata)** è un'estensione naturale,
   quasi gratis, che rafforza il gancio e ti dice — con pochissima spesa — se la
   gente *vuole* un catalogo. È il test più economico dell'intera idea.
3. **Solo se la vetrina tira:** prosegui verso pool + scouting, con i cancelli.
4. **Non diventare SoundCloud.** Resta "il catalogo curato-per-suono del techno non
   firmato dove le label scoutano". La curation è il prodotto; l'apertura selvaggia
   lo distrugge.
5. **Scope legale:** **solo originali**, ToS con licenza+manleva, consulenza su
   streaming/SIAE prima di aprire. Mai edit/remix all'inizio.

**Bottom line:** l'idea è buona e *coerente*, non campata in aria. Ma è una
costruzione a strati su un fondamento (il match) ancora da validare, e il suo
destino lo decide il cold-start, non la tecnologia. Fatta in piccolo e a cancelli,
il downside è minimo e l'upside è reale. Fatta tutta insieme adesso, è il modo
classico di bruciare mesi. **Vai per gradi.**

---

## 11. Il flusso completo lato utente + soldi + fisco/legale

Principio che tiene insieme tutto: **ascoltare è gratis, scaricare si paga.**
Lo streaming gratuito è il motore della visibilità (più ascolti → più i producer
vogliono esserci); il download è l'utilità concreta per cui i DJ pagano.

### 11.1 Il producer (chi fa la traccia)
1. Carica la sua traccia originale.
2. Vede **le label compatibili** (il match) — **gratis**.
3. Invito: *"Vuoi che la tua traccia entri nel catalogo? La ascolteranno DJ e
   label."* → spunta **"sono l'autore e accetto i termini"** → pubblica.
4. Sceglie titolo/artista/genere (pre-compilati dall'AI), copertina, e se renderla
   **solo ascoltabile** o anche **scaricabile**.
5. Ottiene **pagina-traccia pubblica** (link condivisibile) + **profilo**.
6. Nel tempo riceve: ascolti, like, *"salvata da N DJ"*, *"una label ti ha notato"*.

Il producer **non paga**. Paga solo per il **Pro** (statistiche, featured, priorità).

### 11.2 Il DJ (chi cerca musica per i set)
1. Entra nel catalogo (home o link a una traccia).
2. Naviga **per sound** (bucket AI), novità, classifiche.
3. **Ascolta gratis**, mette like, crea preferiti.
4. Clicca **"Scarica"** → muro: *"Abbonati al DJ Pool — €15/mese."*
5. Si abbona, **paga**, scarica WAV/MP3 illimitato.
6. Usa le tracce nei set → visibilità ai producer → loop.

Il DJ è **chi paga la quota** che fa girare l'economia.

### 11.3 La label (B2B)
Dashboard di scouting → catalogo **pre-filtrato sul proprio suono** + classifiche →
salva/contatta i producer delle tracce emergenti ad alto fit. Paga **abbonamento
B2B** (ticket alto, il ricavo più sano).

### 11.4 Dove si paga (riepilogo)
| Azione | Chi | Gratis / a pagamento |
|---|---|---|
| Analisi + match | producer | **Gratis** |
| Pubblicare nel catalogo | producer | **Gratis** |
| Streaming + like | tutti | **Gratis** |
| **Scaricare le tracce** | **DJ** | **€/mese (DJ Pool)** ← ricavo principale |
| Statistiche / featured (Pro) | producer | € opzionale |
| Scouting avanzato | label | €/mese (B2B) |

### 11.5 Cosa ricevi tu (esempio su €15/mese di un DJ)
- **~€1** commissioni + IVA → **le gestisce il Merchant of Record** (vedi sotto)
- **~€4,50** quota producer (es. 30%, divisa per download) — *è una tua scelta:
  in Fase 0-1, senza download, NON paghi nessuno e tieni quasi tutto*
- **~€9,50 restano a te**, prima delle tasse
- meno: tasse (regime forfettario) e infrastruttura (~centesimi/utente con R2)

### 11.6 Gestione FISCALE e LEGALE (Italia)
> ⚠️ Mappa pratica, NON consulenza. Servono un commercialista e un avvocato veri.

**A) Come incassi**
- Serve **partita IVA**. Partenza tipica: **ditta individuale, regime forfettario**
  (agevolato fino a €85k ricavi + contributi INPS). Crescita/investitori → **SRL**.
- Vendere abbonamenti digitali a privati UE = IVA del **paese del cliente** via
  regime **OSS** → a mano è pesante.
- **Scorciatoia consigliata: Merchant of Record (Paddle / Lemon Squeezy).**
  Diventano loro il venditore legale: incassano, calcolano e versano l'IVA in ogni
  paese, ti girano un bonifico unico, tu emetti **una sola fattura a loro**. Toglie
  l'incubo IVA estera. (Stripe = ottimo ma l'IVA resta a te.)

**B) Come paghi i producer (il nodo)**
- **Fase 0-1: non li paghi** (modello visibilità) → zero complessità. Inizia così.
- **Fase 2 (revenue-share):** distribuire denaro a tanti piccoli creator è il punto
  più delicato — può essere **diritto d'autore** (agevolato), **prestazione
  occasionale**, o **fattura** (se hanno P.IVA). **Qui il commercialista è
  obbligatorio.** Tieni il modello "visibilità" finché i volumi non giustificano la
  macchina dei pagamenti.

**C) Diritti musicali**
- Streaming pubblico → possibili obblighi **SIAE / SoundReef** anche per indie. Ti
  appoggi a ToS (licenza dall'autore) + safe harbor, **ma va verificato** (budget
  consulenza).
- **Solo originali.** Mai edit/remix/bootleg (diritti altrui → licenze costose).

**D) Documenti legali**
1. **Termini di Servizio**: l'uploader dichiara di essere l'autore, ti concede
   licenza, ti manleva.
2. **Privacy (GDPR)** + **Cookie policy**.
3. **Procedura di rimozione** (notice-and-takedown) per tracce segnalate.
4. **Accordo revenue-share** col producer (solo Fase 2).

**E) Chi ti serve accanto**
- **Commercialista** → P.IVA, regime, IVA/Merchant of Record, pagamenti producer.
- **Avvocato** → ToS, licenze, privacy, rimozioni.

**Sintesi:** il DJ paga l'abbonamento; un Merchant of Record ti toglie l'incubo
IVA; i producer all'inizio non li paghi (visibilità); in forfettario tieni grosso
modo €9-10 ogni €15, meno le tue tasse.
