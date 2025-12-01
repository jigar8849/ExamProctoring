const express = require("express");
const router = express.Router();
const ensureAuthenticated = require("../middlewares/authMiddleware");
const { GoogleGenerativeAI } = require('@google/generative-ai');
const User = require("../models/User"); 

const genAI = new GoogleGenerativeAI("AIzaSyCaHT5AUOdo2ejsOrvbE2SN_WUYW0NsyFo");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

router.get("/examinee/chat", ensureAuthenticated, (req, res) => {
    res.render("users/AI/chatbot", { user: req.user });
});


router.post("/chat", async (req, res) => {
    try {
      const userMessage = req.body.message;
      const selectedLanguage = req.body.language || "en";
  
      const personalQueries = [
        "what is your name",
        "who are you",
        "your name",
        "tell me your name",
        "are you terzettoo ai"
      ];
  
      const languageMap = {
        en: "English",
        hi: "Hindi",
        gu: "Gujarati",
        mr: "Marathi",
        bho: "Bhojpuri",
        np: "Nepali"
      };
  
      let prompt;
      if (personalQueries.some(query => userMessage.toLowerCase().includes(query))) {
        prompt = `You are human friendly Terzettoo AI that is against the violance. Always start your response with "I am Terzettoo AI, how can I assist you today?" and answer in ${languageMap[selectedLanguage]}. \n\nUser: ${userMessage}\nTerzettoo AI:`;
      } else {
        prompt = `Please respond in ${languageMap[selectedLanguage]}:\nUser: ${userMessage}\nTerzettoo AI:`;
      }
  
      const result = await model.generateContent(prompt);
      res.json({ response: result.response.text() });
    } catch (error) {
      console.error("Error generating AI response:", error);
      res.json({ response: "I'm sorry, I couldn't process that request." });
    }
  });
  

module.exports = router;
