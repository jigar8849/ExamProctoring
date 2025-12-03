const LocalStrategy = require("passport-local").Strategy;
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

          // Use passport-local-mongoose authenticate method for consistency
          user.authenticate(password, (err, authenticatedUser, passwordErr) => {
            if (err) {
              console.error("Authentication error:", err);
              return done(err);
            }
            if (passwordErr) {
              console.log("Password error:", passwordErr.message);
              return done(null, false, { message: passwordErr.message });
            }
            if (!authenticatedUser) {
              console.log("Authentication failed for user:", emailId);
              return done(null, false, { message: "Incorrect password" });
            }
            console.log("Authentication successful for user:", emailId);
            return done(null, authenticatedUser);
          });
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
