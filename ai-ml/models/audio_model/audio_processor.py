import os
import logging
import json
import sys
from datetime import datetime
import numpy as np
import librosa
from pydub import AudioSegment

def numpy_to_python(obj):
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, np.bool_):
        return bool(obj)
    return obj

class SoundFeatureExtractor:
    def __init__(self):
        self.supported_formats = [".wav", ".mp3", ".flac", ".ogg", ".mp4"]
        self._check_ffmpeg()
    
    def _check_ffmpeg(self):
        try:
            AudioSegment.from_file(os.devnull)
        except Exception as e:
            if "ffprobe" in str(e):
                logging.warning("FFmpeg not found. Please install FFmpeg for audio processing.")

    def extract_voice_features(self, audio_path):
        try:
            if not os.path.exists(audio_path):
                raise FileNotFoundError(f"Audio file not found: {audio_path}")

            _, ext = os.path.splitext(audio_path)
            if ext.lower() == ".mp4":
                audio_path = self._convert_to_wav(audio_path)            
            audio, sr = librosa.load(audio_path, sr=None)                        
            voice_strength = self._calculate_voice_strength(audio)
            background_noise = self._calculate_background_noise(audio)
            disturbance = self._calculate_disturbance(audio)

            features = {
                "voice_metrics": {
                    "strength": numpy_to_python(voice_strength),
                    "clarity": numpy_to_python(self._calculate_voice_clarity(audio)),
                    "pitch_stability": numpy_to_python(self._calculate_pitch_stability(audio))
                },
                "noise_metrics": {
                    "background_level": numpy_to_python(background_noise),
                    "signal_to_noise_ratio": numpy_to_python(self._calculate_snr(audio)),
                    "disturbance_level": numpy_to_python(disturbance)
                }
            }
            return features

        except Exception as e:
            logging.error(f"Error extracting features from {audio_path}: {str(e)}")
            raise

    def _calculate_voice_strength(self, audio):                
        voice_mask = librosa.feature.melspectrogram(y=audio, sr=22050)
        return np.mean(voice_mask)

    def _calculate_background_noise(self, audio):                
        S = np.abs(librosa.stft(audio))
        percentile = np.percentile(S, 10, axis=1)
        return np.mean(percentile)

    def _calculate_disturbance(self, audio):                
        onset_env = librosa.onset.onset_strength(y=audio)
        return np.mean(onset_env)

    def _calculate_voice_clarity(self, audio):        
        contrast = librosa.feature.spectral_contrast(y=audio)
        return np.mean(contrast)

    def _calculate_pitch_stability(self, audio):        
        pitches, magnitudes = librosa.piptrack(y=audio)
        return np.std(pitches[magnitudes > np.median(magnitudes)])

    def _calculate_snr(self, audio):        
        noise_floor = np.percentile(np.abs(audio), 10)
        signal = np.percentile(np.abs(audio), 90)
        return 20 * np.log10(signal / noise_floor) if noise_floor > 0 else 0

    def _convert_to_wav(self, input_path):
        output_path = f"{os.path.splitext(input_path)[0]}.wav"
        try:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            audio = AudioSegment.from_file(input_path)
            audio.export(output_path, format="wav")
            return output_path
        except Exception as e:
            logging.error(f"Error converting audio to WAV: {str(e)}")
            raise

    def compare_voices(self, features1, features2, threshold=0.85):
        try:
            if not features1 or not features2:
                return {"match": False, "confidence": 0, "error": "Invalid features"}                        
            voice_diff = abs(features1["voice_metrics"]["strength"] - features2["voice_metrics"]["strength"])
            clarity_diff = abs(features1["voice_metrics"]["clarity"] - features2["voice_metrics"]["clarity"])
            pitch_diff = abs(features1["voice_metrics"]["pitch_stability"] - features2["voice_metrics"]["pitch_stability"])                        
            voice_match = 1 / (1 + voice_diff)
            clarity_match = 1 / (1 + clarity_diff)
            pitch_match = 1 / (1 + pitch_diff)
            
            confidence = (voice_match * 0.4 + clarity_match * 0.3 + pitch_match * 0.3)
            
            return {
                "match": bool(confidence >= threshold),
                "confidence": float(confidence),
                "details": {
                    "voice_similarity": float(voice_match),
                    "clarity_similarity": float(clarity_match),
                    "pitch_similarity": float(pitch_match)
                }
            }
        except Exception as e:
            logging.error(f"Error comparing voices: {str(e)}")
            return {"match": False, "confidence": 0, "error": str(e)}

