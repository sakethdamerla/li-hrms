'use client';

import { useState, useEffect } from 'react';
import { api, Shift } from '@/lib/api';

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [allowedDurations, setAllowedDurations] = useState<number[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState<number | ''>('');
  const [inputMode, setInputMode] = useState<'time' | 'duration'>('time');
  const [error, setError] = useState('');

  useEffect(() => {
    loadShifts();
    loadAllowedDurations();
  }, []);

  const loadShifts = async () => {
    try {
      setLoading(true);
      const response = await api.getShifts();
      if (response.success && response.data) {
        setShifts(response.data);
      }
    } catch (err) {
      console.error('Error loading shifts:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllowedDurations = async () => {
    try {
      const response = await api.getAllowedDurations();
      if (response.success && response.data) {
        setAllowedDurations(response.data);
      }
    } catch (err) {
      console.error('Error loading durations:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const data: any = { name };

      if (inputMode === 'duration') {
        if (!startTime || !duration) {
          setError('Start time and duration are required');
          return;
        }
        data.startTime = startTime;
        data.duration = Number(duration);
      } else {
        if (!startTime || !endTime) {
          setError('Start time and end time are required');
          return;
        }
        data.startTime = startTime;
        data.endTime = endTime;
      }

      let response;
      if (editingShift) {
        response = await api.updateShift(editingShift._id, data);
      } else {
        response = await api.createShift(data);
      }

      if (response.success) {
        setShowForm(false);
        setEditingShift(null);
        resetForm();
        loadShifts();
      } else {
        setError(response.message || 'Failed to save shift');
      }
    } catch (err) {
      setError('An error occurred');
      console.error(err);
    }
  };

  const handleEdit = (shift: Shift) => {
    setEditingShift(shift);
    setName(shift.name);
    setStartTime(shift.startTime);
    setEndTime(shift.endTime);
    setDuration(shift.duration);
    setInputMode('time');
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this shift?')) return;

    try {
      const response = await api.deleteShift(id);
      if (response.success) {
        loadShifts();
      } else {
        alert(response.message || 'Failed to delete shift');
      }
    } catch (err) {
      console.error('Error deleting shift:', err);
    }
  };

  const resetForm = () => {
    setName('');
    setStartTime('');
    setEndTime('');
    setDuration('');
    setInputMode('time');
    setError('');
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingShift(null);
    resetForm();
  };

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
              Shift Management
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Create and manage work shifts
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="group relative inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-600 hover:to-indigo-600 hover:shadow-xl hover:shadow-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
          >
            <span className="text-lg">+</span>
            <span>Create Shift</span>
          </button>
        </div>

        {/* Create/Edit Shift Dialog */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
              onClick={handleCancel}
            />
            <div className="relative z-50 w-full max-w-2xl rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-2xl shadow-blue-500/10 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {editingShift ? 'Edit Shift' : 'Create New Shift'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {editingShift ? 'Update shift information' : 'Add a new shift to the system'}
                  </p>
                </div>
                <button
                  onClick={handleCancel}
                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition hover:border-red-200 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Shift Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="e.g., Morning Shift"
                  />
                </div>

                <div>
                  <label className="mb-3 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Input Mode
                  </label>
                  <div className="flex gap-4">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        value="time"
                        checked={inputMode === 'time'}
                        onChange={() => setInputMode('time')}
                        className="h-4 w-4 text-blue-600 focus:ring-2 focus:ring-blue-400"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Start & End Time</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        value="duration"
                        checked={inputMode === 'duration'}
                        onChange={() => setInputMode('duration')}
                        className="h-4 w-4 text-blue-600 focus:ring-2 focus:ring-blue-400"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Start Time & Duration</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>

                {inputMode === 'time' ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      End Time *
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Duration (hours) *
                    </label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      required
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="">Select duration</option>
                      {allowedDurations.map((dur) => (
                        <option key={dur} value={dur}>
                          {dur} hours
                        </option>
                      ))}
                    </select>
                    {allowedDurations.length === 0 && (
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        No durations configured. Please configure durations in Settings.
                      </p>
                    )}
                  </div>
                )}

                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-600 hover:to-indigo-600 hover:shadow-xl hover:shadow-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
                  >
                    {editingShift ? 'Update' : 'Create'} Shift
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Shifts Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white/95 py-16 shadow-lg dark:border-slate-800 dark:bg-slate-950/95">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
            <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-400">Loading shifts...</p>
          </div>
        ) : shifts.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white/95 p-12 text-center shadow-lg dark:border-slate-800 dark:bg-slate-950/95">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30">
              <svg className="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">No shifts found</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Create your first shift to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {shifts.map((shift) => (
              <div
                key={shift._id}
                className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-blue-100/40 transition-all hover:border-blue-300 hover:shadow-xl hover:shadow-blue-200/50 dark:border-slate-800 dark:bg-slate-950/95 dark:shadow-none dark:hover:border-slate-700"
              >
                {/* Gradient accent */}
                <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>

                <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{shift.name}</h3>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{shift.startTime} - {shift.endTime}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{shift.duration} hours</span>
                      </div>
                    </div>
                  </div>
                  <span
                    className={`ml-3 rounded-full px-3 py-1 text-xs font-semibold ${
                      shift.isActive
                        ? 'bg-green-100 text-green-700 shadow-sm dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {shift.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="flex gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <button
                    onClick={() => handleEdit(shift)}
                    className="flex-1 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-all hover:from-blue-100 hover:to-indigo-100 hover:shadow-md dark:border-blue-800 dark:from-blue-900/20 dark:to-indigo-900/20 dark:text-blue-300 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(shift._id)}
                    className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-pink-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition-all hover:from-red-100 hover:to-pink-100 hover:shadow-md dark:border-red-800 dark:from-red-900/20 dark:to-pink-900/20 dark:text-red-300 dark:hover:from-red-900/30 dark:hover:to-pink-900/30"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
