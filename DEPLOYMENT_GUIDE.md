# 🚀 GUIDA DEPLOYMENT COMPLETA - Selecta

Questa guida ti porta da zero alla piattaforma online in ~30 minuti.

---

## 📋 PREREQUISITI

- Account GitHub (gratuito)
- Account Supabase (gratuito tier sufficiente per iniziare)
- Account Vercel (gratuito)
- Account Railway o Render (gratuito, per il worker Python)
- Account OpenAI (opzionale, per A&R feedback avanzati)

---

## 1️⃣ SETUP SUPABASE (Database + Auth + Storage)

### Step 1.1: Crea Progetto Supabase

1. Vai su https://supabase.com/dashboard
2. Clicca **"New Project"**
3. Configura:
   - **Name**: `selecta` (o qualsiasi nome)
   - **Database Password**: genera una password sicura e SALVALA (serve dopo)
   - **Region**: Scegli quella più vicina ai tuoi utenti (Frankfurt per Europa)
4. Clicca **"Create New Project"**
5. Attendi ~2 minuti che il progetto sia pronto

### Step 1.2: Ottieni le API Keys

1. Nel dashboard Supabase, vai su **Project Settings** (icona ingranaggio in basso)
2. Seleziona **API** dal menu laterale
3. Copia questi valori (li userai dopo):
   - `URL` → sarà `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → sarà `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → sarà `SUPABASE_SERVICE_ROLE_KEY` (MANTENILA SEGRETA!)

### Step 1.3: Esegui lo Schema SQL

1. Nel dashboard, vai su **SQL Editor** (icona </> nel menu laterale)
2. Clicca **"New Query"**
3. Copia e incolla TUTTO il contenuto di `supabase/migrations/001_initial_schema.sql`
4. Clicca **"Run"** (tasto play in alto a destra)
5. Verifica che non ci siano errori nel output

### Step 1.4: Configura Storage Bucket

1. Vai su **Storage** nel menu laterale
2. Clicca **"New Bucket"**
3. Configura:
   - **Name**: `audio-tracks` (esatto!)
   - **Public bucket**: ✅ Spunta ON (serve per URL pubbliche)
4. Clicca **"Save"**

5. Ora configura le policies RLS:
   - Clicca sul bucket `audio-tracks`
   - Vai alla tab **Policies**
   - Clicca **"New Policy"**
   - Seleziona **"For full customization"**
   
   **Policy 1 - Upload:**
   - Policy name: `Allow authenticated uploads`
   - Allowed operation: `INSERT`
   - Target roles: `authenticated`
   - Policy definition: `(auth.uid() = (storage.foldername(name))[1]::uuid)`
   - Clicca **"Review"** poi **"Save policy"**

   **Policy 2 - Select:**
   - Policy name: `Allow users to view own files`
   - Allowed operation: `SELECT`
   - Target roles: `authenticated`
   - Policy definition: `(auth.uid() = (storage.foldername(name))[1]::uuid)`
   - Salva

   **Policy 3 - Delete:**
   - Policy name: `Allow users to delete own files`
   - Allowed operation: `DELETE`
   - Target roles: `authenticated`
   - Policy definition: `(auth.uid() = (storage.foldername(name))[1]::uuid)`
   - Salva

### Step 1.5: Abilita pgvector (già fatto nella migration, ma verifica)

1. Vai su **Database** → **Extensions**
2. Cerca `vector`
3. Se non è attivo, clicca l'interruttore per attivarlo

✅ **Supabase è pronto!**

---

## 2️⃣ SETUP REPOSITORY GITHUB

### Step 2.1: Pusha il codice

```bash
# Dalla cartella selecta (dove hai il progetto)
cd /Users/andreaballabio/Desktop/Selecta/selecta

# Inizializza git (se non già fatto)
git init

# Aggiungi tutto
git add .

# Commit
git commit -m "Initial commit - Selecta MVP"

# Crea repo su GitHub (via web o CLI)
# Poi connetti e pusha:
git remote add origin https://github.com/TUOUSERNAME/selecta.git
git branch -M main
git push -u origin main
```

---

## 3️⃣ DEPLOY FRONTEND SU VERCEL

### Step 3.1: Connetti Repository

1. Vai su https://vercel.com/dashboard
2. Clicca **"Add New Project"**
3. Seleziona **"Import Git Repository"**
4. Trova `selecta` nella lista e clicca **"Import"**

### Step 3.2: Configura Build

1. **Framework Preset**: Seleziona `Next.js`
2. **Root Directory**: Cambia da `./` a `apps/web`
3. Vercel dovrebbe rilevare automaticamente le impostazioni

