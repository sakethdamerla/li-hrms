const express = require('express');
const router = express.Router();
const shiftController = require('./controllers/shiftController');
const shiftDurationController = require('./controllers/shiftDurationController');
const { protect, authorize } = require('../authentication/middleware/authMiddleware');

// All routes are protected
router.use(protect);

// Shift Duration routes
// Get allowed durations (for shift creation validation)
router.get('/durations', shiftController.getAllowedDurations);
// Get all shift durations with full details (for settings page)
router.get('/durations/all', shiftDurationController.getAllShiftDurations);
// CRUD operations for shift durations
router.post('/durations', authorize('super_admin', 'sub_admin'), shiftDurationController.createShiftDuration);
router.put('/durations/:id', authorize('super_admin', 'sub_admin'), shiftDurationController.updateShiftDuration);
router.delete('/durations/:id', authorize('super_admin', 'sub_admin'), shiftDurationController.deleteShiftDuration);

// Shift routes
router.get('/', shiftController.getAllShifts);
router.get('/:id', shiftController.getShift);
router.post('/', authorize('super_admin', 'sub_admin', 'hr'), shiftController.createShift);
router.put('/:id', authorize('super_admin', 'sub_admin', 'hr'), shiftController.updateShift);
router.delete('/:id', authorize('super_admin', 'sub_admin'), shiftController.deleteShift);

module.exports = router;

