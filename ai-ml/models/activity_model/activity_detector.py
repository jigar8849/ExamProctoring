import cv2
import numpy as np
import mediapipe as mp
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime
import json

@dataclass
class FaceMetrics:
    face_detected: bool
    eye_aspect_ratio: float
    mouth_aspect_ratio: float
    head_pose: Tuple[float, float, float]  # pitch, yaw, roll
    face_landmarks: Optional[List[Tuple[float, float, float]]] = None

class EnhancedFaceDetector:
    def __init__(self):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # Indices for facial landmarks
        self.LEFT_EYE = [362, 385, 387, 263, 373, 380]
        self.RIGHT_EYE = [33, 160, 158, 133, 153, 144]
        self.MOUTH = [61, 291, 39, 181, 0, 17]
        
    def calculate_ear(self, eye_points: List[Tuple[float, float, float]]) -> float:
        """Calculate eye aspect ratio"""
        if not eye_points or len(eye_points) != 6:
            return 0.0
            
        # Vertical distances
        v1 = np.linalg.norm(np.array(eye_points[1]) - np.array(eye_points[5]))
        v2 = np.linalg.norm(np.array(eye_points[2]) - np.array(eye_points[4]))
        
        # Horizontal distance
        h = np.linalg.norm(np.array(eye_points[0]) - np.array(eye_points[3]))
        
        return (v1 + v2) / (2.0 * h) if h > 0 else 0.0
        
    def calculate_mar(self, mouth_points: List[Tuple[float, float, float]]) -> float:
        """Calculate mouth aspect ratio"""
        if not mouth_points or len(mouth_points) != 6:
            return 0.0
            
        # Vertical distance
        v = np.linalg.norm(np.array(mouth_points[1]) - np.array(mouth_points[4]))
        
        # Horizontal distance
        h = np.linalg.norm(np.array(mouth_points[0]) - np.array(mouth_points[3]))
        
        return v / h if h > 0 else 0.0

    def detect_face(self, frame: np.ndarray) -> FaceMetrics:
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(frame_rgb)
        
        if not results.multi_face_landmarks:
            return FaceMetrics(
                face_detected=False,
                eye_aspect_ratio=0.0,
                mouth_aspect_ratio=0.0,
                head_pose=(0.0, 0.0, 0.0)
            )
        
        face_landmarks = results.multi_face_landmarks[0]
        h, w, _ = frame.shape
        landmarks_3d = []
        
        # Extract 3D landmarks
        for landmark in face_landmarks.landmark:
            x = landmark.x * w
            y = landmark.y * h
            z = landmark.z
            landmarks_3d.append((x, y, z))
        
        # Calculate metrics
        left_eye_points = [landmarks_3d[i] for i in self.LEFT_EYE]
        right_eye_points = [landmarks_3d[i] for i in self.RIGHT_EYE]
        mouth_points = [landmarks_3d[i] for i in self.MOUTH]
        
        ear = (self.calculate_ear(left_eye_points) + self.calculate_ear(right_eye_points)) / 2
        mar = self.calculate_mar(mouth_points)
        
        # Estimate head pose
        nose_tip = landmarks_3d[1]  # Using nose tip as reference
        left_eye = landmarks_3d[33]  # Left eye corner
        right_eye = landmarks_3d[263]  # Right eye corner
        
        # Simple head pose estimation
        pitch = np.arctan2(nose_tip[1] - (left_eye[1] + right_eye[1])/2, nose_tip[2])
        yaw = np.arctan2(nose_tip[0] - (left_eye[0] + right_eye[0])/2, nose_tip[2])
        roll = np.arctan2(right_eye[1] - left_eye[1], right_eye[0] - left_eye[0])
        
        return FaceMetrics(
            face_detected=True,
            eye_aspect_ratio=ear,
            mouth_aspect_ratio=mar,
            head_pose=(pitch, yaw, roll),
            face_landmarks=landmarks_3d
        )

