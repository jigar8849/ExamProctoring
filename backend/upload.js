const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");

const router = express.Router();

// Ensure the 'data/videos' folder exists
const uploadDir = path.join(__dirname, "../data/videos");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Save files in 'data/videos'
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
  },
});

const upload = multer({ storage: storage });

// Handle File Upload and Conversion
router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const uploadedFilePath = req.file.path;
  const mp4FilePath = path.join(uploadDir, Date.now() + ".mp4");

  // Convert the video to MP4 using ffmpeg
  ffmpeg(uploadedFilePath)
    .output(mp4FilePath)
    .on("end", () => {
      console.log("Video conversion completed");

      // Optionally, delete the original uploaded file after conversion
      fs.unlinkSync(uploadedFilePath);

      res.send("File uploaded and converted to MP4 successfully.");
    })
    .on("error", (err) => {
      console.error("Error during video conversion", err);
      res.status(500).send("Error during video conversion.");
    })
    .run();
});

module.exports = router;
