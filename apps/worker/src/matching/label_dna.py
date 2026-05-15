import numpy as np
from typing import List, Dict, Tuple, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass

from ..utils.logging import logger

@dataclass
class LabelDNA:
    """Complete DNA profile of a label."""
    label_id: str
    centroid: np.ndarray
    trend_direction: np.ndarray
    trend_magnitude: float
    clusters: Dict[str, np.ndarray]  # sub-cluster centroids
    bpm_range: Tuple[float, float]
    key_distribution: Dict[str, float]
    temporal_weight: float

class LabelDNAEngine:
    """Build and update Label DNA profiles."""
    
    def __init__(
        self,
        embedding_dim: int = 64,
        decay_half_life_days: float = 180.0,
        outlier_contamination: float = 0.05
    ):
        self.embedding_dim = embedding_dim
        self.decay_half_life = decay_half_life_days
        self.outlier_contamination = outlier_contamination
        
    def compute_temporal_centroid(
        self,
        embeddings: List[np.ndarray],
        release_dates: List[datetime],
        reference_date: Optional[datetime] = None
    ) -> np.ndarray:
        """
        Compute time-weighted centroid.
        
        Recent releases have higher weight.
        Weight = 0.5 ^ (age_days / half_life)
        """
        if reference_date is None:
            reference_date = datetime.now()
        
        weighted_embeddings = []
        total_weight = 0.0
        
        for emb, date in zip(embeddings, release_dates):
            age_days = (reference_date - date).days
            
            # Exponential decay
            weight = 0.5 ** (age_days / self.decay_half_life)
            
            weighted_embeddings.append(emb * weight)
            total_weight += weight
        
        if total_weight == 0:
            return np.zeros(self.embedding_dim)
        
        centroid = np.sum(weighted_embeddings, axis=0) / total_weight
        
        # Normalize
        norm = np.linalg.norm(centroid)
        if norm > 0:
            centroid = centroid / norm
        
        return centroid
    
    def compute_trend_direction(
        self,
        embeddings: List[np.ndarray],
        release_dates: List[datetime],
        old_window_days: int = 180,
        new_window_days: int = 90
    ) -> Tuple[np.ndarray, float]:
        """
        Compute trend direction vector.
        
        Compares centroid of old period vs new period.
        Returns direction vector and magnitude.
        """
        now = datetime.now()
        
        # Old period: 6-12 months ago
        old_start = now - timedelta(days=old_window_days * 2)
        old_end = now - timedelta(days=old_window_days)
        
        # New period: last 3 months
        new_start = now - timedelta(days=new_window_days)
        new_end = now
        
        # Filter tracks
        old_embeddings = []
        new_embeddings = []
        
        for emb, date in zip(embeddings, release_dates):
            if old_start <= date <= old_end:
                old_embeddings.append(emb)
            elif new_start <= date <= new_end:
                new_embeddings.append(emb)
        
        if len(old_embeddings) < 3 or len(new_embeddings) < 3:
            logger.warning("Not enough tracks for trend analysis")
            return np.zeros(self.embedding_dim), 0.0
        
        # Compute centroids
        old_centroid = np.mean(old_embeddings, axis=0)
        new_centroid = np.mean(new_embeddings, axis=0)
        
        # Normalize
        old_norm = np.linalg.norm(old_centroid)
        new_norm = np.linalg.norm(new_centroid)
        
        if old_norm > 0:
            old_centroid = old_centroid / old_norm
        if new_norm > 0:
            new_centroid = new_centroid / new_norm
        
        # Direction vector
        direction = new_centroid - old_centroid
        magnitude = np.linalg.norm(direction)
        
        # Normalize direction
        if magnitude > 0:
            direction = direction / magnitude
        
        return direction, magnitude
    
    def detect_style_drift(
        self,
        features: List[Dict],
        release_dates: List[datetime],
        feature_names: List[str] = ['bpm', 'energy', 'spectral_centroid']
    ) -> Dict[str, Dict]:
        """
        Detect which specific features are changing.
        
        Returns dict of {feature: {direction, magnitude}}
        """
        now = datetime.now()
        
        # Split into old and new
        old_features = []
        new_features = []
        
        for feat, date in zip(features, release_dates):
            age_days = (now - date).days
            if age_days > 180:  # Older than 6 months
                old_features.append(feat)
            elif age_days < 90:  # Last 3 months
                new_features.append(feat)
        
        if len(old_features) < 3 or len(new_features) < 3:
            return {}
        
        drift_report = {}
        
        for feature_name in feature_names:
            old_values = [f.get(feature_name, 0) for f in old_features if f.get(feature_name)]
            new_values = [f.get(feature_name, 0) for f in new_features if f.get(feature_name)]
            
            if not old_values or not new_values:
                continue
            
            old_mean = np.mean(old_values)
            new_mean = np.mean(new_values)
            
            if old_mean == 0:
                continue
            
            change_pct = ((new_mean - old_mean) / old_mean) * 100
            
            # Only report significant changes (>10%)
            if abs(change_pct) > 10:
                drift_report[feature_name] = {
                    'direction': 'up' if change_pct > 0 else 'down',
                    'magnitude': abs(change_pct),
                    'old_mean': float(old_mean),
                    'new_mean': float(new_mean)
                }
        
        return drift_report
    
    def classify_trend(self, magnitude: float) -> str:
        """Classify trend based on magnitude."""
        if magnitude < 0.1:
            return 'stable'
        elif magnitude < 0.3:
            return 'evolving'
        else:
            return 'shifting'
    
    def compute_sub_clusters(
        self,
        embeddings: List[np.ndarray],
        n_clusters: int = 5
    ) -> Dict[str, np.ndarray]:
        """
        Compute sub-cluster centroids (peak-time, groovy, minimal, etc.)
        
        Uses simple k-means clustering.
        """
        from sklearn.cluster import KMeans
        
        if len(embeddings) < n_clusters * 2:
            logger.warning(f"Not enough tracks for {n_clusters} clusters")
            n_clusters = max(2, len(embeddings) // 3)
        
        X = np.array(embeddings)
        
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        kmeans.fit(X)
        
        # Name clusters based on characteristics (simplified)
        cluster_names = ['peak_time', 'groovy', 'minimal', 'vocal', 'experimental']
        
        clusters = {}
        for i, centroid in enumerate(kmeans.cluster_centers_):
            name = cluster_names[i] if i < len(cluster_names) else f'cluster_{i}'
            # Normalize
            norm = np.linalg.norm(centroid)
            if norm > 0:
                centroid = centroid / norm
            clusters[name] = centroid
        
        return clusters
    
    def remove_outliers(
        self,
        embeddings: List[np.ndarray],
        contamination: Optional[float] = None
    ) -> List[np.ndarray]:
        """Remove outlier embeddings using Isolation Forest."""
        from sklearn.ensemble import IsolationForest
        
        if contamination is None:
            contamination = self.outlier_contamination
        
        if len(embeddings) < 10:
            return embeddings
        
        X = np.array(embeddings)
        
        clf = IsolationForest(contamination=contamination, random_state=42)
        is_inlier = clf.fit_predict(X) == 1
        
        filtered = [emb for emb, keep in zip(embeddings, is_inlier) if keep]
        
        logger.info(f"Removed {len(embeddings) - len(filtered)} outliers")
        
        return filtered
