'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ModuleSummary } from '@/lib/types';

interface ModuleRiskChartProps {
  moduleSummaries: ModuleSummary[];
  onSelectModule: (moduleName: string) => void;
}

export function ModuleRiskChart({ moduleSummaries, onSelectModule }: ModuleRiskChartProps) {
  // Sort modules with active requirements
  const chartData = moduleSummaries.slice(0, 15).map((m) => ({
    name: m.module,
    Ready: m.readyCount,
    'At Risk': m.atRiskCount,
    'Not Ready': m.notReadyCount,
    Upcoming: m.upcomingCount,
    'No Data': m.noDataCount,
    total: m.totalItems,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs min-w-[150px]">
          <div className="font-bold text-slate-900 border-b border-slate-100 pb-1 mb-1.5 flex justify-between">
            <span>Module {label}</span>
            <span className="text-slate-500 font-mono">
              {payload.reduce((sum: number, p: any) => sum + (p.value || 0), 0)} plans
            </span>
          </div>
          <div className="space-y-1">
            {payload.map((entry: any) => (
              <div key={entry.name} className="flex items-center justify-between text-slate-700">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span>{entry.name}:</span>
                </div>
                <span className="font-mono font-semibold">{entry.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-emerald-600 font-semibold text-center">
            Click bar to open module details
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Module Status Distribution</h3>
          <p className="text-xs text-slate-500">Readiness state per active sewing module</p>
        </div>
        <span className="text-xs text-slate-400 font-medium">Click module to drill down</span>
      </div>

      <div className="h-64 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            onClick={(e: any) => {
              if (e && e.activeLabel) {
                onSelectModule(e.activeLabel);
              }
            }}
            className="cursor-pointer"
          >
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span className="text-xs text-slate-700 font-medium mr-2">{value}</span>}
            />
            <Bar dataKey="Not Ready" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
            <Bar dataKey="At Risk" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Upcoming" stackId="a" fill="#94a3b8" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Ready" stackId="a" fill="#10b981" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
