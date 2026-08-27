'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Layers, UploadCloud, RefreshCw, Database, Clock, ShieldCheck, Printer, RotateCcw } from 'lucide-react';
import { isSupabaseConfigured, clearLocalDataset } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';

interface NavbarProps {
  lastUpdated?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function Navbar({ lastUpdated, onRefresh, isRefreshing }: NavbarProps) {
  const [timeStr, setTimeStr] = useState<string>('');
  const [isDbOnline, setIsDbOnline] = useState<boolean>(false);

  useEffect(() => {
    setIsDbOnline(isSupabaseConfigured());
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleHardRefresh = () => {
    if (typeof window !== 'undefined') {
      clearLocalDataset();
      window.location.reload();
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-navy-700/80 bg-navy-950/90 backdrop-blur-md shadow-lg shadow-navy-950/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-navy-800 border border-blue-400/30 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5 text-cyan-300" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-white text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                    Sewing Readiness
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                    Navy Edition
                  </span>
                </div>
                <p className="text-xs text-slate-400 hidden sm:block">
                  Knitting & Raw Material Warehouse (Trims) Tracker
                </p>
              </div>
            </Link>
          </div>

          {/* Right Status & Actions */}
          <div className="flex items-center space-x-3">
            {/* Live Clock */}
            <div className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-navy-900 border border-navy-700/70 text-slate-300 text-xs font-mono">
              <Clock className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>{timeStr || '00:00:00 AM'}</span>
            </div>

            {/* Sync / Database Badge */}
            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-navy-900 border border-navy-700/70 text-slate-300 text-xs font-medium">
              <Database className={`w-3.5 h-3.5 ${isDbOnline ? 'text-emerald-400' : 'text-cyan-400'}`} />
              <span>{isDbOnline ? 'Supabase Live' : 'Local / Demo Mode'}</span>
              <span className={`w-2 h-2 rounded-full ${isDbOnline ? 'bg-emerald-400 animate-ping' : 'bg-cyan-400'}`} />
            </div>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              title="Print Floor Readiness Summary"
              className="p-2 rounded-lg text-slate-300 hover:text-white bg-navy-900 hover:bg-navy-800 border border-navy-700/70 transition-colors no-print"
            >
              <Printer className="w-4 h-4 text-slate-400 hover:text-white" />
            </button>

            {/* Refresh / Re-Sync Button */}
            <button
              onClick={handleHardRefresh}
              title="Reset Cache & Refresh Data"
              className="p-2 rounded-lg text-slate-300 hover:text-white bg-navy-900 hover:bg-navy-800 border border-navy-700/70 transition-colors no-print group"
            >
              <RefreshCw className="w-4 h-4 text-cyan-400 group-hover:rotate-180 transition-transform duration-500" />
            </button>

            {/* Admin Upload Button */}
            <Link
              href="/upload"
              className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition-all border border-blue-400/30 hover:scale-[1.02] active:scale-[0.98] no-print"
            >
              <UploadCloud className="w-4 h-4 text-cyan-200" />
              <span>Admin Upload</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
