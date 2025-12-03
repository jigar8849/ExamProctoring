// Import necessary modules
const express = require("express");
const router = express.Router();
const passport = require("passport");
const User = require("../models/User");
const multer = require("multer");
const { cloudinary , imageStorage } = require("../config/cloud");
const upload = multer({
  storage: imageStorage,
  limits: {
    fieldSize: 50 * 1024 * 1024, // 50MB text field limit for base64 images
  },
});
const Exam = require("../models/Exam");

// Render signup page
router.get("/signup", (req, res) => {
  res.render("users/signup");
});
router.post("/signup", upload.single("photo"), async (req, res) => {
  console.log("Received form data:", req.body);
  console.log("Received file:", req.file);

  const { 
    email, 
    username, 
    password, 
    confirmPassword, 
    accessType, 
    age, 
    mobileNumber, 
    universityId, 
    bio, 
    childrenIds 
  } = req.body;
  
  // Ensure required fields are provided
  if (!email || !username || !password || !confirmPassword || !accessType) {
    req.flash("error", "All required fields must be provided.");
    return res.redirect("/auth/signup");
  }

  if (password !== confirmPassword) {
    req.flash("error", "Passwords do not match.");
    return res.redirect("/auth/signup");
  }

  // Determine if we have a file or a base64 string for the profile photo
  let photoUrl;
  try {
    if (req.file) {
      // Examiner (or any user uploading a file) path – file was uploaded via CloudinaryStorage
      photoUrl = req.file.path; // CloudinaryStorage sets req.file.path to the secure_url
    } else if (req.body.photo) {
      // Examinee path – photo is a base64 data URL in req.body.photo
      const uploadResult = await cloudinary.uploader.upload(req.body.photo, {
        folder: "user_profiles",
        transformation: { width: 500, height: 500, crop: "fill" },
      });
      photoUrl = uploadResult.secure_url;
    } else if (accessType === "parent") {
      // For parents, if no photo is provided, use a default profile photo URL.
      photoUrl = "https://res.cloudinary.com/<your_cloud_name>/image/upload/v1234567890/default_parent_photo.png";
    } else {
      req.flash("error", "Profile photo is required.");
      return res.redirect("/auth/signup");
    }
  } catch (uploadError) {
    console.error("Cloudinary upload error:", uploadError);
    req.flash("error", "There was a problem uploading your photo.");
    return res.redirect("/auth/signup");
  }

  // Prepare user data based on access type
  let newUserData = {
    emailId: email,
    username,
    accessType,
    bio: bio || "----------",
    age: age,
    mobileNumber: mobileNumber,
    photoUrl,
    dateOfJoining: new Date(),
  };

  if (accessType === "examiner" || accessType === "examinee") {
    newUserData.universityId = universityId;
  } else if (accessType === "parent") {
    // Convert comma separated children IDs into an array
    let children = [];
    if (childrenIds) {
      children = childrenIds.split(",").map(id => id.trim()).filter(id => id.length > 0);
    }
    newUserData.children = children;
  }

  // Create new user
  const newUser = new User(newUserData);

  // Register the user using passport-local-mongoose
  User.register(newUser, password, async (err, user) => {
    if (err) {
      console.error("Error during registration: ", err);
      if (err.code === 11000 && err.keyValue?.emailId) {
        req.flash("error", "Email is already registered.");
      } else {
        req.flash("error", "Something went wrong during registration.");
      }
      return res.redirect("/auth/signup");
    }

    req.login(user, (err) => {
      if (err) {
        console.error("Error during login: ", err);
        req.flash("error", "Something went wrong during login.");
        return res.redirect("/auth/signup");
      }

      req.flash("success", `Welcome to TheSecureExam, ${username}!`);

      if (accessType === "examiner") {
        return res.redirect("/examiner/dashboard");
      } else if (accessType === "examinee") {
        return res.redirect("/examinee/dashboard");
      } else if (accessType === "parent") {
        return res.redirect("/parent/dashboard");
      }
      return res.redirect("/");
    });
  });
});

// Render login page
router.get("/login", (req, res) => {
  res.render("users/login");
});

// Handle user login
router.post("/login", (req, res, next) => {
  console.log("Login attempt received. Body:", req.body);
  console.log("Session ID:", req.sessionID);
  console.log("Is authenticated before login:", req.isAuthenticated());

  // Use passport's local strategy for authentication
  passport.authenticate("local", (err, user, info) => {
    console.log("Passport authenticate callback. Err:", err, "User:", user ? user.emailId : null, "Info:", info);

    // Handle authentication errors
    if (err) {
      console.error("Authentication error: ", err);
      req.flash("error", "Something went wrong during authentication.");
      return res.redirect("/auth/login");
    }

    // If no user is found, flash error and redirect back to login
    if (!user) {
      console.log("No user found. Info message:", info.message);
      req.flash("error", info.message || "Invalid username or password.");
      return res.redirect("/auth/login");
    }

    console.log("User found, attempting to log in. User ID:", user._id, "AccessType:", user.accessType);

    // Attempt to log in the user
    req.login(user, (loginErr) => {
      console.log("req.login callback. LoginErr:", loginErr);
      console.log("Is authenticated after login:", req.isAuthenticated());
      console.log("req.user after login:", req.user ? req.user.emailId : null);

      if (loginErr) {
        console.error("Error during login: ", loginErr);
        req.flash("error", "Something went wrong during login.");
        return res.redirect("/auth/login");
      }

      console.log("User successfully logged in: ", user.emailId, "AccessType:", user.accessType);

      // Redirect the user based on their accessType (role)
      if (user.accessType === "examiner") {
        console.log("Redirecting to examiner dashboard");
        return res.redirect("/examiner/dashboard");
      } else if (user.accessType === "examinee") {
        console.log("Redirecting to examinee dashboard");
        return res.redirect("/examinee/dashboard");
      } else if (user.accessType === "admin") {
        console.log("Redirecting to admin dashboard");
        return res.redirect("/admin/dashboard");
      } else if (user.accessType === "parent") {
        console.log("Redirecting to parent dashboard");
        return res.redirect("/parent/dashboard");
      }

      // If no accessType is defined, log error and redirect to homepage
      console.log("No valid accessType found, redirecting to home");
      req.flash("error", "Access type is undefined. Redirecting to home.");
      return res.redirect("/");
    });
  })(req, res, next);
});


// Logout Route
router.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.log("Error during logout: ", err);
      req.flash("error", "Something went wrong during logout.");
      return res.redirect("/");
    }
    req.flash("success", "Goodbye!");
    res.redirect("/");
  });
});

module.exports = router;
