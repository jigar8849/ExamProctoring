const express = require("express");
const router = express.Router();
const ensureAuthenticated = require("../middlewares/authMiddleware");
const Exam = require("../models/Exam");
const User = require("../models/User");
const Course = require("../models/Courses");
const ExaminerStats = require("../models/ExaminerStats");
const ExamSubmission = require("../models/ExamSubmission");
const multerStorageCloudinary = require("multer-storage-cloudinary");
const multer = require("multer");
const { mediaStorage, cloudinary } = require("../config/cloud");
const upload = multer({
  storage: mediaStorage,
  limits: {
    fieldSize: 10 * 1024 * 1024, // 10MB text field limit
  },
});
const mongoose = require("mongoose");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");
const ffmpeg = require("fluent-ffmpeg");
const speech = require("@google-cloud/speech");



// Examiner Profile
router.get("/examiner/profile", ensureAuthenticated, (req, res) => {
  res.render("users/examiner/profile", { user: req.user });
});

// Examinee Profile
router.get("/examinee/profile", ensureAuthenticated, (req, res) => {
  console.log(req);
  res.render("users/examinee/profile", { user: req.user });
});

// Examiner home
router.get("/examiner", (req, res) => {
  res.render("users/examiner/home", { user: req.user });
});

// Examinee home
router.get("/examinee", (req, res) => {
  res.render("users/examinee/home", { user: req.user });
});

