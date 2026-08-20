'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, HelpCircle, ArrowUpRight } from 'lucide-react';
import { OverallMetrics, ReadinessStatus } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

interface MetricsOverviewProps {
  metrics: OverallMetrics;
  selectedStatus: ReadinessStatus | 'ALL';
  onSelectStatus: (status: ReadinessStatus | 'ALL') => void;
}

export function MetricsOverview({ metrics, selectedStatus, onSelectStatus }: MetricsOverviewProps) {
  const cards: {
    status: ReadinessStatus;
    title: string;
    count: number;
    pct: number;
    colorBg: string;
    colorBorder: string;
    colorText: string;
    icon: any;
    badgeBg: string;
    sublabel: string;
    glowClass: string;
  }[] = [
    {
      status: 'READY',
      title: 'Ready',
      count: metrics.readyCount,
      pct: metrics.readyPercentage,
      colorBg: 'bg-gradient-to-br from-emerald-950/60 to-navy-900/90 hover:from-emerald-900/50',
      colorBorder: 'border-emerald-500/30 hover:border-emerald-500/60',
      colorText: 'text-emerald-400',
      icon: CheckCircle2,
      badgeBg: 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30',
      sublabel: 'Knit & Trims verified',
      glowClass: 'shadow-emerald-glow',
    },
    {
      status: 'AT_RISK',
      title: 'At Risk',
      count: metrics.atRiskCount,
      pct: metrics.atRiskPercentage,
      colorBg: 'bg-gradient-to-br from-amber-950/60 to-navy-900/90 hover:from-amber-900/50',
      colorBorder: 'border-amber-500/30 hover:border-amber-500/60',
      colorText: 'text-amber-400',
      icon: AlertTriangle,
      badgeBg: 'bg-amber-950/80 text-amber-300 border border-amber-500/30',
      sublabel: 'Sewing in ≤ 3 days',
      glowClass: 'shadow-amber-glow',
    },
    {
      status: 'NOT_READY',
      title: 'Not Ready / Delayed',
      count: metrics.notReadyCount,
      pct: metrics.notReadyPercentage,
      colorBg: 'bg-gradient-to-br from-rose-950/60 to-navy-900/90 hover:from-rose-900/50',
      colorBorder: 'border-rose-500/30 hover:border-rose-500/60',
      colorText: 'text-rose-400',
      icon: XCircle,
      badgeBg: 'bg-rose-950/80 text-rose-300 border border-rose-500/30',
      sublabel: 'Date passed or today',
      glowClass: 'shadow-rose-glow',
    },
    {
      status: 'UPCOMING',
      title: 'Upcoming',
      count: metrics.upcomingCount,
      pct: metrics.totalItems > 0 ? Math.round((metrics.upcomingCount / metrics.totalItems) * 100) : 0,
      colorBg: 'bg-gradient-to-br from-sky-950/50 to-navy-900/90 hover:from-sky-900/40',
      colorBorder: 'border-sky-500/30 hover:border-sky-500/60',
      colorText: 'text-sky-400',
      icon: Clock,
      badgeBg: 'bg-sky-950/80 text-sky-300 border border-sky-500/30',
      sublabel: 'Sewing in > 3 days',
      glowClass: 'shadow-cyan-glow',
    },
    {
      status: 'NO_DATA',
      title: 'Missing Data',
      count: metrics.noDataCount,
      pct: metrics.totalItems > 0 ? Math.round((metrics.noDataCount / metrics.totalItems) * 100) : 0,
      colorBg: 'bg-gradient-to-br from-slate-900/80 to-navy-900/90 hover:from-slate-800/60',
      colorBorder: 'border-slate-700/60 hover:border-slate-600',
      colorText: 'text-slate-400',
      icon: HelpCircle,
      badgeBg: 'bg-slate-900/90 text-slate-300 border border-slate-700/60',
      sublabel: 'Missing Knit/Trims key',
      glowClass: 'shadow-navy-glow',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = selectedStatus === card.status;

        return (
          <button
            key={card.status}
            onClick={() => onSelectStatus(isSelected ? 'ALL' : card.status)}
            className={`text-left rounded-2xl p-4 transition-all duration-200 border backdrop-blur-md relative overflow-hidden group ${
              card.colorBg
            } ${
              isSelected
                ? `ring-2 ring-white/80 ${card.colorBorder} ${card.glowClass} scale-[1.02]`
                : `${card.colorBorder} hover:scale-[1.01]`
            }`}
          >
            {/* Top row: badge % & Icon */}
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full font-mono ${card.badgeBg}`}>
                {card.pct}%
              </span>
              <Icon className={`w-5 h-5 ${card.colorText} group-hover:scale-110 transition-transform`} />
            </div>

            {/* Big Count */}
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight">
              {formatNumber(card.count)}
            </div>

            {/* Label */}
            <div className="text-xs font-bold text-slate-200 mt-1 truncate">
              {card.title}
            </div>

            {/* Sublabel */}
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
              {card.sublabel}
            </div>

            {/* Selected Indicator Pill */}
            {isSelected && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-cyan-400" />
            )}
          </button>
        );
      })}
    </div>
  );
}
