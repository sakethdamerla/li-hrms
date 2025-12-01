/**
 * Attendance Daily Model
 * Aggregated daily view - one document per employee per date
 */

const mongoose = require('mongoose');

const attendanceDailySchema = new mongoose.Schema(
  {
    employeeNumber: {
      type: String,
      required: [true, 'Employee number is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    date: {
      type: String, // YYYY-MM-DD format
      required: [true, 'Date is required'],
      index: true,
    },
    inTime: {
      type: Date,
      default: null,
    },
    outTime: {
      type: Date,
      default: null,
    },
    totalHours: {
      type: Number,
      default: null, // Calculated: (outTime - inTime) / (1000 * 60 * 60)
    },
    status: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'PARTIAL'],
      default: 'ABSENT',
    },
    source: {
      type: [String],
      enum: ['mssql', 'excel', 'manual'],
      default: [],
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },
    locked: {
      type: Boolean,
      default: false, // For manual overrides
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
    // Shift-related fields
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      default: null,
      index: true,
    },
    lateInMinutes: {
      type: Number,
      default: null, // Minutes late if in-time > shift start + grace period
    },
    earlyOutMinutes: {
      type: Number,
      default: null, // Minutes early if out-time < shift end
    },
    isLateIn: {
      type: Boolean,
      default: false,
    },
    isEarlyOut: {
      type: Boolean,
      default: false,
    },
    expectedHours: {
      type: Number,
      default: null, // Expected hours based on shift duration
    },
    // Overtime and extra hours
    otHours: {
      type: Number,
      default: 0, // Overtime hours (from approved OT request)
    },
    extraHours: {
      type: Number,
      default: 0, // Extra hours worked without OT request (auto-detected)
    },
    // Permission fields
    permissionHours: {
      type: Number,
      default: 0, // Total permission hours for the day
    },
    permissionCount: {
      type: Number,
      default: 0, // Number of permissions taken on this day
    },
  },
  {
    timestamps: true,
  }
);

// Unique index: one record per employee per date
attendanceDailySchema.index({ employeeNumber: 1, date: 1 }, { unique: true });

// Index for calendar queries
attendanceDailySchema.index({ date: 1 });

// Index for employee queries
attendanceDailySchema.index({ employeeNumber: 1, date: -1 });

// Method to calculate total hours
attendanceDailySchema.methods.calculateTotalHours = function() {
  if (this.inTime && this.outTime) {
    const diffMs = this.outTime.getTime() - this.inTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    this.totalHours = Math.round(diffHours * 100) / 100; // Round to 2 decimal places
    return this.totalHours;
  }
  return null;
};

// Pre-save hook to calculate total hours
attendanceDailySchema.pre('save', async function() {
  if (this.inTime && this.outTime) {
    this.calculateTotalHours();
  }
});

// Post-save hook to recalculate monthly summary and detect extra hours
attendanceDailySchema.post('save', async function() {
  try {
    const { recalculateOnAttendanceUpdate } = require('../services/summaryCalculationService');
    const { detectExtraHours } = require('../services/extraHoursService');
    
    // If shiftId was modified, we need to recalculate the entire month
    if (this.isModified('shiftId')) {
      const dateObj = new Date(this.date);
      const year = dateObj.getFullYear();
      const monthNumber = dateObj.getMonth() + 1;
      
      const Employee = require('../../employees/model/Employee');
      const employee = await Employee.findOne({ emp_no: this.employeeNumber, is_active: { $ne: false } });
      
      if (employee) {
        const { calculateMonthlySummary } = require('../services/summaryCalculationService');
        await calculateMonthlySummary(employee._id, employee.emp_no, year, monthNumber);
      }
    } else {
      // Regular update - just recalculate for that date's month
      await recalculateOnAttendanceUpdate(this.employeeNumber, this.date);
    }

    // Detect extra hours if outTime or shiftId was modified
    if (this.isModified('outTime') || this.isModified('shiftId')) {
      if (this.outTime && this.shiftId) {
        // Only detect if we have both outTime and shiftId
        await detectExtraHours(this.employeeNumber, this.date);
      }
    }
  } catch (error) {
    // Don't throw - this is a background operation
    console.error('Error in post-save hook:', error);
  }
});

module.exports = mongoose.model('AttendanceDaily', attendanceDailySchema);

