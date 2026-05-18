#!/usr/bin/env python3
"""
Script per aggiungere una nuova label al database.

Uso:
    python add_label.py "Drumcode" "techno" "adam-beyer"

Processo:
    1. Crea entry nella tabella labels
    2. Recupera ultime 50 tracce da Spotify (seed iniziale)
    3. Programma backfill progressivo (5 anni in 30 giorni)
    4. Aggiunge a ingestion queue
"""

import asyncio
import sys
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import httpx
from supabase import create_client

# Config
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")

class LabelAdder:
    def __init__(self):
        self.supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        self.access_token = None
    
    async def get_spotify_token(self):
        """Get Spotify access token."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://accounts.spotify.com/api/token",
                data={"grant_type": "client_credentials"},
                auth=(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET)
            )
            self.access_token = response.json()["access_token"]
            print("✓ Spotify token ottenuto")
    
    async def search_label_tracks(
        self, 
        label_name: str, 
        limit: int = 50,
        max_age_days: int = 90
    ) -> List[Dict]:
        """
        Cerca tracce di una label su Spotify.
        Restituisce le più recenti (ultimi 90 giorni).
        """
        if not self.access_token:
            await self.get_spotify_token()
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.spotify.com/v1/search",
                headers={"Authorization": f"Bearer {self.access_token}"},
                params={
                    "q": f'label:"{label_name}"',
                    "type": "track",
                    "limit": min(limit, 50),
                    "market": "US"
                }
            )
            
            if response.status_code != 200:
                print(f"✗ Errore Spotify: {response.status_code}")
                return []
            
            data = response.json()
            tracks = data.get("tracks", {}).get("items", [])
            
            # Filtra per data (ultimi 90 giorni)
            cutoff_date = datetime.now() - timedelta(days=max_age_days)
            recent_tracks = []
            
            for track in tracks:
                release_date = track.get("album", {}).get("release_date", "")
                if release_date:
                    try:
                        if len(release_date) == 4:  # Solo anno
                            track_date = datetime.strptime(release_date, "%Y")
                        elif len(release_date) == 7:  # Anno-mese
                            track_date = datetime.strptime(release_date, "%Y-%m")
                        else:  # Data completa
                            track_date = datetime.strptime(release_date, "%Y-%m-%d")
                        
                        if track_date >= cutoff_date:
                            recent_tracks.append(track)
                    except ValueError:
                        continue
            
            print(f"✓ Trovate {len(recent_tracks)} tracce recenti su Spotify")
            return recent_tracks
    
    def create_label(self, name: str, genre: str, slug: str) -> str:
        """
        Crea la label nel database.
        Restituisce l'ID della label.
        """
        # Controlla se esiste già
        existing = self.supabase.table("labels")\
            .select("id")\
            .eq("slug", slug)\
            .execute()
        
        if existing.data:
            print(f"✗ Label '{name}' esiste già (ID: {existing.data[0]['id']})")
            return existing.data[0]["id"]
        
        # Crea nuova label
        result = self.supabase.table("labels").insert({
            "name": name,
            "slug": slug,
            "genre_focus": [genre],
            "temporal_weight": 0.85,
            "stylistic_variance": 0.3,
            "total_tracks": 0,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }).execute()
        
        label_id = result.data[0]["id"]
        print(f"✓ Label '{name}' creata (ID: {label_id})")
        return label_id
    
    def add_tracks_to_database(self, label_id: str, tracks: List[Dict]) -> int:
        """
        Aggiunge tracce al database.
        Restituisce numero di tracce aggiunte.
        """
        added = 0
        
        for track in tracks:
            spotify_id = track["id"]
            
            # Controlla se esiste già
            existing = self.supabase.table("reference_tracks")\
                .select("id")\
                .eq("spotify_id", spotify_id)\
                .execute()
            
            if existing.data:
                continue
            
            # Prepara dati
            track_data = {
                "label_id": label_id,
                "spotify_id": spotify_id,
                "title": track["name"],
                "artist": ", ".join(a["name"] for a in track["artists"]),
                "album": track["album"]["name"],
                "release_date": track["album"]["release_date"],
                "preview_url": track.get("preview_url"),
                "source": "spotify",
                "analysis_status": "pending" if track.get("preview_url") else "no_preview",
                "time_weight": 1.0,  # Sarà ricalcolato nightly
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
            
            try:
                self.supabase.table("reference_tracks").insert(track_data).execute()
                added += 1
            except Exception as e:
                print(f"  ✗ Errore aggiungendo {track['name']}: {e}")
        
        print(f"✓ Aggiunte {added} nuove tracce al database")
        return added
    
    def schedule_backfill(self, label_id: str, label_name: str, genre: str):
        """
        Programma il backfill progressivo dei 5 anni.
        Crea job in ingestion_queue per recuperare storico.
        """
        # Calcola date per backfill graduale
        # Giorno 1: già fatto (ultime 50 tracce)
        # Giorno 2-30: 20 tracce al giorno da periodi sempre più vecchi
        
        jobs = []
        for day in range(1, 31):  # 30 giorni di backfill
            # Calcola range di date
            end_offset = 90 + (day - 1) * 60  # Inizia da 3 mesi fa, vai indietro
            start_offset = end_offset + 60   # 2 mesi di range
            
            job = {
                "job_type": "spotify_backfill",
                "label_id": label_id,
                "status": "pending",
                "payload": {
                    "label_name": label_name,
                    "genre": genre,
                    "start_days_ago": start_offset,
                    "end_days_ago": end_offset,
                    "scheduled_for_day": day
                },
                "max_attempts": 3,
                "created_at": datetime.now().isoformat()
            }
            jobs.append(job)
        
        # Inserisci jobs
        for job in jobs:
            self.supabase.table("ingestion_queue").insert(job).execute()
        
        print(f"✓ Programmati {len(jobs)} giorni di backfill (5 anni in 30 giorni)")
    
    async def add_label(self, name: str, genre: str, slug: str):
        """
        Processo completo di aggiunta label.
        """
        print(f"\n{'='*60}")
        print(f"Aggiunta label: {name}")
        print(f"{'='*60}\n")
        
        # 1. Crea label nel database
        label_id = self.create_label(name, genre, slug)
        
        # 2. Recupera tracce recenti da Spotify
        tracks = await self.search_label_tracks(name, limit=50)
        
        if not tracks:
            print("✗ Nessuna traccia trovata su Spotify")
            return
        
        # 3. Aggiungi tracce al database
        added = self.add_tracks_to_database(label_id, tracks)
        
        # 4. Programma backfill storico
        self.schedule_backfill(label_id, name, genre)
        
        # 5. Aggiorna contatore label
        self.supabase.table("labels")\
            .update({
                "total_tracks": added,
                "first_release_date": tracks[-1]["album"]["release_date"] if tracks else None,
                "last_release_date": tracks[0]["album"]["release_date"] if tracks else None,
                "updated_at": datetime.now().isoformat()
            })\
            .eq("id", label_id)\
            .execute()
        
        print(f"\n{'='*60}")
        print(f"✓ Label '{name}' aggiunta con successo!")
        print(f"  - ID: {label_id}")
        print(f"  - Tracce iniziali: {added}")
        print(f"  - Backfill: 30 giorni per 5 anni di storico")
        print(f"  - Prossimo step: attendi l'analisi automatica")
        print(f"{'='*60}\n")

async def main():
    """Entry point."""
    if len(sys.argv) < 4:
        print("Uso: python add_label.py <nome> <genere> <slug>")
        print("Esempio: python add_label.py 'Drumcode' 'techno' 'drumcode'")
        sys.exit(1)
    
    name = sys.argv[1]
    genre = sys.argv[2]
    slug = sys.argv[3]
    
    # Validazione
    if not all([SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET]):
        print("✗ Errore: variabili d'ambiente mancanti")
        print("  Serve: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET")
        sys.exit(1)
    
    adder = LabelAdder()
    await adder.add_label(name, genre, slug)

if __name__ == "__main__":
    asyncio.run(main())
