/**
 * Permissions Module Routes
 */

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../authentication/middleware/authMiddleware');
const {
  createPermission,
  getPermissions,
  getPermission,
  approvePermission,
  rejectPermission,
  getOutpass,
  getQRCode,
} = require('./controllers/permissionController');

// Public route for outpass (no authentication required)
router.get('/outpass/:qrCode', getOutpass);

// All other routes require authentication
router.use(protect);

// Create permission request
router.post('/', createPermission);

// Get permission requests
router.get('/', getPermissions);

// Get single permission request
router.get('/:id', getPermission);

// Get QR code for permission
router.get('/:id/qr', getQRCode);

// Approve permission request (HOD, HR, Super Admin)
router.put('/:id/approve', authorize('super_admin', 'sub_admin', 'hr', 'hod'), approvePermission);

// Reject permission request (HOD, HR, Super Admin)
router.put('/:id/reject', authorize('super_admin', 'sub_admin', 'hr', 'hod'), rejectPermission);

module.exports = router;

