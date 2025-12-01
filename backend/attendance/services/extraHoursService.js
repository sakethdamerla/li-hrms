/**
 * Extra Hours Detection Service
 * Automatically detects extra hours worked beyond shift end time (without OT request)
 */

const AttendanceDaily = require('../model/AttendanceDaily');
const Shift = require('../../shifts/model/Shift');
const { calculateMonthlySummary } = require('./summaryCalculationService');

/**
 * Detect and update extra hours for an attendance record
 * @param {String} employeeNumber - Employee number
 * @param {String} date - Date (YYYY-MM-DD)
 * @returns {Object} - Result
 */
const detectExtraHours = async (employeeNumber, date) => {
  try {
    const attendanceRecord = await AttendanceDaily.findOne({
      employeeNumber: employeeNumber.toUpperCase(),
      date: date,
    }).populate('shiftId');

    if (!attendanceRecord) {
      return {
        success: false,
        message: 'Attendance record not found',
      };
    }

    // Need both shift and outTime to calculate extra hours
    if (!attendanceRecord.shiftId || !attendanceRecord.outTime) {
      return {
        success: false,
        message: 'Shift or out time not available',
        extraHours: 0,
      };
    }

    const shift = attendanceRecord.shiftId;
    if (typeof shift === 'string') {
      // If shiftId is just an ID, populate it
      const shiftDoc = await Shift.findById(shift);
      if (!shiftDoc) {
        return {
          success: false,
          message: 'Shift not found',
        };
      }
      shift = shiftDoc;
    }

    // Get shift end time
    const [shiftEndHour, shiftEndMin] = shift.endTime.split(':').map(Number);
    
    // Create shift end time on the attendance date
    const shiftEndTime = new Date(date);
    shiftEndTime.setHours(shiftEndHour, shiftEndMin, 0, 0);

    // Handle overnight shifts (if shift end is next day)
    if (shiftEndHour < shift.startTime?.split(':')[0] || shiftEndHour === 0) {
      shiftEndTime.setDate(shiftEndTime.getDate() + 1);
    }

    // Calculate extra hours (only if outTime is after shift end)
    if (attendanceRecord.outTime > shiftEndTime) {
      const diffMs = attendanceRecord.outTime.getTime() - shiftEndTime.getTime();
      const extraHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

      // Only update if extra hours > 0 and no OT hours already set
      // (OT hours take precedence - if OT is approved, don't count as extra hours)
      if (extraHours > 0 && (!attendanceRecord.otHours || attendanceRecord.otHours === 0)) {
        attendanceRecord.extraHours = extraHours;
        await attendanceRecord.save();

        // Recalculate monthly summary
        const dateObj = new Date(date);
        const year = dateObj.getFullYear();
        const monthNumber = dateObj.getMonth() + 1;
        
        const Employee = require('../../employees/model/Employee');
        const employee = await Employee.findOne({ emp_no: attendanceRecord.employeeNumber, is_active: { $ne: false } });
        
        if (employee) {
          await calculateMonthlySummary(employee._id, employee.emp_no, year, monthNumber);
        }

        return {
          success: true,
          message: 'Extra hours detected and updated',
          extraHours: extraHours,
        };
      }

      return {
        success: true,
        message: 'Extra hours detected but not updated (OT hours exist or zero)',
        extraHours: extraHours,
        updated: false,
      };
    }

    // No extra hours
    if (attendanceRecord.extraHours > 0) {
      // Clear extra hours if outTime is now before shift end
      attendanceRecord.extraHours = 0;
      await attendanceRecord.save();

      // Recalculate monthly summary
      const dateObj = new Date(date);
      const year = dateObj.getFullYear();
      const monthNumber = dateObj.getMonth() + 1;
      
      const Employee = require('../../employees/model/Employee');
      const employee = await Employee.findOne({ emp_no: attendanceRecord.employeeNumber, is_active: { $ne: false } });
      
      if (employee) {
        await calculateMonthlySummary(employee._id, employee.emp_no, year, monthNumber);
      }
    }

    return {
      success: true,
      message: 'No extra hours detected',
      extraHours: 0,
    };

  } catch (error) {
    console.error('Error detecting extra hours:', error);
    return {
      success: false,
      message: error.message || 'Error detecting extra hours',
    };
  }
};

/**
 * Batch detect extra hours for multiple records
 * @param {String} startDate - Start date (optional)
 * @param {String} endDate - End date (optional)
 * @returns {Object} - Statistics
 */
const batchDetectExtraHours = async (startDate = null, endDate = null) => {
  const stats = {
    success: false,
    processed: 0,
    updated: 0,
    errors: [],
    message: '',
  };

  try {
    const query = {
      outTime: { $exists: true, $ne: null },
      shiftId: { $exists: true, $ne: null },
    };

    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    const records = await AttendanceDaily.find(query)
      .populate('shiftId')
      .sort({ date: -1 });

    stats.processed = records.length;

    for (const record of records) {
      try {
        const result = await detectExtraHours(record.employeeNumber, record.date);
        if (result.success && result.updated !== false) {
          stats.updated++;
        }
      } catch (error) {
        stats.errors.push(`Error processing ${record.employeeNumber} on ${record.date}: ${error.message}`);
        console.error(`Error processing record ${record._id}:`, error);
      }
    }

    stats.success = true;
    stats.message = `Processed ${stats.processed} records: ${stats.updated} updated with extra hours`;

  } catch (error) {
    console.error('Error in batch detect extra hours:', error);
    stats.errors.push(error.message);
    stats.message = 'Error batch detecting extra hours';
  }

  return stats;
};

module.exports = {
  detectExtraHours,
  batchDetectExtraHours,
};

