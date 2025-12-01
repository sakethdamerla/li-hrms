/**
 * Attendance Routes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, authorize } = require('../authentication/middleware/authMiddleware');

// Controllers
const attendanceController = require('./controllers/attendanceController');
const attendanceSettingsController = require('./controllers/attendanceSettingsController');
const attendanceSyncController = require('./controllers/attendanceSyncController');
const attendanceUploadController = require('./controllers/attendanceUploadController');
const monthlySummaryController = require('./controllers/monthlySummaryController');

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.mimetype === 'text/csv') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) and CSV files are allowed'), false);
    }
  },
});

// All routes require authentication
router.use(protect);

// Attendance Data Routes
router.get('/calendar', attendanceController.getAttendanceCalendar);
router.get('/list', attendanceController.getAttendanceList);
router.get('/detail', attendanceController.getAttendanceDetail);
router.get('/employees', attendanceController.getEmployeesWithAttendance);
router.get('/monthly', attendanceController.getMonthlyAttendance);

// Update outTime for PARTIAL attendance (Super Admin, Sub Admin, HR, HOD)
router.put('/:employeeNumber/:date/outtime', authorize('super_admin', 'sub_admin', 'hr', 'hod'), attendanceController.updateOutTime);

// Settings Routes (Super Admin, Sub Admin only)
router.get('/settings', attendanceSettingsController.getSettings);
router.put('/settings', authorize('super_admin', 'sub_admin'), attendanceSettingsController.updateSettings);

// Sync Routes (Super Admin, Sub Admin only)
router.post('/sync', authorize('super_admin', 'sub_admin'), attendanceSyncController.manualSync);
router.get('/sync/status', attendanceSyncController.getSyncStatus);

// Upload Routes (Super Admin, Sub Admin, HR)
router.post('/upload', authorize('super_admin', 'sub_admin', 'hr'), upload.single('file'), attendanceUploadController.uploadExcel);
router.get('/upload/template', attendanceUploadController.downloadTemplate);

// Monthly Summary Routes
router.get('/monthly-summary', monthlySummaryController.getAllMonthlySummaries);
router.get('/monthly-summary/:employeeId', monthlySummaryController.getEmployeeMonthlySummary);
router.post('/monthly-summary/calculate/:employeeId', authorize('super_admin', 'sub_admin', 'hr'), monthlySummaryController.calculateEmployeeSummary);
router.post('/monthly-summary/calculate-all', authorize('super_admin', 'sub_admin', 'hr'), monthlySummaryController.calculateAllSummaries);

module.exports = router;

