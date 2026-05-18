"""
Spotify Matcher - Trova corrispondenze tra tracce Discogs e Spotify
"""
import os
import re
import httpx
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class MatchResult:
    spotify_id: Optional[str]
    preview_url: Optional[str]
    confidence: float  # 0-1
    title: Optional[str]
    artist: Optional[str]
    album: Optional[str]


class SpotifyMatcher:
    def __init__(self):
        self.client_id = os.getenv("SPOTIFY_CLIENT_ID")
        self.client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
        self.access_token = None
        
    async def _get_token(self) -> str:
        """Ottiene token di accesso Spotify"""
        if self.access_token:
            return self.access_token
            
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://accounts.spotify.com/api/token",
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": f"Basic {self._get_basic_auth()}"
                },
                data={"grant_type": "client_credentials"}
            )
            
            if response.status_code != 200:
                logger.error(f"Token error: {response.text}")
                raise Exception("Failed to get Spotify token")
                
            data = response.json()
            self.access_token = data["access_token"]
            return self.access_token
    
    def _get_basic_auth(self) -> str:
        import base64
        credentials = f"{self.client_id}:{self.client_secret}"
        return base64.b64encode(credentials.encode()).decode()
    
    def normalize_title(self, title: str) -> str:
        """Normalizza il titolo per matching migliore"""
        # Rimuovi contenuti tra parentesi che indicano versioni
        title = re.sub(r'\s*[\(\[].*?(remix|edit|mix|version|original|radio|extended).*?[\)\]]', '', title, flags=re.IGNORECASE)
        # Rimuovi feat./ft.
        title = re.sub(r'\s*\(?(feat|ft)\.?\s+[^\)]+\)?', '', title, flags=re.IGNORECASE)
        # Rimuovi spazi extra
        title = re.sub(r'\s+', ' ', title).strip()
        return title.lower()
    
    def normalize_artist(self, artist: str) -> str:
        """Normalizza il nome artista"""
        # Rimuovi prefissi comuni
        artist = re.sub(r'^(the|dj|mc)\s+', '', artist, flags=re.IGNORECASE)
        return artist.lower().strip()
    
    def calculate_confidence(self, 
                           spotify_track: Dict[str, Any], 
                           query_artist: str, 
                           query_title: str) -> float:
        """Calcola confidence score 0-1"""
        
        # Estrai info da Spotify
        spotify_title = spotify_track.get("name", "")
        spotify_artists = [a.get("name", "") for a in spotify_track.get("artists", [])]
        
        # Normalizza
        norm_query_title = self.normalize_title(query_title)
        norm_query_artist = self.normalize_artist(query_artist)
        norm_spotify_title = self.normalize_title(spotify_title)
        norm_spotify_artists = [self.normalize_artist(a) for a in spotify_artists]
        
        # Score titolo (0-0.6)
        title_score = 0
        if norm_query_title == norm_spotify_title:
            title_score = 0.6
        elif norm_query_title in norm_spotify_title or norm_spotify_title in norm_query_title:
            title_score = 0.45
        else:
            # Calcola similarità parziale
            query_words = set(norm_query_title.split())
            spotify_words = set(norm_spotify_title.split())
            if query_words and spotify_words:
                intersection = query_words & spotify_words
                title_score = (len(intersection) / max(len(query_words), len(spotify_words))) * 0.3
        
        # Score artista (0-0.4)
        artist_score = 0
        for spotify_artist in norm_spotify_artists:
            if norm_query_artist == spotify_artist:
                artist_score = 0.4
                break
            elif norm_query_artist in spotify_artist or spotify_artist in norm_query_artist:
                artist_score = max(artist_score, 0.25)
            else:
                # Parola chiave in comune
                query_words = set(norm_query_artist.split())
                artist_words = set(spotify_artist.split())
                if query_words and artist_words:
                    intersection = query_words & artist_words
                    if intersection:
                        artist_score = max(artist_score, (len(intersection) / max(len(query_words), len(artist_words))) * 0.2)
        
        total_score = title_score + artist_score
        return min(total_score, 1.0)
    
    async def search_track(self, artist: str, title: str) -> List[Dict[str, Any]]:
        """Cerca tracce su Spotify"""
        token = await self._get_token()
        
        # Costruisci query
        query = f'artist:"{artist}" track:"{title}"'
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.spotify.com/v1/search",
                headers={"Authorization": f"Bearer {token}"},
                params={
                    "q": query,
                    "type": "track",
                    "limit": 5
                }
            )
            
            if response.status_code != 200:
                logger.error(f"Search error: {response.text}")
                return []
            
            data = response.json()
            return data.get("tracks", {}).get("items", [])
    
    async def match_track(self, artist: str, title: str) -> MatchResult:
        """
        Trova il miglior match per una traccia.
        Ritorna MatchResult con confidence score.
        """
        try:
            tracks = await self.search_track(artist, title)
            
            if not tracks:
                # Prova query più semplice senza filtri
                token = await self._get_token()
                async with httpx.AsyncClient() as client:
                    simple_query = f"{artist} {title}"
                    response = await client.get(
                        "https://api.spotify.com/v1/search",
                        headers={"Authorization": f"Bearer {token}"},
                        params={
                            "q": simple_query,
                            "type": "track",
                            "limit": 5
                        }
                    )
                    if response.status_code == 200:
                        data = response.json()
                        tracks = data.get("tracks", {}).get("items", [])
            
            if not tracks:
                return MatchResult(
                    spotify_id=None,
                    preview_url=None,
                    confidence=0.0,
                    title=None,
                    artist=None,
                    album=None
                )
            
            # Calcola confidence per ogni risultato
            best_match = None
            best_confidence = 0
            
            for track in tracks:
                confidence = self.calculate_confidence(track, artist, title)
                if confidence > best_confidence:
                    best_confidence = confidence
                    best_match = track
            
            if best_match and best_confidence >= 0.3:  # Threshold minimo
                return MatchResult(
                    spotify_id=best_match.get("id"),
                    preview_url=best_match.get("preview_url"),
                    confidence=best_confidence,
                    title=best_match.get("name"),
                    artist=", ".join(a.get("name", "") for a in best_match.get("artists", [])),
                    album=best_match.get("album", {}).get("name")
                )
            
            return MatchResult(
                spotify_id=None,
                preview_url=None,
                confidence=best_confidence,
                title=None,
                artist=None,
                album=None
            )
            
        except Exception as e:
            logger.error(f"Error matching track: {e}")
            return MatchResult(
                spotify_id=None,
                preview_url=None,
                confidence=0.0,
                title=None,
                artist=None,
                album=None
            )


# Singleton instance
matcher = SpotifyMatcher()
