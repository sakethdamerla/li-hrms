/**
 * Attendance Upload Controller
 * Handles Excel file uploads for attendance logs
 */

const AttendanceRawLog = require('../model/AttendanceRawLog');
const AttendanceDaily = require('../model/AttendanceDaily');
const { processAndAggregateLogs } = require('../services/attendanceSyncService');
const { detectAndAssignShift } = require('../../shifts/services/shiftDetectionService');
const { batchDetectExtraHours } = require('../services/extraHoursService');
const XLSX = require('xlsx');

/**
 * @desc    Upload attendance from Excel
 * @route   POST /api/attendance/upload
 * @access  Private (Super Admin, Sub Admin, HR)
 */
exports.uploadExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Excel file is required',
      });
    }

    // Parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Excel file is empty',
      });
    }

    // Expected columns: Employee Number, In-Time, Out-Time (optional)
    const rawLogs = [];
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // Try different column name variations
        const empNo = row['Employee Number'] || row['EmployeeNumber'] || row['Emp No'] || row['EmpNo'] || row['emp_no'];
        const inTime = row['In-Time'] || row['InTime'] || row['In Time'] || row['in_time'] || row['Check In'];
        const outTime = row['Out-Time'] || row['OutTime'] || row['Out Time'] || row['out_time'] || row['Check Out'];

        if (!empNo || !inTime) {
          errors.push(`Row ${i + 2}: Missing required fields (Employee Number, In-Time)`);
          continue;
        }

        // Parse dates
        const inTimeDate = new Date(inTime);
        if (isNaN(inTimeDate.getTime())) {
          errors.push(`Row ${i + 2}: Invalid In-Time format`);
          continue;
        }

        // Insert IN log
        const inLog = {
          employeeNumber: String(empNo).trim().toUpperCase(),
          timestamp: inTimeDate,
          type: 'IN',
          source: 'excel',
          date: formatDate(inTimeDate),
          rawData: row,
        };

        // Try to insert (will fail if duplicate)
        try {
          await AttendanceRawLog.create(inLog);
        } catch (error) {
          if (error.code !== 11000) {
            throw error;
          }
          // Duplicate - skip
        }

        rawLogs.push(inLog);

        // Insert OUT log if provided
        if (outTime) {
          const outTimeDate = new Date(outTime);
          if (!isNaN(outTimeDate.getTime())) {
            const outLog = {
              employeeNumber: String(empNo).trim().toUpperCase(),
              timestamp: outTimeDate,
              type: 'OUT',
              source: 'excel',
              date: formatDate(outTimeDate),
              rawData: row,
            };

            try {
              await AttendanceRawLog.create(outLog);
            } catch (error) {
              if (error.code !== 11000) {
                throw error;
              }
            }

            rawLogs.push(outLog);
          }
        }

      } catch (error) {
        errors.push(`Row ${i + 2}: ${error.message}`);
      }
    }

    // Process and aggregate
    const stats = await processAndAggregateLogs(rawLogs, false);

    // IMPORTANT: After processing logs, detect extra hours for all affected records
    // This ensures extra hours are calculated for all attendance records from Excel upload
    try {
      console.log('[ExcelUpload] Detecting extra hours for all processed records...');
      
      // Get unique dates from the processed logs
      const processedDates = [...new Set(rawLogs.map(log => {
        const d = new Date(log.timestamp);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }))];
      
      if (processedDates.length > 0) {
        const minDate = processedDates.sort()[0];
        const maxDate = processedDates.sort()[processedDates.length - 1];
        
        // Batch detect extra hours for all records in the date range
        const extraHoursStats = await batchDetectExtraHours(minDate, maxDate);
        console.log(`[ExcelUpload] Extra hours detection: ${extraHoursStats.message}`);
        
        // Add extra hours stats to response
        stats.extraHoursDetected = extraHoursStats.updated;
        stats.extraHoursProcessed = extraHoursStats.processed;
      }
    } catch (extraHoursError) {
      console.error('[ExcelUpload] Error detecting extra hours:', extraHoursError);
      // Don't fail the upload if extra hours detection fails
      stats.extraHoursError = extraHoursError.message;
    }

    res.status(200).json({
      success: true,
      message: `Successfully processed ${rawLogs.length} logs from Excel`,
      data: {
        totalRows: data.length,
        logsProcessed: rawLogs.length,
        rawLogsInserted: stats.rawLogsInserted,
        dailyRecordsCreated: stats.dailyRecordsCreated,
        dailyRecordsUpdated: stats.dailyRecordsUpdated,
        extraHoursDetected: stats.extraHoursDetected || 0,
        extraHoursProcessed: stats.extraHoursProcessed || 0,
        errors: errors.length > 0 ? errors : undefined,
      },
    });

  } catch (error) {
    console.error('Error uploading Excel:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload Excel file',
    });
  }
};

/**
 * Format date to YYYY-MM-DD
 */
const formatDate = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * @desc    Download Excel template
 * @route   GET /api/attendance/upload/template
 * @access  Private
 */
exports.downloadTemplate = async (req, res) => {
  try {
    // Create sample data
    const sampleData = [
      {
        'Employee Number': 'EMP001',
        'In-Time': new Date().toISOString(),
        'Out-Time': new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours later
      },
      {
        'Employee Number': 'EMP002',
        'In-Time': new Date().toISOString(),
        'Out-Time': '', // Optional
      },
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance_template.xlsx');
    res.send(buffer);

  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate template',
    });
  }
};

