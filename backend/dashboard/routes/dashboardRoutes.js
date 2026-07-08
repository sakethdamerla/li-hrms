const express = require('express');
const router = express.Router();
const { protect } = require('../../authentication/middleware/authMiddleware'); // Verify path!
const { getDashboardStats, getSuperAdminAnalytics, getLeaveODTrends } = require('../controllers/dashboardController');

router.get('/stats', protect, getDashboardStats);
router.get('/analytics', protect, getSuperAdminAnalytics);
router.get('/leave-od-trends', protect, getLeaveODTrends);

module.exports = router;
