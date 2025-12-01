/**
 * Shift Detection Service
 * Automatically detects and assigns shifts to attendance records
 * Priority: Pre-Scheduled → Designation → Department → General Shifts
 */

const Employee = require('../../employees/model/Employee');
const Department = require('../../departments/model/Department');
const Designation = require('../../departments/model/Designation');
const Shift = require('../model/Shift');
const PreScheduledShift = require('../model/PreScheduledShift');
const ConfusedShift = require('../model/ConfusedShift');
const AttendanceDaily = require('../../attendance/model/AttendanceDaily');

/**
 * Convert time string (HH:mm) to minutes from midnight
 */
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Check if a time falls within a shift window (considering grace period)
 * @param {Date} punchTime - The actual punch time
 * @param {String} shiftStartTime - Shift start time (HH:mm)
 * @param {Number} gracePeriodMinutes - Grace period in minutes
 * @returns {Boolean} - True if within window
 */
const isWithinShiftWindow = (punchTime, shiftStartTime, gracePeriodMinutes = 15) => {
  const punchMinutes = punchTime.getHours() * 60 + punchTime.getMinutes();
  const shiftStartMinutes = timeToMinutes(shiftStartTime);
  const graceEndMinutes = shiftStartMinutes + gracePeriodMinutes;
  
  // Handle overnight shifts
  if (graceEndMinutes >= 24 * 60) {
    // Shift spans midnight
    return punchMinutes >= shiftStartMinutes || punchMinutes <= (graceEndMinutes % (24 * 60));
  }
  
  return punchMinutes >= shiftStartMinutes && punchMinutes <= graceEndMinutes;
};

/**
 * Get shifts for employee based on priority
 * Priority: Pre-Scheduled → Designation → Department → General
 */
const getShiftsForEmployee = async (employeeNumber, date) => {
  try {
    // Get employee details
    const employee = await Employee.findOne({ emp_no: employeeNumber })
      .populate('department_id', 'shifts')
      .populate('designation_id', 'shifts');
    
    if (!employee) {
      return { shifts: [], source: 'none' };
    }

    // 1. Check pre-scheduled shift (highest priority)
    const preScheduled = await PreScheduledShift.findOne({
      employeeNumber: employeeNumber.toUpperCase(),
      date: date,
    }).populate('shiftId');
    
    if (preScheduled && preScheduled.shiftId) {
      return {
        shifts: [preScheduled.shiftId],
        source: 'pre_scheduled',
        preScheduledId: preScheduled._id,
      };
    }

    // 2. Check designation shifts
    if (employee.designation_id && employee.designation_id.shifts && employee.designation_id.shifts.length > 0) {
      const designationShifts = await Shift.find({
        _id: { $in: employee.designation_id.shifts },
        isActive: true,
      });
      if (designationShifts.length > 0) {
        return {
          shifts: designationShifts,
          source: 'designation',
        };
      }
    }

    // 3. Check department shifts
    if (employee.department_id && employee.department_id.shifts && employee.department_id.shifts.length > 0) {
      const departmentShifts = await Shift.find({
        _id: { $in: employee.department_id.shifts },
        isActive: true,
      });
      if (departmentShifts.length > 0) {
        return {
          shifts: departmentShifts,
          source: 'department',
        };
      }
    }

    // 4. Get all general active shifts (fallback)
    const generalShifts = await Shift.find({ isActive: true });
    return {
      shifts: generalShifts,
      source: 'general',
    };

  } catch (error) {
    console.error('Error getting shifts for employee:', error);
    return { shifts: [], source: 'none' };
  }
};

/**
 * Find matching shifts based on in-time
 * @param {Date} inTime - Employee's in-time
 * @param {Array} shifts - Array of shift objects
 * @returns {Array} - Array of matching shifts with match details
 */
