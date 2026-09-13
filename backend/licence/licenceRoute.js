const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const licenceController = require('./licenceController');
const { authenticate, requireAdmin } = require('../middlewares/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 64 * 1024 } });

const installLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
});

// Deliberately NOT behind licenceGuard — an expired/missing license must
// still let an authenticated admin read the status and install a new one.
router.get('/status', authenticate, licenceController.getStatus);
router.post('/demo', authenticate, requireAdmin, licenceController.activateDemo);
router.post('/', authenticate, requireAdmin, installLimiter, upload.single('licence'), licenceController.install);

module.exports = router;
