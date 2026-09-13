const express = require('express');
const rateLimit = require('express-rate-limit');
const setupController = require('./setupController');

const router = express.Router();

// The account-creation attempt only ever "wins" once (server re-checks
// isConfigured() itself); this just blunts scripted hammering of the endpoint
// before that first admin exists.
const createAdminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
});

router.get('/status', setupController.getStatus);
router.post('/admin', createAdminLimiter, setupController.createAdmin);

module.exports = router;
