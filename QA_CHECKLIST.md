# Checklist QA — prova prima di aprire al pubblico

Falla con **due account diversi** (A = artista, B = secondo utente/DJ) + un giro **da sloggato** e uno **da telefono**. Segna ✅/❌.

## 0. Prerequisiti
- [ ] Tutte le SQL 0001→0012 eseguite su Supabase.
- [ ] Email configurata su Supabase (vedi sotto "Email"): registrazione + magic link arrivano davvero.
- [ ] Worker HF sveglio (`/api/cron/ping-worker` deve dare `ok:true`).
- [ ] Catalogo label popolato (più di 2 label, altrimenti i match sono poveri).

## 1. Visitatore sloggato
- [ ] Home si apre, hero + sezioni + footer.
- [ ] **/match**: carico una demo → entro ~90s ottengo BPM, key, report, **Demo Score**, lista label con %.
- [ ] /library, /charts, /artists: si caricano e si ascolta col player.
- [ ] Provo a mettere like/seguire → mi chiede di accedere.

## 2. Registrazione & accesso
- [ ] Registrazione con email/password → ricevo email di conferma → confermo → entro.
- [ ] **Magic link**: inserisco email → ricevo il link → cliccando entro.
- [ ] Logout funziona; al rientro la sessione regge.

## 3. Analisi → account (claim)
- [ ] Analizzo da sloggato, poi mi registro: l'analisi compare in **/dashboard** (claim).
- [ ] Il Demo Score mostra il percentile/fascia coerente.

## 4. Pubblicazione & press kit
- [ ] Pubblico una traccia (consenso) → compare in /library e in /charts.
- [ ] Creo la press kit (/profile) → /u/mio-handle mostra dati + **statistiche live**.
- [ ] Metto una traccia **in evidenza** (Spotlight) → compare in cima al profilo.
- [ ] **Modifica traccia**: cambio titolo/genere/label/anno/buy-link → si aggiorna.
- [ ] **Ritira** una traccia → sparisce dal catalogo ma io (owner) la vedo ancora.

## 5. Social (con account B)
- [ ] B mette like/salva/repost/commenta una traccia di A → i conteggi salgono.
- [ ] **Commento sulla waveform**: ancorato a un punto, il marker compare sull'onda.
- [ ] B segue A → A riceve la **notifica** (campanella) e il follower count sale.
- [ ] **/feed** di B mostra le tracce di A; **Mix "Per te"** mostra consigli dopo qualche like.
- [ ] **Messaggi**: B scrive ad A da /u/handle → A vede il thread e risponde.
- [ ] **Playlist**: B crea una playlist, aggiunge tracce, la apre, rimuove una traccia.

## 6. Ricerca & classifiche
- [ ] **/search**: testo + filtri (sottogenere, key, BPM) danno risultati corretti.
- [ ] **/charts**: Top / New&Hot / Emergenti / **Pronte da firmare** / **Gemme nascoste**.

## 7. Player
- [ ] Play continua tra le pagine; coda, **shuffle**, **repeat**, prev/next.
- [ ] **Autoplay** a fine coda parte con tracce simili; volume; **waveform** seek.

## 8. Versioni & download
- [ ] Owner carica una **versione** (Extended/Acapella…) → compare ed è riproducibile.
- [ ] **/pricing**: attivo "DJ Pool" (demo) → il pulsante **Scarica** funziona (traccia + versione).
- [ ] **Scarica il crate** da /saved; **/downloads** registra lo storico.
- [ ] Da non abbonato, Scarica → porta a /pricing.

## 9. Moderazione
- [ ] **Segnala** una traccia (anche da sloggato) → arriva in **/admin/reports**.
- [ ] Da admin: "Rimuovi" la ritira; "Ignora" la chiude.

## 10. Admin (solo email admin)
- [ ] /admin accessibile solo col tuo account; da altro account → reindirizza.
- [ ] Dashboard mostra i numeri; /admin/users elenca gli utenti; gestione label ok.

## 11. Mobile
- [ ] Home, /match, /library, player bar, login: usabili su telefono.

---

## Email (l'unica cosa che NON posso configurare io)
Supabase → **Authentication → Emails / SMTP**: collega un provider (es. **Resend**) e personalizza i template, altrimenti le email di conferma e i magic link **non arrivano** in modo affidabile e gli utenti non riescono a registrarsi.
