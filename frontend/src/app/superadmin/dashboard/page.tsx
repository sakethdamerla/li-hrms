'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type InAppNotification } from '@/lib/api';
import {
  Calendar,
  Bell,
  BellRing, X,
  CheckCheck,
  Users,
  UserCheck,
  Timer,
  ClipboardCheck,
  TrendingUp,
  Cake,
  Activity,
  PlusCircle,
  FileBarChart,
  Settings
} from 'lucide-react';
import { useSocket } from '@/contexts/SocketContext';
import { useDashboardPushBell } from '@/hooks/useDashboardPushBell';
import {
  AttendancePulse,
  LeaveSpectrum,
  WorkforceHeatmap,
  DashboardCard,
  LeaveODStackedTrends
} from './components/HRWidgets';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  totalDepartments: number;
  totalUsers: number;
  todayPresent: number;
  todayAbsent: number;
  todayOnLeave: number;
  todayODs: number;
  pendingLeaves: number;
  pendingODs: number;
  pendingPermissions: number;
  pendingApplications: number;
  monthlyPresent: number;
  attendanceRate: number;
  departmentLeaveDistribution: Record<string, number>;
  leaveTypeDistribution: Record<string, number>;
  departmentHeadcount: Array<{ name: string, count: number }>;
  newEmployeesThisMonth: number;
  resignedThisMonth: number;
  weeklyTracker: any[];
  divisionAttendanceToday: any[];
  onLeaveEmployeesList: any[];
  upcomingBirthdays: any[];
  presentRateToday: number;
  performanceDeltaVsYesterday: number;
}

