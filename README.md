# Selecta - AI A&R Platform for Tech House Producers

Selecta è una piattaforma AI-powered che analizza le tracce dei produttori tech house e fornisce:
- **Label Matching**: Scopri quali label hanno maggiore probabilità di ascoltarti
- **A&R Feedback**: Feedback professionale simile a un vero A&R
- **Demo Strategy**: Strategia di submission ordinata per probabilità di successo

## 🏗️ Architettura

```
selecta/
├── apps/
│   ├── web/              # Next.js 14 (Frontend)
│   └── worker/           # Python FastAPI (Audio Processing)
├── packages/shared/      # Shared utilities
└── supabase/
    └── migrations/       # Database schema
```

## 🚀 Quick Start

### Prerequisiti
- Node.js 18+
- Python 3.11+
- Docker (opzionale per worker)
- Account Supabase
- Account OpenAI (opzionale per A&R feedback)

### 1. Setup Supabase

1. Crea un nuovo progetto su [Supabase](https://supabase.com)
2. Esegui lo schema SQL in `supabase/migrations/001_initial_schema.sql`
3. Crea un bucket storage chiamato `audio-tracks` con le policies:
   - Enable RLS
   - Allowed file types: audio/*
   - Max file size: 100MB

### 2. Setup Frontend (Next.js)

```bash
cd apps/web

# Installa dipendenze
npm install

# Configura variabili d'ambiente
cp .env.example .env.local
# Edita .env.local con i tuoi valori Supabase

# Avvia development server
npm run dev
```

### 3. Setup Worker (Python)

```bash
cd apps/worker

# Crea virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Installa dipendenze
pip install -r requirements.txt

# Configura variabili d'ambiente
cp .env.example .env
# Edita .env con i tuoi valori

# Avvia server
python main.py
```

Oppure con Docker:

```bash
cd apps/worker
docker build -t selecta-worker .
docker run -p 8000:8000 --env-file .env selecta-worker
```

## 📊 Database Schema

### Tabelle Principali

- **labels**: Profilo delle label (DNA audio, BPM range, target artist level)
- **user_tracks**: Tracce caricate dagli utenti
- **analysis_results**: Risultati dell'analisi A&R
- **label_matches**: Score di matching track-label
- **reference_tracks**: Tracce di riferimento per calcolare i centroidi label

### Vector Search

Il database utilizza l'estensione `pgvector` per similarity search sugli embeddings audio:

```sql
-- Esempio: Trova label simili a una traccia
SELECT l.name, 1 - (l.audio_embedding <=> track_embedding) as similarity
FROM labels l
ORDER BY l.audio_embedding <=> track_embedding
LIMIT 5;
```

## 🔧 Configurazione

### Variabili d'Ambiente Frontend

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
WORKER_URL=http://localhost:8000
OPENAI_API_KEY=sk-...  # Opzionale per A&R feedback
```

### Variabili d'Ambiente Worker

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-...
ALLOWED_ORIGINS=http://localhost:3000
```

## 🎵 Audio Processing

Il worker Python estrae:

1. **BPM**: Beats per minute usando librosa
2. **Key/Scale**: Krumhansl-Schmuckler key detection
3. **LUFS**: Loudness unit (stimato)
4. **Energy Curve**: RMS energy over time
5. **Spectral Features**: Centroid, rolloff, ZCR
6. **Embedding**: 128-dim vector (MFCC + Chroma + Spectral Contrast)

### Label Matching Algorithm

```
Final Probability = 
  Sound Match × 0.50 +
  Accessibility × 0.30 +
  Trend Alignment × 0.20
```

## 🚀 Deployment

### Frontend (Vercel)

```bash
cd apps/web
vercel --prod
```

Configura le variabili d'ambiente nel dashboard Vercel.

### Worker

Opzione 1: **Railway**
- Pusha su GitHub
- Connetti Railway al repo
- Configura variabili d'ambiente

Opzione 2: **Render**
- Crea un Blueprint
- Usa il Dockerfile nel repo

Opzione 3: **AWS/GCP**
- Containerize con Docker
- Deploy su ECS/Cloud Run

### Supabase

- Production: usa Supabase Cloud Pro
- Self-hosted: segui [docs ufficiali](https://supabase.com/docs/guides/self-hosting)

## 📈 Scaling Considerations

### Database
- Usa connection pooling (PgBouncer)
- Considera read replicas per query pesanti
- Implementa caching per i label centroids

### Audio Processing
- Processing asincrono con coda (Redis/RabbitMQ)
- Auto-scaling del worker basato sulla coda
- Cache risultati analisi (evita re-analisi)

### Storage
- CDN per audio files (Cloudflare R2, AWS CloudFront)
- Compressione automatica uploads
- Lifecycle policies per file vecchi

## 🔄 Auto-Update System (Futuro)

Per rendere la piattaforma auto-sufficiente:

### Phase 1: Metadata Crawler
- Cron job che traccia nuove uscite su Spotify/Beatport
- Salva metadati (NO audio download per copyright)
- Aggiorna trend analysis

### Phase 2: Label Partnerships
- Le label caricano direttamente reference tracks
- API per label manager
- Verified label badge

### Phase 3: Community Contributions
- Utenti votano il matching
- Feedback loop per migliorare embeddings
- Crowdsourced label profiles

## 🧪 Testing

### Unit Tests (Worker)

```bash
cd apps/worker
pytest tests/
```

### E2E Tests (Frontend)

```bash
cd apps/web
npm run test:e2e
```

## 📝 API Documentation

### Worker Endpoints

#### POST /analyze
```json
{
  "track_id": "uuid",
  "file_url": "https://...",
  "artist_level": "emerging"
}
```

Response:
```json
{
  "track_id": "uuid",
  "features": {
    "bpm": 126.5,
    "key": "Am",
    "scale": "minor",
    "lufs": -13.2,
    "energy_curve": [...],
    "embedding": [...]
  },
  "top_matches": [...],
  "ar_feedback": "...",
  "improvement_suggestions": [...],
  "demo_strategy": "..."
}
```

## 🎯 Roadmap

### MVP (Ora)
- [x] Upload audio
- [x] Analisi base (BPM, key, LUFS)
- [x] Label matching
- [x] A&R feedback
- [x] Dashboard risultati

### V1.1
- [ ] Integrazione OpenAI per feedback realistici
- [ ] 50+ label nel database
- [ ] Energy curve visualization
- [ ] User profiles e quota management

### V1.2
- [ ] Demo submission tracker
- [ ] Email templates
- [ ] Label response tracking
- [ ] Community features

### V2.0
- [ ] Auto-crawler nuove uscite
- [ ] ML model training sui dati
- [ ] API pubblica
- [ ] White-label per scuole/accademie

## 🤝 Contributing

1. Fork il repo
2. Crea un branch: `git checkout -b feature/xyz`
3. Commit: `git commit -am 'Add feature'`
4. Push: `git push origin feature/xyz`
5. Apri una Pull Request

## 📄 License

MIT License - vedi LICENSE file

## 🙏 Credits

- [librosa](https://librosa.org/) - Audio analysis
- [Essentia](https://essentia.upf.edu/) - Advanced audio features
- [Supabase](https://supabase.com/) - Backend infrastructure
- [Next.js](https://nextjs.org/) - Frontend framework

---

Built with passion for the tech house community 🎵
