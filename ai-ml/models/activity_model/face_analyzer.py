import cv2
import math
import numpy as np
from typing import List, Optional, Tuple, Union
from dataclasses import dataclass
import base64
import json
import os
from datetime import datetime

@dataclass
class BoundingBox:
    origin_x: int
    origin_y: int
    width: int
    height: int

@dataclass
class Keypoint:
    x: float
    y: float

@dataclass
class Category:
    category_name: str
    score: float

@dataclass
class Detection:
    bounding_box: BoundingBox
    keypoints: List[Keypoint]
    categories: List[Category]

class FaceDetector:
    def __init__(self):
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        self.eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
        
    def detect_facial_features(self, roi_gray: np.ndarray, x: int, y: int, w: int, h: int, width: int, height: int) -> List[Keypoint]:
        keypoints = []
        eyes = self.eye_cascade.detectMultiScale(roi_gray, scaleFactor=1.1, minNeighbors=5)
        if len(eyes) >= 2:
            eyes = sorted(eyes, key=lambda e: e[0])
            ex, ey, ew, eh = eyes[0]
            keypoints.append(Keypoint(x=(x + ex + ew//2)/width, y=(y + ey + eh//2)/height))
            keypoints.append(Keypoint(x=(x + ex)/width, y=(y + ey + eh//2)/height))  # Left 
            keypoints.append(Keypoint(x=(x + ex + ew)/width, y=(y + ey + eh//2)/height))  # Right 

            if len(eyes) > 1:
                ex, ey, ew, eh = eyes[1]
                keypoints.append(Keypoint(x=(x + ex + ew//2)/width, y=(y + ey + eh//2)/height))
                keypoints.append(Keypoint(x=(x + ex)/width, y=(y + ey + eh//2)/height))  # Left 
                keypoints.append(Keypoint(x=(x + ex + ew)/width, y=(y + ey + eh//2)/height))  # Right 
        else:
            keypoints.extend([
                Keypoint(x=(x + w//3)/width, y=(y + h//3)/height),     # Left eye
                Keypoint(x=(x + 2*w//3)/width, y=(y + h//3)/height),   # Right eye
            ])
        nose_top_y = y + h * 0.4
        nose_bottom_y = y + h * 0.6
        nose_center_x = x + w//2
        
        keypoints.extend([
            Keypoint(x=nose_center_x/width, y=nose_top_y/height),
            Keypoint(x=nose_center_x/width, y=nose_bottom_y/height),
            Keypoint(x=(nose_center_x - w//8)/width, y=nose_bottom_y/height),
            Keypoint(x=(nose_center_x + w//8)/width, y=nose_bottom_y/height),
        ])
        
        mouth_y = y + 2*h//3
        keypoints.extend([
            Keypoint(x=(x + w//3)/width, y=mouth_y/height),     # Left 
            Keypoint(x=(x + 2*w//3)/width, y=mouth_y/height),   # Right 
            Keypoint(x=(x + w//2)/width, y=(mouth_y - h//20)/height),  # Upper 
            Keypoint(x=(x + w//2)/width, y=(mouth_y + h//20)/height),  # Lower 
        ])

        ear_y = y + h//3
        keypoints.extend([
            Keypoint(x=x/width, y=ear_y/height),             
            Keypoint(x=x/width, y=(ear_y + h//4)/height),      
            Keypoint(x=x/width, y=(ear_y + h//2)/height),       
            Keypoint(x=(x + w)/width, y=ear_y/height),      
            Keypoint(x=(x + w)/width, y=(ear_y + h//4)/height), 
            Keypoint(x=(x + w)/width, y=(ear_y + h//2)/height), 
        ])
        
        keypoints.extend([
            Keypoint(x=(x + w//8)/width, y=(y + 7*h//8)/height),    
            Keypoint(x=(x + 7*w//8)/width, y=(y + 7*h//8)/height),  
            Keypoint(x=(x + w//2)/width, y=(y + h)/height),         
        ])
        
        return keypoints

    def detect_faces(self, image: np.ndarray) -> List[Detection]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30)
        )
        
        results = []
        height, width = image.shape[:2]
        
        for (x, y, w, h) in faces:
            roi_gray = gray[y:y+h, x:x+w]
            
            keypoints = self.detect_facial_features(roi_gray, x, y, w, h, width, height)
            
            detection = Detection(
                bounding_box=BoundingBox(
                    origin_x=x,
                    origin_y=y,
                    width=w,
                    height=h
                ),
                keypoints=keypoints,
                categories=[Category("Face", 1.0)]
            )
            results.append(detection)
        
        return results

class DetectionVisualizer:
    MARGIN = 10
    ROW_SIZE = 10
    FONT_SIZE = 1
    FONT_THICKNESS = 1
    TEXT_COLOR = (255, 0, 0)   
    EYE_COLOR = (0, 255, 0)    
    NOSE_COLOR = (255, 255, 0) 
    MOUTH_COLOR = (0, 255, 255)
    EAR_COLOR = (255, 165, 0)  
    JAW_COLOR = (128, 0, 128)  
    
    @staticmethod
    def _normalized_to_pixel_coordinates(
        normalized_x: float, 
        normalized_y: float, 
        image_width: int,
        image_height: int
    ) -> Union[None, Tuple[int, int]]:
        def is_valid_normalized_value(value: float) -> bool:
            return (value > 0 or math.isclose(0, value)) and (value < 1 or math.isclose(1, value))

        if not (is_valid_normalized_value(normalized_x) and is_valid_normalized_value(normalized_y)):
            return None
            
        x_px = min(math.floor(normalized_x * image_width), image_width - 1)
        y_px = min(math.floor(normalized_y * image_height), image_height - 1)
        return x_px, y_px

    @classmethod
    def visualize(cls, image: np.ndarray, detections: List[Detection]) -> np.ndarray:
        annotated_image = image.copy()
        height, width, _ = image.shape

        for detection in detections:
            bbox = detection.bounding_box
            start_point = (bbox.origin_x, bbox.origin_y)
            end_point = (bbox.origin_x + bbox.width, bbox.origin_y + bbox.height)
            cv2.rectangle(annotated_image, start_point, end_point, cls.TEXT_COLOR, 2)
            keypoint_pixels = []
            for keypoint in detection.keypoints:
                px = cls._normalized_to_pixel_coordinates(keypoint.x, keypoint.y, width, height)
                if px:
                    keypoint_pixels.append(px)
            def draw_connected_points(points, color, closed=False):
                if len(points) > 1:
                    for i in range(len(points) - 1):
                        cv2.line(annotated_image, points[i], points[i + 1], color, 1)
                    if closed:
                        cv2.line(annotated_image, points[-1], points[0], color, 1)

            for i in range(min(6, len(keypoint_pixels))):
                cv2.circle(annotated_image, keypoint_pixels[i], 2, cls.EYE_COLOR, -1)
            nose_points = keypoint_pixels[6:10]
            for point in nose_points:
                cv2.circle(annotated_image, point, 2, cls.NOSE_COLOR, -1)
            if len(nose_points) >= 4:
                cv2.line(annotated_image, nose_points[0], nose_points[1], cls.NOSE_COLOR, 1)
                cv2.line(annotated_image, nose_points[2], nose_points[3], cls.NOSE_COLOR, 1)
            mouth_points = keypoint_pixels[10:14]
            for point in mouth_points:
                cv2.circle(annotated_image, point, 2, cls.MOUTH_COLOR, -1)
            if len(mouth_points) >= 4:
                draw_connected_points(mouth_points, cls.MOUTH_COLOR, closed=True)
            left_ear_points = keypoint_pixels[14:17]
            draw_connected_points(left_ear_points, cls.EAR_COLOR)
        
            right_ear_points = keypoint_pixels[17:20]
            draw_connected_points(right_ear_points, cls.EAR_COLOR)
            
        
            jaw_points = keypoint_pixels[20:23]
            draw_connected_points(jaw_points, cls.JAW_COLOR)

        
            category = detection.categories[0]
            result_text = f'{category.category_name} ({category.score:.2f})'
            text_location = (cls.MARGIN + bbox.origin_x,
                           cls.MARGIN + cls.ROW_SIZE + bbox.origin_y)
            cv2.putText(annotated_image, result_text, text_location, 
                       cv2.FONT_HERSHEY_PLAIN, cls.FONT_SIZE, 
                       cls.TEXT_COLOR, cls.FONT_THICKNESS)

        return annotated_image

def resize_image(image, target_width: int = 800) -> np.ndarray:
    height, width, _ = image.shape
    aspect_ratio = width / height
    new_width = target_width
    new_height = int(new_width / aspect_ratio)
    
    resized_image = cv2.resize(image, (new_width, new_height))
    return resized_image

def main():
    face_detector = FaceDetector()
    
    image_path = "./sample_1/samp_img3.jpeg"
    image = cv2.imread(image_path)
    
    if image is None:
        print(f"Error: Could not load image from {image_path}")
        return

    image = resize_image(image, target_width=100)
    
    detections = face_detector.detect_faces(image)
    output_image = DetectionVisualizer.visualize(image, detections)

    cv2.imshow("Detection Results", output_image)
    cv2.waitKey(0)
    cv2.destroyAllWindows()

    output_path = "output_image.jpeg"
    cv2.imwrite(output_path, output_image)
    print(f"Annotated image saved to {output_path}")

class FaceStorage:
    def __init__(self, database_path: str = "face_database.json"):
        self.database_path = database_path
        self._load_database()
    
    def _load_database(self):
        if os.path.exists(self.database_path):
            with open(self.database_path, 'r') as f:
                self.database = json.load(f)
        else:
            self.database = {}
            
    def save_database(self):
        with open(self.database_path, 'w') as f:
            json.dump(self.database, f, indent=4)
            
    def encode_face_region(self, image: np.ndarray, detection: Detection) -> str:
        bbox = detection.bounding_box
        face_img = image[bbox.origin_y:bbox.origin_y + bbox.height,
                        bbox.origin_x:bbox.origin_x + bbox.width]
        _, buffer = cv2.imencode('.jpg', face_img)
        face_encoding = base64.b64encode(buffer).decode('utf-8')
        return face_encoding
        
    def store_face(self, student_id: str, face_encoding: str, detection: Detection):
        """Store face encoding with student ID and detection data"""
        if student_id not in self.database:
            self.database[student_id] = []
        keypoints_list = [{"x": kp.x, "y": kp.y} for kp in detection.keypoints]
        face_entry = {
            "encoding": face_encoding,
            "keypoints": keypoints_list,
            "bbox": {
                "x": detection.bounding_box.origin_x,
                "y": detection.bounding_box.origin_y,
                "width": detection.bounding_box.width,
                "height": detection.bounding_box.height
            },
            "timestamp": datetime.now().isoformat()
        }
        
        self.database[student_id].append(face_entry)
        self.save_database()
        
    def get_student_faces(self, student_id: str) -> list:
        """Retrieve all faces for a given student ID"""
        return self.database.get(student_id, [])
    
    def delete_student_data(self, student_id: str) -> bool:
        """Delete all face data for a given student ID"""
        if student_id in self.database:
            del self.database[student_id]
            self.save_database()
            return True
        return False
def main_with_storage():
    face_detector = FaceDetector()
    face_storage = FaceStorage()

    student_id = input("Enter student ID: ")
    image_path = "./sample_1/samp_img3.jpeg"
    image = cv2.imread(image_path)
    
    if image is None:
        print(f"Error: Could not load image from {image_path}")
        return
    image = resize_image(image, target_width=800)

    detections = face_detector.detect_faces(image)
    if detections:
        for detection in detections:
        
            face_encoding = face_storage.encode_face_region(image, detection)
            face_storage.store_face(student_id, face_encoding, detection)
        print(f"Successfully stored face data for student ID: {student_id}")
        output_image = DetectionVisualizer.visualize(image, detections)
        cv2.imshow("Detection Results", output_image)
        cv2.waitKey(0)
        cv2.destroyAllWindows()

        output_path = f"output_{student_id}.jpeg"
        cv2.imwrite(output_path, output_image)
        print(f"Annotated image saved to {output_path}")
    else:
        print("No faces detected in the image.")
def face_storage_examples():
    storage = FaceStorage()
    student_id = "12345"
    faces = storage.get_student_faces(student_id)
    print(f"Found {len(faces)} faces for student {student_id}")
    if storage.delete_student_data(student_id):
        print(f"Deleted all face data for student {student_id}")
    else:
        print(f"No data found for student {student_id}")

def load_student_ids(json_path: str) -> List[str]:
    """Load student IDs from a JSON file"""
    try:
        with open(json_path, 'r') as f:
            data = json.load(f)
            if not isinstance(data, dict) or 'student_ids' not in data:
                raise ValueError("JSON file must contain a 'student_ids' key with an array of student IDs")
            return data['student_ids']
    except FileNotFoundError:
        print(f"Error: Student ID file not found at {json_path}")
        return []
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON file at {json_path}")
        return []
    except Exception as e:
        print(f"Error loading student IDs: {str(e)}")
        return []

def process_student_images(student_id: str, image_directory: str, face_detector: FaceDetector, face_storage: FaceStorage) -> None:
    """Process images for a single student"""
    # Check if directory exists
    if not os.path.exists(image_directory):
        print(f"Error: Image directory {image_directory} not found")
        return

    # Process all images in directory
    for image_file in os.listdir(image_directory):
        if image_file.lower().endswith(('.png', '.jpg', '.jpeg')):
            image_path = os.path.join(image_directory, image_file)
            image = cv2.imread(image_path)
            
            if image is None:
                print(f"Error: Could not load image from {image_path}")
                continue

            image = resize_image(image, target_width=800)
            detections = face_detector.detect_faces(image)
            
            if detections:
                for detection in detections:
                    face_encoding = face_storage.encode_face_region(image, detection)
                    face_storage.store_face(student_id, face_encoding, detection)
                
                output_image = DetectionVisualizer.visualize(image, detections)
                output_path = f"output_{student_id}_{os.path.basename(image_file)}"
                cv2.imwrite(output_path, output_image)
                print(f"Processed and saved {output_path}")
            else:
                print(f"No faces detected in {image_file}")
def main_with_storage():
    student_ids_path = "./student_ids.json"
    image_directory = "./sample_1"
    
    face_detector = FaceDetector()
    face_storage = FaceStorage()
    
    student_ids = load_student_ids(student_ids_path)
    if not student_ids:
        print("No student IDs found. Please check the JSON file.")
        return
    
    for student_id in student_ids:
        print(f"\nProcessing images for student ID: {student_id}")
        process_student_images(student_id, image_directory, face_detector, face_storage)

if __name__ == "__main__":
    main_with_storage() 