const findMatchingShifts = (inTime, shifts) => {
  const matches = [];

  for (const shift of shifts) {
    const gracePeriod = shift.gracePeriod || 15; // Default 15 minutes
    
    if (isWithinShiftWindow(inTime, shift.startTime, gracePeriod)) {
      matches.push({
        shiftId: shift._id,
        shiftName: shift.name,
        startTime: shift.startTime,
        endTime: shift.endTime,
        gracePeriod: gracePeriod,
        matchReason: `In-time ${inTime.toLocaleTimeString()} matches shift ${shift.name} (${shift.startTime}) with ${gracePeriod}min grace`,
      });
    }
  }

  return matches;
};

/**
 * Find matching shifts based on out-time (for secondary matching)
 * @param {Date} outTime - Employee's out-time
 * @param {Array} shifts - Array of shift objects (already matched by inTime)
 * @param {Number} toleranceMinutes - Tolerance in minutes for matching end time (default 30)
 * @returns {Array} - Array of matching shifts with match details
 */
const findMatchingShiftsByOutTime = (outTime, shifts, toleranceMinutes = 30) => {
  if (!outTime) return [];
  
  const matches = [];
  const outMinutes = outTime.getHours() * 60 + outTime.getMinutes();

  for (const shift of shifts) {
    const shiftEndMinutes = timeToMinutes(shift.endTime);
    
    // Calculate difference (handle overnight shifts)
    let difference = Math.abs(outMinutes - shiftEndMinutes);
    
    // If difference is more than 12 hours, consider it might be next day
    if (difference > 12 * 60) {
      difference = 24 * 60 - difference;
    }
    
    // If within tolerance, it's a match
    if (difference <= toleranceMinutes) {
      matches.push({
        shiftId: shift._id,
        shiftName: shift.name,
        startTime: shift.startTime,
        endTime: shift.endTime,
        differenceMinutes: difference,
        matchReason: `Out-time ${outTime.toLocaleTimeString()} matches shift ${shift.name} end time (${shift.endTime}) with ${difference}min difference`,
      });
    }
  }

  // Sort by closest match (smallest difference)
  return matches.sort((a, b) => a.differenceMinutes - b.differenceMinutes);
};

/**
 * Calculate late-in minutes
 * @param {Date} inTime - Actual in-time
 * @param {String} shiftStartTime - Shift start time (HH:mm)
 * @param {Number} gracePeriodMinutes - Grace period in minutes
 * @returns {Number} - Minutes late (0 if on time or within grace)
 */
const calculateLateIn = (inTime, shiftStartTime, gracePeriodMinutes = 15) => {
  const inMinutes = inTime.getHours() * 60 + inTime.getMinutes();
  const shiftStartMinutes = timeToMinutes(shiftStartTime);
  const graceEndMinutes = shiftStartMinutes + gracePeriodMinutes;
  
  if (inMinutes <= graceEndMinutes) {
    return 0; // On time or within grace period
  }
  
  return inMinutes - graceEndMinutes;
};

/**
 * Calculate early-out minutes
 * @param {Date} outTime - Actual out-time
 * @param {String} shiftEndTime - Shift end time (HH:mm)
 * @returns {Number} - Minutes early (0 if on time or late)
 */
const calculateEarlyOut = (outTime, shiftEndTime) => {
  if (!outTime) return null;
  
  const outMinutes = outTime.getHours() * 60 + outTime.getMinutes();
  const shiftEndMinutes = timeToMinutes(shiftEndTime);
  
  if (outMinutes >= shiftEndMinutes) {
    return 0; // On time or late out
  }
  
  return shiftEndMinutes - outMinutes;
};

/**
 * Detect and assign shift to attendance record
 * @param {String} employeeNumber - Employee number
 * @param {String} date - Date (YYYY-MM-DD)
 * @param {Date} inTime - In-time
 * @param {Date} outTime - Out-time (optional)
 * @returns {Object} - Detection result
 */