class EnhancedActivityAnalyzer:
    def __init__(self):
        self.face_detector = EnhancedFaceDetector()
        self.activity_history = {
            "face_movements": [],
            "eye_movements": [],
            "mouth_movements": [],
            "head_movements": [],
            "timestamps": []
        }
        self.prev_metrics: Optional[FaceMetrics] = None
        
    def calculate_movement(self, current: float, previous: float, threshold: float = 0.1) -> float:
        if previous is None:
            return 0.0
        return 1.0 if abs(current - previous) > threshold else 0.0
        
    def process_frame(self, frame: np.ndarray) -> Dict[str, float]:
        metrics = self.face_detector.detect_face(frame)
        
        if not metrics.face_detected:
            return {
                "face_movement": 0.0,
                "eye_movement": 0.0,
                "mouth_movement": 0.0,
                "head_movement": 0.0
            }
        
        if self.prev_metrics is None:
            self.prev_metrics = metrics
            return {
                "face_movement": 1.0,
                "eye_movement": 0.0,
                "mouth_movement": 0.0,
                "head_movement": 0.0
            }
        
        # Calculate movements
        eye_movement = self.calculate_movement(metrics.eye_aspect_ratio, self.prev_metrics.eye_aspect_ratio, 0.05)
        mouth_movement = self.calculate_movement(metrics.mouth_aspect_ratio, self.prev_metrics.mouth_aspect_ratio, 0.1)
        
        # Head movement calculation
        head_movement = sum(
            abs(current - prev) for current, prev in 
            zip(metrics.head_pose, self.prev_metrics.head_pose)
        ) / 3.0
        
        # Update previous metrics
        self.prev_metrics = metrics
        
        return {
            "face_movement": 1.0 if metrics.face_detected else 0.0,
            "eye_movement": eye_movement,
            "mouth_movement": mouth_movement,
            "head_movement": min(1.0, head_movement)
        }
        
    def process_video(self, video_path: str) -> Dict:
        cap = cv2.VideoCapture(video_path)
        frame_count = 0
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
                
            frame_results = self.process_frame(frame)
            
            self.activity_history["face_movements"].append(frame_results["face_movement"])
            self.activity_history["eye_movements"].append(frame_results["eye_movement"])
            self.activity_history["mouth_movements"].append(frame_results["mouth_movement"])
            self.activity_history["head_movements"].append(frame_results["head_movement"])
            self.activity_history["timestamps"].append(datetime.now().isoformat())
            
            frame_count += 1
            
        cap.release()
        
        return self._generate_report(frame_count)
        
    def _generate_report(self, total_frames: int) -> Dict:
        if total_frames == 0:
            return {
                "activity_metrics": {
                    "face_activity_percentage": 0.0,
                    "body_activity_percentage": 0.0,
                    "eye_activity_percentage": 0.0,
                    "blink_rate": 0.0,
                    "overall_activity_score": 0.0
                },
                "timestamps": []
            }
            
        face_activity = np.mean(self.activity_history["face_movements"]) * 100
        eye_activity = np.mean(self.activity_history["eye_movements"]) * 100
        mouth_activity = np.mean(self.activity_history["mouth_movements"]) * 100
        head_activity = np.mean(self.activity_history["head_movements"]) * 100
        
        # Calculate blink rate (when EAR drops significantly)
        blinks = sum(1 for i in range(1, len(self.activity_history["eye_movements"]))
                    if self.activity_history["eye_movements"][i] > 0.8)
        blink_rate = (blinks / total_frames) * 100
        
        # Overall activity score
        overall_score = (face_activity * 0.2 + 
                        eye_activity * 0.3 + 
                        mouth_activity * 0.2 + 
                        head_activity * 0.3)
                        
        return {
            "activity_metrics": {
                "face_activity_percentage": round(face_activity, 2),
                "body_activity_percentage": round(head_activity, 2),  # Using head movement as body activity
                "eye_activity_percentage": round(eye_activity, 2),
                "blink_rate": round(blink_rate, 2),
                "overall_activity_score": round(overall_score, 2)
            },
        }
        
    def save_report(self, report: Dict, output_path: str):
        with open(output_path, 'w') as f:
            json.dump(report, f, indent=4)

def main():
    video_path = "D:/ExamGuard/data/videos/1737528453707.mp4"  # Replace with your video path
    analyzer = EnhancedActivityAnalyzer()
    report = analyzer.process_video(video_path)
    analyzer.save_report(report, "activity_report.json")
    print("Activity report saved.")

if __name__ == "__main__":
    main()