const express = require('express');
const router = express.Router();
const departmentController = require('./controllers/departmentController');
const designationController = require('./controllers/designationController');
const { protect, authorize } = require('../authentication/middleware/authMiddleware');

// All routes are protected
router.use(protect);

// Get all departments
router.get('/', departmentController.getAllDepartments);

// Get single department
router.get('/:id', departmentController.getDepartment);

// Get department employees
router.get('/:id/employees', departmentController.getDepartmentEmployees);

// Get department configuration
router.get('/:id/configuration', departmentController.getDepartmentConfiguration);

// Create department (Super Admin, Sub Admin, HR)
router.post('/', authorize('super_admin', 'sub_admin', 'hr'), departmentController.createDepartment);

// Update department (Super Admin, Sub Admin, HR)
router.put('/:id', authorize('super_admin', 'sub_admin', 'hr'), departmentController.updateDepartment);

// Update department configuration (Super Admin, Sub Admin, HR)
router.put('/:id/configuration', authorize('super_admin', 'sub_admin', 'hr'), departmentController.updateDepartmentConfiguration);

// Assign HOD (Super Admin, Sub Admin, HR)
router.put('/:id/assign-hod', authorize('super_admin', 'sub_admin', 'hr'), departmentController.assignHOD);

// Assign HR (Super Admin, Sub Admin)
router.put('/:id/assign-hr', authorize('super_admin', 'sub_admin'), departmentController.assignHR);

// Assign shifts to department (Super Admin, Sub Admin, HR)
router.put('/:id/shifts', authorize('super_admin', 'sub_admin', 'hr'), departmentController.assignShifts);

// Update paid leaves (Super Admin, Sub Admin, HR)
router.put('/:id/paid-leaves', authorize('super_admin', 'sub_admin', 'hr'), departmentController.updatePaidLeaves);

// Update leave limits (Super Admin, Sub Admin, HR)
router.put('/:id/leave-limits', authorize('super_admin', 'sub_admin', 'hr'), departmentController.updateLeaveLimits);

// Delete department (Super Admin, Sub Admin)
router.delete('/:id', authorize('super_admin', 'sub_admin'), departmentController.deleteDepartment);

// Designation routes
// Get designations by department
router.get('/:departmentId/designations', designationController.getDesignationsByDepartment);

// Create designation (Super Admin, Sub Admin, HR)
router.post('/:departmentId/designations', authorize('super_admin', 'sub_admin', 'hr'), designationController.createDesignation);

// Get single designation
router.get('/designations/:id', designationController.getDesignation);

// Update designation (Super Admin, Sub Admin, HR)
router.put('/designations/:id', authorize('super_admin', 'sub_admin', 'hr'), designationController.updateDesignation);

// Delete designation (Super Admin, Sub Admin)
router.delete('/designations/:id', authorize('super_admin', 'sub_admin'), designationController.deleteDesignation);

module.exports = router;


