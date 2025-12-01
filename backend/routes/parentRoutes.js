const express = require("express");
const router = express.Router();
const ensureAuthenticated = require("../middlewares/authMiddleware");
const Exam = require("../models/Exam");
const User = require("../models/User");
const Course = require("../models/Courses");
const ExaminerStats = require("../models/ExaminerStats");
const ExamSubmission = require("../models/ExamSubmission");
const mongoose = require("mongoose");
const axios = require("axios");

router.get("/parent/dashboard", async (req, res) => {
  try {
    const parent = await User.findById(req.user._id)
      .populate({
        path: "children",
        populate: {
          path: "examHistory",
          model: "ExamSubmission",
          populate: {
            path: "examId",
            model: "Exam",
            select: "examName subject duration passingMarks totalMarks questions",
          },
          options: { sort: { submissionTime: -1 } },
        },
      })
      .lean(); 

    if (!parent) {
      req.flash("error", "Parent not found.");
      return res.redirect("/");
    }

    res.render("users/parent/dashboard", { user: parent });
  } catch (err) {
    console.error(`Error loading parent dashboard: ${err.message}`);
    req.flash("error", "Unable to load dashboard.");
    res.redirect("/");
  }
});

  

module.exports = router;