// Examiner Dashboard
router.get("/examiner/dashboard", ensureAuthenticated, async (req, res) => {
  console.log("Examiner dashboard route accessed. User:", req.user ? req.user.emailId : null, "Session ID:", req.sessionID);
  try {
    const user = await User.findById(req.user._id).populate("examHistory");

    const exams = await Exam.find({ creatorId: req.user._id });

    const examinerStats = await ExaminerStats.findOne({
      examinerId: req.user._id,
    }).populate({
      path: "exams.examId",
      model: "Exam",
    });

    const totalExams = examinerStats ? examinerStats.totalExams : exams.length;

    let totalStudents = 0;
    if (
      examinerStats &&
      examinerStats.exams &&
      examinerStats.exams.length > 0
    ) {
      totalStudents = examinerStats.exams.reduce(
        (sum, entry) => sum + entry.totalSubmissions,
        0
      );
    }

    let lastExamDate = "N/A";
    if (
      examinerStats &&
      examinerStats.exams &&
      examinerStats.exams.length > 0
    ) {
      const pastExams = examinerStats.exams.filter((entry) => {
        return (
          entry.examId &&
          entry.examId.scheduleDate &&
          new Date(entry.examId.scheduleDate) <= new Date()
        );
      });
      if (pastExams.length > 0) {
        let lastExam = pastExams.reduce((prev, curr) => {
          return new Date(prev.examId.scheduleDate) >
            new Date(curr.examId.scheduleDate)
            ? prev
            : curr;
        });
        lastExamDate = new Date(
          lastExam.examId.scheduleDate
        ).toLocaleDateString();
      }
    }

    const examIds = exams.map((exam) => exam._id);
    const submissions = await ExamSubmission.find({ examId: { $in: examIds } });
    let averageScore = 0;
    if (submissions.length > 0) {
      let totalPercentage = 0;
      submissions.forEach((sub) => {
        let correctCount = 0;
        sub.answers.forEach((answer) => {
          const submitted = answer.submittedAnswer
            ? answer.submittedAnswer.trim().toLowerCase()
            : "";
          const correct = answer.correctAnswer
            ? answer.correctAnswer.trim().toLowerCase()
            : "";
          if (submitted === correct) {
            correctCount++;
          }
        });
        const totalQuestions = sub.answers.length;
        const score =
          totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
        totalPercentage += score;
      });
      averageScore = Math.round(totalPercentage / submissions.length);
    }

    res.render("users/examiner/dashboard", {
      user,
      exams,
      examinerStats,
      totalExams,
      totalStudents,
      lastExamDate,
      averageScore,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "There was an error fetching your exams.");
    res.redirect("/examiner/dashboard");
  }
});

router.get(
  "/examiner/exams/:examId/report",
  ensureAuthenticated,
  async (req, res) => {
    if (!req.user) {
      req.flash("error", "You must be logged in to view this page.");
      return res.redirect("/login");
    }

    try {
      const exam = await Exam.findById(req.params.examId).populate("creatorId");

      if (!exam) {
        req.flash("error", "Exam not found.");
        return res.redirect("/examiner/dashboard");
      }

      if (exam.creatorId._id.toString() !== req.user._id.toString()) {
        req.flash("error", "You are not authorized to view this exam report.");
        return res.redirect("/examiner/dashboard");
      }

      const examinerStats = await ExaminerStats.findOne({
        examinerId: req.user._id,
      });
      let examEntry = null;

      if (
        examinerStats &&
        examinerStats.exams &&
        examinerStats.exams.length > 0
      ) {
        examEntry = examinerStats.exams.find(
          (entry) => entry.examId.toString() === req.params.examId.toString()
        );
      }

      res.render("users/examiner/report", { exam, examEntry, user: req.user });
    } catch (err) {
      console.error(err);
      req.flash("error", "There was an error fetching the exam report.");
      res.redirect("/examiner/dashboard");
    }
  }
);

router.get("/examinee/dashboard", ensureAuthenticated, async (req, res) => {
  console.log("Examinee dashboard route accessed. User:", req.user ? req.user.emailId : null, "Session ID:", req.sessionID);
  if (!req.user) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized. Please log in." });
  }

  try {
    const { examId } = req.query;
    let exam = null;
    let exams = [];

    if (examId) {
      exam = await Exam.findOne({ _id: examId }).populate(
        "creatorId",
        "username"
      );

      if (!exam) {
        return res.json({ success: false, message: "Exam not found." });
      }

      return res.json({
        success: true,
        exam: {
          name: exam.examName,
          instructor: exam.creatorId
            ? exam.creatorId.username
            : "Unknown Instructor",
          startTime: exam.scheduleTime,
          duration: exam.duration,
        },
      });
    }

    exams = await Exam.find().populate("creatorId", "username");

    const userWithHistory = await User.findById(req.user._id).populate({
      path: "examHistory",
      populate: {
        path: "examId",
        model: "Exam", 
      },
    });

    if (!userWithHistory.examHistory) {
      userWithHistory.examHistory = [];
    }

 
    const totalExamsAttempted = userWithHistory.examHistory.length;
    let lastAttemptDate = "N/A";
    let lastAttemptScore = "N/A";
    let bestPerformance = "N/A";

    if (totalExamsAttempted > 0) {
      const sortedSubmissions = userWithHistory.examHistory.sort(
        (a, b) => new Date(b.submissionTime) - new Date(a.submissionTime)
      );
      const latestSubmission = sortedSubmissions[0];
      lastAttemptDate = latestSubmission.submissionTime;

      let correctCount = 0;
      const totalQuestions = latestSubmission.answers
        ? latestSubmission.answers.length
        : 0;
      if (totalQuestions > 0) {
        latestSubmission.answers.forEach((answer) => {
          const submitted = answer.submittedAnswer
            ? answer.submittedAnswer.trim().toLowerCase()
            : "";
          const correct = answer.correctAnswer
            ? answer.correctAnswer.trim().toLowerCase()
            : "";
          if (submitted === correct) {
            correctCount++;
          }
        });
      }
      lastAttemptScore =
        totalQuestions > 0
          ? Math.round((correctCount / totalQuestions) * 100)
          : 0;

      let bestScore = 0;
      userWithHistory.examHistory.forEach((submission) => {
        let subCorrectCount = 0;
        const subTotal = submission.answers ? submission.answers.length : 0;
        if (subTotal > 0) {
          submission.answers.forEach((answer) => {
            const subSubmitted = answer.submittedAnswer
              ? answer.submittedAnswer.trim().toLowerCase()
              : "";
            const subCorrect = answer.correctAnswer
              ? answer.correctAnswer.trim().toLowerCase()
              : "";
            if (subSubmitted === subCorrect) {
              subCorrectCount++;
            }
          });
        }
        const subScore =
          subTotal > 0 ? Math.round((subCorrectCount / subTotal) * 100) : 0;
        if (subScore > bestScore) {
          bestScore = subScore;
        }
      });
      bestPerformance = bestScore;
    }

    res.render("users/examinee/dashboard", {
      user: userWithHistory,
      exams,
      exam: null,
      stats: {
        totalExamsAttempted,
        lastAttemptDate,
        lastAttemptScore,
        bestPerformance,
      },
    });
  } catch (err) {
    console.error("Error in dashboard route:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

router.get(
  "/examinee/exams/:examId/analysis/:submissionId",
  ensureAuthenticated,
  async (req, res) => {
    try {
      const { examId, submissionId } = req.params;

      const submission = await ExamSubmission.findById(submissionId)
        .populate({
          path: "examId",
          populate: {
            path: "creatorId",
            select: "username",
          },
        })
        .populate("userId", "username emailId photoUrl");

      if (!submission) {
        return res
          .status(404)
          .json({ success: false, message: "Submission not found" });
      }

      res.render("users/examinee/analysis", { submission });
    } catch (err) {
      console.error("Error in fetching analysis:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// Create Exam Page
router.get("/examiner/create-exam", ensureAuthenticated, (req, res) => {
  res.render("exams/new");
});

/// Handle Exam Creation
router.post("/examiner/create-exam", ensureAuthenticated, async (req, res) => {
  try {
    const {
      examName,
      duration,
      scheduleDate,
      scheduleTime,
      questions,
      description,
    } = req.body;

    if (!examName || !duration || !questions || questions.length === 0) {
      req.flash("error", "Exam Name, Duration, and Questions are required.");
      return res.redirect("/examiner/create-exam");
    }

    let examDate = null;
    if (scheduleDate) {
      examDate = new Date(scheduleDate);
      if (isNaN(examDate.getTime())) {
        req.flash("error", "Invalid date format.");
        return res.redirect("/examiner/create-exam");
      }
    }

    let examTime =
      scheduleTime && scheduleTime.trim() !== "" ? scheduleTime : null;

    const newExam = new Exam({
      creatorId: req.user._id, 
      examName,
      duration,
      scheduleDate: examDate, 
      scheduleTime: examTime, 
      description,
      questions: questions.map((q) => ({
        questionText: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer, 
      })),
    });

    await newExam.save();

    let stats = await ExaminerStats.findOne({ examinerId: req.user._id });
    if (!stats) {
      stats = new ExaminerStats({
        examinerId: req.user._id,
        totalExams: 0,
        exams: [],
      });
    }
    stats.totalExams += 1;
    stats.exams.push({
      examId: newExam._id,
      totalSubmissions: 0,
      examineeIds: [],
    });
    await stats.save();

    req.flash("success", "Exam created successfully!");
    res.redirect("/examiner/dashboard");
  } catch (err) {
    console.error(err.message);
    req.flash("error", "Server error. Please try again later.");
    res.redirect("/examiner/create-exam");
  }
});

// View Exam Details
router.get(
  "/examinee/exams/:examId/notice",
  ensureAuthenticated,
  (req, res) => {
    const { examId } = req.params; 

    const mockExam = {
      _id: examId,
    };

    res.render("exams/notice", { exam: mockExam });
  }
);

// Start Exam Route
router.get(
  "/examinee/exams/:examId/start",
  ensureAuthenticated,
  async (req, res) => {
    const { examId } = req.params;

    try {
      const exam = await Exam.findById(examId).populate("questions");
      if (!exam) {
        req.flash("error", "Exam not found.");
        return res.redirect("/examinee/dashboard", { currentUrl: req.originalUrl });
      }

      res.render("exams/start-exam", {
        currentUrl: req.originalUrl,
        page: "exam-start",
        exam: {
          _id: exam._id,
          examName: exam.examName,
          duration: exam.duration, // in minutes
          questions: exam.questions.map((question) => ({
            _id: question._id,
            text: question.questionText,
            options: question.options,
          })),
        },
      });
    } catch (err) {
      console.error(err);
      req.flash("error", "Error fetching exam details.");
      res.redirect("/examinee/dashboard");
    }
  }
);

router.get(
  "/examinee/exams/:examId/complete",
  ensureAuthenticated,
  async (req, res) => {
    try {
      const { examId } = req.params;
      const submission = await ExamSubmission.findOne({
        userId: req.user._id,
        examId,
      });

      if (!submission) {
        req.flash("error", "Submission not found.");
        return res.redirect("/examinee/dashboard");
      }

      const exam = await Exam.findById(examId);
      if (!exam) {
        req.flash("error", "Exam not found.");
        return res.redirect("/examinee/dashboard");
      }

      const correctCount = submission.answers.reduce((count, answer) => {
        const submitted = answer.submittedAnswer?.trim().toLowerCase();
        const correct = answer.correctAnswer?.trim().toLowerCase();
        return submitted === correct ? count + 1 : count;
      }, 0);

      const incorrectCount = submission.answers.length - correctCount;

      res.render("exams/complete.ejs", {
        user: req.user,
        submission: { correctCount, incorrectCount },
      });
    } catch (err) {
      console.error("Error fetching exam results:", err);
      req.flash("error", "An error occurred.");
      res.redirect("/examinee/dashboard");
    }
  }
);

// POST /examinee/exams/:examId/complete - handle exam submission and update stats
router.post(
  "/examinee/exams/:examId/complete",
  ensureAuthenticated,
  upload.fields([
  ]),
  async (req, res) => {
    const { examId } = req.params;

    try {
      const { answers, videoUrl, audioUrl, screenRecordingUrl } = req.body;
      console.log("📩 Submitted Answers:", answers);
      console.log("🌐 Cloudinary Video URL:", videoUrl);

      if (req.user.accessType !== "examinee") {
        req.flash("error", "Unauthorized access.");
        return res.redirect("/login");
      }

      const exam = await Exam.findById(examId).populate("questions");
      if (!exam) {
        req.flash("error", "Exam not found.");
        return res.redirect("/examinee/dashboard");
      }

      // Format answers for each question in the exam
      const formattedAnswers = exam.questions.map((question, index) => ({
        questionId: question._id,
        questionText: question.questionText,
        submittedAnswer: answers[index] || null,
        correctAnswer: question.options[question.correctAnswer],
      }));

      // Video, Audio, and Screen Recording URLs
      const videoPath = videoUrl || null;
      const audioPath = audioUrl || null;
      const screenRecordingPath = screenRecordingUrl || null;

      if (!videoPath) {
        console.error("❌ Video URL not provided.");
        req.flash("error", "Video URL is required.");
        return res.redirect(`/examinee/exams/${examId}/complete`);
      }

      const newSubmission = new ExamSubmission({
        userId: req.user._id,
        examId,
        answers: formattedAnswers,
        submissionTime: Date.now(),
        videoPath,
        audioPath,
        screenRecordingPath,
      });

      await newSubmission.save();

      const examineeUser = await User.findById(req.user._id);
      examineeUser.examHistory.push(newSubmission._id);
      await examineeUser.save();

      
      const stats = await ExaminerStats.findOne({ examinerId: exam.creatorId });
      if (stats) {
        const examEntry = stats.exams.find(
          (e) => e.examId.toString() === examId.toString()
        );
        if (examEntry) {
          examEntry.totalSubmissions += 1;
          if (!examEntry.examineeIds.includes(req.user._id)) {
            examEntry.examineeIds.push(req.user._id);
          }
        }
        await stats.save();
      }

      console.log("✅ Submission Saved:", newSubmission);
      res.redirect(`/examinee/exams/${examId}/complete`);
    } catch (err) {
      console.error("❌ Error completing exam:", err);
      req.flash("error", "An error occurred during submission.");
      res.redirect("/examinee/dashboard");
    }
  }
);

// create new Course page
router.get("/examiner/create-course", ensureAuthenticated, (req, res) => {
  res.render("users/courses/new");
});

// Create new Course post request
router.post(
  "/examiner/create-course",
  ensureAuthenticated,
  async (req, res) => {
    try {
      console.log(req.body);
      const { courseName, courseDescription, subjects } = req.body;

      if (!courseName || !courseDescription || !subjects) {
        req.flash(
          "error",
          "Course Name, Description, and at least one subject are required."
        );
        return res.redirect("/examiner/create-course");
      }

      const parsedSubjects = JSON.parse(subjects).map((subject) => ({
        subjectName: subject.subjectName,
        subjectId: new mongoose.Types.ObjectId(),
        chapters: subject.chapters.map((chapter) => ({
          chapterNumber: chapter.chapterNumber,
          chapterName: chapter.chapterName,
          chapterId: new mongoose.Types.ObjectId(),
        })),
      }));

      const newCourse = new Course({
        creatorId: req.user._id,
        courseName,
        courseDescription,
        subjects: parsedSubjects,
      });

      await newCourse.save();

      req.flash("success", "Course created successfully!");
      res.redirect("/examiner/dashboard");
    } catch (err) {
      console.error(err.message);
      req.flash("error", "Server error. Please try again later.");
      res.redirect("/examiner/create-course");
    }
  }
);

// Course dashboard
router.get("/examiner/courses", ensureAuthenticated, async (req, res) => {
  try {
    const courses = await Course.find({ creatorId: req.user._id });

    res.render("users/courses/dashboard", { courses });
  } catch (err) {
    console.error(err);
    req.flash("error", "Error fetching courses.");
    res.redirect("/examiner/dashboard");
  }
});

// View Course Details
router.get(
  "/examiner/courses/:courseId",
  ensureAuthenticated,
  async (req, res) => {
    try {
      const course = await Course.findById(req.params.courseId);
      res.render("users/courses/view", { course });
    } catch (err) {
      console.error(err);
      req.flash("error", "Error fetching course details.");
      res.redirect("/examiner/courses");
    }
  }
);

// Get chapter record page
router.get(
  "/examiner/:courseId/:subjectId/:chapterId/record",
  ensureAuthenticated,
  async (req, res) => {
    res.render("users/courses/record", { currentUrl: req.originalUrl });
  }
);

router.post(
  "/examiner/:courseId/:subjectId/:chapterId/record",
  ensureAuthenticated,
  upload.single("video"), 
  async (req, res) => {
    try {
      if (!req.file) {
        req.flash("error", "No video file was uploaded.");
        console.log("No file uploaded");
        return res.redirect("/courses/dashboard");
      }

      const videoUrl = req.file.path;
      console.log("Video uploaded to Cloudinary. URL:", videoUrl);

      const { courseId, subjectId, chapterId } = req.params;
      console.log(
        "Course ID:",
        courseId,
        "Subject ID:",
        subjectId,
        "Chapter ID:",
        chapterId
      );

      // Fetch the course from the database
      const course = await Course.findById(courseId);
      if (!course) {
        console.error(`Course with ID ${courseId} not found.`);
        req.flash("error", "Course not found.");
        return res.redirect("/examiner/courses");
      }
      console.log("Course found:", course);

    
      const subject = course.subjects.find((sub) => {
        return (
          (sub.subjectId && sub.subjectId.toString() === subjectId) ||
          (sub._id && sub._id.toString() === subjectId)
        );
      });
      if (!subject) {
        console.error(
          `Subject with ID ${subjectId} not found in course ${courseId}.`
        );
        req.flash("error", "Subject not found.");
        return res.redirect("/examiner/courses");
      }
      console.log("Subject found:", subject);


      const chapter = subject.chapters.find((chap) => {
        return (
          (chap.chapterId && chap.chapterId.toString() === chapterId) ||
          (chap._id && chap._id.toString() === chapterId)
        );
      });
      if (!chapter) {
        console.error(
          `Chapter with ID ${chapterId} not found in subject ${subjectId}.`
        );
        req.flash("error", "Chapter not found.");
        return res.redirect("/examiner/courses");
      }
      console.log("Chapter found:", chapter);

      chapter.screenRecordingLink = videoUrl;
      await course.save();
      console.log("Chapter updated with video URL:", videoUrl);

      req.flash("success", "Video uploaded and saved successfully.");
      return res.redirect("/examiner/courses");
    } catch (error) {
      console.error("Upload error:", error);
      req.flash("error", "There was an error uploading your video.");
      return res.redirect("/examiner/courses");
    }
  }
);

router.get('/examiner/:courseId/:subjectId/:chapterId/live', (req, res) => {
  const { courseId, subjectId, chapterId } = req.params;
  res.render('room', { 
    roomId: chapterId, 
    courseId, 
    subjectId, 
    chapterId, 
    currentUrl: req.originalUrl,
    role: 'examiner'
  });
});


router.get('/examinee/:courseId/:subjectId/:chapterId/live', (req, res) => {
  const { courseId, subjectId, chapterId } = req.params;
  res.render('room', { roomId: chapterId, courseId, subjectId, chapterId, role: 'examinee',  currentUrl: req.originalUrl,
  });
});

module.exports = router;


async function transcribeAudioFromVideoUrl(videoUrl) {
  const videoPath = path.join(os.tmpdir(), "temp_video.webm");
  const audioPath = path.join(os.tmpdir(), "temp_audio.flac");

  // Download video from Cloudinary
  const response = await axios({
    method: "GET",
    url: videoUrl,
    responseType: "stream",
  });
  const videoWriter = fs.createWriteStream(videoPath);
  response.data.pipe(videoWriter);
  await new Promise((resolve, reject) => {
    videoWriter.on("finish", resolve);
    videoWriter.on("error", reject);
  });

  await new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec("flac")
      .audioFrequency(44100) // adjust if needed
      .save(audioPath)
      .on("end", resolve)
      .on("error", reject);
  });

  const audioBytes = fs.readFileSync(audioPath).toString("base64");

  const client = new speech.SpeechClient();
  const request = {
    audio: { content: audioBytes },
    config: {
      encoding: "FLAC",
      sampleRateHertz: 44100,
      languageCode: "en-US",
    },
  };

  const [response2] = await client.recognize(request);
  const transcript = response2.results
    .map((result) => result.alternatives[0].transcript)
    .join("\n");

  fs.unlinkSync(videoPath);
  fs.unlinkSync(audioPath);

  return transcript;
}

router.post("/cloudinary/webhook", async (req, res) => {
  try {
    const payload = req.body;

    const videoUrl = payload.secure_url;
    const publicId = payload.public_id; 


    const course = await Course.findOne({
      "subjects.chapters.screenRecordingLink": videoUrl,
    });
    if (course) {
      for (let subject of course.subjects) {
        for (let chapter of subject.chapters) {
          if (chapter.screenRecordingLink === videoUrl && !chapter.transcript) {
            console.log(
              "Starting transcription for chapter:",
              chapter.chapterName
            );
            const transcript = await transcribeAudioFromVideoUrl(videoUrl);
            chapter.transcript = transcript;
            await course.save();
            console.log("Transcription complete and saved.");
            break;
          }
        }
      }
    }

    res.status(200).send("Webhook received.");
  } catch (error) {
    console.error("Error processing Cloudinary webhook:", error);
    res.status(500).send("Error processing webhook");
  }
});

router.get("/viewclass/:courseId/:subjectId/:chapterId", async (req, res) => {
  try {
    const { courseId, subjectId, chapterId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) {
      req.flash("error", "Course not found.");
      return res.redirect("/courses/dashboard");
    }

    const subject = course.subjects.find((sub) => {
      return (
        (sub.subjectId && sub.subjectId.toString() === subjectId) ||
        (sub._id && sub._id.toString() === subjectId)
      );
    });
    if (!subject) {
      req.flash("error", "Subject not found.");
      return res.redirect("/courses/dashboard");
    }

    const chapter = subject.chapters.find((chap) => {
      return (
        (chap.chapterId && chap.chapterId.toString() === chapterId) ||
        (chap._id && chap._id.toString() === chapterId)
      );
    });
    if (!chapter) {
      req.flash("error", "Chapter not found.");
      return res.redirect("/courses/dashboard");
    }

    let transcript = chapter.transcript || null;

    if (chapter.screenRecordingLink && !transcript) {
      try {
        transcript = await transcribeAudioFromVideoUrl(
          chapter.screenRecordingLink
        );
        chapter.transcript = transcript;
        await course.save();
      } catch (transcribeError) {
        console.error("Error during transcription:", transcribeError);
      }
    }

    res.render("users/courses/viewclass", {
      course,
      subject,
      chapter,
      transcript,
    });
  } catch (error) {
    console.error("Error in /viewclass route:", error);
    req.flash("error", "An error occurred.");
    return res.redirect("/courses/dashboard");
  }
});

router.get("/examinee/courses", async (req, res) => {
  try {
    const searchQuery = req.query.search || ""; 
    let courses;

    const userId = req.user._id;

    const user = await User.findById(userId).populate("addedCourses");

    if (searchQuery) {
      courses = await Course.find({
        $or: [
          { courseName: { $regex: searchQuery, $options: "i" } },
          { courseDescription: { $regex: searchQuery, $options: "i" } },
        ],
      }).populate("subjects.chapters"); // Populate nested data if needed
    } else {
      courses = user.addedCourses;
    }

    res.render("users/examinee/courses", {
      courses,
      searchQuery,
      flash: req.flash(),
      user: req.user,          
      addedCourses: user.addedCourses 
    });
  } catch (error) {
    console.error("Error in /examinee/courses route:", error);
    req.flash("error", "An error occurred while searching for courses.");
    return res.redirect("/examinee/dashboard");
  }
});

router.post('/examinee/courses/add', async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user._id;

    await User.findByIdAndUpdate(userId, {
      $addToSet: { addedCourses: courseId } 
    });

    // Redirect back to the courses page with a success message
    req.flash('success', 'Course added successfully!');
    res.redirect('/examinee/courses');
  } catch (error) {
    console.error("Error adding course:", error);
    req.flash('error', 'Failed to add course.');
    res.redirect('/examinee/courses');
  }
});

// Route to show course details
router.get('/examinee/course/:id', async (req, res) => {
  try {
    const courseId = req.params.id;
    const course = await Course.findById(courseId).populate('subjects.chapters');

    if (!course) {
      req.flash('error', 'Course not found.');
      return res.redirect('/examinee/courses');
    }

    res.render('users/examinee/viewCourse', { course });
  } catch (error) {
    console.error('Error fetching course details:', error);
    req.flash('error', 'An error occurred while fetching course details.');
    res.redirect('/examinee/courses');
  }
});

module.exports = router;
