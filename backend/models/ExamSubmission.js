const mongoose = require("mongoose");

const AnswerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  questionText: { type: String, required: true },
  submittedAnswer: { type: String, default: null },
  correctAnswer: { type: String }
});

const ExamSubmissionSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true 
    },
    examId: { 
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
      index: true 
    },
    answers: [AnswerSchema],
    submissionTime: { type: Date, default: Date.now },
    videoPath: { type: String, default: null },
    audioPath: { type: String, default: null },
    screenRecordingPath: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ExamSubmission", ExamSubmissionSchema);