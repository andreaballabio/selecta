# Selecta — Mappa del prodotto & piano di sviluppo

## Il filo conduttore
**Una sola analisi del suono → la tua identità sonora → la tua pagina/press-kit
come centro → il percorso dell'artista in 5 tappe → gli studi/label che pescano
sopra.** Nessuna funzione è un'isola: tutte leggono dallo stesso "DNA sonoro".

```
                 ┌───────────────────────────────────────┐
                 │  IL MOTORE · analisi del tuo suono     │   una volta sola
                 └───────────────────┬───────────────────┘
                                     │  alimenta ogni tappa
   ① CAPISCI     ② MIGLIORA     ③ PIAZZA        ④ MOSTRA       ⑤ CRESCI
   Match         Reference      Submit(filtr.)  Catalogo       Network
   Report PRO    Mastering      Distribuzione   Press Kit      Hype/classifiche
        └────────────┴───────────────┴──────┬──────┴──────────────┘
                                            ▼
                       ┌────────────────────────────────────┐
                       │   LA TUA PAGINA · PRESS KIT          │  il centro,
                       │   identità sonora condivisibile      │  condivisibile
                       └────────────────────┬───────────────┘
                                            ▼  gli studi pescano qui
   ─────────────────────  STUDI / LABEL · B2B  ─────────────────────
   A&R Copilot (inbox filtrato) · Scouting feed · Press-kit white-label

   FLYWHEEL: utenti creano → studi scoprono e pagano → successi → +utenti
```

---

## Fattibilità & tempi

### 🟢 ORA (col motore attuale, nessuna dipendenza esterna)
| Servizio | Cosa serve | Note |
|---|---|---|
| **Report PRO** | packaging delle feature che già calcoli + UI + benchmark vs standard streaming/label + copy dei consigli | il grosso è **design + copy**, non nuovo motore. **Deve essere ottimo**: consigli ancorati a misure reali (LUFS, dB, rapporti di banda), mai generici |
| **Reference Matching** | confronto di 2 embedding + delta per-asse (timbro/drums/dinamica) + generazione consigli | stesso motore. La *credibilità* sta nell'ancorare i consigli a numeri reali ("kick +3 dB", "master −2 LUFS"). Fattibile e affidabile perché sono misure, non opinioni |
| **Press Kit (base)** | data-model profilo (bio/foto/link) + pagina pubblica auto-popolata (suono, tracce, numeri) + design | il differenziatore è l'auto-popolamento dal motore. **Il design qui è critico** (deve sembrare pro, non amatoriale) |

