import numpy as np
import librosa
from typing import Dict, Tuple, List
import scipy.stats as stats

class SoundFeatureExtractor:
    def __init__(self, sample_rate: int = 44100):
        self.sample_rate = sample_rate
        self.feature_names = [
            'mfcc', 'spectral_centroid', 'spectral_bandwidth',
            'spectral_rolloff', 'zero_crossing_rate', 'chroma_stft',
            'spectral_contrast'
        ]
    
    def extract_features(self, audio: np.ndarray) -> np.ndarray:
        if len(audio.shape) > 1:
            audio = np.mean(audio, axis=1)
            
        features = []
               
        mfccs = librosa.feature.mfcc(y=audio, sr=self.sample_rate, n_mfcc=13)
        mfcc_stats = self._compute_statistics(mfccs)
        features.extend(mfcc_stats)
                
        spectral_centroids = librosa.feature.spectral_centroid(y=audio, sr=self.sample_rate)
        sc_stats = self._compute_statistics(spectral_centroids)
        features.extend(sc_stats)
               
        spectral_bandwidth = librosa.feature.spectral_bandwidth(y=audio, sr=self.sample_rate)
        sb_stats = self._compute_statistics(spectral_bandwidth)
        features.extend(sb_stats)
               
        spectral_rolloff = librosa.feature.spectral_rolloff(y=audio, sr=self.sample_rate)
        sr_stats = self._compute_statistics(spectral_rolloff)
        features.extend(sr_stats)
               
        zcr = librosa.feature.zero_crossing_rate(audio)
        zcr_stats = self._compute_statistics(zcr)
        features.extend(zcr_stats)
               
        chroma = librosa.feature.chroma_stft(y=audio, sr=self.sample_rate)
        chroma_stats = self._compute_statistics(chroma)
        features.extend(chroma_stats)
               
        contrast = librosa.feature.spectral_contrast(y=audio, sr=self.sample_rate)
        contrast_stats = self._compute_statistics(contrast)
        features.extend(contrast_stats)
        
        return np.array(features)
    
    def _compute_statistics(self, feature_matrix: np.ndarray) -> List[float]:
        means = np.mean(feature_matrix, axis=1)
        stds = np.std(feature_matrix, axis=1)
        skews = stats.skew(feature_matrix, axis=1)
        kurtoses = stats.kurtosis(feature_matrix, axis=1)
               
        statistics = []
        statistics.extend(means)
        statistics.extend(stds)
        statistics.extend(skews)
        statistics.extend(kurtoses)
        
        return statistics
    
    def extract_voice_segments(self, audio: np.ndarray) -> Tuple[List[np.ndarray], List[Tuple[int, int]]]:     
        if len(audio.shape) > 1:
            audio = np.mean(audio, axis=1)
                   
        segments = librosa.effects.split(
            audio,
            top_db=20,
            frame_length=2048,
            hop_length=512
        )
        
        voice_segments = []
        for start, end in segments:
            segment = audio[start:end]
            if len(segment) > self.sample_rate * 0.1:  # Minimum 100ms
                voice_segments.append((segment, (start, end)))
                
        return voice_segments
    
    def compute_similarity(self, features1: np.ndarray, features2: np.ndarray) -> float:   
        features1_norm = features1 / np.linalg.norm(features1)
        features2_norm = features2 / np.linalg.norm(features2)
               
        similarity = np.dot(features1_norm, features2_norm)
               
        similarity = (similarity + 1) / 2
        
        return similarity
    
    def analyze_audio_quality(self, audio: np.ndarray) -> Dict:
        if len(audio.shape) > 1:
            audio = np.mean(audio, axis=1)
            
        metrics = {}
                
        noise_floor = np.percentile(np.abs(audio), 10)
        signal_power = np.mean(np.square(audio))
        if noise_floor > 0:
            snr = 10 * np.log10(signal_power / (noise_floor ** 2))
        else:
            snr = 100
        metrics['estimated_snr'] = snr
                
        metrics['peak_amplitude'] = np.max(np.abs(audio))
        metrics['rms_level'] = np.sqrt(np.mean(np.square(audio)))
                
        silent_threshold = 0.01
        is_silent = np.abs(audio) < silent_threshold
        silent_segments = np.sum(np.diff(is_silent.astype(int)) != 0) // 2
        metrics['silent_segments'] = silent_segments
        
        return metrics
import os
from typing import Dict, Any

def student_config(students: Dict[str, Any], audio_base_path: str = "./audio_files/") -> Dict[str, Any]:

    validated_config = {"students": {}}

    for student_id, student_data in students.items():
        try:
            student_entry = {}
            student_entry["name"] = student_data.get("name", f"Student_{student_id}")
            student_entry["register_audio_path"] = os.path.join(
                audio_base_path, student_data.get("register_audio_path", f"{student_id}_register.wav")
            )
            student_entry["validate_audio_path"] = os.path.join(
                audio_base_path, student_data.get("validate_audio_path", f"{student_id}_validate.wav")
            )
            student_entry["operations"] = student_data.get("operations", ["register", "validate"])
            if not os.path.isfile(student_entry["register_audio_path"]):
                raise FileNotFoundError(f"Register audio file not found for student ID {student_id}: {student_entry['register_audio_path']}")
            if not os.path.isfile(student_entry["validate_audio_path"]):
                raise FileNotFoundError(f"Validate audio file not found for student ID {student_id}: {student_entry['validate_audio_path']}")

            validated_config["students"][student_id] = student_entry

        except Exception as e:
            print(f"Error processing configuration for student ID {student_id}: {str(e)}")

    return validated_config

"""
def _extract_voice_features(self, audio: np.ndarray) -> np.ndarray:
    feature_extractor = SoundFeatureExtractor(sample_rate=self.sample_rate)
    return feature_extractor.extract_features(audio)
"""