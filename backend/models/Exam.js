const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
    questionText: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: Number, required: true } 
});

// Define the Exam schema
const ExamSchema = new mongoose.Schema({
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    examName: { type: String, required: true },
    duration: { type: Number, required: true }, 
    scheduleDate: { type: Date  }, 
    scheduleTime: { type: String  },
    Description: { type: String }, 
    questions: [QuestionSchema],
    totalSubmissions: { type: Number, default: 0 }, 
    status: { type: String, enum: ['active', 'inactive'], default: 'active' } 
}, { timestamps: true });

module.exports = mongoose.model('Exam', ExamSchema);
