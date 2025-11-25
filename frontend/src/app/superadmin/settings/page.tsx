'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

type TabType = 'shift' | 'attendance' | 'payroll' | 'general';

interface ShiftDuration {
  _id: string;
  duration: number;
  label?: string;
  isActive: boolean;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('shift');
  const [shiftDurations, setShiftDurations] = useState<ShiftDuration[]>([]);
  const [newDuration, setNewDuration] = useState<number | ''>('');
  const [newLabel, setNewLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (activeTab === 'shift') {
      loadShiftDurations();
    }
  }, [activeTab]);

  const loadShiftDurations = async () => {
    try {
      setLoading(true);
      const response = await api.getShiftDurations();
      console.log('Shift Durations API Response:', response);
      
      if (response.success && response.data) {
        // Backend returns: { success: true, count: number, data: number[], durations: ShiftDuration[] }
        // The durations array contains full objects with _id, duration, label, isActive
        const durations = response.data.durations || [];
        setShiftDurations(Array.isArray(durations) ? durations : []);
      } else {
        console.error('Failed to load durations:', response);
        setMessage({ type: 'error', text: response.message || 'Failed to load shift durations' });
        setShiftDurations([]);
      }
    } catch (err) {
      console.error('Error loading durations:', err);
      setMessage({ type: 'error', text: 'An error occurred while loading durations' });
      setShiftDurations([]);
    } finally {
      setLoading(false);
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
        console.error(err);
      } finally {
        setSaving(false);
      }
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
      console.error(err);
    }
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'shift', label: 'Shift Settings' },
    { id: 'attendance', label: 'Attendance Settings' },
    { id: 'payroll', label: 'Payroll Settings' },
    { id: 'general', label: 'General Settings' },
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
          <nav className="flex space-x-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
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
                  placeholder="Hours (e.g., 8)"
                />
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Label (optional, e.g., Full Day)"
                />
                <button
                  onClick={handleAddDuration}
                  disabled={saving || !newDuration}
                  className="rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-600 hover:to-indigo-600 hover:shadow-xl hover:shadow-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="space-y-3">
                {shiftDurations.map((duration) => (
                  <div
                    key={duration._id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 transition-all hover:border-blue-200 hover:bg-blue-50/30 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                  >
                    <div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {duration.duration} hours
                      </span>
                      {duration.label && (
                        <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">({duration.label})</span>
                      )}
                      {!duration.isActive && (
                        <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          Inactive
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteDuration(duration._id)}
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-all hover:border-red-300 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
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
    </div>
  );
}
