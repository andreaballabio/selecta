from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(title="Selecta Audio Worker", version="1.0.0")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}

@app.post("/analyze")
async def analyze_track(request: dict):
    """Simplified analysis endpoint for testing."""
    track_id = request.get("track_id", "unknown")
    
    # Return mock data for testing
    return {
        "track_id": track_id,
        "features": {
            "bpm": 124.5,
            "key": "A",
            "scale": "minor",
            "lufs": -14.2,
            "energy_curve": [0.5] * 100,
            "duration": 240.0,
            "spectral_centroid_mean": 2500.0,
            "spectral_rolloff_mean": 6000.0,
            "zero_crossing_rate_mean": 0.05,
            "embedding": [0.0] * 128
        },
        "top_matches": [
            {
                "label_id": "solid-grooves",
                "label_name": "Solid Grooves Records",
                "sound_match_score": 85.0,
                "accessibility_score": 70.0,
                "trend_score": 75.0,
                "final_probability": 78.0,
                "reasoning": "Great match for Solid Grooves sound"
            }
        ],
        "ar_feedback": "This track shows strong potential with solid groove and energy.",
        "improvement_suggestions": ["Consider slightly more dynamic range"],
        "demo_strategy": "Submit to Solid Grooves first"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
