const express = require('express');
const router = express.Router();
const ensureAuthenticated = require("../middlewares/authMiddleware");
const multer = require('multer');
const { multiStorage } = require("../config/cloud");
const CommunityPost = require('../models/CommunityPost');

const upload = multer({
  storage: multiStorage,
  limits: {
    fieldSize: 10 * 1024 * 1024, // 10MB text field limit
  },
}).fields([
  { name: "image", maxCount: 1 },
  { name: "pdf", maxCount: 1 },
]);


router.get('/community', ensureAuthenticated, async (req, res) => {
  try {
    const posts = await CommunityPost.find({})
      .sort({ createdAt: -1 })
      .populate('createdBy');
    res.render('users/community/community', { user: req.user, posts });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to load community posts.');
    res.redirect('/');
  }
});

router.get('/community/new', ensureAuthenticated, (req, res) => {
  res.render('users/community/new', { user: req.user });
});

router.post('/community/new', ensureAuthenticated, (req, res) => {
  // Use the upload middleware to process both "image" and "pdf" fields
  upload(req, res, async (err) => {
    if (err) {
      console.error('File Upload Error:', err);
      req.flash('error', 'Error uploading files.');
      return res.redirect('/community/new');
    }
    try {
      const { content } = req.body;
      let attachments = {};

      if (req.files && req.files.image && req.files.image[0]) {
        attachments.image = req.files.image[0].path; 
      }
      // Check if a PDF was uploaded
      if (req.files && req.files.pdf && req.files.pdf[0]) {
        attachments.pdf = req.files.pdf[0].path;
      }

      // Create a new community post
      const newPost = new CommunityPost({
        content,
        attachments,
        createdBy: req.user._id,
      });

      await newPost.save();
      req.flash('success', 'Post created successfully.');
      res.redirect('/community');
    } catch (error) {
      console.error(error);
      req.flash('error', 'Error creating post.');
      res.redirect('/community/new');
    }
  });
});

router.get('/community/:id', ensureAuthenticated, async (req, res) => {
  try {
    const post = await CommunityPost.findById(req.params.id)
      .populate('createdBy')
      .populate('comments.user');
    if (!post) {
      req.flash('error', 'Post not found.');
      return res.redirect('/community');
    }
    res.render('users/community/view', { user: req.user, post });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading post.');
    res.redirect('/community');
  }
});

router.post('/community/:id/comment', ensureAuthenticated, async (req, res) => {
  try {
    const { comment } = req.body;
    const post = await CommunityPost.findById(req.params.id);
    if (!post) {
      req.flash('error', 'Post not found.');
      return res.redirect('/community');
    }
    post.comments.push({
      user: req.user._id,
      comment,
    });
    await post.save();
    req.flash('success', 'Comment added.');
    res.redirect(`/community/${req.params.id}`);
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error adding comment.');
    res.redirect(`/community/${req.params.id}`);
  }
});

router.post('/community/:id/like', ensureAuthenticated, async (req, res) => {
  try {
    const post = await CommunityPost.findById(req.params.id);
    if (!post) {
      req.flash('error', 'Post not found.');
      return res.redirect('/community');
    }
    const index = post.likes.indexOf(req.user._id);
    if (index === -1) {
      post.likes.push(req.user._id);
    } else {
      post.likes.splice(index, 1);
    }
    await post.save();
    res.redirect(`/community/${req.params.id}`);
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error processing like.');
    res.redirect('/community');
  }
});

module.exports = router;
