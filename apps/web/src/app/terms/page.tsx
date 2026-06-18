import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Termini di servizio — Selecta' }

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-8">
      <h1 className="font-display text-4xl font-bold text-text">Termini di servizio</h1>
      <p className="mt-2 text-sm text-faint">Ultimo aggiornamento: giugno 2026 · Modello di base, da far validare a un legale prima dell’uso pubblico.</p>

      <div className="mt-8 space-y-6 text-muted [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-text [&_p]:mt-2">
        <section>
          <h2>1. Cos’è Selecta</h2>
          <p>Selecta è una piattaforma che analizza tracce audio, le confronta con cataloghi di etichette e permette di pubblicarle in un catalogo dove possono essere ascoltate, salvate e — con abbonamento — scaricate. Usando il servizio accetti questi termini.</p>
        </section>
        <section>
          <h2>2. Account</h2>
          <p>Devi fornire dati veri e mantenere riservate le tue credenziali. Sei responsabile dell’attività svolta dal tuo account. Puoi chiudere l’account in qualsiasi momento.</p>
        </section>
        <section>
          <h2>3. I tuoi contenuti — solo originali</h2>
          <p>Puoi caricare e pubblicare <strong>solo tracce originali di cui detieni i diritti</strong>. Caricando una traccia dichiari di esserne l’autore o di avere tutti i diritti necessari, e concedi a Selecta una licenza non esclusiva per ospitarla, riprodurla in streaming ed (eventualmente) renderla scaricabile sulla piattaforma. Resti proprietario della tua musica.</p>
        </section>
        <section>
          <h2>4. Cosa non è permesso</h2>
          <p>È vietato caricare materiale di terzi senza diritti, remix o bootleg non autorizzati, contenuti illegali, offensivi o ingannevoli, e usare il servizio per spam o abusi. Possiamo rimuovere contenuti e sospendere account che violano queste regole.</p>
        </section>
        <section>
          <h2>5. Rimozione e segnalazioni</h2>
          <p>Chiunque può segnalare una traccia che viola i diritti altrui tramite l’apposito pulsante “Segnala”. Valutiamo le segnalazioni e rimuoviamo i contenuti quando opportuno. Se ritieni che un tuo diritto sia stato violato, scrivici.</p>
        </section>
        <section>
          <h2>6. Analisi e match</h2>
          <p>L’analisi audio, i punteggi e i match con le etichette sono <strong>stime automatiche a scopo informativo</strong>: non garantiscono firme, contratti o risultati commerciali. Non sostituiscono il giudizio di un A&R.</p>
        </section>
        <section>
          <h2>7. Abbonamenti e download</h2>
          <p>Alcune funzioni (es. il download) richiedono un abbonamento. Prezzi e condizioni sono indicati nella pagina dei prezzi. I download sono per uso personale/professionale del DJ e non autorizzano la ridistribuzione.</p>
        </section>
        <section>
          <h2>8. Limitazione di responsabilità</h2>
          <p>Il servizio è fornito “così com’è”. Nei limiti consentiti dalla legge, Selecta non è responsabile per danni indiretti o perdite derivanti dall’uso della piattaforma.</p>
        </section>
        <section>
          <h2>9. Modifiche</h2>
          <p>Possiamo aggiornare questi termini; le modifiche rilevanti verranno comunicate. L’uso continuato del servizio implica l’accettazione della versione aggiornata.</p>
        </section>
        <section>
          <h2>10. Contatti</h2>
          <p>Per qualsiasi domanda sui termini, contattaci all’indirizzo indicato nel sito.</p>
        </section>
      </div>
    </div>
  )
}
