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
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-emerald-900 shadow-xs mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-emerald-950">Floor Ready: No Critical 3-Day Delays</h3>
            <p className="text-xs text-emerald-800">
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
    <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50/70 to-rose-50/50 p-4 sm:p-5 shadow-sm mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left icon & text */}
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20 animate-pulse">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-200 text-amber-900 uppercase tracking-wider">
                Action Required (3-Day Horizon)
              </span>
              <span className="text-xs font-semibold text-slate-600">
                {totalUrgent} requirement{totalUrgent === 1 ? '' : 's'} at risk
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              {delayedItems.length > 0 && `${delayedItems.length} Overdue/Delayed`}
              {delayedItems.length > 0 && atRiskItems.length > 0 && ' & '}
              {atRiskItems.length > 0 && `${atRiskItems.length} At Risk within 3 Days`}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Impacted modules:{' '}
              <span className="font-semibold text-slate-900">
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
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
              isFilteredUrgent
                ? 'bg-slate-900 text-white ring-2 ring-slate-800'
                : 'bg-amber-600 text-white hover:bg-amber-700 active:scale-95'
            }`}
          >
            <span>{isFilteredUrgent ? 'Showing 3-Day Risk Lines (Reset)' : 'Filter 3-Day Critical Lines'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
