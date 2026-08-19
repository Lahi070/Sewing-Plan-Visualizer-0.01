'use client';

import React from 'react';
import { X, CheckCircle2, AlertTriangle, XCircle, Clock, HelpCircle, Package, Scissors, Calendar } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ModuleSummary } from '@/lib/types';
import { formatNumber, formatDate, getStatusConfig } from '@/lib/utils';

interface ModuleDetailModalProps {
  moduleSummary: ModuleSummary | null;
  onClose: () => void;
}

export function ModuleDetailModal({ moduleSummary, onClose }: ModuleDetailModalProps) {
  if (!moduleSummary) return null;

  // 1. Knit Side Data: SM WIP vs Balance Needed
  const knitCompleted = moduleSummary.knitCompletedQty;
  const knitTotalNeeded = moduleSummary.knitTotalNeededQty;
  const knitPending = Math.max(0, knitTotalNeeded - knitCompleted);

  const knitChartData = [
    { name: 'Knit Complete (SM WIP)', value: knitCompleted, color: '#10b981' },
    { name: 'Knit Pending', value: knitPending, color: '#e2e8f0' },
  ];

  // 2. Trims Side Data: Count of SO_LIs OK vs NO / Pending
  const trimsOk = moduleSummary.trimsOkCount;
  const trimsTotal = moduleSummary.trimsTotalCount;
  const trimsPending = Math.max(0, trimsTotal - trimsOk);

  const trimsChartData = [
    { name: 'Trims Ready (OK)', value: trimsOk, color: '#0ea5e9' },
    { name: 'Trims Pending / NO', value: trimsPending, color: '#fed7aa' },
  ];

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      return (
        <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-md text-xs">
          <span className="font-semibold text-slate-800">{entry.name}: </span>
          <span className="font-mono font-bold">{formatNumber(entry.value)}</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-extrabold text-lg shadow-md shadow-slate-900/10">
              {moduleSummary.module}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-900">
                  Module {moduleSummary.module} Readiness Details
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                  {moduleSummary.totalItems} Scheduled SO_LIs
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Total planned sew quantity:{' '}
                <span className="font-mono font-bold text-slate-900">
                  {formatNumber(moduleSummary.totalQty)} pcs
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Dual Pie Charts Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Knit Side */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 flex flex-col items-center">
              <div className="w-full flex items-center justify-between border-b border-emerald-100 pb-2">
                <div className="flex items-center space-x-2">
                  <Package className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                    Knitting WIP Fulfillment
                  </h4>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-800">
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
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-base font-extrabold text-slate-900 font-mono">
                    {formatNumber(knitCompleted)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    / {formatNumber(knitTotalNeeded)} pcs
                  </span>
                </div>
              </div>

              <div className="w-full mt-2 text-center text-xs font-semibold text-emerald-900 bg-emerald-100/70 py-1.5 px-3 rounded-lg">
                Knit Complete: {formatNumber(knitCompleted)} / {formatNumber(knitTotalNeeded)} pcs
              </div>
            </div>

            {/* 2. Trims Side */}
            <div className="rounded-2xl border border-sky-200 bg-sky-50/30 p-4 flex flex-col items-center">
              <div className="w-full flex items-center justify-between border-b border-sky-100 pb-2">
                <div className="flex items-center space-x-2">
                  <Scissors className="w-4 h-4 text-sky-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-sky-950">
                    Trims Readiness (RMW)
                  </h4>
                </div>
                <span className="text-xs font-mono font-bold text-sky-800">
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
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-base font-extrabold text-slate-900 font-mono">
                    {trimsOk}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    / {trimsTotal} SO_LIs
                  </span>
                </div>
              </div>

              <div className="w-full mt-2 text-center text-xs font-semibold text-sky-900 bg-sky-100/70 py-1.5 px-3 rounded-lg">
                Trims Ready: {trimsOk} / {trimsTotal} SO_LIs OK
              </div>
            </div>
          </div>

          {/* Module Line Items Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-900">
                Scheduled Requirements for Module {moduleSummary.module}
              </h4>
              <span className="text-xs text-slate-500 font-mono">
                {moduleSummary.items.length} items
              </span>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 sticky top-0 font-bold text-slate-700 uppercase tracking-wider">
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
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {moduleSummary.items.map((item) => {
                      const cfg = getStatusConfig(item.overallStatus);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                            {item.so_li}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            <div className="font-medium truncate max-w-[150px]">{item.style || '-'}</div>
                            <div className="text-[10px] text-slate-400">{item.customer || ''}</div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-medium">
                            {formatDate(item.plannedDate)}
                            <span className="text-[10px] block text-slate-400">
                              {item.diffDays <= 0 ? 'Today/Passed' : `in ${item.diffDays} days`}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {formatNumber(item.qtyNeeded)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {item.knitFound ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded font-mono font-semibold text-[11px] ${
                                item.knitReady ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {formatNumber(item.qtyNeeded)} / {formatNumber(item.knitSmWip)}
                              </span>
                            ) : (
                              <span className="text-gray-400 font-mono text-[11px]">No Knit</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {item.trimsFound ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded font-semibold text-[11px] ${
                                item.trimsReady ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-900'
                              }`}>
                                {item.trimsStatus || 'NO'}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[11px]">No Trims</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${cfg.badgeClass}`}>
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
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
