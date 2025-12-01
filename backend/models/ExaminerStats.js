// models/ExaminerStats.js
const mongoose = require("mongoose");

const ExaminerExamSchema = new mongoose.Schema({
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Exam",
    required: true
  },
  totalSubmissions: {
    type: Number,
    default: 0
  },
  examineeIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  ]
});

const ExaminerStatsSchema = new mongoose.Schema(
  {
    examinerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    totalExams: {
      type: Number,
      default: 0
    },
    exams: [ExaminerExamSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model("ExaminerStats", ExaminerStatsSchema);