### 🟡 MEDIO (più build / dipende dall'onboarding label)
| Servizio | Cosa serve | Dipende da |
|---|---|---|
| **Submit (filtrato)** | gating per fit + qualità, scarsità/crediti, analytics invio | che esista il lato label |
| **A&R Copilot** | account label, inbox, controlli/filtri, ranking (motore c'è) | **onboarding di 2-3 label pilota** (business, non codice) |
| **Press-kit white-label** | account studio multi-artista + branding/dominio | che esista la Press Kit |

### 🔴 DOPO (sforzo alto / delicato / dipendenze pesanti)
| Servizio | Cosa serve | Note |
|---|---|---|
| **Catalogo + Network + DJ pool** | storage+streaming (Cloudflare R2), player, like/classifiche, download + **pagamenti** + **moderazione** + **legale (ToS/licenze)** | ⚠️ la parte **più importante e delicata**. Il *network* ("chi suona come te") è facile (motore c'è); il resto è il vero lavoro. Cold-start pesante (vedi SOCIAL_CATALOG_PLAN.md) |
| **Scouting feed (B2B)** | feed + ranking | dipende dal Catalogo |
| **Distribuzione** | affiliazione (Amuse/LANDR) → poi propria | affiliazione = business deal, basso sforzo; propria = alto |
| **Selecta come Label** | A&R + legale + contratti | mangi il tuo prodotto, ti prendi l'upside |
| **AI Mastering** | build DSP/ML *oppure* white-label | meglio white-label all'inizio |
| **API white-label** | prodottizzare il motore | quando il motore è stabile (lo è) |

---

## Fasi consigliate (con cancello per avanzare)

**Fase 1 — "Da tool a identità" (ORA).**
Report PRO + Reference Matching + Press Kit. Trasforma Selecta da "trovami una
label" a *hub dell'identità dell'artista*. Porta la prima revenue (Pro) e la
Press Kit è **virale** (ogni link condiviso porta utenti). Tutto col motore che hai.
*Cancello:* utenti che usano e convertono a Pro; press-kit condivise.

**Fase 2 — "Chiudi il loop" (B2B).**
Submit filtrato + A&R Copilot (pilota con 2-3 label amiche) + Press-kit
white-label per gli studi. Prima revenue B2B (ticket alto).
*Cancello:* almeno una label dice "questo mi fa risparmiare tempo / lo pago".

**Fase 3 — "Il livello sociale" (delicato).**
Catalogo + Network + DJ pool + Scouting feed. Si accende quando c'è massa utenti.
Richiede legale, infra streaming, pagamenti, moderazione (vedi SOCIAL_CATALOG_PLAN.md).
*Cancello:* la vetrina curata genera ritorni/ascolti prima di aprire download/pagamenti.

**Fase 4 — "Protagonista".**
Distribuzione (affiliazione→propria) + Selecta Label + Mastering + API.

---

## Risorse e competenze necessarie

| Area | Stato | Nota |
|---|---|---|
| **Backend / full-stack** | ✅ coperto (io + te) | Next.js + Supabase + worker |
| **Motore audio** | ✅ fatto | analisi + matching + auto-calibrazione |
| **Design / frontend di qualità** | ⚠️ **il gap principale** | Report e Press Kit DEVONO sembrare pro. Serve un buon designer o un design system forte. È la competenza che fa la differenza tra "amatoriale" e "credibile" |
| **Infra (storage/streaming)** | da introdurre in Fase 3 | Cloudflare R2 (egress zero) per il catalogo |
| **Compute analisi** | ⚠️ da valutare | oggi ~45-50s/traccia su CPU gratuita HF: ok ora, ma a volumi alti serve GPU a pagamento o ottimizzazione (stride più ampio) |
| **Pagamenti + legale** | da Fase 2-3 | Merchant of Record (Paddle/Lemon Squeezy) per l'IVA; commercialista + avvocato (ToS, licenze) |
| **Business dev (onboarding label)** | da Fase 2 | NON è codice: senza label, Submit e A&R Copilot sono vuoti. Servono 2-3 label pilota |
| **Community / marketing** | da Fase 3 | per il cold-start del catalogo |

---

## Note sui punti che hai segnato
- **Reference Matching deve essere reale/affidabile:** sì, ed è ottenibile perché
  i consigli sono **misure** (dB, LUFS, rapporti di banda), non giudizi. La qualità
  sta nel tradurre i numeri in consigli chiari e nel validarli su tracce vere.
- **Catalogo = il più importante e delicato:** confermato. È in Fase 3 apposta —
  il valore è enorme ma il costo (legale, infra, cold-start, pagamenti) è il più
  alto. Lo progettiamo con cura quando ci arriviamo, partendo da "vetrina curata".
- **Submit e credibilità:** risolto col modello "filtro, non megaphone" (gating per
  fit + qualità + scarsità; le label pagano per il filtro). È un vantaggio, non un rischio.

---

## Come procediamo
Partiamo dalla **Fase 1**, e dentro la Fase 1 dal pezzo a più alto ritorno e più
veloce: il **Report PRO** (prima fonte di guadagno, usa ciò che hai). Poi
Reference Matching, poi Press Kit. Ogni pezzo è autonomo e dà valore da subito.
