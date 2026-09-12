const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('./authController');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

// Blunt but effective brake on credential stuffing against a small user base.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' },
});

router.post('/signin', loginLimiter, authController.login);
router.get('/me', authenticate, authController.getCurrentMember);
router.put('/logout', authenticate, authController.logoutMember);

module.exports = router;
