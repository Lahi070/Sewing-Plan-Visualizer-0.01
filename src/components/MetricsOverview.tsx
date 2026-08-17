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
  }[] = [
    {
      status: 'READY',
      title: 'Ready',
      count: metrics.readyCount,
      pct: metrics.readyPercentage,
      colorBg: 'bg-emerald-50/70 hover:bg-emerald-50',
      colorBorder: 'border-emerald-200',
      colorText: 'text-emerald-700',
      icon: CheckCircle2,
      badgeBg: 'bg-emerald-100 text-emerald-800',
      sublabel: 'Knit & Trims verified',
    },
    {
      status: 'AT_RISK',
      title: 'At Risk',
      count: metrics.atRiskCount,
      pct: metrics.atRiskPercentage,
      colorBg: 'bg-amber-50/70 hover:bg-amber-50',
      colorBorder: 'border-amber-200',
      colorText: 'text-amber-700',
      icon: AlertTriangle,
      badgeBg: 'bg-amber-100 text-amber-900',
      sublabel: 'Sewing in ≤ 3 days',
    },
    {
      status: 'NOT_READY',
      title: 'Not Ready / Delayed',
      count: metrics.notReadyCount,
      pct: metrics.notReadyPercentage,
      colorBg: 'bg-rose-50/70 hover:bg-rose-50',
      colorBorder: 'border-rose-200',
      colorText: 'text-rose-700',
      icon: XCircle,
      badgeBg: 'bg-rose-100 text-rose-800',
      sublabel: 'Date passed or today',
    },
    {
      status: 'UPCOMING',
      title: 'Upcoming',
      count: metrics.upcomingCount,
      pct: metrics.totalItems > 0 ? Math.round((metrics.upcomingCount / metrics.totalItems) * 100) : 0,
      colorBg: 'bg-slate-50 hover:bg-slate-100/80',
      colorBorder: 'border-slate-200',
      colorText: 'text-slate-700',
      icon: Clock,
      badgeBg: 'bg-slate-100 text-slate-800',
      sublabel: 'Sewing in > 3 days',
    },
    {
      status: 'NO_DATA',
      title: 'Missing Data',
      count: metrics.noDataCount,
      pct: metrics.totalItems > 0 ? Math.round((metrics.noDataCount / metrics.totalItems) * 100) : 0,
      colorBg: 'bg-gray-50 hover:bg-gray-100/80',
      colorBorder: 'border-gray-200',
      colorText: 'text-gray-600',
      icon: HelpCircle,
      badgeBg: 'bg-gray-200 text-gray-700',
      sublabel: 'Missing Knit/Trims key',
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
            className={`text-left rounded-2xl p-4 transition-all duration-200 border relative overflow-hidden group ${
              card.colorBg
            } ${card.colorBorder} ${
              isSelected
                ? 'ring-2 ring-slate-900 shadow-md scale-[1.02]'
                : 'hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold ${card.badgeBg}`}>
                <span>{card.pct}%</span>
              </span>
              <Icon className={`w-4 h-4 ${card.colorText}`} />
            </div>

            <div className="mt-2.5">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                {formatNumber(card.count)}
              </div>
              <div className="text-xs font-bold text-slate-800 mt-0.5 truncate">{card.title}</div>
              <div className="text-[11px] text-slate-500 truncate mt-0.5">{card.sublabel}</div>
            </div>

            {isSelected && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900" />
            )}
          </button>
        );
      })}
    </div>
  );
}
