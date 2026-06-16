# Selecta — Strategia di piattaforma & monetizzazione

> Documento di lavoro. Sintetizza un'analisi competitiva (Trackstack, SubmitHub,
> Groover, LabelRadar, LANDR/Amuse, Music Gateway) e propone una roadmap per
> trasformare Selecta da "tool di matching" a **piattaforma completa per
> producer di musica elettronica**, con il matching A&R come gancio gratuito.

---

## 1. Posizionamento in una frase

**Gli altri ti fanno spammare demo a pioggia e pagare per ogni invio. Selecta ti
dice — gratis e in 30 secondi — quali label suonano DAVVERO come te, e poi ti
porta dentro quelle label.**

Il cuore difendibile di Selecta è la **similarità audio AI**: non "manda a 50
curatori e spera", ma "questa è la label il cui *catalogo* somiglia al tuo
suono". È un wedge di *discovery*, non di *spam*.

---

## 2. Panorama competitivo

| Piattaforma | Cosa fa | Modello di ricavo | Limite che Selecta sfrutta |
|---|---|---|---|
| **SubmitHub** | Invio brani a 1.900+ curator/playlist/blog | Crediti ($10/10cr, 1–4cr a curator; premium = ascolto 60s garantito). Approvazione media 5–8% | È spray-and-pray a pagamento. Bassa conversione, l'artista paga per essere ignorato |
| **Groover** | Invio a curator con **feedback garantito** | €2/invio, refund se nessuna risposta in 7gg, 96% response | Sempre invio-centrico; nessun matching per *suono* |
| **LabelRadar** | Demo submission per elettronica (clip 20s, public pool o privato) | Gratis per artisti, le **label pagano** l'inbox | Inbox passiva: nessuna intelligenza sul fit demo↔catalogo |
| **Trackstack** | Inbox demo + Studio (community) + Elevate (vendi feedback/mentorship/mixing) + Store (vendi tracce) | Abbonamento ai **professional** (Free 20 invii → Pro 300 → Max 1000 → Enterprise) | Il competitor più vicino e completo. Ma il matching è "AI search", non similarità acustica profonda |
| **LANDR / Amuse** | Distribuzione + mastering AI + sample + plugin | Abbonamento (~$24/anno distrib.) / pay-per-master | Servizi a valle (mastering, distribuzione) → upsell, non concorrenti diretti |
| **Music Gateway** | Mastering AI + promo + sync/opportunità | $9.99/master + add-on | Idem, fonte di feature da assorbire |

**Lettura strategica:** il mercato si divide in due. (A) *Submission/feedback*
(SubmitHub, Groover, LabelRadar, Trackstack-Inbox) — monetizza il flusso
demo→label. (B) *Producer services* (LANDR, Amuse, Music Gateway) — monetizza
mastering/distribuzione/sample. **Nessuno** parte dalla **similarità acustica del
catalogo** come motore. Quello è lo spazio di Selecta, e da lì si può espandere
in entrambe le direzioni.

---

## 3. Il wedge difendibile

1. **Matching per suono reale** (embedding audio, non tag/genere dichiarato).
   Con l'upgrade learned-embedding (Discogs-EffNet, vedi
   `apps/worker/UPGRADE_learned_embedding.md`) diventa qualità che SubmitHub &
   co. non hanno: loro non confrontano l'audio col catalogo della label.
2. **Asimmetria di valore B2B:** la stessa tecnologia che dice all'artista "sei
   da Hellbent Records" dice alla label "questa demo è all'88% nel tuo sound,
   mettila in cima all'inbox". → due lati dello stesso motore (vedi §6).
3. **Dataset proprietario:** ogni analisi (catalogo + demo) costruisce un atlante
   acustico dell'elettronica. Difendibile, migliora con l'uso, abilita feature
   (trend, "sound del momento", A&R predittivo).

---

## 4. Roadmap prodotto (a strati)

### Strato 0 — il gancio (gratis, già esistente)
- **Match con le label** per similarità audio. Resta gratis (o free fino a N
  analisi/mese, vedi §5). È il top-of-funnel: porta gli artisti dentro.

### Strato 1 — approfondire il valore per l'artista (freemium)
- **Report di analisi PRO**: oltre al match, un report leggibile del brano —
  LUFS/loudness vs standard della label, bilanciamento sub/mid, "groove",
  confronto con la traccia più simile del catalogo ("il tuo kick è 2 dB sotto").
  *Già hai quasi tutte le feature: è packaging.*
- **A/B reference matching**: carichi la tua traccia + una reference; Selecta
  dice quanto sei vicino e su quali assi (timbro, drums, dinamica) diverge.
- **"Pronto per la demo?" checklist**: qualità mix/master rispetto alle label
  target, con suggerimenti azionabili.

### Strato 2 — chiudere il loop (submission intelligente)
- **Smart Submit**: dopo il match, invii la demo *solo* alle label ad alto fit,
  dentro Selecta. Niente spray: targeting per similarità. Questo è il punto in
  cui SubmitHub/Groover monetizzano — ma noi lo facciamo *mirato* (conversione
  più alta → migliore per artista e label).
- **Inbox per label** (lato B2B, vedi §6): le label ricevono, con
  pre-ranking AI per fit al catalogo.
- **Feedback**: la label può rispondere; tracci stato (come Trackstack Outbound).

### Strato 3 — marketplace & community (alla Trackstack Elevate/Studio)
- **Marketplace servizi**: mixing, master, ghost production, mentorship —
  Selecta prende una fee. (Elevate-style.)
- **Collab matching**: trova producer/vocalist con suono compatibile/complementare
  (stesso motore di embedding, obiettivo diverso).
