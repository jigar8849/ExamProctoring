const mongoose = require("mongoose");

const ExamAnalyticsSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },
    totalSubmissions: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    minScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ExamAnalytics", ExamAnalyticsSchema);
