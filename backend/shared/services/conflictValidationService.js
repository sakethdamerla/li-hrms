/**
 * Conflict Validation Service
 * Validates conflicts between Leave, OD, OT, and Permission requests
 */

const Leave = require('../../leaves/model/Leave');
const OD = require('../../leaves/model/OD');
const OT = require('../../overtime/model/OT');
const Permission = require('../../permissions/model/Permission');
const AttendanceDaily = require('../../attendance/model/AttendanceDaily');

/**
 * Check if a date falls within a date range
 * @param {String|Date} date - Date to check (YYYY-MM-DD or Date object)
 * @param {Date} fromDate - Start date
 * @param {Date} toDate - End date
 * @returns {Boolean}
 */
const isDateInRange = (date, fromDate, toDate) => {
  const checkDate = typeof date === 'string' ? new Date(date) : date;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  
  // Set time to start/end of day for accurate comparison
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  checkDate.setHours(12, 0, 0, 0); // Set to noon for date-only comparison
  
  return checkDate >= from && checkDate <= to;
};

/**
 * Check if employee has an approved or pending Leave on a date
 * @param {String} employeeId - Employee ID
 * @param {String} employeeNumber - Employee number
 * @param {String} date - Date to check (YYYY-MM-DD)
 * @returns {Object} - { hasLeave: boolean, leave: Leave|null }
 */
const checkLeaveConflict = async (employeeId, employeeNumber, date) => {
  try {
    const leaves = await Leave.find({
      $or: [
        { employeeId: employeeId },
        { emp_no: employeeNumber.toUpperCase() }
      ],
      status: { $in: ['pending', 'hod_approved', 'hr_approved', 'approved'] },
      isActive: true,
    });

    for (const leave of leaves) {
      if (isDateInRange(date, leave.fromDate, leave.toDate)) {
        return {
          hasLeave: true,
          leave: leave,
          message: `Employee has a ${leave.status} leave from ${leave.fromDate.toLocaleDateString()} to ${leave.toDate.toLocaleDateString()}`,
        };
      }
    }

    return {
      hasLeave: false,
      leave: null,
    };
  } catch (error) {
    console.error('Error checking leave conflict:', error);
    return {
      hasLeave: false,
      leave: null,
      error: error.message,
    };
  }
};

/**
 * Check if employee has an approved or pending OD on a date
 * @param {String} employeeId - Employee ID
 * @param {String} employeeNumber - Employee number
 * @param {String} date - Date to check (YYYY-MM-DD)
 * @returns {Object} - { hasOD: boolean, od: OD|null }
 */
const checkODConflict = async (employeeId, employeeNumber, date) => {
  try {
    const ods = await OD.find({
      $or: [
        { employeeId: employeeId },
        { emp_no: employeeNumber.toUpperCase() }
      ],
      status: { $in: ['pending', 'hod_approved', 'hr_approved', 'approved'] },
      isActive: true,
    });

    for (const od of ods) {
      if (isDateInRange(date, od.fromDate, od.toDate)) {
        return {
          hasOD: true,
          od: od,
          message: `Employee has a ${od.status} OD from ${od.fromDate.toLocaleDateString()} to ${od.toDate.toLocaleDateString()}`,
        };
      }
    }

    return {
      hasOD: false,
      od: null,
    };
  } catch (error) {
    console.error('Error checking OD conflict:', error);
    return {
      hasOD: false,
      od: null,
      error: error.message,
    };
  }
};

/**
 * Check if employee has attendance for a date
 * @param {String} employeeNumber - Employee number
 * @param {String} date - Date to check (YYYY-MM-DD)
 * @returns {Object} - { hasAttendance: boolean, attendance: AttendanceDaily|null }
 */
const checkAttendanceExists = async (employeeNumber, date) => {
  try {
    const attendance = await AttendanceDaily.findOne({
      employeeNumber: employeeNumber.toUpperCase(),
      date: date,
    });

    if (!attendance) {
      return {
        hasAttendance: false,
        attendance: null,
        message: 'No attendance record found for this date',
      };
    }

    if (!attendance.inTime) {
      return {
        hasAttendance: false,
        attendance: attendance,
        message: 'Employee has no in-time for this date',
      };
    }

    return {
      hasAttendance: true,
      attendance: attendance,
    };
  } catch (error) {
    console.error('Error checking attendance:', error);
    return {
      hasAttendance: false,
      attendance: null,
      error: error.message,
    };
  }
};

/**
 * Validate OT request - check conflicts and attendance
 * @param {String} employeeId - Employee ID
 * @param {String} employeeNumber - Employee number
 * @param {String} date - Date (YYYY-MM-DD)
 * @returns {Object} - Validation result
 */