- **Community/Studio**: contenuti, eventi, fanbase per artisti affermati.

### Strato 4 — servizi a valle (upsell / affiliazione)
- **Mastering AI** (proprio o in white-label/affiliazione LANDR).
- **Distribuzione** (affiliazione Amuse/LANDR o integrazione).
- **Sample/stem marketplace** orientato all'elettronica.

---

## 5. Monetizzazione (modelli concreti)

Principio dell'utente: **il matching resta il gancio gratuito**; al massimo
paywall dopo una soglia di analisi. Costruiamo i ricavi *attorno*, non *sopra*,
il match.

### 5.1 Freemium sulle analisi (soft paywall)
- Free: **N analisi/mese** (es. 3–5) con match completo.
- Pro (artista) ~€7–12/mese: analisi illimitate + **Report PRO** + reference
  matching + Smart Submit scontato. *Questo è il primo ricavo, a basso attrito.*

### 5.2 Crediti per Smart Submit (alla Groover, ma mirato)
- L'invio mirato a una label costa 1 credito; il fit alto rende la conversione
  migliore di SubmitHub (5–8%) → puoi prezzare con valore percepito.
- Opzionale: **feedback garantito** (la label si impegna a rispondere) come tier
  premium, fee splittata con la label (modello Groover/Trackstack Elevate).

### 5.3 **B2B SaaS per label** (la vera miniera — §6)
- Abbonamento label per **inbox + pre-filtro AI** dei demo in arrivo. Le label
  *già pagano* LabelRadar/Trackstack per inbox; noi aggiungiamo il ranking per
  fit acustico al loro catalogo. Tier per volume demo (come Trackstack
  Pro/Max/Enterprise).

### 5.4 Take-rate marketplace
- Fee % su mixing/master/mentorship/collab venduti in piattaforma.

### 5.5 Servizi a valle
- Mastering AI a consumo (€/master) o incluso nel Pro. Affiliazione distribuzione.

**Sequenza di attivazione consigliata:** 5.1 (subito, packaging di ciò che hai)
→ 5.3 (B2B, ticket alto, pochi clienti) → 5.2 → 5.4/5.5.

---

## 6. Il prodotto B2B che cambia tutto: "A&R Copilot" per label

La stessa identica tecnologia di matching, girata verso le label:

- Una label collega il proprio catalogo (già lo fai: `label_ingestion_queue`).
- I demo in arrivo vengono **automaticamente rankati per fit acustico** al
  catalogo: "Demo #47 — 91% nel tuo sound, simile a *[traccia]*".
- **Filtri**: per fit, per sub-genere auto-rilevato, per loudness/qualità mix,
  per "novità" (quanto è diverso dal catalogo = scoperta vs sicuro).
- **Riduce il dolore #1 delle label**: centinaia di demo, zero tempo. Selecta
  fa il primo screening come farebbe un A&R junior.

Perché è strategico:
- **Ticket alto, churn basso** (le label pagano tool, non gli artisti).
- **Crea il lato offerta del marketplace**: più label dentro → più valore per gli
  artisti del match gratuito → flywheel.
- È **difendibile**: nessun competitor parte dall'embedding acustico del
  catalogo. LabelRadar/Trackstack hanno l'inbox ma non il cervello.

---

## 7. Flywheel

```
  Artisti (match gratis)  ──▶  più demo di qualità targettizzate
        ▲                                   │
        │                                   ▼
  più label "scopribili"  ◀──  Label (A&R Copilot a pagamento)
        ▲                                   │
        └──────── dataset acustico ◀────────┘
              (migliora match + feature)
```

Il gratis per gli artisti alimenta il pagato per le label, e viceversa. Il
dataset acustico al centro migliora tutto e diventa il fossato.

---

## 8. Metriche da strumentare fin da subito

- **Funnel match:** upload → match visto → Smart Submit → risposta label.
- **Qualità match (lato artista):** % di utenti che dicono "sì, è la mia label"
  (un semplice 👍/👎 sul risultato → anche feedback per calibrare l'algoritmo!).
- **Lato label:** demo processate, % shortlist, tempo risparmiato.
- **Conversione paywall** e **retention** Pro.

> Nota tecnica: il 👍/👎 sul match è oro doppio — UX *e* labeling per addestrare/
> calibrare l'embedding (oggi calibri "a mano"; con feedback puoi imparare i pesi
> dei gruppi in `build_embedding`).

---

## 9. Rischi & note

- **Cold start label:** servono label con cataloghi caricati perché il match abbia
  senso. Priorità: onboarding label (anche manuale) prima del marketing artisti.
- **Qualità match = credibilità:** se il match sbaglia, il gancio non aggancia.
  → l'upgrade learned-embedding (Discogs-EffNet) è prioritario per scalare oltre
  il piccolo catalogo omogeneo attuale.
- **Costi compute:** embedding deep e mastering AI costano CPU/GPU. Tenerli
  dietro al paywall (Pro / B2B) per allineare costo e ricavo.
- **Non diventare SubmitHub:** il valore è il *targeting*, non il volume di invii.
  Resistere alla tentazione di monetizzare lo spam.

---

## 10. Prossimi passi consigliati (ordine)

1. **Stabilizzare il match** (embedding v6 → test → eventualmente Discogs-EffNet).
2. **👍/👎 sul risultato** del match (UX + dati di calibrazione).
3. **Report PRO** (packaging delle feature esistenti) → primo paywall Pro.
4. **A&R Copilot lato label** (riusa il match, lo giri verso l'inbox) → ricavo B2B.
5. **Smart Submit** (chiude il loop artista→label).
6. Marketplace & servizi a valle.
