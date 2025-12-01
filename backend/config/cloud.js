const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// Dynamic Storage Based on File Type
const multiStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    if (file.fieldname === "image") {
      return {
        folder: "ExamGuard/Images",
        allowed_formats: ["jpg", "jpeg", "png"],
      };
    } else if (file.fieldname === "pdf") {
      return {
        folder: "ExamGuard/PDFs",
        allowed_formats: ["pdf"],
        resource_type: "raw",
        public_id: `pdf_${Date.now()}`,
      };
    } else if (file.fieldname === "media") {
      return {
        folder: "ExamGuard/Media",
        allowed_formats: ["mp4", "webm", "ogg", "mp3", "wav"],
        resource_type: "auto",
        public_id: `screen_recording_${Date.now()}`,
      };
    } else {
      return { folder: "ExamGuard/Other" };
    }
  },
});

// Image Storage for profile photos
const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "user_profiles",
    allowed_formats: ["jpg", "jpeg", "png"],
    transformation: { width: 500, height: 500, crop: "fill" },
  },
});

// Media Storage for videos and recordings
const mediaStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "ExamGuard/Media",
    allowed_formats: ["mp4", "webm", "ogg", "mp3", "wav"],
    resource_type: "auto",
  },
});

// Multer Upload Config (MAIN FIX 🔥)
const upload = multer({
  storage: multiStorage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB for videos
    fieldSize: 10 * 1024 * 1024, // 10MB text field limit
  },
});

// Multiple Field Upload Handling
const fileUpload = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "pdf", maxCount: 1 },
  { name: "media", maxCount: 1 },
]);

module.exports = {
  cloudinary,
  upload: fileUpload
};
