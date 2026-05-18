"""
Ingestion Pipeline - Processa la coda di tracce da Discogs verso Spotify
"""
import os
import asyncio
from typing import List, Dict, Any
from supabase import create_client, Client
from .spotify_matcher import matcher
import logging

logger = logging.getLogger(__name__)

# Inizializza Supabase
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)


class IngestionPipeline:
    """Processa tracce dalla coda di ingestion e cerca match su Spotify"""
    
    def __init__(self):
        self.matcher = matcher
        self.batch_size = 10  # Processa 10 tracce per batch
        self.confidence_threshold_high = 0.85  # Match sicuro
        self.confidence_threshold_low = 0.50   # Necessita review
    
    async def process_pending_tracks(self, label_id: str = None) -> Dict[str, int]:
        """
        Processa tracce in attesa dalla coda.
        
        Args:
            label_id: Se specificato, processa solo tracce di questa label
            
        Returns:
            Dict con statistiche: matched, needs_review, failed
        """
        stats = {"matched": 0, "needs_review": 0, "failed": 0, "processed": 0}
        
        try:
            # Query per tracce pending
            query = supabase.table("label_ingestion_queue").select("*")
            
            if label_id:
                query = query.eq("label_id", label_id)
            else:
                # Solo tracce pending non ancora processate
                query = query.eq("status", "pending")
            
            query = query.limit(self.batch_size)
            
            response = query.execute()
            tracks = response.data
            
            if not tracks:
                logger.info("Nessuna traccia da processare")
                return stats
            
            logger.info(f"Processando {len(tracks)} tracce...")
            
            for track in tracks:
                result = await self._process_single_track(track)
                stats[result] += 1
                stats["processed"] += 1
                
                # Piccola pausa per rispettare rate limits
                await asyncio.sleep(0.2)
            
            return stats
            
        except Exception as e:
            logger.error(f"Error processing queue: {e}")
            return stats
    
    async def _process_single_track(self, track: Dict[str, Any]) -> str:
        """
        Processa una singola traccia.
        
        Returns:
            'matched', 'needs_review', o 'failed'
        """
        track_id = track["id"]
        artist = track["artist_name"]
        title = track["track_title"]
        
        try:
            logger.debug(f"Processing: {artist} - {title}")
            
            # Cerca su Spotify
            match = await self.matcher.match_track(artist, title)
            
            if match.confidence >= self.confidence_threshold_high:
                # Match sicuro
                await self._update_track(
                    track_id,
                    status="matched",
                    spotify_id=match.spotify_id,
                    preview_url=match.preview_url,
                    confidence=match.confidence
                )
                logger.info(f"✓ Matched: {artist} - {title} ({match.confidence:.2f})")
                return "matched"
                
            elif match.confidence >= self.confidence_threshold_low:
                # Match incerto, necessita review
                await self._update_track(
                    track_id,
                    status="needs_review",
                    spotify_id=match.spotify_id,
                    preview_url=match.preview_url,
                    confidence=match.confidence
                )
                logger.info(f"⚠ Needs review: {artist} - {title} ({match.confidence:.2f})")
                return "needs_review"
                
            else:
                # Nessun match
                await self._update_track(
                    track_id,
                    status="failed",
                    confidence=match.confidence
                )
                logger.info(f"✗ Failed: {artist} - {title} ({match.confidence:.2f})")
                return "failed"
                
        except Exception as e:
            logger.error(f"Error processing track {track_id}: {e}")
            
            # Incrementa tentativi
            attempts = track.get("attempts", 0) + 1
            await self._update_track(
                track_id,
                attempts=attempts,
                last_error=str(e)[:200]
            )
            
            return "failed"
    
    async def _update_track(self, 
                          track_id: str,
                          status: str = None,
                          spotify_id: str = None,
                          preview_url: str = None,
                          confidence: float = None,
                          attempts: int = None,
                          last_error: str = None):
        """Aggiorna una traccia nella coda"""
        
        update_data = {}
        
        if status:
            update_data["status"] = status
        if spotify_id is not None:
            update_data["spotify_track_id"] = spotify_id
        if preview_url is not None:
            update_data["spotify_preview_url"] = preview_url
        if confidence is not None:
            update_data["spotify_match_confidence"] = confidence
        if attempts is not None:
            update_data["attempts"] = attempts
        if last_error:
            update_data["last_error"] = last_error
        
        if update_data:
            supabase.table("label_ingestion_queue").update(update_data).eq("id", track_id).execute()
    
    async def run_continuous(self, interval_seconds: int = 60):
        """Esegue il pipeline continuamente con intervallo"""
        logger.info(f"Starting continuous pipeline (interval: {interval_seconds}s)")
        
        while True:
            try:
                stats = await self.process_pending_tracks()
                
                if stats["processed"] > 0:
                    logger.info(f"Batch complete: {stats}")
                
                await asyncio.sleep(interval_seconds)
                
            except Exception as e:
                logger.error(f"Error in continuous loop: {e}")
                await asyncio.sleep(interval_seconds)


# Singleton
pipeline = IngestionPipeline()


async def process_ingestion_queue(label_id: str = None, batch_size: int = 10):
    """
    Funzione principale per processare la coda.
    Può essere chiamata da endpoint API o scheduler.
    """
    pipeline.batch_size = batch_size
    return await pipeline.process_pending_tracks(label_id)
