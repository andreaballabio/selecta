# Relesit → come Selecta lo scavalca (teardown + blueprint)

> Obiettivo: NON clonare relesit.com. Capire il *lavoro* che fa, farlo **meglio** sfruttando
> ciò che loro non hanno (l'audio reale + la piattaforma), e rendere Selecta la scelta ovvia.

---

## 0. Tesi in una riga
Relesit è la **versione facile** dell'idea: "descrivi a parole il tuo suono → directory di label
da Beatport". Selecta è la **versione vera**: "carica la traccia → match oggettivo sull'audio +
piattaforma completa". Loro hanno validato il bisogno. Noi vinciamo su **credibilità del match**,
**personalizzazione** e **ampiezza** — a patto di rubargli la **frizione bassa** e i **metadati pratici**.

---

## 1. Teardown di relesit (cos'è davvero)

**Meccanica centrale:** ricerca semantica su TESTO. L'utente scrive *"cómo suena tu track con tus
palabras"* e l'AI matcha le descrizioni delle label. **Nessun upload audio.**

**Modello dati per label (il loro "ADN"):**
- genere / sotto-genere (Tech House, House, Melodic H&T, Techno Peak/Driving e Raw/Deep/Hypnotic, Trance)
- **difficoltà** a 3 livelli: *Muy difícil / Medio / Accesible*
- **apertura ai nuovi talenti**
- **artisti di riferimento**
- **stato submission** + **canale di invio/contatto**
- flag **verificata** + freschezza: *"actualizados cada viernes desde Beatport"*

**Flusso:** descrivi → sfoglia label ordinate (difficoltà/attività/apertura/A-Z) → salva nei
**preferiti** → invii al canale verificato → tracci. Disclaimer: *"verifica siempre el canal oficial"*.

**Business/tech:** nessun prezzo (pre-monetizzazione). SPA React hash-router, dark minimale, **spagnolo**.
Niente worker audio → **costo infra ~zero**.

**Posizionamento implicito:** "la directory Beatport intelligente per mandare demo."

**La loro forza nascosta = LAVORO MANUALE.** 170 label "verificate" con difficoltà, apertura, canale di
invio e artisti di riferimento = **curation a mano**. È il loro vero fossato (costoso da replicare),
non l'algoritmo.

**La loro debolezza strutturale = niente audio.** Il match è **soggettivo** (dipende da come *descrivi*
il suono, non da com'è), **gameable** ("scrivo le parole giuste"), senza **prova** né **% oggettiva**.

---

## 2. Il "lavoro" da copiare (non le feature)
Il producer ha 3 sotto-bisogni:
1. **Trovare** label che calzano col mio suono.
2. **Capire se ho una chance reale** (difficoltà / apertura).
3. **Inviare** davvero (canale/contatto) e **tracciare**.

Relesit risolve tutti e 3 con *testo + metadati Beatport*. **Selecta li risolve meglio con
*audio + dati che già possiede*.** Copiamo i 3 job, non l'implementazione.

---

## 3. Feature-by-feature: loro → versione Selecta superiore

| Job | Relesit | **Selecta (migliore)** |
|---|---|---|
| Match | scrivi a parole → semantic search | **carica → % di compatibilità oggettiva** sull'embedding. Testo resta come *porta d'ingresso* (browse), audio dà il **verdetto** |
| DNA label | caratteristiche descritte a mano | **DNA misurato** dall'audio (radar: brillantezza, sub, punch, loudness, coerenza) — oggettivo, non opinione |
| Difficoltà | 3 livelli manuali | **Reachability score data-driven** (vedi §5), con il "perché" |
| Apertura nuovi | etichetta manuale | **% calcolata** da turnover roster (artisti nuovi vs ricorrenti negli ultimi 12 mesi) |
| Artisti di riferimento | lista generica | **"l'artista di QUESTA label più vicino al TUO brano"** (cosine sull'embedding) — personalizzato |
| Invio | canale + tracking manuale | canale + tracking **+ press kit e report auto-allegabili** (li hai già) |
| Freschezza | scraping Beatport settimanale | **ingestione continua Deezer + notifier nuove uscite** (cron in arrivo) |
| Catalogo/community | — | **player + social + classifiche** → il producer *resta*, non solo consulta |

**Principio:** dove loro mettono un'*opinione curata*, noi mettiamo un *numero derivato dai dati* +
l'opinione curata come strato sopra. Più difendibile e più "magico".

---

## 4. Feature di sorpasso che relesit NON può avere (perché niente audio)
Queste sono il distacco vero — impossibili da copiare senza una pipeline audio:
- **% di compatibilità oggettiva** + **feedback sul mix** (LUFS/sub/brillantezza vs media label).
- **Mappa/radar del sound** (già fatti).
- **Demo Score percentile** (dove sta il tuo brano nel corpus).
- **"Traccia di riferimento più vicina alla tua"** su ogni label.
- **Match pesato sul presente** (recency — già fatto): matcha il suono *attuale* della label.
- **Lato A&R / marketplace a due lati**: le label scoprono talenti *per suono*. Relesit è
  one-sided (solo producer). Questo è il potenziale 10x.

---

## 5. Reachability / apertura: come calcolarli SENZA curation manuale
Dati che **già abbiamo** in `label_ingestion_queue` (artist_name, release_date) e `label_profiles`:

- **Apertura ai nuovi (0-100)** = % di uscite negli ultimi 12 mesi firmate da artisti che compaiono
  **una sola volta** nel catalogo (proxy di "firmano gente nuova").
- **Cadenza** = uscite/mese (label molto attive girano più demo).
- **Selettività di suono** = coerenza interna (std basse → devi calzare *esatto* → più difficile).
- **Dimensione/prestigio** = n° tracce/artisti (più grande → tendenzialmente più difficile).

**Reachability (0-100)** ≈ `w1·apertura + w2·cadenza − w3·prestigio − w4·selettività`, mostrato con
il breakdown ("aperta ai nuovi 72% · molto attiva · suono molto coerente → media-difficile").
→ Dove relesit *stima a mano*, noi **calcoliamo** e mostriamo il perché. Più onesto e più scalabile.

**L'unico pezzo NON derivabile dall'audio:** `demos_open` + **canale/contatto di invio**. Qui serve
curation (o scraping della pagina/Linktree della label). Onesto: è il lavoro manuale di relesit.
Strategia: campo admin, partire dalle **top label** (poche, alto valore), arricchimento semi-automatico
in seconda battuta (ricerca sito/Linktree). Non bloccare il resto del prodotto su questo.

---

## 6. Posizionamento (per NON essere un clone)
- Relesit = **"directory intelligente"**. Selecta = **"il tuo A&R + il tuo catalogo"**.
- Loro: *"trova il sello"*. Noi: *"scopri chi suona come te — con la prova"*.
- Non essere "relesit in italiano". Essere la **piattaforma della verità sull'audio**: la directory è
  solo *una* feature dentro qualcosa di più grande (analisi + catalogo + community + lato label).

---

## 7. Roadmap prioritizzata (impatto × sforzo)

**Tier 1 — ruba la frizione bassa + i metadati pratici (poco sforzo, alto impatto)**
1. Arricchimento profilo label: `demos_open`, `submission_channel`/contatto, `reference_artists`,
   `last_release_date`, `reachability_score`, `openness_score` (+ filtri relativi).
2. **Porta d'ingresso a testo**: quick-search testuale (zero frizione, stile relesit) → upsell
   *"vuoi il match vero? carica la traccia"*. Converti la loro facilità nel nostro metodo migliore.

**Tier 2 — sfrutta il fossato audio (medio sforzo, distacco netto)**
3. **"Artista/traccia di riferimento più vicino alla TUA demo"** per ogni label nel report.
4. **Reachability/openness data-driven** (§5) con breakdown.
5. Far emergere meglio recency + radar nel report al producer.

**Tier 3 — marketplace a due lati (alto sforzo, 10x)**
6. Lato label: dashboard "demo in arrivo che suonano come noi" → discovery per suono.

**Da NON fare:** dipendere da scraping Beatport come base dati (rischio ToS/ban); restare una semplice
directory; bloccare tutto sulla curation dei contatti.

---

## 8. Aggiunte concrete al modello dati (label)
Nuovi campi su `labels` (o tabella `label_meta`):
`demos_open boolean`, `submission_url text`, `submission_email text`, `reference_artists text[]`,
`last_release_date date`, `reachability_score int`, `openness_score int`, `verified boolean`,
`accepts_genres text[]`. I primi due/tre sono curati; gli altri **calcolati** dal catalogo.

---

## 9. Sintesi
Relesit ha dimostrato che il bisogno c'è e ha confezionato bene i **metadati pratici** (difficoltà,
apertura, canale). Selecta li prende, ma li **fonda sui dati** invece che sull'opinione, e ci mette
sopra le cose che loro non possono avere: **match oggettivo sull'audio, personalizzazione, percentile,
catalogo/community e il lato label**. Risultato: stessa utilità immediata, più la profondità che li
rende una nota a piè di pagina.
