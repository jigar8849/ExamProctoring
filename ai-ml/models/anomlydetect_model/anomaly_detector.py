import numpy as np
from sklearn.ensemble import IsolationForest
from typing import Dict, List
from datetime import datetime

class EnhancedAnomalyDetector:
    def __init__(self, contamination=0.1):
        self.isolation_forest = IsolationForest(contamination=contamination)
        self.baseline_patterns = None
        
    def analyze_session(self, activity_data: Dict, audio_data: Dict) -> Dict:
        features = self._extract_combined_features(activity_data, audio_data)
        anomaly_scores = self.isolation_forest.score_samples(features.reshape(1, -1))
        
        suspicious_activities = self._detect_suspicious_patterns(activity_data, audio_data)
        risk_score = self._calculate_risk_score(suspicious_activities)
        
        return {
            "timestamp": datetime.now().isoformat(),
            "anomaly_score": float(anomaly_scores[0]),
            "risk_score": risk_score,
            "suspicious_activities": suspicious_activities,
            "overall_assessment": self._generate_assessment(risk_score)
        }
    
    def _extract_combined_features(self, activity_data: Dict, audio_data: Dict) -> np.ndarray:
        return np.array([
            activity_data["face_activity_percentage"],
            activity_data["body_activity_percentage"],
            activity_data["eye_activity_percentage"],
            activity_data["blink_rate"],
            activity_data["overall_activity_score"],
            audio_data["noise_ratio"],
            audio_data["voice_match_confidence"]
        ])
    
    def _detect_suspicious_patterns(self, activity_data: Dict, audio_data: Dict) -> List[Dict]:
        suspicious_patterns = []
        
        if activity_data["face_activity_percentage"] > 30:
            suspicious_patterns.append({
                "type": "excessive_face_movement",
                "severity": "high",
                "value": activity_data["face_activity_percentage"]
            })
            
        if activity_data["body_activity_percentage"] > 25:
            suspicious_patterns.append({
                "type": "excessive_body_movement",
                "severity": "high",
                "value": activity_data["body_activity_percentage"]
            })
            
        if audio_data["noise_ratio"] > 15:
            suspicious_patterns.append({
                "type": "high_noise_level",
                "severity": "medium",
                "value": audio_data["noise_ratio"]
            })
            
        if audio_data["voice_match_confidence"] < 85:
            suspicious_patterns.append({
                "type": "voice_mismatch",
                "severity": "high",
                "value": audio_data["voice_match_confidence"]
            })
            
        return suspicious_patterns
    
    def _calculate_risk_score(self, suspicious_activities: List[Dict]) -> float:
        if not suspicious_activities:
            return 0.0
            
        severity_weights = {
            "low": 0.3,
            "medium": 0.6,
            "high": 1.0
        }
        
        total_weight = sum(severity_weights[activity["severity"]] for activity in suspicious_activities)
        normalized_score = min(100, (total_weight / len(suspicious_activities)) * 100)
        
        return round(normalized_score, 2)
    
    def _generate_assessment(self, risk_score: float) -> str:
        if risk_score < 20:
            return "Normal behavior detected"
        elif risk_score < 50:
            return "Some suspicious behavior detected"
        else:
            return "High risk of cheating detected"

