// Import required modules
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("passport");
const flash = require("express-flash");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");
const LocalStrategy = require("passport-local");
const User = require("./models/User");
const uploadRouter = require("./upload");

dotenv.config();

if (!process.env.MONGO_URI) {
  throw new Error("MONGO_URI not set in environment variables");
}
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET not set in environment variables");
}

const authRoutes = require("./routes/authRoutes");
const examRoutes = require("./routes/examRoutes");
const aichatRoutes = require("./routes/aichatRoutes");
const communityRoutes = require("./routes/communityRoutes");
const parentRoutes = require("./routes/parentRoutes");

require("./models/Exam");
require("./models/User");

const app = express();
app.use(expressLayouts);

const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.set("layout", "./layouts/boilerplate");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "../frontend/public")));
app.use(uploadRouter);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../frontend/views"));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use(flash());

require("./config/passport")(passport);
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error");
  res.locals.currentUser = req.user || null;
  next();
});

app.locals.io = io;

// Routes
app.use("/auth", authRoutes);
app.use("/", examRoutes);
app.use("/", aichatRoutes);
app.use("/", communityRoutes);
app.use("/", parentRoutes);


app.use((err, req, res, next) => {
  console.error("Error Stack:", err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV !== "production" ? err : {}, 
  });
});

// MongoDB Atlas connection setup
async function connectToMongoDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB Atlas with Mongoose!");
  } catch (err) {
    console.error("Error connecting to MongoDB Atlas", err);
    process.exit(1); 
}
}

// Debugging middleware to log request details
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Default index route
app.get("/", (req, res) => {
  console.log("This is user detecting from home route", req.user);
  res.render("index.ejs", { page: "default-page" });
});

app.use((req, res, next) => {
  res.locals.currentUrl = req.originalUrl;
  next();
});

io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);

  socket.on('join-chapter', ({ chapterID, userID }) => {
    if (!chapterID) {
      console.error('No chapterID provided.');
      return;
    }
    socket.join(chapterID);

    console.log(`User ${userID} joined chapter ${chapterID}`);
    console.log(`Socket ${socket.id} rooms:`, Array.from(socket.rooms));

    socket.to(chapterID).emit('user-connected', { userID, socketId: socket.id });
  });

  socket.on('subtitle', (text) => {
    io.emit('subtitle', text);
});

  socket.on('stream-data', (data) => {
    const { chapterID } = data;
    if (!chapterID) return;
    socket.to(chapterID).emit('stream-data', data);
  });

  socket.on('drawing', (data) => {
    const { room } = data;
    if (!room) return;
    socket.to(room).emit('drawing', data);
  });

  socket.on('chat-message', (data) => {
    const { room } = data;
    if (!room) return;
    socket.to(room).emit('chat-message', data);
  });

  socket.on('text', (data) => {
    const { room } = data;
    if (!room) return;
    socket.to(room).emit('text', data);
  });
  
  socket.on('clear', (data) => {
    const { room } = data;
    if (!room) return;
    socket.to(room).emit('clear', data);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});



const mockUser = {
  name: "John Doe",
};

const mockExam = {
  title: "AI-ML Exam",
};

const mockSubmission = {
  submissionTime: new Date(),
  answers: [
    {
      questionText: "What is Machine Learning?",
      submittedAnswer:
        "A method of data analysis that automates analytical model building.",
      correctAnswer:
        "A method of data analysis that automates analytical model building.",
    },
    {
      questionText: "What is a neural network?",
      submittedAnswer: "",
      correctAnswer:
        "A series of algorithms that mimic the operations of a human brain.",
    },
  ],
};

app.get("/result", (req, res) => {
  const activityMetrics = require("../activity_report.json");
  console.log(activityMetrics);
  res.render("exams/result", {
    user: mockUser,
    exam: mockExam,
    submission: mockSubmission,
    activityMetrics,
  });
});

// Start the server
const PORT = 3000;
http.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await connectToMongoDB();
});



module.exports = app;