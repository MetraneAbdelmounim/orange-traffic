const express = require('express');
const projectController = require('./projectController');
const { authenticate, requireAdmin, requireProjectAccess, requirePasswordChanged } = require('../middlewares/auth');
const licenceGuard = require('../middlewares/licenceGuard');

const router = express.Router();

router.use(licenceGuard, authenticate, requirePasswordChanged);

router.post('', requireAdmin, projectController.addProject);
router.get('', projectController.getAllProjects);
router.get('/:idProject', requireProjectAccess(), projectController.getProjectByID);
router.delete('/:idProject', requireAdmin, projectController.deleteProject);
router.put('/:idProject', requireAdmin, projectController.updateProject);

module.exports = router;
