const mongoose = require('mongoose');

const chapterSchema = new mongoose.Schema({
  chapterNumber: {
    type: Number,
    required: true
  },
  chapterName: {
    type: String,
    required: true
  },
  chapterId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    unique: true,
    default: () => new mongoose.Types.ObjectId()  
  },
  screenRecordingLink: { 
    type: String, 
    required: false
  },
  transcript: { 
    type: String, 
    required: false 
  },
});

const subjectSchema = new mongoose.Schema({
  subjectName: {
    type: String,
    required: true
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    unique: true,
    default: () => new mongoose.Types.ObjectId()  
  },
  chapters: [chapterSchema]
});

const courseSchema = new mongoose.Schema({
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courseName: {
    type: String,
    required: true
  },
  courseDescription: {
    type: String,
    required: true
  },
  subjects: [subjectSchema],
  screenRecordingLink: {
    type: String,
    required: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Course', courseSchema);
