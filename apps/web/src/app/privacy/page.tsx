import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy — Selecta' }

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-8">
      <h1 className="font-display text-4xl font-bold text-text">Informativa sulla privacy</h1>
      <p className="mt-2 text-sm text-faint">Ultimo aggiornamento: giugno 2026 · Modello di base (GDPR), da far validare a un legale prima dell’uso pubblico.</p>

      <div className="mt-8 space-y-6 text-muted [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-text [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
        <section>
          <h2>1. Titolare del trattamento</h2>
          <p>Il titolare è il gestore di Selecta. Per esercitare i tuoi diritti o per domande sui dati, usa i contatti indicati nel sito.</p>
        </section>
        <section>
          <h2>2. Quali dati raccogliamo</h2>
          <ul>
            <li>Dati dell’account: email, password (cifrata da Supabase), dati del profilo che inserisci.</li>
            <li>Tracce e contenuti che carichi, con i risultati dell’analisi audio.</li>
            <li>Attività sulla piattaforma: ascolti, like, salvataggi, commenti, follow, messaggi, download.</li>
            <li>Dati tecnici minimi necessari al funzionamento (cookie di sessione per l’accesso).</li>
          </ul>
        </section>
        <section>
          <h2>3. Perché li trattiamo</h2>
          <p>Per fornirti il servizio (analisi, catalogo, social, abbonamenti), per la sicurezza, per migliorare la piattaforma e per adempiere a obblighi di legge. La base giuridica è l’esecuzione del contratto e il legittimo interesse.</p>
        </section>
        <section>
          <h2>4. Con chi li condividiamo</h2>
          <p>Con i fornitori che ci permettono di operare (es. hosting e database su Supabase/Vercel, il servizio di analisi audio). Non vendiamo i tuoi dati personali.</p>
        </section>
        <section>
          <h2>5. Conservazione</h2>
          <p>Conserviamo i dati finché l’account è attivo e per il tempo necessario agli scopi sopra indicati. Puoi chiedere la cancellazione.</p>
        </section>
        <section>
          <h2>6. I tuoi diritti (GDPR)</h2>
          <p>Hai diritto di accesso, rettifica, cancellazione, limitazione, portabilità e opposizione al trattamento dei tuoi dati. Per esercitarli, contattaci.</p>
        </section>
        <section>
          <h2>7. Cookie</h2>
          <p>Usiamo cookie tecnici necessari all’accesso e al funzionamento. Non usiamo cookie di profilazione di terze parti senza il tuo consenso.</p>
        </section>
        <section>
          <h2>8. Modifiche</h2>
          <p>Potremmo aggiornare questa informativa; le modifiche rilevanti verranno comunicate nel sito.</p>
        </section>
      </div>
    </div>
  )
}
