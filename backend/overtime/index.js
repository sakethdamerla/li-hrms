/**
 * Overtime Module Routes
 */

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../authentication/middleware/authMiddleware');
const {
  createOT,
  getOTRequests,
  getOTRequest,
  approveOT,
  rejectOT,
  checkConfusedShift,
} = require('./controllers/otController');

// All routes require authentication
router.use(protect);

// Create OT request (HOD, HR, Super Admin)
router.post('/', authorize('super_admin', 'sub_admin', 'hr', 'hod'), createOT);

// Get OT requests
router.get('/', getOTRequests);

// Get single OT request
router.get('/:id', getOTRequest);

// Check ConfusedShift for employee date
router.get('/check-confused/:employeeNumber/:date', checkConfusedShift);

// Approve OT request (HOD, HR, Super Admin)
router.put('/:id/approve', authorize('super_admin', 'sub_admin', 'hr', 'hod'), approveOT);

// Reject OT request (HOD, HR, Super Admin)
router.put('/:id/reject', authorize('super_admin', 'sub_admin', 'hr', 'hod'), rejectOT);

module.exports = router;