const DEFAULT_STATS: DashboardStats = {
  totalEmployees: 0,
  activeEmployees: 0,
  totalDepartments: 0,
  totalUsers: 0,
  todayPresent: 0,
  todayAbsent: 0,
  todayOnLeave: 0,
  todayODs: 0,
  pendingLeaves: 0,
  pendingODs: 0,
  pendingPermissions: 0,
  pendingApplications: 0,
  monthlyPresent: 0,
  attendanceRate: 0,
  departmentLeaveDistribution: {},
  leaveTypeDistribution: {},
  departmentHeadcount: [],
  newEmployeesThisMonth: 0,
  resignedThisMonth: 0,
  weeklyTracker: [],
  divisionAttendanceToday: [],
  onLeaveEmployeesList: [],
  upcomingBirthdays: [],
  presentRateToday: 0,
  performanceDeltaVsYesterday: 0,
};

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { socket } = useSocket();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [trackerPeriod, setTrackerPeriod] = useState<'week' | 'month' | 'lastMonth'>('week');
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { pushSubscribed } = useDashboardPushBell(true);

  const [trendPeriod, setTrendPeriod] = useState<'week' | 'month' | 'lastMonth'>('week');
  const [trendsData, setTrendsData] = useState<any[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);

  const loadTrendsData = useCallback(async () => {
    try {
      setTrendsLoading(true);
      const res = await (api as any).getLeaveODTrends(trendPeriod);
      if (res.success && res.data) {
        setTrendsData(res.data);
      }
    } catch (err) {
      console.error('Failed to load leave/OD trends:', err);
    } finally {
      setTrendsLoading(false);
    }
  }, [trendPeriod]);

  useEffect(() => {
    loadTrendsData();
  }, [loadTrendsData]);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getDashboardAnalytics(trackerPeriod);
      if (res.success && res.data) {
        setStats({ ...DEFAULT_STATS, ...res.data });
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [trackerPeriod]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        setNotificationLoading(true);
        const [listRes, countRes] = await Promise.all([
          api.getNotifications({ page: 1, limit: 15 }),
          api.getNotificationUnreadCount(),
        ]);
        if (listRes?.success) setNotifications(listRes.data || []);
        if (countRes?.success) {
          setUnreadCount(Number(countRes.unreadCount ?? countRes.data?.unreadCount ?? 0));
        }
      } catch (err) {
        console.error('Failed to load notifications:', err);
      } finally {
        setNotificationLoading(false);
      }
    };
    loadNotifications();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onNew = (n: InAppNotification) => {
      setNotifications((p) => [n, ...p].slice(0, 15));
      if (!n.isRead) setUnreadCount((c) => c + 1);
    };
    const onCount = (payload: { unreadCount: number }) => {
      setUnreadCount(Number(payload?.unreadCount || 0));
    };
    socket.on('in_app_notification', onNew);
    socket.on('notification_unread_count', onCount);
    return () => {
      socket.off('in_app_notification', onNew);
      socket.off('notification_unread_count', onCount);
    };
  }, [socket]);

  const markOneRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const getBirthdayBadgeLabel = (emp: any) => {
    const normalize = (value: string) => value.trim().toUpperCase();
    const incomingLabel = typeof emp?.label === 'string' ? normalize(emp.label) : '';
    if (incomingLabel === 'TODAY' || incomingLabel === 'TOMORROW' || incomingLabel === 'TOMMOROW') {
      return incomingLabel === 'TOMMOROW' ? 'TOMORROW' : incomingLabel;
    }

    if (!emp?.nextBirthday) return '';

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const bday = new Date(emp.nextBirthday);
    const asKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const bdayKey = asKey(bday);

    if (bdayKey === asKey(today)) return 'TODAY';
    if (bdayKey === asKey(tomorrow)) return 'TOMORROW';
    return '';
  };

  return (
    <div className="min-h-screen bg-[#f6f8fc] p-4 font-sans dark:bg-[#09090b] sm:p-6">

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">Dashboard</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Real-time workforce intelligence & analytics</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-[#7E7E7E] shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <button
                onClick={() => setNotificationPanelOpen(true)}
                title={
                  pushSubscribed === true
                    ? 'Push notifications active on this device'
                    : pushSubscribed === false
                      ? 'Push not registered — allow notifications in the prompt or browser settings'
                      : 'Notifications'
                }
                className={`relative flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors ${
                  unreadCount > 0 ? 'animate-bell-wrap-pulse' : ''
                } ${
                  pushSubscribed === true
                    ? 'border-emerald-500/70 bg-emerald-50 text-emerald-700 hover:text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:text-emerald-200'
                    : pushSubscribed === false
                      ? 'border-amber-400/80 bg-amber-50 text-amber-800 hover:text-amber-900 dark:border-amber-500/45 dark:bg-amber-950/35 dark:text-amber-200 dark:hover:text-amber-100'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-white'
                }`}
                aria-label="Open notifications"
              >
                {unreadCount > 0 ? (
                  <BellRing className="h-4 w-4 animate-bell-ring" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
            {/* Main column */}
            <div className="space-y-7">
              {loading ? (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-32 animate-pulse rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />
                    ))}
                  </div>
                  <div className="h-80 animate-pulse rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />
                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <div className="h-72 animate-pulse rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />
                    <div className="h-72 animate-pulse rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />
                  </div>
                </>
              ) : (
                <>
                  {/* ── Stat Cards Row 1: Workforce Snapshot ── */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {[
                      {
                        title: 'Active Employees',
                        value: stats.activeEmployees ?? 0,
                        accent: '#2D5BFF',
                        iconBg: 'bg-blue-50 dark:bg-blue-950/50',
                        border: 'border-blue-100 dark:border-blue-900/60',
                        meta: 'Total workforce',
                        icon: (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        ),
                      },
                      {
                        title: 'Present Today',
                        value: stats.todayPresent ?? 0,
                        accent: '#059669',
                        iconBg: 'bg-emerald-50 dark:bg-emerald-950/50',
                        border: 'border-emerald-100 dark:border-emerald-900/60',
                        meta: "Clocked in today",
                        icon: (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ),
                      },
                      {
                        title: 'Absent Today',
                        value: stats.todayAbsent ?? 0,
                        accent: '#EF4444',
                        iconBg: 'bg-red-50 dark:bg-red-950/50',
                        border: 'border-red-100 dark:border-red-900/60',
                        meta: 'Not checked in',
                        icon: (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ),
                      },
                      {
                        title: 'On Leave',
                        value: stats.todayOnLeave ?? 0,
                        accent: '#F59E0B',
                        iconBg: 'bg-amber-50 dark:bg-amber-950/40',
                        border: 'border-amber-100 dark:border-amber-900/60',
                        meta: 'Approved leave',
                        icon: (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        ),
                      },
                    ].map((cell) => (
                      <div
                        key={cell.title}
                        className={`group flex items-start justify-between gap-2 rounded-2xl border ${cell.border} bg-white px-4 py-3.5 shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-900`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{cell.title}</p>
                          <p className="mt-1.5 text-4xl font-black tabular-nums tracking-tight" style={{ color: cell.accent }}>{cell.value}</p>
                          <p className="mt-1 text-[10px] font-medium text-zinc-400">{cell.meta}</p>
                        </div>
                        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cell.iconBg}`} style={{ color: cell.accent }}>
                          {cell.icon}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ── Stat Cards Row 2: Today's OD + Monthly Changes ── */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[
                      {
                        title: 'On OD Today',
                        value: stats.todayODs ?? 0,
                        accent: '#7C3AED',
                        iconBg: 'bg-violet-50 dark:bg-violet-950/40',
                        border: 'border-violet-100 dark:border-violet-900/60',
                        meta: 'On-duty assignments',
                        icon: (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        ),
                      },
                      {
                        title: 'Joined This Month',
                        value: stats.newEmployeesThisMonth ?? 0,
                        accent: '#0EA5E9',
                        iconBg: 'bg-sky-50 dark:bg-sky-950/40',
                        border: 'border-sky-100 dark:border-sky-900/60',
                        meta: 'New joiners',
                        icon: (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                          </svg>
                        ),
                      },
                      {
                        title: 'Resigned This Month',
                        value: stats.resignedThisMonth ?? 0,
                        accent: '#F43F5E',
                        iconBg: 'bg-rose-50 dark:bg-rose-950/40',
                        border: 'border-rose-100 dark:border-rose-900/60',
                        meta: 'Attrition this month',
                        icon: (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                        ),
                      },
                    ].map((cell) => (
                      <div
                        key={cell.title}
                        className={`group flex items-start justify-between gap-2 rounded-2xl border ${cell.border} bg-white px-4 py-3.5 shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-900`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{cell.title}</p>
                          <p className="mt-1.5 text-4xl font-black tabular-nums tracking-tight" style={{ color: cell.accent }}>{cell.value}</p>
                          <p className="mt-1 text-[10px] font-medium text-zinc-400">{cell.meta}</p>
                        </div>
                        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cell.iconBg}`} style={{ color: cell.accent }}>
                          {cell.icon}
                        </div>
                      </div>
                    ))}
                  </div>

                  <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Attendance Pulse</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Organization-wide participation trend</p>
                      </div>
                      <select
                        value={trackerPeriod}
                        onChange={(e) => setTrackerPeriod(e.target.value as any)}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                      >
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="lastMonth">Last Month</option>
                      </select>
                    </div>
                    <AttendancePulse data={stats.weeklyTracker} />
                  </section>

                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <DashboardCard title="Leave Spectrum" subtitle="Current month composition" icon={FileBarChart}>
                      <LeaveSpectrum data={stats.leaveTypeDistribution} />
                    </DashboardCard>

                    <DashboardCard title="Department Load" subtitle="Workforce distribution" icon={Settings}>
                      <WorkforceHeatmap data={stats.departmentHeadcount} />
                    </DashboardCard>
                  </div>

                  <DashboardCard title="Leave & OD Request Trends" subtitle="Volume of requests and status distribution" icon={FileBarChart}>
                    <LeaveODStackedTrends
                      data={trendsData}
                      loading={trendsLoading}
                      trackerPeriod={trendPeriod}
                      onTrackerPeriodChange={setTrendPeriod}
                    />
                  </DashboardCard>
                </>
              )}
            </div>

            {/* Right Column: Actions & Feed */}
            <div className="space-y-5">
                  {/* Birthday Widget */}
                  <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="mb-6 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                          <Cake className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-zinc-900 dark:text-white leading-tight">Future Birthdays</h3>
                          <p className="text-[10px] font-medium text-zinc-400">Upcoming celebrations</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1 dark:bg-emerald-900/20">
                        <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-600">{(stats.upcomingBirthdays || []).length}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {(stats.upcomingBirthdays || []).slice(0, 4).map((emp: any) => {
                        const designation =
                          emp.designation_id?.name ||
                          emp.designation?.name ||
                          emp.designationName ||
                          emp.designation ||
                          emp.designation_id ||
                          emp.post_name ||
                          '—';
                        const employeeId = emp.empNo || emp.emp_no || emp.employeeId || '—';
                        const division = emp.division?.name || emp.divisionName || '—';
                        const department = emp.department?.name || emp.departmentName || '—';
                        return (
                          <div
                            key={emp.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50/60 px-3 py-2.5 transition-all hover:border-emerald-100 dark:border-zinc-800 dark:bg-zinc-900/40"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-zinc-900 dark:text-white">{emp.name}</p>
                              <p className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                                {employeeId} • {designation}
                              </p>
                              <p className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                                {department}
                              </p>
                              <p className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                                {division}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase text-emerald-600 dark:bg-emerald-900/20">
                              {getBirthdayBadgeLabel(emp) || new Date(emp.nextBirthday || emp.dob).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {(stats.upcomingBirthdays || []).length === 0 && (
                      <div className="flex flex-col items-center justify-center py-10">
                        <Cake className="mb-2 h-6 w-6 text-zinc-200" />
                        <p className="text-[10px] font-medium text-zinc-400">No birthdays this month</p>
                      </div>
                    )}

                    <button className="mt-6 w-full rounded-xl border border-dashed border-zinc-200 py-2.5 text-[9px] font-black uppercase tracking-widest text-zinc-400 transition-all hover:border-zinc-300 hover:text-zinc-600 dark:border-zinc-800">
                      Explore All Celebrations
                    </button>
                  </section>

                  {/* Activity Timeline */}
                  <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="mb-5 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-violet-600" />
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Recent Activity</h3>
                    </div>
                    <div className="relative space-y-8 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-zinc-200 dark:before:bg-zinc-800">
                      {notifications.slice(0, 4).map((n) => (
                        <div key={n._id} className="relative flex gap-4 pl-8">
                          <div className="absolute left-0 top-1 h-8 w-8 rounded-full border-4 border-white bg-emerald-500 shadow-sm dark:border-zinc-900" />
                          <div>
                            <p className="text-xs font-bold text-zinc-900 dark:text-white">{n.title}</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{n.message}</p>
                            <time className="mt-2 block text-[9px] font-bold uppercase text-zinc-400">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </time>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>

            {/* Notification Panel Overlay */}
              <AnimatePresence>
                {notificationPanelOpen && (
                  <div className="fixed inset-0 z-[150] flex justify-end">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setNotificationPanelOpen(false)}
                      className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
                    />
                    <motion.div
                      initial={{ x: '100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: '100%' }}
                      className="relative h-full w-full max-w-md bg-white shadow-2xl dark:bg-zinc-950 flex flex-col"
                    >
                      <div className="flex items-center justify-between border-b p-6 dark:border-zinc-800">
                        <div>
                          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Notifications</h3>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">Unread: {unreadCount}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={markAllRead}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                          >
                            <CheckCheck className="h-3.5 w-3.5" />
                            Read All
                          </button>
                          <button onClick={() => setNotificationPanelOpen(false)}>
                          <X className="h-6 w-6 text-zinc-400" />
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {notificationLoading ? (
                          <div className="text-xs text-zinc-500 p-2">Loading notifications...</div>
                        ) : notifications.length === 0 ? (
                          <div className="text-xs text-zinc-500 p-2">No notifications yet.</div>
                        ) : (
                          notifications.map((n) => (
                            <button
                              key={n._id}
                              onClick={() => !n.isRead && markOneRead(n._id)}
                              className={`w-full text-left rounded-2xl p-4 border transition-colors ${n.isRead
                                ? 'bg-zinc-50 border-zinc-100 dark:bg-zinc-900/50 dark:border-zinc-800'
                                : 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800'
                                }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-bold text-zinc-900 dark:text-white">{n.title}</p>
                                {!n.isRead && <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />}
                              </div>
                              <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">{n.message}</p>
                              <p className="text-[10px] text-zinc-400 mt-2 uppercase tracking-wider">
                                {n.module.replace('_', ' ')} | {new Date(n.createdAt).toLocaleString()}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
            );
}
