# Selecta Worker - Audio Analysis & Label Intelligence

Python worker for audio feature extraction and label matching.

## Architecture

```
worker/
├── src/
│   ├── analysis/        # Audio feature extraction
│   ├── matching/        # Label matching engine
│   ├── ingestion/       # Spotify/YouTube ingestion
│   ├── models/          # Data models
│   └── utils/           # Utilities
├── main.py              # FastAPI entry point
├── Dockerfile
└── requirements.txt
```

## Endpoints

- `POST /analyze` - Analyze audio track
- `GET /health` - Health check
- `POST /ingest/spotify` - Ingest from Spotify
- `POST /compute/centroids` - Recompute label centroids

## Environment Variables

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
ALLOWED_ORIGINS=
```