const detectAndAssignShift = async (employeeNumber, date, inTime, outTime = null) => {
  try {
    if (!inTime) {
      return {
        success: false,
        message: 'In-time is required for shift detection',
      };
    }

    // Get shifts for employee
    const { shifts, source, preScheduledId } = await getShiftsForEmployee(employeeNumber, date);

    if (shifts.length === 0) {
      return {
        success: false,
        message: 'No shifts found for employee',
        assignedShift: null,
      };
    }

    // PRIMARY: Find matching shifts based on in-time
    const matchingShifts = findMatchingShifts(inTime, shifts);

    // Case 1: Pre-scheduled shift - use it directly
    if (source === 'pre_scheduled' && shifts.length === 1) {
      const shift = shifts[0];
      const lateInMinutes = calculateLateIn(inTime, shift.startTime, shift.gracePeriod || 15);
      const earlyOutMinutes = outTime ? calculateEarlyOut(outTime, shift.endTime) : null;

      return {
        success: true,
        assignedShift: shift._id,
        shiftName: shift.name,
        source: 'pre_scheduled',
        lateInMinutes: lateInMinutes > 0 ? lateInMinutes : null,
        earlyOutMinutes: earlyOutMinutes && earlyOutMinutes > 0 ? earlyOutMinutes : null,
        isLateIn: lateInMinutes > 0,
        isEarlyOut: earlyOutMinutes && earlyOutMinutes > 0,
        expectedHours: shift.duration,
      };
    }

    // Case 2: Single match by inTime - auto assign
    if (matchingShifts.length === 1) {
      const match = matchingShifts[0];
      const shift = shifts.find(s => s._id.toString() === match.shiftId.toString());
      
      if (!shift) {
        return {
          success: false,
          message: 'Shift not found',
        };
      }

      const lateInMinutes = calculateLateIn(inTime, shift.startTime, shift.gracePeriod || 15);
      const earlyOutMinutes = outTime ? calculateEarlyOut(outTime, shift.endTime) : null;

      return {
        success: true,
        assignedShift: shift._id,
        shiftName: shift.name,
        source: source,
        lateInMinutes: lateInMinutes > 0 ? lateInMinutes : null,
        earlyOutMinutes: earlyOutMinutes && earlyOutMinutes > 0 ? earlyOutMinutes : null,
        isLateIn: lateInMinutes > 0,
        isEarlyOut: earlyOutMinutes && earlyOutMinutes > 0,
        expectedHours: shift.duration,
      };
    }

    // Case 3: Multiple matches by inTime - SECONDARY: Use outTime to narrow down
    if (matchingShifts.length > 1) {
      // If outTime is available, use it to find the best match
      if (outTime) {
        // Get the actual shift objects for the matches
        const matchedShiftObjects = shifts.filter(s => 
          matchingShifts.some(m => m.shiftId.toString() === s._id.toString())
        );
        
        // Find matching shifts based on outTime
        const outTimeMatches = findMatchingShiftsByOutTime(outTime, matchedShiftObjects);
        
        // If we have a clear match by outTime, use it
        if (outTimeMatches.length === 1) {
          const bestMatch = outTimeMatches[0];
          const shift = shifts.find(s => s._id.toString() === bestMatch.shiftId.toString());
          
          if (shift) {
            const lateInMinutes = calculateLateIn(inTime, shift.startTime, shift.gracePeriod || 15);
            const earlyOutMinutes = calculateEarlyOut(outTime, shift.endTime);

            return {
              success: true,
              assignedShift: shift._id,
              shiftName: shift.name,
              source: `${source}_outtime_match`,
              lateInMinutes: lateInMinutes > 0 ? lateInMinutes : null,
              earlyOutMinutes: earlyOutMinutes && earlyOutMinutes > 0 ? earlyOutMinutes : null,
              isLateIn: lateInMinutes > 0,
              isEarlyOut: earlyOutMinutes && earlyOutMinutes > 0,
              expectedHours: shift.duration,
              matchMethod: 'inTime_and_outTime',
            };
          }
        }
        
        // If multiple outTime matches or no outTime match, still confused
        // But we have narrowed it down - use the closest match by outTime
        if (outTimeMatches.length > 0) {
          // Use the closest match (already sorted by difference)
          const bestMatch = outTimeMatches[0];
          const shift = shifts.find(s => s._id.toString() === bestMatch.shiftId.toString());
          
          if (shift) {
            const lateInMinutes = calculateLateIn(inTime, shift.startTime, shift.gracePeriod || 15);
            const earlyOutMinutes = calculateEarlyOut(outTime, shift.endTime);

            // Still create confused shift but assign the best match
            const confusedShiftData = {
              employeeNumber: employeeNumber.toUpperCase(),
              date: date,
              inTime: inTime,
              outTime: outTime,
              possibleShifts: outTimeMatches.map(m => ({
                shiftId: m.shiftId,
                shiftName: m.shiftName,
                startTime: m.startTime,
                endTime: m.endTime,
                matchReason: m.matchReason,
              })),
              status: 'pending',
              requiresManualSelection: true,
            };

            await ConfusedShift.findOneAndUpdate(
              { employeeNumber: employeeNumber.toUpperCase(), date: date },
              confusedShiftData,
              { upsert: true, new: true }
            );

            return {
              success: true,
              assignedShift: shift._id,
              shiftName: shift.name,
              source: `${source}_best_match`,
              lateInMinutes: lateInMinutes > 0 ? lateInMinutes : null,
              earlyOutMinutes: earlyOutMinutes && earlyOutMinutes > 0 ? earlyOutMinutes : null,
              isLateIn: lateInMinutes > 0,
              isEarlyOut: earlyOutMinutes && earlyOutMinutes > 0,
              expectedHours: shift.duration,
              matchMethod: 'inTime_and_outTime_best_match',
              confused: true,
              requiresManualSelection: true,
              possibleShifts: outTimeMatches,
            };
          }
        }
      }
      
      // No outTime or outTime didn't help - create confused shift
      const confusedShiftData = {
        employeeNumber: employeeNumber.toUpperCase(),
        date: date,
        inTime: inTime,
        outTime: outTime,
        possibleShifts: matchingShifts,
        status: 'pending',
        requiresManualSelection: outTime ? false : true, // If outTime exists but didn't help, still need manual selection
      };

      await ConfusedShift.findOneAndUpdate(
        { employeeNumber: employeeNumber.toUpperCase(), date: date },
        confusedShiftData,
        { upsert: true, new: true }
      );

      return {
        success: false,
        confused: true,
        message: outTime 
          ? 'Multiple shifts match by inTime and outTime - requires manual review'
          : 'Multiple shifts match by inTime - outTime needed for better matching',
        possibleShifts: matchingShifts,
        requiresManualSelection: true,
      };
    }

    // Case 4: No matches by inTime - flag as confused
    if (matchingShifts.length === 0) {
      // Create or update confused shift record
      const confusedShiftData = {
        employeeNumber: employeeNumber.toUpperCase(),
        date: date,
        inTime: inTime,
        outTime: outTime,
        possibleShifts: shifts.map(s => ({
              shiftId: s._id,
              shiftName: s.name,
              startTime: s.startTime,
              endTime: s.endTime,
              matchReason: `No clear match - in-time ${inTime.toLocaleTimeString()} doesn't match any shift window`,
            })),
        status: 'pending',
        requiresManualSelection: true,
      };

      await ConfusedShift.findOneAndUpdate(
        { employeeNumber: employeeNumber.toUpperCase(), date: date },
        confusedShiftData,
        { upsert: true, new: true }
      );

      return {
        success: false,
        confused: true,
        message: 'No shift matches by inTime - requires manual review',
        possibleShifts: shifts.map(s => ({
          shiftId: s._id,
          shiftName: s.name,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
        requiresManualSelection: true,
      };
    }

  } catch (error) {
    console.error('Error in shift detection:', error);
    return {
      success: false,
      message: error.message || 'Error detecting shift',
    };
  }
};

/**
 * Manually assign shift to confused record
 * @param {String} confusedShiftId - Confused shift record ID
 * @param {String} shiftId - Shift ID to assign
 * @param {String} userId - User ID who is assigning
 * @param {String} comments - Optional comments
 * @returns {Object} - Result
 */
const resolveConfusedShift = async (confusedShiftId, shiftId, userId, comments = null) => {
  try {
    const confusedShift = await ConfusedShift.findById(confusedShiftId);
    if (!confusedShift) {
      return {
        success: false,
        message: 'Confused shift record not found',
      };
    }

    if (confusedShift.status !== 'pending') {
      return {
        success: false,
        message: 'This record has already been resolved',
      };
    }

    const shift = await Shift.findById(shiftId);
    if (!shift) {
      return {
        success: false,
        message: 'Shift not found',
      };
    }

    // Update confused shift
    confusedShift.assignedShiftId = shiftId;
    confusedShift.status = 'resolved';
    confusedShift.reviewedBy = userId;
    confusedShift.reviewedAt = new Date();
    confusedShift.reviewComments = comments;

    await confusedShift.save();

    // Update attendance record
    const attendanceRecord = await AttendanceDaily.findOne({
      employeeNumber: confusedShift.employeeNumber,
      date: confusedShift.date,
    });

    if (attendanceRecord) {
      const lateInMinutes = calculateLateIn(confusedShift.inTime, shift.startTime, shift.gracePeriod || 15);
      const earlyOutMinutes = confusedShift.outTime 
        ? calculateEarlyOut(confusedShift.outTime, shift.endTime) 
        : null;

      attendanceRecord.shiftId = shiftId;
      attendanceRecord.lateInMinutes = lateInMinutes > 0 ? lateInMinutes : null;
      attendanceRecord.earlyOutMinutes = earlyOutMinutes && earlyOutMinutes > 0 ? earlyOutMinutes : null;
      attendanceRecord.isLateIn = lateInMinutes > 0;
      attendanceRecord.isEarlyOut = earlyOutMinutes && earlyOutMinutes > 0;
      attendanceRecord.expectedHours = shift.duration;

      await attendanceRecord.save();
    }

    return {
      success: true,
      message: 'Shift assigned successfully',
      data: confusedShift,
    };

  } catch (error) {
    console.error('Error resolving confused shift:', error);
    return {
      success: false,
      message: error.message || 'Error resolving confused shift',
    };
  }
};

/**
 * Sync shifts for existing attendance records that don't have shifts assigned
 * @param {String} startDate - Start date (optional)
 * @param {String} endDate - End date (optional)
 * @returns {Object} - Sync statistics
 */
const syncShiftsForExistingRecords = async (startDate = null, endDate = null) => {
  const stats = {
    success: false,
    processed: 0,
    assigned: 0,
    confused: 0,
    errors: [],
    message: '',
  };

  try {
    // Build query for records without shiftId
    const query = { shiftId: { $exists: false } };
    
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    // Get all attendance records without shifts
    const records = await AttendanceDaily.find(query).sort({ date: -1 });

    stats.processed = records.length;

    for (const record of records) {
      try {
        if (!record.inTime) {
          // No in-time, skip
          continue;
        }

        // Detect and assign shift
        const result = await detectAndAssignShift(
          record.employeeNumber,
          record.date,
          record.inTime,
          record.outTime || null
        );

        if (result.success && result.assignedShift) {
          // Update record with shift assignment
          record.shiftId = result.assignedShift;
          record.lateInMinutes = result.lateInMinutes;
          record.earlyOutMinutes = result.earlyOutMinutes;
          record.isLateIn = result.isLateIn || false;
          record.isEarlyOut = result.isEarlyOut || false;
          record.expectedHours = result.expectedHours;
          
          await record.save();
          stats.assigned++;
        } else if (result.confused) {
          // Confused shift record already created by detectAndAssignShift
          stats.confused++;
        }

      } catch (error) {
        stats.errors.push(`Error processing ${record.employeeNumber} on ${record.date}: ${error.message}`);
        console.error(`Error processing record ${record._id}:`, error);
      }
    }

    stats.success = true;
    stats.message = `Processed ${stats.processed} records: ${stats.assigned} assigned, ${stats.confused} flagged for review`;

  } catch (error) {
    console.error('Error in syncShiftsForExistingRecords:', error);
    stats.errors.push(error.message);
    stats.message = 'Error syncing shifts';
  }

  return stats;
};

/**
 * Auto-assign nearest shift based on in-time
 * This is a separate function that finds the shift with start time closest to the in-time
 * Used for confused shifts auto-assignment
 * @param {String} employeeNumber - Employee number
 * @param {String} date - Date (YYYY-MM-DD)
 * @param {Date} inTime - In-time
 * @param {Date} outTime - Out-time (optional)
 * @returns {Object} - Assignment result
 */
const autoAssignNearestShift = async (employeeNumber, date, inTime, outTime = null) => {
  try {
    if (!inTime) {
      return {
        success: false,
        message: 'In-time is required for auto-assignment',
      };
    }

    // Get all available shifts (not just possible ones)
    const { shifts } = await getShiftsForEmployee(employeeNumber, date);

    if (shifts.length === 0) {
      return {
        success: false,
        message: 'No shifts available for auto-assignment',
      };
    }

    // Convert in-time to minutes from midnight
    const inMinutes = inTime.getHours() * 60 + inTime.getMinutes();

    // Find shift with start time closest to in-time
    let nearestShift = null;
    let minDifference = Infinity;

    for (const shift of shifts) {
      const shiftStartMinutes = timeToMinutes(shift.startTime);
      
      // Calculate difference (handle overnight shifts)
      let difference = Math.abs(inMinutes - shiftStartMinutes);
      
      // If difference is more than 12 hours, consider it might be next day
      if (difference > 12 * 60) {
        difference = 24 * 60 - difference;
      }

      if (difference < minDifference) {
        minDifference = difference;
        nearestShift = shift;
      }
    }

    if (!nearestShift) {
      return {
        success: false,
        message: 'Could not find nearest shift',
      };
    }

    // Calculate late-in and early-out
    const lateInMinutes = calculateLateIn(inTime, nearestShift.startTime, nearestShift.gracePeriod || 15);
    const earlyOutMinutes = outTime ? calculateEarlyOut(outTime, nearestShift.endTime) : null;

    return {
      success: true,
      assignedShift: nearestShift._id,
      shiftName: nearestShift.name,
      source: 'auto_assign_nearest',
      lateInMinutes: lateInMinutes > 0 ? lateInMinutes : null,
      earlyOutMinutes: earlyOutMinutes && earlyOutMinutes > 0 ? earlyOutMinutes : null,
      isLateIn: lateInMinutes > 0,
      isEarlyOut: earlyOutMinutes && earlyOutMinutes > 0,
      expectedHours: nearestShift.duration,
      differenceMinutes: minDifference,
    };

  } catch (error) {
    console.error('Error in auto-assign nearest shift:', error);
    return {
      success: false,
      message: error.message || 'Error auto-assigning nearest shift',
    };
  }
};

module.exports = {
  detectAndAssignShift,
  resolveConfusedShift,
  getShiftsForEmployee,
  findMatchingShifts,
  findMatchingShiftsByOutTime,
  calculateLateIn,
  calculateEarlyOut,
  isWithinShiftWindow,
  syncShiftsForExistingRecords,
  autoAssignNearestShift,
};

