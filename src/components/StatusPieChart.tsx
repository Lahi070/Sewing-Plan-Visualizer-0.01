'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { OverallMetrics } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

interface StatusPieChartProps {
  metrics: OverallMetrics;
}

const COLORS: Record<string, string> = {
  Ready: '#10b981',
  'At Risk': '#f59e0b',
  'Not Ready / Delayed': '#f43f5e',
  Upcoming: '#38bdf8',
  'No Data': '#64748b',
};

export function StatusPieChart({ metrics }: StatusPieChartProps) {
  const data = [
    { name: 'Ready', value: metrics.readyCount, color: COLORS.Ready },
    { name: 'At Risk', value: metrics.atRiskCount, color: COLORS['At Risk'] },
    { name: 'Not Ready / Delayed', value: metrics.notReadyCount, color: COLORS['Not Ready / Delayed'] },
    { name: 'Upcoming', value: metrics.upcomingCount, color: COLORS.Upcoming },
    { name: 'No Data', value: metrics.noDataCount, color: COLORS['No Data'] },
  ].filter((item) => item.value > 0);

  if (metrics.totalItems === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-xs text-slate-500">
        No data available to display chart
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      const pct = Math.round((entry.value / metrics.totalItems) * 100);
      return (
        <div className="rounded-xl border border-navy-700 bg-navy-900/95 backdrop-blur-md p-3 shadow-xl text-xs text-slate-100">
          <div className="flex items-center space-x-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: entry.payload.color }}
            />
            <span className="font-bold text-white">{entry.name}</span>
          </div>
          <div className="mt-1 text-slate-300">
            <span className="font-mono font-bold text-cyan-300">{formatNumber(entry.value)}</span> SO_LI requirements ({pct}%)
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-navy-850 to-navy-900 rounded-3xl border border-navy-700/80 p-5 shadow-lg shadow-navy-950/40 flex flex-col justify-between backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-navy-700/60 pb-3">
        <div>
          <h3 className="text-sm font-bold text-white">Overall Readiness Breakdown</h3>
          <p className="text-xs text-slate-400">Distribution across all {metrics.totalItems} planned SO_LI requirements</p>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
          {metrics.readyPercentage}% Ready
        </span>
      </div>

      <div className="h-64 relative mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="#0B132B" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              iconSize={8}
              formatter={(value, entry: any) => (
                <span className="text-xs text-slate-300 font-medium mr-2">
                  {value} ({formatNumber(entry.payload.value)})
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label inside donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
          <span className="text-2xl font-extrabold text-white font-mono">
            {metrics.totalItems}
          </span>
          <span className="text-[10px] uppercase font-bold text-cyan-400/80 tracking-wider">
            Total Plans
          </span>
        </div>
      </div>
    </div>
  );
}
