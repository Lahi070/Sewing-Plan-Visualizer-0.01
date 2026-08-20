'use client';

import React from 'react';
import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { MatchedReadinessItem } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

interface UrgentAlertsProps {
  items: MatchedReadinessItem[];
  onFilterUrgent: () => void;
  isFilteredUrgent: boolean;
}

export function UrgentAlerts({ items, onFilterUrgent, isFilteredUrgent }: UrgentAlertsProps) {
  const atRiskItems = items.filter((i) => i.overallStatus === 'AT_RISK');
  const delayedItems = items.filter((i) => i.overallStatus === 'NOT_READY');
  const totalUrgent = atRiskItems.length + delayedItems.length;

  if (totalUrgent === 0) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 to-navy-900/60 p-4 text-emerald-300 shadow-emerald-glow mb-6 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Floor Ready: No Critical 3-Day Delays</h3>
            <p className="text-xs text-emerald-400/90 mt-0.5">
              All sewing modules planned for the next 3 days have completed knitting and trims prerequisites.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const affectedModules = Array.from(
    new Set([...atRiskItems, ...delayedItems].map((i) => i.module))
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/60 via-navy-900/90 to-rose-950/60 p-4 sm:p-5 shadow-amber-glow mb-6 backdrop-blur-md relative overflow-hidden">
      {/* Top micro stitch pattern bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 animate-pulse" />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left icon & text */}
        <div className="flex items-start space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider">
                Action Required (3-Day Horizon)
              </span>
              <span className="text-xs font-semibold text-slate-300">
                {totalUrgent} requirement{totalUrgent === 1 ? '' : 's'} at risk
              </span>
            </div>
            <h3 className="text-base font-bold text-white mt-1">
              {delayedItems.length > 0 && `${delayedItems.length} Overdue/Delayed`}
              {delayedItems.length > 0 && atRiskItems.length > 0 && ' & '}
              {atRiskItems.length > 0 && `${atRiskItems.length} At Risk within 3 Days`}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Impacted modules:{' '}
              <span className="font-semibold text-amber-200 font-mono">
                {affectedModules.slice(0, 10).join(', ')}
                {affectedModules.length > 10 ? ` +${affectedModules.length - 10} more` : ''}
              </span>
            </p>
          </div>
        </div>

        {/* Right CTA Button */}
        <div className="flex items-center space-x-3 shrink-0 self-start md:self-center">
          <button
            onClick={onFilterUrgent}
            className={`inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all shadow-md ${
              isFilteredUrgent
                ? 'bg-slate-100 text-slate-950 hover:bg-white ring-2 ring-white/60'
                : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-amber-500/20 hover:scale-105 active:scale-95'
            }`}
          >
            <span>{isFilteredUrgent ? 'Showing 3-Day Risk Lines (Reset)' : 'Filter 3-Day Critical Lines'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
