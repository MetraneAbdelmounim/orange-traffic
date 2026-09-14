const express = require('express');
const controllerController = require('./controllerController');
const { authenticate, requireAdmin, requireProjectAccess, requirePasswordChanged } = require('../middlewares/auth');
const licenceGuard = require('../middlewares/licenceGuard');

const router = express.Router();

router.use(licenceGuard, authenticate, requirePasswordChanged);

router.get('/ping', controllerController.getAllControllers);

router.post('', requireAdmin, controllerController.addController);

// The project must be one the caller belongs to; getAllControllers is scoped
// to the caller's own projects rather than returning every device.
router.get('', requireProjectAccess('project'), controllerController.getControllersByProject);
router.get('/projects/:idProject', requireProjectAccess(), controllerController.getControllersByProject);

router.get('/status/:ip', controllerController.getStatusController);
router.get('/history/:idController', controllerController.getHistoryByController);
router.get('/events/:idController', controllerController.getAlarmEventsByController);

router.post('/poll/:idController', controllerController.pollController);

router.put('/maintenance/:idController', requireAdmin, controllerController.setMaintenance);
router.put('/acknowledge/:idController', controllerController.setAcknowledgment);

router.delete('/:idController', requireAdmin, controllerController.deleteController);
router.put('/:idController', requireAdmin, controllerController.updateController);
router.get('/:idController', controllerController.getControllerById);

module.exports = router;
