'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { X, CheckCircle2, AlertTriangle, XCircle, Clock, HelpCircle, Package, Scissors } from 'lucide-react';
import { ModuleSummary } from '@/lib/types';
import { formatNumber, formatDate, getStatusConfig } from '@/lib/utils';

interface ModuleDetailModalProps {
  moduleSummary: ModuleSummary | null;
  onClose: () => void;
}

export function ModuleDetailModal({ moduleSummary, onClose }: ModuleDetailModalProps) {
  if (!moduleSummary) return null;

  // 1. Knit Side Data: Pieces Completed vs Needed
  const knitCompleted = moduleSummary.knitCompletedQty;
  const knitTotalNeeded = moduleSummary.knitTotalNeededQty;
  const knitPending = Math.max(0, knitTotalNeeded - knitCompleted);

  const knitChartData = [
    { name: 'Knit Complete (SM WIP)', value: knitCompleted, color: '#10b981' },
    { name: 'Knit Pending', value: knitPending, color: '#1E293B' },
  ];

  // 2. Trims Side Data: Count of SO_LIs OK vs NO / Pending
  const trimsOk = moduleSummary.trimsOkCount;
  const trimsTotal = moduleSummary.totalItems || moduleSummary.trimsTotalCount;
  const trimsPending = Math.max(0, trimsTotal - trimsOk);

  const trimsChartData = trimsTotal > 0 ? [
    { name: 'Trims Ready (OK)', value: trimsOk, color: '#38bdf8' },
    { name: 'Trims Pending / Missing', value: trimsPending, color: '#1E293B' },
  ] : [
    { name: 'No Trims Data', value: 1, color: '#1E293B' },
  ];

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      return (
        <div className="rounded-lg border border-navy-700 bg-navy-900/95 backdrop-blur-md p-2 shadow-xl text-xs text-white">
          <span className="font-semibold text-slate-300">{entry.name}: </span>
          <span className="font-mono font-bold text-cyan-300">{formatNumber(entry.value)}</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gradient-to-br from-navy-900 to-navy-950 rounded-3xl border border-navy-700/80 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl shadow-navy-950 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-navy-700/70 flex items-center justify-between bg-navy-900/70">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-navy-800 border border-blue-400/30 text-white flex items-center justify-center font-extrabold text-lg shadow-md shadow-blue-500/20">
              {moduleSummary.module}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-white">
                  Module {moduleSummary.module} Readiness Details
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-navy-800 text-cyan-300 border border-navy-700">
                  {moduleSummary.totalItems} Scheduled SO_LIs
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Total planned sew quantity:{' '}
                <span className="font-mono font-bold text-white">
                  {formatNumber(moduleSummary.totalQty)} pcs
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl border border-navy-700/80 hover:bg-navy-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Dual Pie Charts Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Knit Side */}
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 to-navy-900/80 p-4 flex flex-col items-center shadow-emerald-glow">
              <div className="w-full flex items-center justify-between border-b border-emerald-500/20 pb-2">
                <div className="flex items-center space-x-2">
                  <Package className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    Knitting WIP Fulfillment
                  </h4>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {knitTotalNeeded > 0 ? Math.round((knitCompleted / knitTotalNeeded) * 100) : 0}% Complete
                </span>
              </div>

              <div className="h-44 w-full relative mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={knitChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {knitChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#060B18" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-base font-extrabold text-white font-mono">
                    {formatNumber(knitCompleted)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    / {formatNumber(knitTotalNeeded)} pcs
                  </span>
                </div>
              </div>

              <div className="w-full mt-2 text-center text-xs font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/30 py-1.5 px-3 rounded-lg">
                Knit Complete: {formatNumber(knitCompleted)} / {formatNumber(knitTotalNeeded)} pcs
              </div>
            </div>

            {/* 2. Trims Side */}
            <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-950/40 to-navy-900/80 p-4 flex flex-col items-center shadow-cyan-glow">
              <div className="w-full flex items-center justify-between border-b border-sky-500/20 pb-2">
                <div className="flex items-center space-x-2">
                  <Scissors className="w-4 h-4 text-sky-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-sky-300">
                    Trims Readiness (RMW)
                  </h4>
                </div>
                <span className="text-xs font-mono font-bold text-sky-400">
                  {trimsTotal > 0 ? Math.round((trimsOk / trimsTotal) * 100) : 0}% Ready
                </span>
              </div>

              <div className="h-44 w-full relative mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={trimsChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {trimsChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#060B18" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-base font-extrabold text-white font-mono">
                    {trimsOk}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    / {trimsTotal} SO_LIs
                  </span>
                </div>
              </div>

              <div className="w-full mt-2 text-center text-xs font-bold text-sky-300 bg-sky-950/80 border border-sky-500/30 py-1.5 px-3 rounded-lg">
                Trims Ready: {trimsOk} / {trimsTotal} SO_LIs OK
              </div>
            </div>
          </div>

          {/* Module Requirements Table */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-bold text-white">
                Scheduled Requirements for Module {moduleSummary.module}
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {moduleSummary.items.length} items
              </span>
            </div>

            <div className="rounded-2xl border border-navy-700/80 overflow-hidden shadow-inner">
              <div className="max-h-72 overflow-y-auto">
                <table className="min-w-full divide-y divide-navy-700/60 text-xs">
                  <thead className="bg-navy-950 sticky top-0 font-bold text-slate-300 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 text-left">SO_LI</th>
                      <th className="py-2.5 px-3 text-left">Style / Product</th>
                      <th className="py-2.5 px-3 text-left">Planned Date</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-center">Knit WIP</th>
                      <th className="py-2.5 px-3 text-center">Trims</th>
                      <th className="py-2.5 px-3 text-center">Overall</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-700/50 bg-navy-900/50">
                    {moduleSummary.items.map((item) => {
                      const cfg = getStatusConfig(item.overallStatus);
                      return (
                        <tr key={item.id} className="hover:bg-navy-800/60 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-white">
                            {item.so_li}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            <div className="font-semibold text-white truncate max-w-[150px]">{item.style || '-'}</div>
                            <div className="text-[10px] text-slate-400">{item.customer || ''}</div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 font-medium">
                            {formatDate(item.plannedDate)}
                            <span className="text-[10px] block text-slate-400">
                              {item.diffDays <= 0 ? 'Today/Passed' : `in ${item.diffDays} days`}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                            {formatNumber(item.qtyNeeded)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {item.knitFound ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded font-mono font-semibold text-[11px] border ${
                                item.knitReady ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40' : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                              }`}>
                                {formatNumber(item.qtyNeeded)} / {formatNumber(item.knitSmWip)}
                              </span>
                            ) : (
                              <span className="text-slate-500 font-mono text-[11px]">No Knit</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {item.trimsFound ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded font-semibold text-[11px] border ${
                                item.trimsReady
                                  ? 'bg-sky-950/80 text-sky-300 border-sky-500/40'
                                  : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                              }`}>
                                {item.trimsStatus || 'NO'}
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[11px]">No Trims</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.badgeClass}`}>
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-navy-700/70 bg-navy-950/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-navy-800 hover:bg-navy-700 border border-navy-700 text-white font-bold text-xs transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
