from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

from src.models.schemas import (
    AnalysisRequest, AnalysisResponse, 
    MatchingRequest, MatchingResponse, LabelMatch
)
from src.analysis.audio_analyzer import AudioAnalyzer
from src.matching.matching_engine import MatchingEngine, MatchingWeights
from src.matching.label_dna import LabelDNAEngine
from src.utils.config import Config
from src.utils.logging import logger

# Global instances
analyzer: AudioAnalyzer = None
matching_engine: MatchingEngine = None
dna_engine: LabelDNAEngine = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    global analyzer, matching_engine, dna_engine
    
    # Startup
    logger.info("Starting Selecta Worker...")
    analyzer = AudioAnalyzer(embedding_dim=64)
    matching_engine = MatchingEngine()
    dna_engine = LabelDNAEngine()
    logger.info("Worker initialized successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Selecta Worker...")

app = FastAPI(
    title="Selecta Worker",
    description="Audio analysis and label matching for tech house",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "services": {
            "analyzer": analyzer is not None,
            "matching": matching_engine is not None,
            "dna_engine": dna_engine is not None
        }
    }

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_track(request: AnalysisRequest):
    """
    Analyze audio track and extract features.
    
    Downloads preview from URL, extracts features using librosa,
    returns structured analysis data.
    """
    try:
        logger.info(f"Analyzing track: {request.track_id}")
        
        # Analyze
        features = await analyzer.analyze_from_url(request.audio_url)
        
        logger.info(f"Analysis complete for {request.track_id}")
        
        return AnalysisResponse(
            track_id=request.track_id,
            features=features,
            success=True
        )
        
    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")
        return AnalysisResponse(
            track_id=request.track_id,
            features=None,
            success=False,
            error=str(e)
        )

@app.post("/match", response_model=MatchingResponse)
async def match_track(request: MatchingRequest):
    """
    Match track against all labels.
    
    Computes similarity scores, trend alignment, and generates
    detailed reasoning for each label match.
    """
    try:
        logger.info(f"Matching track: {request.track_id}")
        
        # TODO: Load label DNAs from database
        # For now, return placeholder
        
        return MatchingResponse(
            track_id=request.track_id,
            matches=[],
            top_label_id=None,
            top_probability=None
        )
        
    except Exception as e:
        logger.error(f"Matching failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/compute/centroids")
async def compute_centroids(background_tasks: BackgroundTasks):
    """
    Trigger recomputation of all label centroids.
    
    Runs in background. Updates label DNA profiles
    with latest temporal weighting.
    """
    # TODO: Implement background centroid computation
    return {"status": "queued", "message": "Centroid computation queued"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
