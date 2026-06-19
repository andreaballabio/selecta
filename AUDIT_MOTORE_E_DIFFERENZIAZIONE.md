# Audit del motore di matching + feature di differenziazione difendibili

> Obiettivo: rispondere a due domande. (1) L'algoritmo di matching vale ancora
> investimento o è già "abbastanza perfetto"? (2) Quali feature ti elevano e ti
> rendono difendibile contro Beatport/LabelRadar e i tool di mastering AI.

---

## PARTE 1 — Audit dell'algoritmo di matching

### 1.1 Cosa fa davvero (stato reale, dal codice)

**Worker (Hugging Face)** — pipeline di livello *settore*, non amatoriale:
- **Embedding di match neurale**: Discogs-EffNet (1280-dim) → proiezione deterministica Johnson-Lindenstrauss a 64-dim (preserva il coseno, niente training). Fallback hand-crafted "v6" (firma timbrica MFCC + std/delta + bande + percussione) se il modello non c'è.
- **BPM** TempoCNN (neurale), **Key** madmom CNN, **feature di display** Essentia frame-level. Fallback librosa.
- Sliding-window sul full track: una impronta per ~30s.

**Match (web, `api/match/route.ts`)** — le scelte difficili sono fatte *bene*:
- **Mean-centering** del catalogo (toglie la "traccia media" techno → il coseno diventa correlazione di Pearson, molto più discriminante in un catalogo omogeneo).
- **Top-K finestre** (non il max puro → la traccia esatta combacia su più finestre, le somiglianze fortuite si diluiscono).
- **Floor auto-calibrato** dal catalogo (lo 0% si adatta quando aggiungi label).
- **Recency weighting** (il match riflette il *suono attuale* della label, non la media storica).
- **Demo Score** = 0.5·readiness (ancorata a LUFS reali) + 0.5·fit, con **percentile** vs corpus.
- **Profili label** data-driven: medie/std + embedding medio + reachability/openness calcolate (non a mano come relesit).

### 1.2 Verdetto: è già MOLTO buono. NON è lì che devi investire ancora.

L'architettura è corretta e le decisioni non banali (centering, top-K, recency, floor adattivo, modelli neurali SOTA) sono **quelle giuste e raramente fatte bene**. I rendimenti del tuning ulteriore (±qualche % di coseno) sono **decrescenti** e *invisibili all'utente*. Perfezionare la formula non sposta l'ago.

**Il problema non è la precisione. È la CREDIBILITÀ (validazione) + 3 buchi mirati.**

### 1.3 I veri buchi (alto ROI, non "perfezione")

| # | Problema | Perché conta | Priorità |
|---|---|---|---|
| 1 | **Nessuna validazione su ground-truth.** Il motore è internamente coerente ma nessuno ha provato che la % *significhi* qualcosa. I commenti stessi dicono "no test → servono dati". | La tua promessa è "il match con la prova". Senza un numero di accuratezza, è un bel numero non dimostrato. | 🔴 massima |
| 2 | **La % non è calibrata sulla realtà.** `displayStrength` è una trasformazione del coseno, non una probabilità. "78%" implica un significato che non ha. | Rischio credibilità: o la calibri sugli esiti reali, o sii onesto e chiamala "affinità di suono", non "probabilità di firma". | 🔴 alta |
| 3 | **Rischio embedding misti (EffNet vs v6).** Vivono in spazi diversi; il match confronta tutti i vettori 64-dim senza guardare *come* sono stati prodotti. Se il catalogo è stato analizzato in parte con/senza il modello, il coseno è spazzatura. Oggi è protetto solo dalla disciplina manuale ("ri-analizza tutto"). | È **correttezza**, non rifinitura: un catalogo misto rompe silenziosamente il match. | 🟠 verifica subito |
| 4 | **Readiness sottile.** Usa solo LUFS + profilo spettrale; i check che *fanno scartare in 2 secondi* (true-peak/clipping, PSR/punch, LRA/dinamica, mono/fase) sono ancora "pending" nel codice. | Metà del Demo Score poggia su pochi segnali. Completare i check vale più del tuning. | 🟠 alta |
| 5 | **Dipendenza dal catalogo freddo.** Con poche label/tracce i match sono poveri (MIN_LABEL_TRACKS=3, confidence satura a 20). | La leva è **più dati**, non una formula migliore. | 🟡 continua |

### 1.4 Dove spendere il "tempo-algoritmo"
1. **Harness di validazione** → prendi tracce di label note, passale come "demo", misura se la *loro* label finisce in top-k (**precision@k**). Produce un numero di credibilità ("nel nostro test la label giusta è in top-5 nell'X% dei casi") — vale 100× più di +2% di coseno, ed è **marketing + fossato** (nessuno lo pubblica).
2. **Guard sulla versione embedding** (colonna `embedding_version` per traccia; confronta solo stesso-versione).
3. **Completa i check tecnici** (la lista "pending" di `report.ts`).

> In breve: l'algoritmo è già forte. Trasformalo da *buono* a *fidato* (validazione + correttezza + check completi). La fiducia è ciò che ti differenzia, non i decimali.

---

## PARTE 2 — Feature che ti elevano e ti difendono