class VoiceProcessor:
    def __init__(self, config_path="C:/Users/Admin/Desktop/aiml_v2/models/audio_model/student_id.json"):
        self.config_path = config_path
        self.load_config()
        self.feature_extractor = SoundFeatureExtractor()
        self.output_dir = os.path.dirname(config_path)
        
    def load_config(self):
        if not os.path.exists(self.config_path):
            raise FileNotFoundError(f"Config file not found: {self.config_path}")
            
        with open(self.config_path, 'r') as f:
            self.config_data = json.load(f)
            
        self.config_data.setdefault("results", {})

    def process_student(self, student_id, student_data):
        logging.info(f"Processing student: {student_id}")
        
        report = {
            "student_id": student_id,
            "name": student_data.get("name", "Unknown"),
            "timestamp": datetime.now().isoformat(),
            "registration": None,
            "validation": None,
            "comparison": None
        }

        try:
            operations = student_data.get("operations", [])
            
            if "register" in operations:
                register_path = student_data.get("register_audio_path")
                if not register_path or not os.path.exists(register_path):
                    raise FileNotFoundError(f"Registration audio file not found: {register_path}")
                
                register_features = self.feature_extractor.extract_voice_features(register_path)
                if register_features is None:
                    raise ValueError(f"Failed to extract features from registration audio: {register_path}")
                
                report["registration"] = {
                    "audio_path": register_path,
                    "features": register_features,
                    "processed_at": datetime.now().isoformat()
                }

            if "validate" in operations:
                validate_path = student_data.get("validate_audio_path")
                if not validate_path or not os.path.exists(validate_path):
                    raise FileNotFoundError(f"Validation audio file not found: {validate_path}")
                
                validate_features = self.feature_extractor.extract_voice_features(validate_path)
                if validate_features is None:
                    raise ValueError(f"Failed to extract features from validation audio: {validate_path}")
                
                report["validation"] = {
                    "audio_path": validate_path,
                    "features": validate_features,
                    "processed_at": datetime.now().isoformat()
                }
                
                if report["registration"] and report["validation"]:
                    comparison = self.feature_extractor.compare_voices(
                        report["registration"]["features"],
                        report["validation"]["features"]
                    )
                    report["comparison"] = {
                        **comparison,
                        "compared_at": datetime.now().isoformat()
                    }

            self.config_data["results"][student_id] = report
            self._save_config()
            return report
            
        except Exception as e:
            logging.error(f"Error processing student {student_id}: {str(e)}")
            report["error"] = str(e)
            self.config_data["results"][student_id] = report
            self._save_config()
            raise

    def _save_config(self):
        with open(self.config_path, 'w') as f:
            json.dump(self.config_data, f, indent=4, default=numpy_to_python)
        logging.info(f"Updated results in: {self.config_path}")

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

def main():
    setup_logging()
    logging.info("Starting voice verification processing")
    
    try:
        processor = VoiceProcessor()
        students = processor.config_data.get("students", {})
        
        if not students:
            logging.error("No students found in config")
            return 1
            
        for student_id, student_data in students.items():
            try:
                report = processor.process_student(student_id, student_data)
                if report.get("comparison"):
                    match_status = "MATCH" if report["comparison"]["match"] else "NO MATCH"
                    logging.info(f"Processed student {student_id} - {match_status}")
            except Exception as e:
                logging.error(f"Failed to process student {student_id}: {str(e)}")
                
        logging.info("Processing completed")
        return 0
        
    except Exception as e:
        logging.error(f"Error during processing: {str(e)}")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)