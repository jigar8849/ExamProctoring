const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    emailId: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    accessType: {
      type: String,
      enum: ["admin", "examiner", "examinee", "parent"],
      default: "examinee",
    },
    universityId: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      default: "",
      maxlength: 500,
    },
    age: {
      type: Number,
      min: 10,
      max: 100,
    },
    mobileNumber: {
      type: String,
      match: [/^\d{10,15}$/, "Invalid mobile number"],
      trim: true,
    },
    photoUrl: {
      type: String,
      validate: {
        validator: function (url) {
          return !url || /^https?:\/\/.+\..+$/.test(url);
        },
        message: "Invalid photo URL format",
      },
    },
    dateOfJoining: {
      type: Date,
      default: Date.now,
    },
    examHistory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ExamSubmission",
      },
    ],
    addedCourses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
    children: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

// Passport plugin for authentication using email instead of username
UserSchema.plugin(passportLocalMongoose, { usernameField: "emailId" });

// Ensure photo URL is valid before saving
UserSchema.pre("save", function (next) {
  if (this.photoUrl && !/^https?:\/\/.+\..+$/.test(this.photoUrl)) {
    return next(new Error("Invalid photo URL format"));
  }
  next();
});

// Normalize email before saving
UserSchema.pre("save", function (next) {
  if (this.emailId) {
    this.emailId = this.emailId.toLowerCase().trim();
  }
  next();
});

module.exports = mongoose.model("User", UserSchema);
