const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const User = require("../models/User");

module.exports = function (passport) {
  console.log("Passport configuration loaded");
  passport.use(
    new LocalStrategy(
      { usernameField: "emailId" },
      async (emailId, password, done) => {
        console.log("LocalStrategy authenticate called for email:", emailId);
        try {
          if (!emailId || !password) {
            console.log("Missing credentials: emailId or password not provided");
            return done(null, false, { message: "Missing credentials" });
          }

          const user = await User.findOne({ emailId });
          console.log("User lookup result:", user ? "found" : "not found");
          if (!user) {
            console.log("No user found with email:", emailId);
            return done(null, false, { message: "No user with that email" });
          }

          if (!user.password) {
            console.log("User password not set for email:", emailId);
            return done(null, false, { message: "Incorrect password" });
          }

          const isMatch = await bcrypt.compare(password, user.password);
          console.log("Password match result:", isMatch);
          if (!isMatch) {
            console.log("Password mismatch for user:", emailId);
            return done(null, false, { message: "Incorrect password" });
          }

          console.log("Authentication successful for user:", emailId);
          return done(null, user);
        } catch (err) {
          console.error("Error in LocalStrategy:", err);
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
};
