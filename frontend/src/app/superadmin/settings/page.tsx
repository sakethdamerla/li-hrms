'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

type TabType = 'shift' | 'employee' | 'leaves' | 'attendance' | 'payroll' | 'general';

interface ShiftDuration {
  _id: string;
  duration: number;
  label?: string;
  isActive: boolean;
}

interface LeaveType {
  code: string;
  name: string;
  description?: string;
  maxDays?: number;
  carryForward?: boolean;
  isActive: boolean;
}

interface ODType {
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
}

interface WorkflowStep {
  stepOrder: number;
  stepName: string;
  approverRole: string;
  availableActions: string[];
  approvedStatus: string;
  rejectedStatus: string;
  nextStepOnApprove: number | null;
  isActive: boolean;
}

interface LeaveSettings {
  leaveTypes: LeaveType[];
  workflow: {
    isEnabled: boolean;
    steps: WorkflowStep[];
    finalAuthority: {
      role: string;
      anyHRCanApprove: boolean;
    };
  };
  settings: {
    allowBackdated: boolean;
    maxBackdatedDays: number;
    allowFutureDated: boolean;
    maxAdvanceDays: number;
  };
}

interface ODSettings {
  odTypes: ODType[];
  workflow: {
    isEnabled: boolean;
    steps: WorkflowStep[];
  };
}

// Icon Components
const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
    <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
  </svg>
);

const DeleteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
  </svg>
);

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('shift');
  const [shiftDurations, setShiftDurations] = useState<ShiftDuration[]>([]);
  const [newDuration, setNewDuration] = useState<number | ''>('');
  const [newLabel, setNewLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit modal state
  const [editingDuration, setEditingDuration] = useState<ShiftDuration | null>(null);
  const [editDuration, setEditDuration] = useState<number | ''>('');
  const [editLabel, setEditLabel] = useState('');

  // Employee settings state
  const [employeeDataSource, setEmployeeDataSource] = useState<string>('mongodb');
  const [employeeDeleteTarget, setEmployeeDeleteTarget] = useState<string>('both');
  const [mssqlConnected, setMssqlConnected] = useState(false);
  const [employeeSettingsLoading, setEmployeeSettingsLoading] = useState(false);

  // Leave settings state
  const [leaveSettings, setLeaveSettings] = useState<LeaveSettings | null>(null);
  const [odSettings, setODSettings] = useState<ODSettings | null>(null);
  const [leaveSettingsLoading, setLeaveSettingsLoading] = useState(false);
  const [leaveSubTab, setLeaveSubTab] = useState<'types' | 'odTypes' | 'workflow' | 'odWorkflow' | 'general'>('types');
  
  // New leave type form
  const [newLeaveType, setNewLeaveType] = useState({ code: '', name: '', description: '', maxDays: 12 });
  const [newODType, setNewODType] = useState({ code: '', name: '', description: '' });

  useEffect(() => {
    if (activeTab === 'shift') {
      loadShiftDurations();
    } else if (activeTab === 'employee') {
      loadEmployeeSettings();
    } else if (activeTab === 'leaves') {
      loadLeaveSettings();
    }
  }, [activeTab]);

  const loadShiftDurations = async () => {
    try {
      setLoading(true);
      const response = await api.getShiftDurations();
      
      if (response.success) {
        const durations = response.durations || [];
        setShiftDurations(Array.isArray(durations) ? durations : []);
      } else {
        setMessage({ type: 'error', text: response.message || 'Failed to load shift durations' });
        setShiftDurations([]);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'An error occurred while loading durations' });
      setShiftDurations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployeeSettings = async () => {
    try {
      setEmployeeSettingsLoading(true);
      
      // Get current employee settings
      const empSettingsRes = await api.getEmployeeSettings();
      if (empSettingsRes.success && empSettingsRes.data) {
        setEmployeeDataSource(empSettingsRes.data.dataSource || 'mongodb');
        setEmployeeDeleteTarget(empSettingsRes.data.deleteTarget || 'both');
        setMssqlConnected(empSettingsRes.data.mssqlConnected || false);
      }
    } catch (err) {
      console.error('Error loading employee settings:', err);
    } finally {
      setEmployeeSettingsLoading(false);
    }
  };

  const loadLeaveSettings = async () => {
    try {
      setLeaveSettingsLoading(true);
      
      // Load leave settings
      const leaveRes = await api.getLeaveSettings('leave');
      if (leaveRes.success && leaveRes.data) {
        setLeaveSettings(leaveRes.data);
      } else {
        // Initialize with defaults if not found
        setLeaveSettings({
          leaveTypes: [
            { code: 'CL', name: 'Casual Leave', maxDays: 12, carryForward: false, isActive: true },
            { code: 'SL', name: 'Sick Leave', maxDays: 12, carryForward: false, isActive: true },
            { code: 'EL', name: 'Earned Leave', maxDays: 15, carryForward: true, isActive: true },
            { code: 'ML', name: 'Maternity Leave', maxDays: 180, carryForward: false, isActive: true },
            { code: 'PL', name: 'Paternity Leave', maxDays: 15, carryForward: false, isActive: true },
            { code: 'LWP', name: 'Leave Without Pay', carryForward: false, isActive: true },
          ],
          workflow: {
            isEnabled: true,
            steps: [
              { stepOrder: 1, stepName: 'HOD Approval', approverRole: 'hod', availableActions: ['approve', 'reject', 'forward'], approvedStatus: 'hod_approved', rejectedStatus: 'hod_rejected', nextStepOnApprove: 2, isActive: true },
              { stepOrder: 2, stepName: 'HR Approval', approverRole: 'hr', availableActions: ['approve', 'reject'], approvedStatus: 'approved', rejectedStatus: 'hr_rejected', nextStepOnApprove: null, isActive: true },
            ],
            finalAuthority: { role: 'hr', anyHRCanApprove: true },
          },
          settings: {
            allowBackdated: false,
            maxBackdatedDays: 7,
            allowFutureDated: true,
            maxAdvanceDays: 90,
          },
        });
      }

      // Load OD settings
      const odRes = await api.getLeaveSettings('od');
      if (odRes.success && odRes.data) {
        setODSettings(odRes.data);
      } else {
        setODSettings({
          odTypes: [
            { code: 'OFFICIAL', name: 'Official Work', isActive: true },
            { code: 'TRAINING', name: 'Training', isActive: true },
            { code: 'MEETING', name: 'Meeting', isActive: true },
            { code: 'CLIENT', name: 'Client Visit', isActive: true },
            { code: 'CONF', name: 'Conference', isActive: true },
            { code: 'FIELD', name: 'Field Work', isActive: true },
          ],
          workflow: {
            isEnabled: true,
            steps: [
              { stepOrder: 1, stepName: 'HOD Approval', approverRole: 'hod', availableActions: ['approve', 'reject', 'forward'], approvedStatus: 'hod_approved', rejectedStatus: 'hod_rejected', nextStepOnApprove: 2, isActive: true },
              { stepOrder: 2, stepName: 'HR Approval', approverRole: 'hr', availableActions: ['approve', 'reject'], approvedStatus: 'approved', rejectedStatus: 'hr_rejected', nextStepOnApprove: null, isActive: true },
            ],
          },
        });
      }
    } catch (err) {
      console.error('Error loading leave settings:', err);
      setMessage({ type: 'error', text: 'Failed to load leave settings' });
    } finally {
      setLeaveSettingsLoading(false);
    }
  };

  const handleAddLeaveType = async () => {
    if (!newLeaveType.code || !newLeaveType.name) {
      setMessage({ type: 'error', text: 'Code and Name are required' });
      return;
    }

    const updatedTypes = [...(leaveSettings?.leaveTypes || []), { ...newLeaveType, isActive: true }];
    
    try {
      setSaving(true);
      const response = await api.updateLeaveSettings('leave', { 
        ...leaveSettings, 
        leaveTypes: updatedTypes 
      });
      
      if (response.success) {
        setLeaveSettings(prev => prev ? { ...prev, leaveTypes: updatedTypes } : null);
        setNewLeaveType({ code: '', name: '', description: '', maxDays: 12 });
        setMessage({ type: 'success', text: 'Leave type added successfully' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to add leave type' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLeaveType = async (code: string) => {
    if (!confirm('Are you sure you want to delete this leave type?')) return;
    
    const updatedTypes = leaveSettings?.leaveTypes.filter(t => t.code !== code) || [];
    
    try {
      setSaving(true);
      const response = await api.updateLeaveSettings('leave', { 
        ...leaveSettings, 
        leaveTypes: updatedTypes 
      });
      
      if (response.success) {
        setLeaveSettings(prev => prev ? { ...prev, leaveTypes: updatedTypes } : null);
        setMessage({ type: 'success', text: 'Leave type deleted' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete leave type' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddODType = async () => {
    if (!newODType.code || !newODType.name) {
      setMessage({ type: 'error', text: 'Code and Name are required' });
      return;
    }

    const updatedTypes = [...(odSettings?.odTypes || []), { ...newODType, isActive: true }];
    
    try {
      setSaving(true);
      const response = await api.updateLeaveSettings('od', { 
        ...odSettings, 
        odTypes: updatedTypes 
      });
      
      if (response.success) {
        setODSettings(prev => prev ? { ...prev, odTypes: updatedTypes } : null);
        setNewODType({ code: '', name: '', description: '' });
        setMessage({ type: 'success', text: 'OD type added successfully' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to add OD type' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteODType = async (code: string) => {
    if (!confirm('Are you sure you want to delete this OD type?')) return;
    
    const updatedTypes = odSettings?.odTypes.filter(t => t.code !== code) || [];
    
    try {
      setSaving(true);
      const response = await api.updateLeaveSettings('od', { 
        ...odSettings, 
        odTypes: updatedTypes 
      });
      
      if (response.success) {
        setODSettings(prev => prev ? { ...prev, odTypes: updatedTypes } : null);
        setMessage({ type: 'success', text: 'OD type deleted' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete OD type' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLeaveWorkflow = async () => {
    if (!leaveSettings) return;
    
    try {
      setSaving(true);
      const response = await api.updateLeaveSettings('leave', leaveSettings);
      
      if (response.success) {
        setMessage({ type: 'success', text: 'Leave workflow saved successfully' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save workflow' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveODWorkflow = async () => {
    if (!odSettings) return;
    
    try {
      setSaving(true);
      const response = await api.updateLeaveSettings('od', odSettings);
      
      if (response.success) {
        setMessage({ type: 'success', text: 'OD workflow saved successfully' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save workflow' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLeaveGeneralSettings = async () => {
    if (!leaveSettings) return;
    
    try {
      setSaving(true);
      const response = await api.updateLeaveSettings('leave', leaveSettings);
      
      if (response.success) {
        setMessage({ type: 'success', text: 'Leave settings saved successfully' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmployeeSettings = async () => {
    try {
      setSaving(true);
      setMessage(null);

      // Save data source setting
      await api.upsertSetting({
        key: 'employee_data_source',
        value: employeeDataSource,
        description: 'Source database for fetching employee data',
        category: 'employee',
      });

      // Save delete target setting
      await api.upsertSetting({
        key: 'employee_delete_target',
        value: employeeDeleteTarget,
        description: 'Target database(s) for employee deletion',
        category: 'employee',
      });

      setMessage({ type: 'success', text: 'Employee settings saved successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save employee settings' });
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddDuration = async () => {
    if (newDuration && Number(newDuration) > 0) {
      try {
        setSaving(true);
        setMessage(null);

        const response = await api.createShiftDuration({
          duration: Number(newDuration),
          label: newLabel || `${newDuration} hours`,
        });

        if (response.success) {
          setNewDuration('');
          setNewLabel('');
          setMessage({ type: 'success', text: 'Duration added successfully!' });
          loadShiftDurations();
        } else {
          setMessage({ type: 'error', text: response.message || 'Failed to add duration' });
        }
      } catch (err) {
        setMessage({ type: 'error', text: 'An error occurred' });
      } finally {
        setSaving(false);
      }
    }
  };

  const handleEditClick = (duration: ShiftDuration) => {
    setEditingDuration(duration);
    setEditDuration(duration.duration);
    setEditLabel(duration.label || '');
  };

  const handleEditSave = async () => {
    if (!editingDuration || !editDuration) return;

    try {
      setSaving(true);
      const response = await api.updateShiftDuration(editingDuration._id, {
        duration: Number(editDuration),
        label: editLabel || `${editDuration} hours`,
      });

      if (response.success) {
        setMessage({ type: 'success', text: 'Duration updated successfully!' });
        setEditingDuration(null);
        loadShiftDurations();
      } else {
        setMessage({ type: 'error', text: response.message || 'Failed to update duration' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'An error occurred' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDuration = async (id: string) => {
    if (!confirm('Are you sure you want to delete this duration?')) return;

    try {
      const response = await api.deleteShiftDuration(id);
      if (response.success) {
        setMessage({ type: 'success', text: 'Duration deleted successfully!' });
        loadShiftDurations();
      } else {
        setMessage({ type: 'error', text: response.message || 'Failed to delete duration' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'An error occurred' });
    }
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'shift', label: 'Shift' },
    { id: 'employee', label: 'Employee' },
    { id: 'leaves', label: 'Leaves' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'payroll', label: 'Payroll' },
    { id: 'general', label: 'General' },
  ];

  const leaveSubTabs = [
    { id: 'types', label: 'Leave Types' },
    { id: 'odTypes', label: 'OD Types' },
    { id: 'workflow', label: 'Leave Workflow' },
    { id: 'odWorkflow', label: 'OD Workflow' },
    { id: 'general', label: 'General' },
  ];

  return (
    <div className="relative min-h-screen">
      {/* Background Pattern */}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#e2e8f01f_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f01f_1px,transparent_1px)] bg-[size:28px_28px] dark:bg-[linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.12)_1px,transparent_1px)]" />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-blue-50/40 via-indigo-50/35 to-transparent dark:from-slate-900/60 dark:via-slate-900/65 dark:to-slate-900/80" />

      <div className="relative z-10 p-6 sm:p-8 lg:p-10">
        {/* Header Section */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white/95 px-6 py-5 shadow-[0_8px_26px_rgba(30,64,175,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/90 sm:px-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 sm:text-3xl">
              Settings
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Configure system settings and preferences
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-lg dark:border-slate-800 dark:bg-slate-950/95">
          <nav className="flex space-x-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setMessage(null);
                }}
                className={`flex-1 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'shift' && (
          <div className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950/95 sm:p-8">
            <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">Shift Durations</h2>
            <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
              Configure allowed shift durations. These durations will be available when creating shifts.
            </p>

            {message && (
              <div
                className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
                  message.type === 'success'
                    ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="mb-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/30 p-5 dark:border-slate-700 dark:from-slate-900/50 dark:to-blue-900/10">
              <label className="mb-3 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Add New Duration
              </label>
              <div className="flex gap-3">
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={newDuration}
                  onChange={(e) => setNewDuration(Number(e.target.value))}
                  className="w-32 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Hours"
                />
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Label (e.g., Full Day)"
                />
                <button
                  onClick={handleAddDuration}
                  disabled={saving || !newDuration}
                  className="rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-600 hover:to-indigo-600 hover:shadow-xl hover:shadow-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/50 py-12 dark:border-slate-700 dark:bg-slate-900/50">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Loading durations...</p>
              </div>
            ) : shiftDurations.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/50">
                <p className="text-sm text-slate-500 dark:text-slate-400">No durations configured</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {shiftDurations.map((duration) => (
                  <div
                    key={duration._id}
                    className="group relative flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-all hover:border-blue-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {duration.duration}h
                      </span>
                      {duration.label && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">{duration.label}</span>
                      )}
                    </div>

                    {!duration.isActive && (
                      <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                        Off
                      </span>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditClick(duration)}
                        className="relative rounded-lg p-1.5 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
                        title="Edit"
                      >
                        <EditIcon />
                      </button>
                      <button
                        onClick={() => handleDeleteDuration(duration._id)}
                        className="relative rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                        title="Delete"
                      >
                        <DeleteIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'employee' && (
          <div className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950/95 sm:p-8">
            <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">Employee Settings</h2>
            <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
              Configure how employee data is stored and retrieved between MongoDB and MSSQL databases.
            </p>

            {message && (
              <div
                className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
                  message.type === 'success'
                    ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'
                }`}
              >
                {message.text}
              </div>
            )}

            {/* MSSQL Connection Status */}
            <div className={`mb-6 flex items-center gap-3 rounded-2xl border p-4 ${
              mssqlConnected 
                ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' 
                : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
            }`}>
              <div className={`h-3 w-3 rounded-full ${mssqlConnected ? 'bg-green-500' : 'bg-amber-500'}`}></div>
              <span className={`text-sm font-medium ${
                mssqlConnected 
                  ? 'text-green-700 dark:text-green-400' 
                  : 'text-amber-700 dark:text-amber-400'
              }`}>
                MSSQL (HRMS Database): {mssqlConnected ? 'Connected' : 'Not Connected'}
              </span>
            </div>

            {employeeSettingsLoading ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/50 py-12 dark:border-slate-700 dark:bg-slate-900/50">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Loading settings...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Data Source Setting */}
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/30 p-5 dark:border-slate-700 dark:from-slate-900/50 dark:to-blue-900/10">
                  <label className="mb-3 block text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Data Source (for fetching employees)
                  </label>
                  <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                    Choose which database to fetch employee data from when viewing the employee list.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { value: 'mongodb', label: 'MongoDB', desc: 'Fetch from MongoDB database' },
                      { value: 'mssql', label: 'MSSQL', desc: 'Fetch from SQL Server (HRMS)' },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all ${
                          employeeDataSource === option.value
                            ? 'border-blue-400 bg-blue-50 shadow-md dark:border-blue-600 dark:bg-blue-900/30'
                            : 'border-slate-200 bg-white hover:border-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="dataSource"
                          value={option.value}
                          checked={employeeDataSource === option.value}
                          onChange={(e) => setEmployeeDataSource(e.target.value)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{option.label}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{option.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Delete Target Setting */}
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-red-50/30 p-5 dark:border-slate-700 dark:from-slate-900/50 dark:to-red-900/10">
                  <label className="mb-3 block text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Delete From (when deleting employees)
                  </label>
                  <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                    Choose which database(s) to delete employee data from when removing an employee.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { value: 'mongodb', label: 'MongoDB Only', desc: 'Delete from MongoDB only' },
                      { value: 'mssql', label: 'MSSQL Only', desc: 'Delete from SQL Server only' },
                      { value: 'both', label: 'Both Databases', desc: 'Delete from both databases' },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all ${
                          employeeDeleteTarget === option.value
                            ? 'border-red-400 bg-red-50 shadow-md dark:border-red-600 dark:bg-red-900/30'
                            : 'border-slate-200 bg-white hover:border-red-200 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="deleteTarget"
                          value={option.value}
                          checked={employeeDeleteTarget === option.value}
                          onChange={(e) => setEmployeeDeleteTarget(e.target.value)}
                          className="h-4 w-4 text-red-600 focus:ring-red-500"
                        />
                        <div>
                          <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{option.label}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{option.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Info Box */}
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                  <h4 className="mb-2 text-sm font-semibold text-blue-800 dark:text-blue-300">ℹ️ How it works</h4>
                  <ul className="space-y-1 text-xs text-blue-700 dark:text-blue-400">
                    <li>• <strong>Create/Update:</strong> Always saves to BOTH databases for data consistency</li>
                    <li>• <strong>Read:</strong> Fetches from your selected data source</li>
                    <li>• <strong>Delete:</strong> Removes from your selected target database(s)</li>
                  </ul>
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSaveEmployeeSettings}
                  disabled={saving}
                  className="w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-600 hover:to-indigo-600 hover:shadow-xl hover:shadow-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Employee Settings'}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'leaves' && (
          <div className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950/95 sm:p-8">
            <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">Leave & OD Settings</h2>
            <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
              Configure leave types, OD types, and approval workflows.
            </p>

            {message && (
              <div
                className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
                  message.type === 'success'
                    ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'
                }`}
              >
                {message.text}
              </div>
            )}

            {/* Sub Tabs */}
            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
              <nav className="flex flex-wrap gap-1">
                {leaveSubTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setLeaveSubTab(tab.id as typeof leaveSubTab);
                      setMessage(null);
                    }}
                    className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                      leaveSubTab === tab.id
                        ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {leaveSettingsLoading ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/50 py-12 dark:border-slate-700 dark:bg-slate-900/50">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Loading settings...</p>
              </div>
            ) : (
              <>
                {/* Leave Types */}
                {leaveSubTab === 'types' && (
                  <div className="space-y-6">
                    {/* Add New Leave Type */}
                    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-green-50/30 p-5 dark:border-slate-700 dark:from-slate-900/50 dark:to-green-900/10">
                      <label className="mb-3 block text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Add New Leave Type
                      </label>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                        <input
                          type="text"
                          value={newLeaveType.code}
                          onChange={(e) => setNewLeaveType(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          placeholder="Code (e.g., CL)"
                        />
                        <input
                          type="text"
                          value={newLeaveType.name}
                          onChange={(e) => setNewLeaveType(prev => ({ ...prev, name: e.target.value }))}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:col-span-2"
                          placeholder="Name (e.g., Casual Leave)"
                        />
                        <input
                          type="number"
                          value={newLeaveType.maxDays}
                          onChange={(e) => setNewLeaveType(prev => ({ ...prev, maxDays: Number(e.target.value) }))}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          placeholder="Max Days"
                        />
                        <button
                          onClick={handleAddLeaveType}
                          disabled={saving || !newLeaveType.code || !newLeaveType.name}
                          className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-green-500/30 transition-all hover:from-green-600 hover:to-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Leave Types List */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700">
                      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Configured Leave Types</h3>
                      </div>
                      <div className="divide-y divide-slate-200 dark:divide-slate-700">
                        {leaveSettings?.leaveTypes && leaveSettings.leaveTypes.length > 0 ? (
                          leaveSettings.leaveTypes.map((type) => (
                            <div key={type.code} className="flex items-center justify-between px-4 py-3">
                              <div className="flex items-center gap-4">
                                <span className="rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                                  {type.code}
                                </span>
                                <div>
                                  <span className="font-medium text-slate-900 dark:text-slate-100">{type.name}</span>
                                  {type.maxDays && (
                                    <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                                      (Max: {type.maxDays} days)
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteLeaveType(type.code)}
                                className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                title="Delete"
                              >
                                <DeleteIcon />
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                            No leave types configured. Add one above.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* OD Types */}
                {leaveSubTab === 'odTypes' && (
                  <div className="space-y-6">
                    {/* Add New OD Type */}
                    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-purple-50/30 p-5 dark:border-slate-700 dark:from-slate-900/50 dark:to-purple-900/10">
                      <label className="mb-3 block text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Add New OD Type
                      </label>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                        <input
                          type="text"
                          value={newODType.code}
                          onChange={(e) => setNewODType(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          placeholder="Code (e.g., TRAINING)"
                        />
                        <input
                          type="text"
                          value={newODType.name}
                          onChange={(e) => setNewODType(prev => ({ ...prev, name: e.target.value }))}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:col-span-2"
                          placeholder="Name (e.g., Training Program)"
                        />
                        <button
                          onClick={handleAddODType}
                          disabled={saving || !newODType.code || !newODType.name}
                          className="rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition-all hover:from-purple-600 hover:to-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* OD Types List */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700">
                      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Configured OD Types</h3>
                      </div>
                      <div className="divide-y divide-slate-200 dark:divide-slate-700">
                        {odSettings?.odTypes && odSettings.odTypes.length > 0 ? (
                          odSettings.odTypes.map((type) => (
                            <div key={type.code} className="flex items-center justify-between px-4 py-3">
                              <div className="flex items-center gap-4">
                                <span className="rounded-lg bg-purple-100 px-2.5 py-1 text-xs font-bold text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                                  {type.code}
                                </span>
                                <span className="font-medium text-slate-900 dark:text-slate-100">{type.name}</span>
                              </div>
                              <button
                                onClick={() => handleDeleteODType(type.code)}
                                className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                title="Delete"
                              >
                                <DeleteIcon />
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                            No OD types configured. Add one above.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Leave Workflow */}
                {leaveSubTab === 'workflow' && (
                  <div className="space-y-6">
                    {/* Workflow Enable Toggle */}
                    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/30 p-5 dark:border-slate-700 dark:from-slate-900/50 dark:to-blue-900/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Enable Workflow</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Multi-step approval process for leave requests</p>
                        </div>
                        <label className="relative inline-flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            checked={leaveSettings?.workflow.isEnabled || false}
                            onChange={(e) => setLeaveSettings(prev => prev ? {
                              ...prev,
                              workflow: { ...prev.workflow, isEnabled: e.target.checked }
                            } : null)}
                            className="peer sr-only"
                          />
                          <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:border-slate-600 dark:bg-slate-700 dark:peer-focus:ring-blue-800"></div>
                        </label>
                      </div>
                    </div>

                    {/* Workflow Steps */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700">
                      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Approval Flow</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Define the approval hierarchy</p>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-4">
                          {leaveSettings?.workflow?.steps && leaveSettings.workflow.steps.map((step, index) => (
                            <div key={step.stepOrder} className="flex items-center gap-4">
                              <div className="flex flex-col items-center">
                                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                                  step.approverRole === 'hod' 
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                                    : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                                }`}>
                                  <span className="text-lg font-bold">{step.stepOrder}</span>
                                </div>
                                <span className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">{step.stepName}</span>
                                <span className="text-[10px] uppercase text-slate-400">{step.approverRole}</span>
                              </div>
                              {index < (leaveSettings?.workflow?.steps?.length || 0) - 1 && (
                                <div className="flex items-center">
                                  <div className="h-0.5 w-8 bg-slate-300 dark:bg-slate-600"></div>
                                  <span className="text-slate-400">→</span>
                                  <div className="h-0.5 w-8 bg-slate-300 dark:bg-slate-600"></div>
                                </div>
                              )}
                            </div>
                          ))}
                          <div className="flex flex-col items-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                              ✓
                            </div>
                            <span className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">Approved</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Final Authority */}
                    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-green-50/30 p-5 dark:border-slate-700 dark:from-slate-900/50 dark:to-green-900/10">
                      <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Final Authority</h3>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="finalAuthority"
                            checked={leaveSettings?.workflow.finalAuthority.role === 'hr'}
                            onChange={() => setLeaveSettings(prev => prev ? {
                              ...prev,
                              workflow: { ...prev.workflow, finalAuthority: { ...prev.workflow.finalAuthority, role: 'hr' } }
                            } : null)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300">HR</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="finalAuthority"
                            checked={leaveSettings?.workflow.finalAuthority.role === 'super_admin'}
                            onChange={() => setLeaveSettings(prev => prev ? {
                              ...prev,
                              workflow: { ...prev.workflow, finalAuthority: { ...prev.workflow.finalAuthority, role: 'super_admin' } }
                            } : null)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300">Super Admin Only</span>
                        </label>
                      </div>
                      <label className="mt-3 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={leaveSettings?.workflow.finalAuthority.anyHRCanApprove || false}
                          onChange={(e) => setLeaveSettings(prev => prev ? {
                            ...prev,
                            workflow: { ...prev.workflow, finalAuthority: { ...prev.workflow.finalAuthority, anyHRCanApprove: e.target.checked } }
                          } : null)}
                          className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">Any HR can give final approval</span>
                      </label>
                    </div>

                    <button
                      onClick={handleSaveLeaveWorkflow}
                      disabled={saving}
                      className="w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-600 hover:to-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Leave Workflow'}
                    </button>
                  </div>
                )}

                {/* OD Workflow */}
                {leaveSubTab === 'odWorkflow' && (
                  <div className="space-y-6">
                    {/* Workflow Enable Toggle */}
                    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-purple-50/30 p-5 dark:border-slate-700 dark:from-slate-900/50 dark:to-purple-900/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Enable OD Workflow</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Multi-step approval process for OD requests</p>
                        </div>
                        <label className="relative inline-flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            checked={odSettings?.workflow.isEnabled || false}
                            onChange={(e) => setODSettings(prev => prev ? {
                              ...prev,
                              workflow: { ...prev.workflow, isEnabled: e.target.checked }
                            } : null)}
                            className="peer sr-only"
                          />
                          <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-purple-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:border-slate-600 dark:bg-slate-700 dark:peer-focus:ring-purple-800"></div>
                        </label>
                      </div>
                    </div>

                    {/* OD Workflow Steps */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700">
                      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">OD Approval Flow</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Same flow as leave by default</p>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-4">
                          {odSettings?.workflow?.steps && odSettings.workflow.steps.map((step, index) => (
                            <div key={step.stepOrder} className="flex items-center gap-4">
                              <div className="flex flex-col items-center">
                                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                                  step.approverRole === 'hod' 
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                                }`}>
                                  <span className="text-lg font-bold">{step.stepOrder}</span>
                                </div>
                                <span className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">{step.stepName}</span>
                                <span className="text-[10px] uppercase text-slate-400">{step.approverRole}</span>
                              </div>
                              {index < (odSettings?.workflow?.steps?.length || 0) - 1 && (
                                <div className="flex items-center">
                                  <div className="h-0.5 w-8 bg-slate-300 dark:bg-slate-600"></div>
                                  <span className="text-slate-400">→</span>
                                  <div className="h-0.5 w-8 bg-slate-300 dark:bg-slate-600"></div>
                                </div>
                              )}
                            </div>
                          ))}
                          <div className="flex flex-col items-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                              ✓
                            </div>
                            <span className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">Approved</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveODWorkflow}
                      disabled={saving}
                      className="w-full rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition-all hover:from-purple-600 hover:to-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save OD Workflow'}
                    </button>
                  </div>
                )}

                {/* General Leave Settings */}
                {leaveSubTab === 'general' && (
                  <div className="space-y-6">
                    {/* Backdated Leave */}
                    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-amber-50/30 p-5 dark:border-slate-700 dark:from-slate-900/50 dark:to-amber-900/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Allow Backdated Leave</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Allow employees to apply leave for past dates</p>
                        </div>
                        <label className="relative inline-flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            checked={leaveSettings?.settings.allowBackdated || false}
                            onChange={(e) => setLeaveSettings(prev => prev ? {
                              ...prev,
                              settings: { ...prev.settings, allowBackdated: e.target.checked }
                            } : null)}
                            className="peer sr-only"
                          />
                          <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-amber-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 dark:border-slate-600 dark:bg-slate-700 dark:peer-focus:ring-amber-800"></div>
                        </label>
                      </div>
                      {leaveSettings?.settings.allowBackdated && (
                        <div className="mt-4">
                          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                            Maximum backdated days
                          </label>
                          <input
                            type="number"
                            value={leaveSettings?.settings.maxBackdatedDays || 7}
                            onChange={(e) => setLeaveSettings(prev => prev ? {
                              ...prev,
                              settings: { ...prev.settings, maxBackdatedDays: Number(e.target.value) }
                            } : null)}
                            className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </div>
                      )}
                    </div>

                    {/* Future Dated Leave */}
                    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/30 p-5 dark:border-slate-700 dark:from-slate-900/50 dark:to-blue-900/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Allow Future Dated Leave</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Allow employees to apply leave in advance</p>
                        </div>
                        <label className="relative inline-flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            checked={leaveSettings?.settings.allowFutureDated !== false}
                            onChange={(e) => setLeaveSettings(prev => prev ? {
                              ...prev,
                              settings: { ...prev.settings, allowFutureDated: e.target.checked }
                            } : null)}
                            className="peer sr-only"
                          />
                          <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:border-slate-600 dark:bg-slate-700 dark:peer-focus:ring-blue-800"></div>
                        </label>
                      </div>
                      {leaveSettings?.settings.allowFutureDated !== false && (
                        <div className="mt-4">
                          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                            Maximum advance days
                          </label>
                          <input
                            type="number"
                            value={leaveSettings?.settings.maxAdvanceDays || 90}
                            onChange={(e) => setLeaveSettings(prev => prev ? {
                              ...prev,
                              settings: { ...prev.settings, maxAdvanceDays: Number(e.target.value) }
                            } : null)}
                            className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleSaveLeaveGeneralSettings}
                      disabled={saving}
                      className="w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-600 hover:to-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save General Settings'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950/95 sm:p-8">
            <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">Attendance Settings</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Attendance-related settings will be configured here.</p>
          </div>
        )}

        {activeTab === 'payroll' && (
          <div className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950/95 sm:p-8">
            <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">Payroll Settings</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Payroll-related settings will be configured here.</p>
          </div>
        )}

        {activeTab === 'general' && (
          <div className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950/95 sm:p-8">
            <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">General Settings</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">General system settings will be configured here.</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingDuration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit Duration</h3>
              <button
                onClick={() => setEditingDuration(null)}
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Duration (hours)
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={editDuration}
                  onChange={(e) => setEditDuration(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Label
                </label>
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  placeholder="e.g., Full Day"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingDuration(null)}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={saving || !editDuration}
                  className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-600 hover:to-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
