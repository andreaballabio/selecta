import numpy as np
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass

from ..models.schemas import LabelMatch, TrackFeatures
from ..utils.logging import logger
from .label_dna import LabelDNA

@dataclass
class MatchingWeights:
    """Configurable weights for matching."""
    sound_similarity: float = 0.35
    trend_alignment: float = 0.25
    accessibility: float = 0.10
    novelty: float = 0.10
    saturation: float = 0.10
    recency: float = 0.05
    artist_overlap: float = 0.05
    
    def validate(self):
        total = sum([
            self.sound_similarity,
            self.trend_alignment,
            self.accessibility,
            self.novelty,
            self.saturation,
            self.recency,
            self.artist_overlap
        ])
        assert abs(total - 1.0) < 0.001, f"Weights must sum to 1.0, got {total}"

class MatchingEngine:
    """Match user tracks against label DNA profiles."""
    
    def __init__(self, weights: Optional[MatchingWeights] = None):
        self.weights = weights or MatchingWeights()
        self.weights.validate()
    
    def cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """Compute cosine similarity between two vectors."""
        dot = np.dot(a, b)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
        
        return float(dot / (norm_a * norm_b))
    
    def compute_sound_similarity(
        self,
        track_embedding: np.ndarray,
        label_centroid: np.ndarray
    ) -> float:
        """Similarity between track and label current sound."""
        return self.cosine_similarity(track_embedding, label_centroid)
    
    def compute_trend_alignment(
        self,
        track_embedding: np.ndarray,
        label_past_centroid: np.ndarray,
        label_trend_direction: np.ndarray
    ) -> float:
        """
        How well does the track align with where the label is going?
        
        If label is evolving toward X, and track is X → high alignment
        """
        # Track movement from past
        track_direction = track_embedding - label_past_centroid
        track_direction_norm = np.linalg.norm(track_direction)
        
        if track_direction_norm == 0:
            return 0.5  # Neutral
        
        track_direction = track_direction / track_direction_norm
        
        # Alignment with label trend
        alignment = self.cosine_similarity(track_direction, label_trend_direction)
        
        # Normalize to 0-1 (cosine is -1 to 1)
        return (alignment + 1) / 2
    
    def compute_novelty_score(
        self,
        track_embedding: np.ndarray,
        label_centroid: np.ndarray,
        optimal_novelty: float = 0.2
    ) -> float:
        """
        Track should be novel but not too different.
        
        Optimal novelty ~0.2 (20% different from centroid)
        """
        dissimilarity = 1 - self.cosine_similarity(track_embedding, label_centroid)
        
        # Gaussian penalty around optimal
        score = np.exp(-((dissimilarity - optimal_novelty) ** 2) / (2 * 0.1 ** 2))
        
        return float(score)
    
    def compute_saturation_penalty(
        self,
        track_embedding: np.ndarray,
        label_tracks: List[np.ndarray],
        threshold: float = 0.95
    ) -> Tuple[float, int]:
        """
        Penalty if label already has many similar tracks.
        
        Returns penalty (0-1) and count of similar tracks.
        """
        if not label_tracks:
            return 0.0, 0
        
        similar_count = 0
        for label_track in label_tracks:
            sim = self.cosine_similarity(track_embedding, label_track)
            if sim > threshold:
                similar_count += 1
        
        # Penalty increases with count
        # 0 similar → 0 penalty
        # 5 similar → 0.5 penalty
        # 10+ similar → 1.0 penalty
        penalty = min(similar_count / 10.0, 1.0)
        
        return penalty, similar_count
    
    def compute_accessibility_score(
        self,
        features: TrackFeatures,
        target_bpm_range: Tuple[float, float] = (122.0, 128.0),
        target_energy_range: Tuple[float, float] = (0.3, 0.7)
    ) -> float:
        """
        How "accessible" or "ready" is the track?
        
        Based on BPM and energy in commercial sweet spots.
        """
        bpm_score = 0.0
        if target_bpm_range[0] <= features.bpm <= target_bpm_range[1]:
            bpm_score = 1.0
        else:
            # Linear falloff
            mid = (target_bpm_range[0] + target_bpm_range[1]) / 2
            dist = abs(features.bpm - mid)
            bpm_score = max(0, 1 - dist / 20)
        
        energy_score = 0.0
        if target_energy_range[0] <= features.energy <= target_energy_range[1]:
            energy_score = 1.0
        else:
            mid = (target_energy_range[0] + target_energy_range[1]) / 2
            dist = abs(features.energy - mid)
            energy_score = max(0, 1 - dist / 0.5)
        
        return (bpm_score + energy_score) / 2
    
    def generate_reasoning(
        self,
        label_name: str,
        scores: Dict[str, float],
        features: TrackFeatures,
        similar_count: int
    ) -> Tuple[str, List[str], List[str], List[str]]:
        """Generate human-readable reasoning."""
        
        # Main reasoning
        reasoning_parts = []
        
        if scores['sound_similarity'] > 0.8:
            reasoning_parts.append(f"Strong sonic match with {label_name}'s current sound")
        elif scores['sound_similarity'] > 0.6:
            reasoning_parts.append(f"Good sonic compatibility with {label_name}")
        
        if scores['trend_alignment'] > 0.7:
            reasoning_parts.append("Track aligns with label's evolving direction")
        
        if scores['novelty'] > 0.7:
            reasoning_parts.append("Brings fresh elements while staying coherent")
        
        reasoning = ". ".join(reasoning_parts) if reasoning_parts else f"Moderate match with {label_name}"
        
        # Strengths
        strengths = []
        if scores['sound_similarity'] > 0.75:
            strengths.append(f"BPM {features.bpm:.0f} in label's sweet spot")
        if scores['trend_alignment'] > 0.7:
            strengths.append("Forward-thinking sound aligned with label evolution")
        if scores['accessibility'] > 0.7:
            strengths.append("Club-ready energy and structure")
        if scores['novelty'] > 0.6:
            strengths.append("Distinctive elements that stand out")
        
        # Weaknesses
        weaknesses = []
        if scores['sound_similarity'] < 0.5:
            weaknesses.append("Sonic profile diverges from label's current focus")
        if scores['saturation'] > 0.5:
            weaknesses.append(f"Label has {similar_count} similar tracks recently")
        if scores['accessibility'] < 0.4:
            weaknesses.append("Energy or structure may need refinement for this label")
        
        # Suggestions
        suggestions = []
        if scores['sound_similarity'] < 0.6:
            suggestions.append("Study recent releases from this label for sonic reference")
        if scores['accessibility'] < 0.5:
            suggestions.append("Consider adjusting energy curve for better club impact")
        if scores['novelty'] > 0.8:
            suggestions.append("While original, consider if this pushes too far from label's comfort zone")
        
        return reasoning, strengths, weaknesses, suggestions
    
    def match_track_to_label(
        self,
        track_id: str,
        track_embedding: np.ndarray,
        features: TrackFeatures,
        label_dna: LabelDNA,
        label_past_centroid: Optional[np.ndarray] = None,
        label_tracks: Optional[List[np.ndarray]] = None
    ) -> LabelMatch:
        """
        Compute complete match between track and label.
        """
        # 1. Sound similarity (35%)
        sound_sim = self.compute_sound_similarity(
            track_embedding, 
            label_dna.centroid
        )
        
        # 2. Trend alignment (25%)
        if label_past_centroid is not None and label_dna.trend_magnitude > 0:
            trend_align = self.compute_trend_alignment(
                track_embedding,
                label_past_centroid,
                label_dna.trend_direction
            )
        else:
            trend_align = 0.5  # Neutral if no trend data
        
        # 3. Accessibility (10%)
        accessibility = self.compute_accessibility_score(features)
        
        # 4. Novelty (10%)
        novelty = self.compute_novelty_score(track_embedding, label_dna.centroid)
        
        # 5. Saturation penalty (10%)
        saturation_penalty, similar_count = self.compute_saturation_penalty(
            track_embedding,
            label_tracks or []
        )
        
        # 6. Recency boost (5%)
        recency_boost = 1.0 if label_dna.trend_magnitude > 0.2 else 0.8
        
        # 7. Artist overlap (5%) - placeholder, requires artist data
        artist_overlap = 0.5
        
        # Final score
        final_score = (
            sound_sim * self.weights.sound_similarity +
            trend_align * self.weights.trend_alignment +
            accessibility * self.weights.accessibility +
            novelty * self.weights.novelty +
            (1 - saturation_penalty) * self.weights.saturation +
            recency_boost * self.weights.recency +
            artist_overlap * self.weights.artist_overlap
        )
        
        # Convert to 0-100 probability
        probability = final_score * 100
        
        # Generate reasoning
        scores = {
            'sound_similarity': sound_sim,
            'trend_alignment': trend_align,
            'accessibility': accessibility,
            'novelty': novelty,
            'saturation': saturation_penalty,
            'recency': recency_boost
        }
        
        reasoning, strengths, weaknesses, suggestions = self.generate_reasoning(
            label_dna.label_id,
            scores,
            features,
            similar_count
        )
        
        return LabelMatch(
            label_id=label_dna.label_id,
            label_name=label_dna.label_id,  # Will be populated from DB
            slug=label_dna.label_id,
            final_probability=probability,
            rank=0,  # Will be set after sorting
            sound_match_score=sound_sim * 100,
            trend_alignment_score=trend_align * 100,
            accessibility_score=accessibility * 100,
            novelty_score=novelty * 100,
            saturation_penalty=saturation_penalty * 100,
            recency_boost=recency_boost * 100,
            reasoning=reasoning,
            strengths=strengths,
            weaknesses=weaknesses,
            improvement_suggestions=suggestions
        )
