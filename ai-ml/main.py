import sys
import os
import json
import logging
from typing import Dict, Optional
from datetime import datetime
from models.activity_model.activity_detector import EnhancedActivityAnalyzer
from models.audio_model.audio_processor import VoiceProcessor
from models.anomlydetect_model.anomaly_detector import EnhancedAnomalyDetector


class ExamMonitor:
    def __init__(self, output_path: str):
        self.activity_analyzer = EnhancedActivityAnalyzer()
        self.audio_detector = VoiceProcessor()
        self.anomaly_detector = EnhancedAnomalyDetector()
        self.output_path = output_path
        self._setup_logging()

    def _setup_logging(self):
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        logging.info("ExamMonitor initialized.")

    def validate_paths(self, video_path: str, audio_path: str, output_path: str):
        """Validate file and directory paths."""
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        output_dir = os.path.dirname(output_path)
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            logging.info(f"Output directory created: {output_dir}")

    def process_session(self, video_path: str, audio_path: str, student_id: str) -> Optional[Dict]:
        """Process a single exam session and generate a report."""
        try:
            self.validate_paths(video_path, audio_path, self.output_path)
            
            logging.info(f"Processing session for student: {student_id}")
            
            # Analyze video activity
            logging.info("Analyzing video activity...")
            activity_data = self.activity_analyzer.process_video(video_path)
            
            # Analyze audio data
            logging.info("Analyzing audio...")
            audio_data = self.audio_detector.process_student(student_id, {
                "validate_audio_path": audio_path,
                "operations": ["validate"]
            })

            # Anomaly detection
            logging.info("Performing anomaly detection...")
            anomaly_data = self.anomaly_detector.analyze_session(
                activity_data["activity_metrics"],
                audio_data.get("validation", {}).get("features", {})
            )

            # Combine results into a report
            report = {
                "metadata": {
                    "student_id": student_id,
                    "timestamp": datetime.now().isoformat(),
                    "files": {
                        "video": video_path,
                        "audio": audio_path
                    }
                },
                "analysis": {
                    "activity_metrics": activity_data.get("activity_metrics", {}),
                    "audio_analysis": {
                        "voice_metrics": audio_data.get("validation", {}).get("features", {}).get("voice_metrics", {}),
                        "noise_metrics": audio_data.get("validation", {}).get("features", {}).get("noise_metrics", {})
                    },
                    "anomaly_detection": {
                        "risk_score": anomaly_data.get("risk_score", 0),
                        "suspicious_activities": anomaly_data.get("suspicious_activities", []),
                        "assessment": anomaly_data.get("overall_assessment", "Unknown")
                    }
                },
                "timestamps": activity_data.get("timestamps", [])
            }

            # Save the report
            with open(self.output_path, 'w') as f:
                json.dump(report, f, indent=4)
            logging.info(f"Report saved to: {self.output_path}")
            
            return report

        except Exception as e:
            logging.error(f"Error processing session: {e}")
            return None


def main():
    if len(sys.argv) < 5:
        print(f"Usage: python main.py <video_path> <audio_path> <student_id> <output_path>")
        print(f"Provided arguments: {sys.argv}")
        sys.exit(1)
    
    video_path = sys.argv[1]
    audio_path = sys.argv[2]
    student_id = sys.argv[3]
    output_path = sys.argv[4]
    print(f"Video Path: {video_path}")
    print(f"Audio Path: {audio_path}")
    print(f"Student ID: {student_id}")
    print(f"Output Path: {output_path}")
    
    try:
        monitor = ExamMonitor(output_path)
        report = monitor.process_session(video_path, audio_path, student_id)
        if report:
            print(f"Analysis complete. Report saved to: {output_path}")
        else:
            print("Analysis failed. Check logs for details.")
            sys.exit(1)
    except Exception as e:
        print(f"Error occurred during execution: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
