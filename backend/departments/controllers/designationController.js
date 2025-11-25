const Designation = require('../model/Designation');
const Department = require('../model/Department');
const User = require('../../users/model/User');

// @desc    Get all designations
// @route   GET /api/departments/:departmentId/designations
// @access  Private
exports.getDesignationsByDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { isActive } = req.query;

    const query = { department: departmentId };
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const designations = await Designation.find(query)
      .populate('department', 'name code')
      .populate('createdBy', 'name email')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: designations.length,
      data: designations,
    });
  } catch (error) {
    console.error('Error fetching designations:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching designations',
      error: error.message,
    });
  }
};

// @desc    Get single designation
// @route   GET /api/departments/designations/:id
// @access  Private
exports.getDesignation = async (req, res) => {
  try {
    const designation = await Designation.findById(req.params.id)
      .populate('department', 'name code')
      .populate('createdBy', 'name email');

    if (!designation) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found',
      });
    }

    res.status(200).json({
      success: true,
      data: designation,
    });
  } catch (error) {
    console.error('Error fetching designation:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching designation',
      error: error.message,
    });
  }
};

// @desc    Create designation
// @route   POST /api/departments/:departmentId/designations
// @access  Private (Super Admin, Sub Admin, HR)
exports.createDesignation = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { name, code, description, deductionRules, paidLeaves } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Designation name is required',
      });
    }

    // Verify department exists
    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    // Check if designation with same name exists in this department
    const existingDesignation = await Designation.findOne({
      department: departmentId,
      name: name.trim(),
    });

    if (existingDesignation) {
      return res.status(400).json({
        success: false,
        message: 'Designation with this name already exists in this department',
      });
    }

    const designation = await Designation.create({
      name: name.trim(),
      code: code ? code.trim().toUpperCase() : undefined,
      department: departmentId,
      description,
      deductionRules: deductionRules || [],
      paidLeaves: paidLeaves !== undefined ? Number(paidLeaves) : 0,
      createdBy: req.user?.userId,
    });

    res.status(201).json({
      success: true,
      message: 'Designation created successfully',
      data: designation,
    });
  } catch (error) {
    console.error('Error creating designation:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Designation with this name already exists in this department',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating designation',
      error: error.message,
    });
  }
};

// @desc    Update designation
// @route   PUT /api/departments/designations/:id
// @access  Private (Super Admin, Sub Admin, HR)
exports.updateDesignation = async (req, res) => {
  try {
    const { name, code, description, deductionRules, paidLeaves, isActive } = req.body;

    const designation = await Designation.findById(req.params.id);
    if (!designation) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found',
      });
    }

    // Check if name is being changed and conflicts with existing
    if (name && name.trim() !== designation.name) {
      const existingDesignation = await Designation.findOne({
        department: designation.department,
        name: name.trim(),
        _id: { $ne: designation._id },
      });

      if (existingDesignation) {
        return res.status(400).json({
          success: false,
          message: 'Designation with this name already exists in this department',
        });
      }
    }

    // Update fields
    if (name) designation.name = name.trim();
    if (code !== undefined) designation.code = code ? code.trim().toUpperCase() : undefined;
    if (description !== undefined) designation.description = description;
    if (deductionRules) designation.deductionRules = deductionRules;
    if (paidLeaves !== undefined) designation.paidLeaves = Number(paidLeaves);
    if (isActive !== undefined) designation.isActive = isActive;

    await designation.save();

    res.status(200).json({
      success: true,
      message: 'Designation updated successfully',
      data: designation,
    });
  } catch (error) {
    console.error('Error updating designation:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Designation with this name already exists in this department',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating designation',
      error: error.message,
    });
  }
};

// @desc    Delete designation
// @route   DELETE /api/departments/designations/:id
// @access  Private (Super Admin, Sub Admin)
exports.deleteDesignation = async (req, res) => {
  try {
    const designation = await Designation.findById(req.params.id);
    if (!designation) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found',
      });
    }

    // Check if designation has employees
    const employeeCount = await User.countDocuments({
      department: designation.department,
      // Note: You may need to add a designation field to User model if not exists
    });

    // For now, we'll just check if we can delete
    // You might want to add designation field to User model later
    await designation.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Designation deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting designation:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting designation',
      error: error.message,
    });
  }
};

