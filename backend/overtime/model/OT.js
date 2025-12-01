/**
 * Overtime (OT) Model
 * Stores overtime requests and approved overtime records
 */

const mongoose = require('mongoose');

const otSchema = new mongoose.Schema(
  {
    // Employee reference
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Employee is required'],
      index: true,
    },

    employeeNumber: {
      type: String,
      required: [true, 'Employee number is required'],
      trim: true,
      uppercase: true,
      index: true,
    },

    // Date of overtime (YYYY-MM-DD)
    date: {
      type: String,
      required: [true, 'Date is required'],
      index: true,
    },

    // Attendance record reference
    attendanceRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttendanceDaily',
      default: null,
    },

    // Shift information
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      required: [true, 'Shift is required'],
    },

    // Employee's in-time for that day
    employeeInTime: {
      type: Date,
      required: true,
    },

    // Shift's normal end time (this becomes OT In Time)
    shiftEndTime: {
      type: String, // HH:mm format
      required: true,
    },

    // OT In Time (same as shift end time)
    otInTime: {
      type: Date,
      required: true,
    },

    // OT Out Time (entered by HOD)
    otOutTime: {
      type: Date,
      required: true,
    },

    // Calculated OT hours
    otHours: {
      type: Number,
      required: true,
      min: 0,
    },

    // Status: pending, approved, rejected
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },

    // Request details
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    requestedAt: {
      type: Date,
      default: Date.now,
    },

    // Approval details
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    // Rejection details
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },

    // Comments/notes
    comments: {
      type: String,
      trim: true,
      default: null,
    },

    // ConfusedShift handling
    confusedShiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ConfusedShift',
      default: null,
    },

    manuallySelectedShiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      default: null, // Shift manually selected by HOD if ConfusedShift exists
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
otSchema.index({ employeeId: 1, date: 1 });
otSchema.index({ employeeNumber: 1, date: 1 });
otSchema.index({ status: 1, date: -1 });
otSchema.index({ date: 1 });

// Method to calculate OT hours
otSchema.methods.calculateOTHours = function() {
  if (this.otInTime && this.otOutTime) {
    const diffMs = this.otOutTime.getTime() - this.otInTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    this.otHours = Math.round(diffHours * 100) / 100; // Round to 2 decimal places
    return this.otHours;
  }
  return 0;
};

// Pre-save hook to calculate OT hours
otSchema.pre('save', function() {
  if (this.otInTime && this.otOutTime && !this.otHours) {
    this.calculateOTHours();
  }
});

module.exports = mongoose.model('OT', otSchema);

