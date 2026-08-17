'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Layers, UploadCloud, RefreshCw, Database, Clock, ShieldCheck, Printer } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';
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

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-md shadow-slate-900/10 group-hover:bg-slate-800 transition-colors">
                <Layers className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-900 text-lg tracking-tight">
                    Sewing Readiness
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Floor v1.0
                  </span>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block">
                  Knitting & Raw Material Warehouse (Trims) Tracker
                </p>
              </div>
            </Link>
          </div>

          {/* Right Status & Actions */}
          <div className="flex items-center space-x-3">
            {/* Live Clock */}
            <div className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100/80 border border-slate-200/80 text-xs text-slate-600 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{timeStr || '--:--:--'}</span>
            </div>

            {/* Database indicator */}
            <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-slate-50 border-slate-200 text-slate-600">
              <Database className="w-3.5 h-3.5 text-slate-500" />
              <span>{isDbOnline ? 'Supabase Connected' : 'Local / Demo Mode'}</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isDbOnline ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-blue-400'
                }`}
              />
            </div>

            {/* Print Report */}
            <button
              onClick={handlePrint}
              title="Print Floor Report"
              className="no-print p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Refresh button */}
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                title="Refresh latest data"
                className="no-print p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
              </button>
            )}

            {/* Admin Upload Link */}
            <Link
              href="/upload"
              className="no-print inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold shadow-xs transition-all active:scale-95"
            >
              <UploadCloud className="w-4 h-4 text-emerald-400" />
              <span>Admin Upload</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
