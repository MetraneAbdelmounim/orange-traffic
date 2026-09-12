const express = require('express');
const settingsController = require('./settingsController');
const { authenticate, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get('', settingsController.getSettings);
router.put('', settingsController.updateSettings);

module.exports = router;
