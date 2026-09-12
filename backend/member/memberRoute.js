const express = require('express');
const memberController = require('./memberController');
const { authenticate, requireAdmin, requireSelfOrAdmin } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate);

router.post('', requireAdmin, memberController.addMember);
router.get('', requireAdmin, memberController.getAllMembers);
router.delete('/:idMember', requireAdmin, memberController.deleteMember);
router.put('/:idMember', requireAdmin, memberController.updateMember);

// A member may only change their own password; admins may reset any.
router.put('/password/:idMember', requireSelfOrAdmin(), memberController.changePassword);

module.exports = router;
