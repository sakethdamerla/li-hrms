/**
 * Permission Service
 * Handles permission requests, QR code generation, and outpass management
 */

const Permission = require('../model/Permission');
const AttendanceDaily = require('../../attendance/model/AttendanceDaily');
const Employee = require('../../employees/model/Employee');
const { calculateMonthlySummary } = require('../../attendance/services/summaryCalculationService');
const { validatePermissionRequest } = require('../../shared/services/conflictValidationService');

/**
 * Create permission request
 * @param {Object} data - Permission request data
 * @param {String} userId - User ID creating the request
 * @returns {Object} - Result
 */
const createPermissionRequest = async (data, userId) => {
  try {
    const { employeeId, employeeNumber, date, permissionStartTime, permissionEndTime, purpose, comments } = data;

    // Validate required fields
    if (!employeeId || !employeeNumber || !date || !permissionStartTime || !permissionEndTime || !purpose) {
      return {
        success: false,
        message: 'Employee, date, permission times, and purpose are required',
      };
    }

    // Get employee
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return {
        success: false,
        message: 'Employee not found',
      };
    }

    // Ensure times are Date objects
    const startTime = permissionStartTime instanceof Date ? permissionStartTime : new Date(permissionStartTime);
    const endTime = permissionEndTime instanceof Date ? permissionEndTime : new Date(permissionEndTime);

    // Validate end time is after start time
    if (endTime <= startTime) {
      return {
        success: false,
        message: 'Permission end time must be after start time',
      };
    }

    // Validate Permission request - check conflicts and attendance
    const validation = await validatePermissionRequest(employeeId, employeeNumber, date);
    if (!validation.isValid) {
      return {
        success: false,
        message: validation.errors.join('. '),
        validationErrors: validation.errors,
        hasLeave: !!validation.leave,
        hasOD: !!validation.od,
        hasAttendance: !!validation.attendance,
      };
    }

    // Check attendance exists with inTime (required for permission)
    const { checkAttendanceExists } = require('../../shared/services/conflictValidationService');
    const attendanceCheck = await checkAttendanceExists(employeeNumber, date);
    if (!attendanceCheck.hasAttendance) {
      return {
        success: false,
        message: attendanceCheck.message || 'No attendance record found or employee has no in-time for this date. Permission cannot be created without attendance.',
        validationErrors: [attendanceCheck.message || 'Attendance with in-time is required for permission'],
        hasAttendance: false,
      };
    }

    // Get attendance record (already validated)
    const attendanceRecord = attendanceCheck.attendance;

    // Calculate permission hours
    const diffMs = endTime.getTime() - startTime.getTime();
    const permissionHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

    // Create permission request
    const permissionRequest = await Permission.create({
      employeeId: employeeId,
      employeeNumber: employeeNumber.toUpperCase(),
      date: date,
      attendanceRecordId: attendanceRecord._id,
      permissionStartTime: startTime,
      permissionEndTime: endTime,
      permissionHours: permissionHours,
      purpose: purpose.trim(),
      status: 'pending',
      requestedBy: userId,
      comments: comments || null,
    });

    return {
      success: true,
      message: 'Permission request created successfully',
      data: permissionRequest,
    };

  } catch (error) {
    console.error('Error creating permission request:', error);
    return {
      success: false,
      message: error.message || 'Error creating permission request',
    };
  }
};

/**
 * Approve permission request
 * @param {String} permissionId - Permission request ID
 * @param {String} userId - User ID approving
 * @param {String} baseUrl - Base URL for outpass (e.g., 'https://example.com')
 * @returns {Object} - Result
 */
const approvePermissionRequest = async (permissionId, userId, baseUrl = '') => {
  try {
    const permissionRequest = await Permission.findById(permissionId);

    if (!permissionRequest) {
      return {
        success: false,
        message: 'Permission request not found',
      };
    }

    if (permissionRequest.status !== 'pending') {
      return {
        success: false,
        message: `Permission request is already ${permissionRequest.status}`,
      };
    }

    // Generate QR code
    permissionRequest.generateQRCode();
    
    // Set outpass URL (frontend route)
    permissionRequest.outpassUrl = `${baseUrl}/outpass/${permissionRequest.qrCode}`;

    // Update status
    permissionRequest.status = 'approved';
    permissionRequest.approvedBy = userId;
    permissionRequest.approvedAt = new Date();
    await permissionRequest.save();

    // Update attendance record
    const attendanceRecord = await AttendanceDaily.findById(permissionRequest.attendanceRecordId);
    if (attendanceRecord) {
      // Add permission hours and count
      attendanceRecord.permissionHours = (attendanceRecord.permissionHours || 0) + permissionRequest.permissionHours;
      attendanceRecord.permissionCount = (attendanceRecord.permissionCount || 0) + 1;
      await attendanceRecord.save();

      // Recalculate monthly summary
      const dateObj = new Date(permissionRequest.date);
      const year = dateObj.getFullYear();
      const monthNumber = dateObj.getMonth() + 1;
      await calculateMonthlySummary(permissionRequest.employeeId, permissionRequest.employeeNumber, year, monthNumber);
    }

    return {
      success: true,
      message: 'Permission request approved successfully',
      data: permissionRequest,
    };

  } catch (error) {
    console.error('Error approving permission request:', error);
    return {
      success: false,
      message: error.message || 'Error approving permission request',
    };
  }
};

/**
 * Reject permission request
 * @param {String} permissionId - Permission request ID
 * @param {String} userId - User ID rejecting
 * @param {String} reason - Rejection reason
 * @returns {Object} - Result
 */
const rejectPermissionRequest = async (permissionId, userId, reason) => {
  try {
    const permissionRequest = await Permission.findById(permissionId);

    if (!permissionRequest) {
      return {
        success: false,
        message: 'Permission request not found',
      };
    }

    if (permissionRequest.status !== 'pending') {
      return {
        success: false,
        message: `Permission request is already ${permissionRequest.status}`,
      };
    }

    permissionRequest.status = 'rejected';
    permissionRequest.rejectedBy = userId;
    permissionRequest.rejectedAt = new Date();
    permissionRequest.rejectionReason = reason || null;
    await permissionRequest.save();

    return {
      success: true,
      message: 'Permission request rejected successfully',
      data: permissionRequest,
    };

  } catch (error) {
    console.error('Error rejecting permission request:', error);
    return {
      success: false,
      message: error.message || 'Error rejecting permission request',
    };
  }
};

/**
 * Get outpass data by QR code
 * @param {String} qrCode - QR code
 * @returns {Object} - Result
 */
const getOutpassByQR = async (qrCode) => {
  try {
    const permission = await Permission.findOne({ qrCode: qrCode })
      .populate('employeeId', 'emp_no employee_name department designation photo')
      .populate('approvedBy', 'name email');

    if (!permission) {
      return {
        success: false,
        message: 'Invalid QR code',
      };
    }

    // Check if QR code is expired
    if (permission.qrExpiry && new Date() > permission.qrExpiry) {
      return {
        success: false,
        message: 'QR code has expired',
        expired: true,
      };
    }

    // Check if permission is approved
    if (permission.status !== 'approved') {
      return {
        success: false,
        message: 'Permission is not approved',
      };
    }

    return {
      success: true,
      data: permission,
    };

  } catch (error) {
    console.error('Error getting outpass by QR:', error);
    return {
      success: false,
      message: error.message || 'Error getting outpass',
    };
  }
};

module.exports = {
  createPermissionRequest,
  approvePermissionRequest,
  rejectPermissionRequest,
  getOutpassByQR,
};

