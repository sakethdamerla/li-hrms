'use client';

import { useEffect, useState } from 'react';

export default function SuperAdminDashboard() {
  const [greeting, setGreeting] = useState('Welcome to the HRMS');
  
  useEffect(() => {
    const greetings = [
      'Welcome to the HRMS',
      'Come on Captain',
    ];
    setGreeting(greetings[Math.floor(Math.random() * greetings.length)]);
  }, []);

  return (
    <div className="relative min-h-screen">
      {/* Background Pattern */}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#e2e8f01f_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f01f_1px,transparent_1px)] bg-[size:28px_28px] dark:bg-[linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.12)_1px,transparent_1px)]" />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-blue-50/40 via-indigo-50/35 to-transparent dark:from-slate-900/60 dark:via-slate-900/65 dark:to-slate-900/80" />

      <div className="relative z-10 p-6 sm:p-8 lg:p-10">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-8 shadow-[0_8px_26px_rgba(30,64,175,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/90 sm:p-12">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/30">
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-4xl font-semibold text-slate-900 dark:text-slate-100 sm:text-5xl">
                  {greeting}
                </h1>
                <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">
                  Manage your human resources with ease and efficiency
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