### Step 3.3: Environment Variables

Aggiungi queste variabili (i valori li hai presi dallo Step 1.2):

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://tuo-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIs...` |
| `WORKER_URL` | Per ora lascia `http://localhost:8000`, poi aggiornerai |

Clicca **"Deploy"**

### Step 3.4: Verifica Deploy

1. Attendi il completamento del deploy (~2-3 minuti)
2. Vercel ti darà un URL tipo `https://selecta-xxx.vercel.app`
3. Visita l'URL e verifica che la landing page si veda
4. Prova a cliccare "Inizia Gratis" - dovrebbe portarti al login Supabase

✅ **Frontend online!**

---

## 4️⃣ DEPLOY WORKER PYTHON

Hai 2 opzioni: **Railway** (più semplice) o **Render** (più controllo).

### OPZIONE A: Railway (Consigliato per semplicità)

#### Step 4A.1: Setup

1. Vai su https://railway.app
2. Login con GitHub
3. Clicca **"New Project"**
4. Seleziona **"Deploy from GitHub repo"**
5. Seleziona il repo `selecta`

#### Step 4A.2: Configura Servizio

1. Railway rileverà automaticamente il `Dockerfile` in `apps/worker/`
2. Se non lo rileva: clicca su **"+ Add Service"** → **"Dockerfile"**
3. Specifica il path: `apps/worker/Dockerfile`

#### Step 4A.3: Environment Variables

Vai nella tab **Variables** del servizio e aggiungi:

| Name | Value |
|------|-------|
| `SUPABASE_URL` | Stesso di NEXT_PUBLIC_SUPABASE_URL |
| `SUPABASE_ANON_KEY` | Stesso di NEXT_PUBLIC_SUPABASE_ANON_KEY |
| `SUPABASE_SERVICE_ROLE_KEY` | Stesso di prima |
| `OPENAI_API_KEY` | `sk-...` (opzionale) |
| `ALLOWED_ORIGINS` | URL del frontend Vercel (es: `https://selecta-xxx.vercel.app`) |

#### Step 4A.4: Deploy

1. Railway deploya automaticamente ogni push su main
2. Attendi il deploy (vedi i logs nella tab **Deploy**)
3. Una volta pronto, Railway ti dà un URL tipo `https://selecta-worker.up.railway.app`

4. **IMPORTANTE**: Vai su Vercel e aggiorna la variabile `WORKER_URL` con questo nuovo URL!

✅ **Worker online!**

### OPZIONE B: Render (Alternativa)

#### Step 4B.1: Setup

1. Vai su https://render.com
2. Login con GitHub
3. Clicca **"New"** → **"Web Service"**
4. Seleziona il repo `selecta`

#### Step 4B.2: Configura

- **Name**: `selecta-worker`
- **Runtime**: `Docker`
- **Root Directory**: `apps/worker`
- **Docker Command**: (lascia vuoto, usa il Dockerfile)

#### Step 4B.3: Environment Variables

Aggiungi le stesse variabili della sezione Railway (sopra)

#### Step 4B.4: Deploy

1. Clicca **"Create Web Service"**
2. Attendi il deploy (può richiedere 5-10 minuti la prima volta)
3. Prendi l'URL e aggiorna su Vercel

✅ **Worker online!**

---

## 5️⃣ CONFIGURAZIONE FINALE

### Step 5.1: Aggiorna URL Worker su Vercel

1. Vai su Vercel Dashboard
2. Seleziona il progetto `selecta`
3. Vai su **Settings** → **Environment Variables**
4. Trova `WORKER_URL` e aggiorna con l'URL reale del worker
5. Clicca **"Save"**
6. Vai su **Deployments** e clicca **"Redeploy"** sulla ultima build

### Step 5.2: Configura Redirect URL su Supabase (per Auth)

1. Vai su Supabase Dashboard
2. **Authentication** → **URL Configuration**
3. In **Site URL** inserisci: `https://tuo-progetto.vercel.app`
4. In **Redirect URLs** aggiungi:
   - `https://tuo-progetto.vercel.app/auth/callback`
   - `https://tuo-progetto.vercel.app/dashboard`
5. Salva

### Step 5.3: Configura CORS sul Worker (se necessario)

Se hai scelto Railway/Render, il CORS è già configurato nel codice (`main.py`):

```python
allow_origins=["*"]  # In produzione, sostituisci con il tuo dominio Vercel
```

Aggiorna con il tuo dominio reale:
```python
allow_origins=["https://tuo-progetto.vercel.app"]
```

Fai un nuovo commit e push per aggiornare.

---

## 6️⃣ TEST COMPLETO

