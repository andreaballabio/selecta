# Deploy Worker su Railway

## Prerequisiti
- Account Railway (https://railway.app)
- Account GitHub (il repo è già collegato)

## Passaggi

### 1. Crea progetto su Railway
1. Vai su https://railway.app/dashboard
2. Click "New Project"
3. Seleziona "Deploy from GitHub repo"
4. Scegli il repo `andreaballabio/selecta`

### 2. Configura il servizio
1. Nella root directory imposta: `apps/worker`
2. Railway rileverà automaticamente il Dockerfile
3. Vai su "Variables" e aggiungi:
   ```
   SUPABASE_URL=https://vvjjdmzbnyvgbcjlbzuz.supabase.co
   SUPABASE_ANON_KEY=tuo-anon-key
   SUPABASE_SERVICE_ROLE_KEY=tuo-service-role-key
   OPENAI_API_KEY=sk-... (opzionale)
   ALLOWED_ORIGINS=https://selecta-eta.vercel.app
   ```

### 3. Deploy
1. Click "Deploy"
2. Attendi che il build finisca (2-3 minuti)
3. Copia l'URL del servizio (es: `https://selecta-worker.up.railway.app`)

### 4. Aggiorna Vercel
1. Vai su Vercel Dashboard → selecta → Environment Variables
2. Aggiungi/modifica:
   ```
   WORKER_URL=https://selecta-worker.up.railway.app
   ```
3. Redeploy il frontend

## Monitoraggio
- Logs: Railway Dashboard → Logs
- Health check: `https://tuo-worker.up.railway.app/health`
