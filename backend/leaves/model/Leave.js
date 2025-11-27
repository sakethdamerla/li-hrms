const mongoose = require('mongoose');

/**
 * Leave Model
 * Handles leave applications with dynamic workflow
 */
const LeaveSchema = new mongoose.Schema(
  {
    // Employee who applied for leave
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Employee is required'],
    },

    // Employee number for quick reference
    emp_no: {
      type: String,
      required: true,
    },

    // Leave type (dynamic - values come from LeaveSettings)
    leaveType: {
      type: String,
      required: [true, 'Leave type is required'],
      trim: true,
    },

    // Start date of leave
    fromDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },

    // End date of leave
    toDate: {
      type: Date,
      required: [true, 'End date is required'],
    },

    // Number of days (calculated or manual)
    numberOfDays: {
      type: Number,
      required: true,
      min: [0.5, 'Minimum leave is half day'],
    },

    // Half day options
    isHalfDay: {
      type: Boolean,
      default: false,
    },

    halfDayType: {
      type: String,
      enum: ['first_half', 'second_half', null],
      default: null,
    },

    // Purpose/Reason for leave
    purpose: {
      type: String,
      required: [true, 'Purpose is required'],
      trim: true,
      maxlength: [500, 'Purpose cannot exceed 500 characters'],
    },

    // Contact number during leave
    contactNumber: {
      type: String,
      required: [true, 'Contact number during leave is required'],
      trim: true,
    },

    // Emergency contact (optional)
    emergencyContact: {
      type: String,
      trim: true,
    },

    // Address during leave (optional)
    addressDuringLeave: {
      type: String,
      trim: true,
    },

    // Current status
    status: {
      type: String,
      enum: ['draft', 'pending', 'hod_approved', 'hod_rejected', 'hr_approved', 'hr_rejected', 'approved', 'rejected', 'cancelled'],
      default: 'draft',
    },

    // Workflow tracking
    workflow: {
      // Current step in workflow
      currentStep: {
        type: String,
        enum: ['employee', 'hod', 'hr', 'final', 'completed'],
        default: 'employee',
      },

      // Next approver role
      nextApprover: {
        type: String,
        enum: ['hod', 'hr', 'final_authority', null],
        default: null,
      },

      // Workflow history
      history: [
        {
          step: String,
          action: {
            type: String,
            enum: ['submitted', 'approved', 'rejected', 'forwarded', 'returned', 'cancelled'],
          },
          actionBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
          },
          actionByName: String,
          actionByRole: String,
          comments: String,
          timestamp: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },

    // Approvals record
    approvals: {
      hod: {
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected', 'forwarded', null],
          default: null,
        },
        approvedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        approvedAt: Date,
        comments: String,
      },
      hr: {
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected', null],
          default: null,
        },
        approvedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        approvedAt: Date,
        comments: String,
      },
      final: {
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected', null],
          default: null,
        },
        approvedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        approvedAt: Date,
        comments: String,
      },
    },

    // Department at the time of application
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
    },

    // Designation at the time of application
    designation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Designation',
    },

    // Attachments (medical certificates, etc.)
    attachments: [
      {
        name: String,
        url: String,
        type: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Applied by (the user who submitted)
    appliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Applied at timestamp
    appliedAt: {
      type: Date,
    },

    // Cancellation details
    cancellation: {
      cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      cancelledAt: Date,
      reason: String,
    },

    // Is this leave active (not deleted)
    isActive: {
      type: Boolean,
      default: true,
    },

    // Financial year reference
    financialYear: {
      type: String, // e.g., "2024-2025"
    },

    // Notes/remarks
    remarks: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
LeaveSchema.index({ employeeId: 1, status: 1 });
LeaveSchema.index({ emp_no: 1 });
LeaveSchema.index({ department: 1, status: 1 });
LeaveSchema.index({ fromDate: 1, toDate: 1 });
LeaveSchema.index({ status: 1, 'workflow.nextApprover': 1 });
LeaveSchema.index({ appliedAt: -1 });

// Calculate number of days before save
LeaveSchema.pre('save', function (next) {
  if (this.isModified('fromDate') || this.isModified('toDate')) {
    if (this.fromDate && this.toDate) {
      const diffTime = Math.abs(this.toDate - this.fromDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both days
      
      if (this.isHalfDay) {
        this.numberOfDays = 0.5;
      } else {
        this.numberOfDays = diffDays;
      }
    }
  }
  next();
});

// Virtual for display name
LeaveSchema.virtual('statusDisplay').get(function () {
  const statusMap = {
    draft: 'Draft',
    pending: 'Pending',
    hod_approved: 'HOD Approved',
    hod_rejected: 'HOD Rejected',
    hr_approved: 'HR Approved',
    hr_rejected: 'HR Rejected',
    approved: 'Approved',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  };
  return statusMap[this.status] || this.status;
});

// Method to check if leave can be edited
LeaveSchema.methods.canEdit = function () {
  return ['draft', 'pending'].includes(this.status);
};

// Method to check if leave can be cancelled
LeaveSchema.methods.canCancel = function () {
  return ['draft', 'pending', 'hod_approved'].includes(this.status);
};

// Static method to get pending approvals for a role
LeaveSchema.statics.getPendingForRole = async function (role, departmentIds = []) {
  const query = {
    isActive: true,
    'workflow.nextApprover': role,
  };

  if (departmentIds.length > 0) {
    query.department = { $in: departmentIds };
  }

  return this.find(query)
    .populate('employeeId', 'employee_name emp_no')
    .populate('department', 'name')
    .populate('designation', 'name')
    .sort({ appliedAt: -1 });
};

module.exports = mongoose.model('Leave', LeaveSchema);

