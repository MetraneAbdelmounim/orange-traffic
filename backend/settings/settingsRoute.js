const express = require('express');
const rateLimit = require('express-rate-limit');
const settingsController = require('./settingsController');
const { authenticate, requireAdmin } = require('../middlewares/auth');
const licenceGuard = require('../middlewares/licenceGuard');

const router = express.Router();

router.use(licenceGuard, authenticate, requireAdmin);

// Each call opens a real outbound SMTP connection — worth throttling
// separately from the general /api rate limiter.
const testMailLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tests SMTP. Réessayez dans quelques minutes.' },
});

router.get('', settingsController.getSettings);
router.put('', settingsController.updateSettings);
router.post('/test-mail', testMailLimiter, settingsController.testMail);

module.exports = router;
