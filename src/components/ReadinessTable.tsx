'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { MatchedReadinessItem, ReadinessStatus } from '@/lib/types';
import { formatNumber, formatDate, getStatusConfig } from '@/lib/utils';

interface ReadinessTableProps {
  items: MatchedReadinessItem[];
  selectedStatusFilter: ReadinessStatus | 'ALL';
  onStatusFilterChange: (status: ReadinessStatus | 'ALL') => void;
  onSelectModule: (moduleName: string) => void;
}

type SortField = 'date' | 'module' | 'status' | 'qty' | 'soli';
type SortOrder = 'asc' | 'desc';

export function ReadinessTable({
  items,
  selectedStatusFilter,
  onStatusFilterChange,
  onSelectModule,
}: ReadinessTableProps) {
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | '3DAYS' | '7DAYS' | 'OVERDUE'>('ALL');
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Extract unique module list & customers
  const availableModules = useMemo(() => {
    const set = new Set(items.map((i) => i.module));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [items]);

  const availableCustomers = useMemo(() => {
    const set = new Set(items.map((i) => i.customer).filter(Boolean));
    return Array.from(set).sort();
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Status Filter
      if (selectedStatusFilter !== 'ALL' && item.overallStatus !== selectedStatusFilter) {
        return false;
      }

      // 2. Module Filter
      if (selectedModule !== 'ALL' && item.module !== selectedModule) {
        return false;
      }

      // 3. Customer Filter
      if (selectedCustomer !== 'ALL' && item.customer !== selectedCustomer) {
        return false;
      }

      // 4. Date Filter
      if (dateFilter === '3DAYS') {
        if (item.diffDays < 0 || item.diffDays > 3) return false;
      } else if (dateFilter === '7DAYS') {
        if (item.diffDays < 0 || item.diffDays > 7) return false;
      } else if (dateFilter === 'OVERDUE') {
        if (item.diffDays > 0) return false;
      }

      // 5. Search Text Filter (SO_LI, Style, Module, CW)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matches =
          item.so_li.toLowerCase().includes(query) ||
          item.module.toLowerCase().includes(query) ||
          item.style.toLowerCase().includes(query) ||
          item.customer.toLowerCase().includes(query) ||
          item.productType.toLowerCase().includes(query) ||
          item.cw.toLowerCase().includes(query);
        if (!matches) return false;
      }

      return true;
    });
  }, [items, selectedStatusFilter, selectedModule, selectedCustomer, dateFilter, searchTerm]);

  // Sort items
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    const statusPriority: Record<ReadinessStatus, number> = {
      NOT_READY: 0,
      AT_RISK: 1,
      UPCOMING: 2,
      NO_DATA: 3,
      READY: 4,
    };

    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'status') {
        comparison = statusPriority[a.overallStatus] - statusPriority[b.overallStatus];
      } else if (sortField === 'date') {
        const dateA = a.plannedDate ? new Date(a.plannedDate).getTime() : 0;
        const dateB = b.plannedDate ? new Date(b.plannedDate).getTime() : 0;
        comparison = dateA - dateB;
      } else if (sortField === 'qty') {
        comparison = a.qtyNeeded - b.qtyNeeded;
      } else if (sortField === 'module') {
        comparison = a.module.localeCompare(b.module, undefined, { numeric: true });
      } else if (sortField === 'soli') {
        comparison = a.so_li.localeCompare(b.so_li);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [filteredItems, sortField, sortOrder]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, currentPage, pageSize]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Export to CSV helper
  const exportToCSV = () => {
    const headers = [
      'Module',
      'SO_LI',
      'Customer',
      'Style',
      'Product Type',
      'CW',
      'Planned Date',
      'Days to Sew',
      'Planned Qty',
      'Knitting SM WIP',
      'Knitting Ready',
      'Trims Status',
      'Trims PED',
      'Trims Ready',
      'Overall Status',
      'Status Reason',
    ];

    const rows = sortedItems.map((item) => [
      item.module,
      item.so_li,
      item.customer,
      item.style,
      item.productType,
      item.cw,
      item.plannedDate || '',
      item.diffDays,
      item.qtyNeeded,
      item.knitSmWip,
      item.knitReady ? 'YES' : 'NO',
      item.trimsStatus,
      item.trimsPed || '',
      item.trimsReady ? 'YES' : 'NO',
      item.overallStatus,
      `"${(item.statusReason || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sewing_readiness_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-gradient-to-br from-navy-850 to-navy-900 rounded-3xl border border-navy-700/80 shadow-xl shadow-navy-950/50 overflow-hidden backdrop-blur-md">
      {/* Header Controls Bar */}
      <div className="p-4 sm:p-5 border-b border-navy-700/70 bg-navy-900/60 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-cyan-400/80 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search SO_LI, Style, Module, Customer..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-navy-950/80 border border-navy-700/80 rounded-xl text-xs font-medium text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => {
                onStatusFilterChange(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-navy-950/80 border border-navy-700/80 rounded-xl text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="READY">Ready (🟢)</option>
              <option value="AT_RISK">At Risk (🟡)</option>
              <option value="NOT_READY">Not Ready / Delayed (🔴)</option>
              <option value="UPCOMING">Upcoming (🔵)</option>
              <option value="NO_DATA">Missing Data (⬜)</option>
            </select>

            {/* Module Filter */}
            <select
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-navy-950/80 border border-navy-700/80 rounded-xl text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="ALL">All Modules ({availableModules.length})</option>
              {availableModules.map((m) => (
                <option key={m} value={m}>
                  Module {m}
                </option>
              ))}
            </select>

            {/* Date Window Filter */}
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-navy-950/80 border border-navy-700/80 rounded-xl text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="ALL">All Dates</option>
              <option value="3DAYS">Next 3 Days (Critical)</option>
              <option value="7DAYS">Next 7 Days</option>
              <option value="OVERDUE">Overdue / Today</option>
            </select>

            {/* Export Button */}
            <button
              onClick={exportToCSV}
              className="no-print inline-flex items-center space-x-1.5 px-3.5 py-2 bg-navy-800 hover:bg-navy-700 text-slate-200 border border-navy-700/80 rounded-xl font-semibold transition-all hover:text-white"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Summary & Total Counter */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <div>
            Showing <span className="font-bold text-white font-mono">{sortedItems.length}</span> matching lines
            {selectedStatusFilter !== 'ALL' && ` (Filtered: ${selectedStatusFilter})`}
            {selectedModule !== 'ALL' && ` (Module: ${selectedModule})`}
            {dateFilter !== 'ALL' && ` (${dateFilter})`}
          </div>
          <div className="text-[11px] text-slate-400">
            Sorted by <span className="font-semibold text-cyan-300 uppercase">{sortField}</span> ({sortOrder})
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-navy-700/60 text-xs">
          <thead className="bg-navy-950/90 font-bold text-slate-300 uppercase tracking-wider text-[11px]">
            <tr>
              <th
                onClick={() => toggleSort('module')}
                className="py-3 px-4 text-left cursor-pointer hover:bg-navy-800/80 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Module</span>
                  <ArrowUpDown className="w-3 h-3 text-cyan-400/80" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('soli')}
                className="py-3 px-4 text-left cursor-pointer hover:bg-navy-800/80 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>SO_LI Key</span>
                  <ArrowUpDown className="w-3 h-3 text-cyan-400/80" />
                </div>
              </th>
              <th className="py-3 px-4 text-left">Customer / Style</th>
              <th
                onClick={() => toggleSort('date')}
                className="py-3 px-4 text-left cursor-pointer hover:bg-navy-800/80 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Planned Date</span>
                  <ArrowUpDown className="w-3 h-3 text-cyan-400/80" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('qty')}
                className="py-3 px-4 text-right cursor-pointer hover:bg-navy-800/80 transition-colors"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Sew Qty</span>
                  <ArrowUpDown className="w-3 h-3 text-cyan-400/80" />
                </div>
              </th>
              <th className="py-3 px-4 text-center">Knitting WIP Status</th>
              <th className="py-3 px-4 text-center">Trims (RMW) Status</th>
              <th
                onClick={() => toggleSort('status')}
                className="py-3 px-4 text-center cursor-pointer hover:bg-navy-800/80 transition-colors"
              >
                <div className="flex items-center justify-center space-x-1">
                  <span>Overall Status</span>
                  <ArrowUpDown className="w-3 h-3 text-cyan-400/80" />
                </div>
              </th>
              <th className="py-3 px-4 text-right no-print">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-700/50 bg-navy-900/40">
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-500">
                  No matching sewing requirements found for the selected filters.
                </td>
              </tr>
            ) : (
              paginatedItems.map((item) => {
                const statusCfg = getStatusConfig(item.overallStatus);
                const isOverdue = item.diffDays <= 0;
                const isUrgentWindow = item.diffDays > 0 && item.diffDays <= 3;

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-navy-800/60 transition-colors group"
                  >
                    {/* Module */}
                    <td className="py-3.5 px-4 font-bold text-white">
                      <button
                        onClick={() => onSelectModule(item.module)}
                        className="inline-flex items-center space-x-1 font-mono font-bold text-cyan-300 bg-navy-950/80 hover:bg-navy-800 border border-navy-700/80 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        <span>{item.module}</span>
                      </button>
                    </td>

                    {/* SO_LI Key */}
                    <td className="py-3.5 px-4 font-mono font-bold text-white whitespace-nowrap">
                      {item.so_li}
                    </td>

                    {/* Customer / Style */}
                    <td className="py-3.5 px-4 text-slate-300">
                      <div className="font-semibold text-white truncate max-w-[180px]">
                        {item.style || item.productType || '-'}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                        {item.customer && <span className="font-medium text-slate-300">{item.customer} · </span>}
                        {item.cw || item.productType || ''}
                      </div>
                    </td>

                    {/* Planned Date */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-medium text-white">{formatDate(item.plannedDate)}</div>
                      <div className="text-[11px]">
                        {isOverdue ? (
                          <span className="text-rose-400 font-bold">Today / Overdue</span>
                        ) : isUrgentWindow ? (
                          <span className="text-amber-400 font-bold">in {item.diffDays} day{item.diffDays === 1 ? '' : 's'}</span>
                        ) : (
                          <span className="text-slate-400">in {item.diffDays} days</span>
                        )}
                      </div>
                    </td>

                    {/* Sew Qty */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                      {formatNumber(item.qtyNeeded)} pcs
                    </td>

                    {/* Knit WIP */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {item.knitFound ? (
                        <div>
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                              item.knitReady
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                                : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                            }`}
                          >
                            <span>
                              {formatNumber(item.qtyNeeded)} / {formatNumber(item.knitSmWip)}
                            </span>
                          </span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            {item.knitReady ? 'Knit Ready' : 'Fabric Shortage'}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-900 text-slate-500 border border-slate-800">
                          Not in Knit WIP
                        </span>
                      )}
                    </td>

                    {/* Trims Status */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {item.trimsFound ? (
                        <div>
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                              item.trimsReady
                                ? 'bg-sky-950/80 text-sky-300 border-sky-500/40'
                                : item.trimsStatus === 'OK' && item.trimsPedDelayed
                                ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                                : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                            }`}
                          >
                            <span>{item.trimsStatus || 'NO'}</span>
                          </span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            {item.trimsPed ? `PED: ${formatDate(item.trimsPed)}` : 'Trims Verified'}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-900 text-slate-500 border border-slate-800">
                          No Trims Record
                        </span>
                      )}
                    </td>

                    {/* Overall Status Badge */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold border shadow-xs ${statusCfg.badgeClass}`}
                      >
                        <span>{statusCfg.label}</span>
                      </span>
                      {item.statusReason && (
                        <div
                          title={item.statusReason}
                          className="text-[10px] text-slate-400 truncate max-w-[150px] mx-auto mt-0.5"
                        >
                          {item.statusReason}
                        </div>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap no-print">
                      <button
                        onClick={() => onSelectModule(item.module)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition-colors"
                        title="View module summary & pie charts"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-navy-700/60 bg-navy-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
        <div>
          Showing page <span className="font-bold text-white font-mono">{currentPage}</span> of{' '}
          <span className="font-bold text-white font-mono">{totalPages}</span> ({sortedItems.length} total rows)
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-2.5 py-1.5 rounded-lg border border-navy-700/80 bg-navy-900 text-slate-300 hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
          >
            First
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-navy-700/80 bg-navy-900 text-slate-300 hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-3 py-1 font-mono font-bold text-cyan-300">
            {currentPage} / {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-navy-700/80 bg-navy-900 text-slate-300 hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-2.5 py-1.5 rounded-lg border border-navy-700/80 bg-navy-900 text-slate-300 hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Last
          </button>
        </div>
      </div>
    </div>
  );
}
