const express = require('express');
const projectController = require('./projectController');
const { authenticate, requireAdmin, requireProjectAccess } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate);

router.post('', requireAdmin, projectController.addProject);
router.get('', projectController.getAllProjects);
router.get('/:idProject', requireProjectAccess(), projectController.getProjectByID);
router.delete('/:idProject', requireAdmin, projectController.deleteProject);
router.put('/:idProject', requireAdmin, projectController.updateProject);

module.exports = router;