### 2.0 La verità di mercato (dati 2026)
- **92% delle demo scartate nei primi 15 secondi.**
- **73% degli scarti per errori PREVENIBILI** (non musicali): label sbagliata, audio non a livello, formato sbagliato (40% muore prima del play), struttura incompleta (loop che non va da nessuna parte), niente EPK, mass-email.
- I tool di mastering AI (eMastered, RoEx, Sonible) e stem-separation sono **già affollati** → non è lì il tuo spazio.

**Il tuo cuneo = il livello di INTELLIGENZA PRE-INVIO**: "non farti auto-scartare, e sappi esattamente dove hai una chance vera." Più identità/community che *compongono* nel tempo. Difenditi con ciò che i colossi **strutturalmente non costruiranno**: dati di esito proprietari, identità dell'artista, grafo sociale per suono, nicchia.

### 2.A "Anti-scarto" pre-invio (usa il tuo motore, colpisce il 73%/15s) — alto impatto, sforzo basso-medio
1. **"Passi i primi 15 secondi?" — analizzatore di hook/intro.** Gli A&R decidono in 15s. Analizza *solo* i primi 15-30s: c'è un gancio? si sviluppa o è un loop piatto? Curva d'energia dell'intro. Nessuno lo fa, ed è *la* ragione per cui il 92% muore. Usa feature che già calcoli, focalizzate sulla finestra iniziale.
2. **Gate tecnico completo (finisci la lista "pending"):** true-peak/clipping inter-sample, PSR (punch del drop), LRA (dinamica), compatibilità mono/fase, sub centrato. Sono *gli esatti* check da "scartato in 2 secondi". Trasforma il report in una checklist A&R con pass/fail ancorata a numeri.
3. **"Loop o composizione?"** Rileva il brano-idea da 2 minuti che non va da nessuna parte (motivo di scarto #4) via segmentazione energia/sezioni → "nessun vero drop/breakdown rilevato".

### 2.B Grafo del suono / personalizzazione (compone con gli utenti; i colossi sono generici) — alto impatto, sforzo medio
4. **"Chi suona come te" tra gli ARTISTI (peer graph), non solo le label.** Hai già embedding per traccia → costruisci il grafo "producer vicini al tuo suono" → collaborazioni, scena, community. Beatport non costruirà un grafo sociale per similarità sonora (è contro il suo modello a catalogo). **Compone**: più utenti = grafo migliore.
5. **Traiettoria del suono nel tempo:** upload successivi → "ti stai avvicinando a questa label?". Longitudinale → possibile solo se continui a usarlo → lock-in.
6. **Reference-track delta (l'item del PRODUCT_MAP, fatto bene):** "carica la tua + una reference della label → delta per-asse con consigli misurati (kick +3 dB, master −2 LUFS)". È reference-matching *mirato all'A&R*, non mastering generico.

### 2.C Fossato di dati/credibilità (la vera difesa di lungo periodo) — strategico
7. **Loop di esito: invio → risposta → firma.** Ogni evento "ho inviato / mi hanno risposto / firmato" è **dato proprietario che nessun altro ha**. Col tempo ti permette di predire l'*accettazione reale* (non solo il coseno) → un modello davvero difendibile. È **l'unico fossato che i colossi non possono copiare** perché sono gli esiti dei *tuoi* utenti. Inizia a raccoglierlo ora, anche a mano.
8. **Metrica di validazione pubblicata** (dalla Parte 1) → la precision@k diventa credibilità pubblica. Marketing + fiducia + fossato.

### 2.D Identità & retention (così gli utenti restano, non solo consultano) — medio
9. **Press kit / EPK vivente auto-aggiornato** (ce l'hai) → diventa l'EPK canonico che il producer manda ovunque (risolve il motivo di scarto "niente EPK"). Se il tuo EPK è la loro identità, possiedi la relazione.
10. **Sound DNA nel tempo / "impronta del tuo suono"** — oggetto identità condivisibile ed evolutivo. Virale + appiccicoso.

### 2.E Cuneo di nicchia
11. **Domina prima la tech-house / IT-EU** (sei già focalizzato). Profondità in una scena batte ampiezza: micro-classifiche curate, scena locale, lingua. I colossi sono globali/generici; un tool amato dalla nicchia vince la nicchia.

---

## PARTE 3 — Cosa fare adesso (impatto × sforzo × difendibilità)

1. **Report v2 — A&R pre-flight** (check tecnici "pending" + analizzatore dei 15s). *Usa il motore, colpisce la causa reale di scarto, altissima credibilità.*
2. **Loop di esito** (invio → risposta → firma). *L'unico fossato di lungo periodo — inizia subito, anche manuale.*
3. **Harness di validazione + accuratezza pubblicata.** *Credibilità per l'intera promessa.*
4. **Peer-graph per suono** (producer come te). *Community che compone.*

**Da NON fare:** competere testa a testa con Beatport/LabelRadar sull'invio/relazioni, o costruire DSP di mastering (mercato affollato).

**Risposta secca alle tue due domande**
- *Algoritmo:* già molto buono — **smetti di inseguire la precisione**. Investi il tempo-algoritmo in **validazione + guard di correttezza + check tecnici completi**: convertono un buon algoritmo in uno *fidato*, e la fiducia è il differenziatore.
- *Feature:* differenziati sul **livello di intelligenza pre-invio** (anti-scarto), sul **grafo sociale per suono** e sul **fossato di dati di esito** — cose che Beatport/LabelRadar/i tool di mastering non costruiranno, e che *compongono* nel tempo.
