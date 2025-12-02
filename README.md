# ExamGuard - AI-Powered Exam Proctoring Platform

## Overview

ExamGuard is a comprehensive AI-powered exam proctoring platform designed to ensure the integrity and security of online examinations. The platform leverages advanced machine learning algorithms to monitor students in real-time, detect suspicious activities, and provide detailed analytics for educators. Built with a focus on fairness, security, and ease of use, ExamGuard serves three main user roles: Examiners (teachers), Examinees (students), and Parents.

## Features

### Core Functionality
- **AI-Powered Proctoring**: Real-time monitoring using computer vision and audio analysis
- **Multi-Role Dashboards**: Separate portals for teachers, students, and parents
- **Live Analytics**: Instant reports on student behavior and exam integrity
- **Secure Exam Environment**: Browser lockdown and tab-switching detection
- **Voice Verification**: Audio-based student authentication
- **Anomaly Detection**: Machine learning models to identify suspicious patterns

### Technical Features
- **Face Detection & Tracking**: Uses MediaPipe and OpenCV for facial recognition
- **Activity Monitoring**: Tracks eye movements, head poses, and body language
- **Audio Analysis**: Processes voice features for verification and disturbance detection
- **Real-time Communication**: Socket.io integration for live updates
- **Cloud Storage**: Integration with Cloudinary for media uploads
- **Database Management**: MongoDB with Mongoose for data persistence

### User Portals
- **Examiner Portal**: Create exams, monitor sessions, view analytics
- **Examinee Portal**: Take exams in a secure environment
- **Parent Portal**: Track child's performance and exam integrity

## Problems Addressed

### Traditional Online Exam Challenges
- **Cheating Prevention**: Lack of effective monitoring in remote settings
- **Identity Verification**: Difficulty confirming student identity
- **Behavioral Monitoring**: Inability to detect suspicious activities
- **Scalability**: Managing large numbers of simultaneous exams
- **Data Analysis**: Limited insights into exam integrity and performance

### Technical Challenges
- **Real-time Processing**: Handling video/audio streams efficiently
- **Accuracy vs. Privacy**: Balancing monitoring effectiveness with user privacy
- **Cross-platform Compatibility**: Ensuring functionality across devices
- **False Positives**: Minimizing incorrect suspicious activity flags

## Solutions Implemented

### AI-Driven Monitoring
- **Computer Vision Models**: Custom-trained models for face detection and activity analysis
- **Audio Processing**: Voice feature extraction and comparison algorithms
- **Anomaly Detection**: Machine learning classifiers for identifying unusual behavior
- **Real-time Analytics**: Continuous processing with minimal latency

### Architecture Solutions
- **Microservices Design**: Separated AI/ML, backend, and frontend components
- **Scalable Infrastructure**: Node.js backend with MongoDB for data handling
- **WebRTC Integration**: Peer-to-peer communication for efficient media streaming
- **Responsive Design**: Cross-device compatibility with modern web technologies

### Security Measures
- **Encrypted Communication**: Secure data transmission protocols
- **Session Management**: Robust authentication and authorization
- **Data Privacy**: Compliance with privacy standards and regulations

## Technology Stack

### Backend
- **Node.js** with Express.js framework
- **MongoDB** with Mongoose ODM
- **Socket.io** for real-time communication
- **Passport.js** for authentication
- **Multer** for file uploads
- **Google Cloud Speech-to-Text** API

### Frontend
- **EJS** templating engine
- **Vanilla JavaScript** for client-side logic
- **CSS3** with responsive design
- **WebRTC** for media streaming

### AI/ML Components
- **Python** with TensorFlow and scikit-learn
- **OpenCV** and MediaPipe for computer vision
- **Librosa** for audio processing
- **NumPy** and Pandas for data manipulation

### Infrastructure
- **Vercel** for deployment
- **Cloudinary** for media storage
- **MongoDB Atlas** for database hosting

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- Python (v3.8 or higher)
- MongoDB
- FFmpeg (for audio processing)

### Backend Setup
```bash
cd backend
npm install
# Configure environment variables in .env
npm start
```

### AI/ML Setup
```bash
cd ai-ml
pip install -r requirements.txt
python main.py <video_path> <audio_path> <student_id> <output_path>
```

### Frontend Setup
The frontend is served by the backend Express server and doesn't require separate setup.

## Usage

### For Examiners
1. Register/Login to the Examiner Portal
2. Create exams with questions and settings
3. Schedule exams and share links with students
4. Monitor live sessions and view analytics

### For Examinees
1. Register/Login to the Examinee Portal
2. Join scheduled exams via provided links
3. Complete exams in the secure environment
4. View results and feedback

### For Parents
1. Register/Login to the Parent Portal
2. Link to child's account
3. Monitor exam performance and integrity reports

## API Documentation

### Authentication Routes
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `GET /auth/logout` - User logout

### Exam Routes
- `GET /exams` - List all exams
- `POST /exams` - Create new exam
- `GET /exams/:id` - Get exam details
- `PUT /exams/:id` - Update exam
- `DELETE /exams/:id` - Delete exam

### AI Chat Routes
- `POST /ai/chat` - Interact with AI assistant

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

- **Project Team**: TEAM SOCCA
- **Email**: [contact@example.com](mailto:contact@example.com)
- **GitHub**: [https://github.com/team-socca/examguard](https://github.com/team-socca/examguard)

## Acknowledgments

- MediaPipe for computer vision capabilities
- TensorFlow for machine learning framework
- OpenCV for image processing
- All contributors and the open-source community

---

**ExamGuard** - Ensuring exam integrity through AI-powered proctoring.
