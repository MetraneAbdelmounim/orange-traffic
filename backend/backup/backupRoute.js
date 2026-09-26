const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const backupController = require('./backupController');
const { authenticate, requireAdmin, requirePasswordChanged } = require('../middlewares/auth');
const licenceGuard = require('../middlewares/licenceGuard');

const router = express.Router();

router.use(licenceGuard, authenticate, requireAdmin, requirePasswordChanged);

// A full-fleet backup with months of history can be sizable — well above
// the small fixed uploads (a .otlic licence file, 64KB) elsewhere in this app.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

const restoreLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
});

router.get('', backupController.createBackup);
router.post('/restore', restoreLimiter, upload.single('backup'), backupController.restoreBackup);

module.exports = router;
