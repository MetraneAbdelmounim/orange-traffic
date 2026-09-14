const express = require('express');
const memberController = require('./memberController');
const { authenticate, requireAdmin, requireSelfOrAdmin, requirePasswordChanged } = require('../middlewares/auth');
const licenceGuard = require('../middlewares/licenceGuard');

const router = express.Router();

router.use(licenceGuard, authenticate);

// requirePasswordChanged is applied per-route rather than with router.use()
// so that the one route below it deliberately does NOT gate — a member with
// a forced password change still has to reach this endpoint to escape that
// state at all.
router.post('', requireAdmin, requirePasswordChanged, memberController.addMember);
router.get('', requireAdmin, requirePasswordChanged, memberController.getAllMembers);
router.delete('/:idMember', requireAdmin, requirePasswordChanged, memberController.deleteMember);
router.put('/:idMember', requireAdmin, requirePasswordChanged, memberController.updateMember);

// A member may only change their own password; admins may reset any. Never
// gated by requirePasswordChanged — this IS the way out of that state.
router.put('/password/:idMember', requireSelfOrAdmin(), memberController.changePassword);

module.exports = router;