const validateOTRequest = async (employeeId, employeeNumber, date) => {
  const errors = [];
  const warnings = [];

  // Check attendance
  const attendanceCheck = await checkAttendanceExists(employeeNumber, date);
  if (!attendanceCheck.hasAttendance) {
    errors.push(attendanceCheck.message || 'Attendance record not found or incomplete');
  }

  // Check Leave conflict
  const leaveCheck = await checkLeaveConflict(employeeId, employeeNumber, date);
  if (leaveCheck.hasLeave) {
    errors.push(leaveCheck.message || 'Employee has a leave on this date');
  }

  // Check OD conflict
  const odCheck = await checkODConflict(employeeId, employeeNumber, date);
  if (odCheck.hasOD) {
    errors.push(odCheck.message || 'Employee has an OD on this date');
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    attendance: attendanceCheck.attendance,
    leave: leaveCheck.leave,
    od: odCheck.od,
  };
};

/**
 * Validate Permission request - check conflicts and attendance
 * @param {String} employeeId - Employee ID
 * @param {String} employeeNumber - Employee number
 * @param {String} date - Date (YYYY-MM-DD)
 * @returns {Object} - Validation result
 */
const validatePermissionRequest = async (employeeId, employeeNumber, date) => {
  const errors = [];
  const warnings = [];

  // Check attendance (required for permission)
  const attendanceCheck = await checkAttendanceExists(employeeNumber, date);
  if (!attendanceCheck.hasAttendance) {
    errors.push(attendanceCheck.message || 'No attendance record found or employee has no in-time for this date');
  }

  // Check Leave conflict
  const leaveCheck = await checkLeaveConflict(employeeId, employeeNumber, date);
  if (leaveCheck.hasLeave) {
    errors.push(leaveCheck.message || 'Employee has a leave on this date');
  }

  // Check OD conflict
  const odCheck = await checkODConflict(employeeId, employeeNumber, date);
  if (odCheck.hasOD) {
    errors.push(odCheck.message || 'Employee has an OD on this date');
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    attendance: attendanceCheck.attendance,
    leave: leaveCheck.leave,
    od: odCheck.od,
  };
};

/**
 * Validate Leave request - check OD conflict
 * @param {String} employeeId - Employee ID
 * @param {String} employeeNumber - Employee number
 * @param {Date} fromDate - Start date
 * @param {Date} toDate - End date
 * @returns {Object} - Validation result
 */
const validateLeaveRequest = async (employeeId, employeeNumber, fromDate, toDate) => {
  const errors = [];
  const warnings = [];

  // Check OD conflicts for each day in the range
  const ods = await OD.find({
    $or: [
      { employeeId: employeeId },
      { emp_no: employeeNumber.toUpperCase() }
    ],
    status: { $in: ['pending', 'hod_approved', 'hr_approved', 'approved'] },
    isActive: true,
  });

  const conflictingODs = ods.filter(od => {
    // Check if date ranges overlap
    return (fromDate <= od.toDate && toDate >= od.fromDate);
  });

  if (conflictingODs.length > 0) {
    const od = conflictingODs[0];
    errors.push(`Employee has a ${od.status} OD from ${od.fromDate.toLocaleDateString()} to ${od.toDate.toLocaleDateString()} that conflicts with this leave period`);
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    conflictingODs: conflictingODs,
  };
};

/**
 * Validate OD request - check Leave conflict
 * @param {String} employeeId - Employee ID
 * @param {String} employeeNumber - Employee number
 * @param {Date} fromDate - Start date
 * @param {Date} toDate - End date
 * @returns {Object} - Validation result
 */
const validateODRequest = async (employeeId, employeeNumber, fromDate, toDate) => {
  const errors = [];
  const warnings = [];

  // Check Leave conflicts for each day in the range
  const leaves = await Leave.find({
    $or: [
      { employeeId: employeeId },
      { emp_no: employeeNumber.toUpperCase() }
    ],
    status: { $in: ['pending', 'hod_approved', 'hr_approved', 'approved'] },
    isActive: true,
  });

  const conflictingLeaves = leaves.filter(leave => {
    // Check if date ranges overlap
    return (fromDate <= leave.toDate && toDate >= leave.fromDate);
  });

  if (conflictingLeaves.length > 0) {
    const leave = conflictingLeaves[0];
    errors.push(`Employee has a ${leave.status} leave from ${leave.fromDate.toLocaleDateString()} to ${leave.toDate.toLocaleDateString()} that conflicts with this OD period`);
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    conflictingLeaves: conflictingLeaves,
  };
};

module.exports = {
  checkLeaveConflict,
  checkODConflict,
  checkAttendanceExists,
  validateOTRequest,
  validatePermissionRequest,
  validateLeaveRequest,
  validateODRequest,
};