### Step 6.1: Test Landing Page
- Visita `https://tuo-progetto.vercel.app`
- Verifica che si veda correttamente

### Step 6.2: Test Auth
- Clicca "Inizia Gratis"
- Dovresti vedere la pagina di login Supabase
- Registrati con email/password

### Step 6.3: Test Upload
- Dopo login, dovresti vedere la Dashboard
- Prova a caricare un file audio (WAV/MP3, max 100MB)
- Verifica che l'upload completi senza errori

### Step 6.4: Test Analisi
- Clicca "Analizza con AI"
- Verifica che lo status cambi in "In corso"
- Attendi 1-2 minuti
- Ricarica la pagina - dovrebbe mostrare "Completato"
- Clicca sulla traccia per vedere i risultati

### Step 6.5: Verifica Risultati
- Dovresti vedere:
  - BPM, Key, LUFS
  - Energy Curve (grafico)
  - Label Matching con scores
  - A&R Feedback

---

## 🐛 TROUBLESHOOTING

### Errore: "Failed to create upload URL"
**Causa**: Bucket storage non configurato correttamente
**Fix**: Verifica Step 1.4 - le policies RLS devono essere esatte

### Errore: "Analysis failed" / Worker non risponde
**Causa**: Worker offline o URL sbagliato
**Fix**: 
1. Verifica che il worker sia online (visita `https://tuoworker.com/health`)
2. Controlla che `WORKER_URL` su Vercel sia corretto (senza trailing slash)
3. Verifica i logs su Railway/Render

### Errore: CORS errors nel browser
**Causa**: Origins non permessi
**Fix**: 
1. Aggiorna `ALLOWED_ORIGINS` sul worker con il dominio Vercel esatto
2. Se in sviluppo, puoi temporaneamente mettere `["*"]` (non in produzione!)

### Errore: "Unauthorized" su API
**Causa**: Auth session scaduta o configurazione errata
**Fix**: Verifica Step 5.2 - i redirect URL su Supabase devono includere il tuo dominio

### Analisi resta in "processing" per sempre
**Causa**: Worker non riesce a processare
**Fix**:
1. Controlla logs del worker: `docker logs` o tab Logs su Railway
2. Verifica che il worker riesca a scaricare il file da Supabase Storage
3. Verifica che `SUPABASE_SERVICE_ROLE_KEY` sia corretta

---

## 🎉 POST-DEPLOY

### Aggiungi più Label

Aggiungi label al database eseguendo SQL su Supabase:

```sql
INSERT INTO labels (
    name, slug, description, primary_genre,
    bpm_min, bpm_max, target_artist_level,
    commercial_score, underground_score,
    demo_submission_url, is_active
) VALUES 
(
    'Nu Label', 
    'nu-label',
    'Description...',
    'tech house',
    123, 128, 'emerging',
    0.5, 0.8,
    'https://nulabel.com/demo',
    true
);
```

### Monitora l'uso

- **Supabase Dashboard**: Vai su Reports per vedere API calls, storage usage
- **Vercel Analytics**: Dopo il deploy, abilita Analytics per vedere traffico
- **Railway/Render**: Monitora CPU/RAM usage del worker

### Backup Database

1. Su Supabase: **Database** → **Backups**
2. I backup automatici sono inclusi nel piano Pro
3. Per piano gratuito: esporta manualmente da SQL Editor con `pg_dump`

---

## 📊 COSTI STIMATI

| Servizio | Piano | Costo/mese |
|----------|-------|------------|
| Supabase | Free Tier | €0 (fino a 500MB DB, 1GB storage) |
| Vercel | Hobby | €0 (fino a 100GB bandwidth) |
| Railway | Starter | €0 (fino a $5 crediti/mese) |
| Render | Free | €0 (worker dorme dopo inattività) |
| OpenAI | Pay-as-you-go | ~€0.01 per analisi (opzionale) |

**Totale iniziale: €0/mese** (fino a limiti free tier)

---

## ✅ CHECKLIST FINALI

Prima di annunciare il progetto, verifica:

- [ ] Landing page carica correttamente
- [ ] Signup/login funziona
- [ ] Upload audio funziona (prova file da 10MB e 50MB)
- [ ] Analisi completa con successo
- [ ] Risultati mostrano label matching
- [ ] Mobile responsive (testa su telefono)
- [ ] HTTPS attivo (Vercel lo fa automatico)

---

**Se hai problemi o errori durante questi step, mandami:**
1. Screenshot dell'errore
2. URL del progetto Vercel
3. Logs del worker (da Railway/Render)

Ti aiuto a risolvere! 🚀
