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
        comparison = (a.plannedDate || '').localeCompare(b.plannedDate || '');
      } else if (sortField === 'module') {
        comparison = a.module.localeCompare(b.module, undefined, { numeric: true });
      } else if (sortField === 'qty') {
        comparison = a.qtyNeeded - b.qtyNeeded;
      } else if (sortField === 'soli') {
        comparison = a.so_li.localeCompare(b.so_li);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [filteredItems, sortField, sortOrder]);

  // Paginate
  const totalPages = Math.ceil(sortedItems.length / pageSize) || 1;
  const paginatedItems = sortedItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // CSV Export
  const exportToCSV = () => {
    const headers = [
      'Module',
      'SO_LI',
      'Customer',
      'Style',
      'Product Type',
      'CW',
      'Planned Date',
      'Days Diff',
      'Qty Needed',
      'Knit SM WIP',
      'Knit Ready',
      'Trims Status',
      'Trims PSD',
      'Trims PED',
      'Trims Ready',
      'Overall Status',
      'Reason',
    ];

    const rows = sortedItems.map((i) => [
      `"${i.module}"`,
      `"${i.so_li}"`,
      `"${i.customer}"`,
      `"${i.style}"`,
      `"${i.productType}"`,
      `"${i.cw}"`,
      `"${i.plannedDate}"`,
      i.diffDays,
      i.qtyNeeded,
      i.knitSmWip,
      i.knitReady ? 'YES' : 'NO',
      `"${i.trimsStatus}"`,
      `"${i.trimsPsd}"`,
      `"${i.trimsPed}"`,
      i.trimsReady ? 'YES' : 'NO',
      `"${i.overallStatus}"`,
      `"${i.statusReason.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Sewing_Readiness_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Controls Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search SO_LI, Module, Style, Customer..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          {/* Right Action Tools */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => {
                onStatusFilterChange(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="ALL">All Statuses</option>
              <option value="READY">Ready Only (✅)</option>
              <option value="AT_RISK">At Risk Only (🟡)</option>
              <option value="NOT_READY">Delayed / Not Ready (🔴)</option>
              <option value="UPCOMING">Upcoming Only (⚪)</option>
              <option value="NO_DATA">Missing Data (⬜)</option>
            </select>

            {/* Module Filter */}
            <select
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
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
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="ALL">All Dates</option>
              <option value="3DAYS">Next 3 Days (Critical)</option>
              <option value="7DAYS">Next 7 Days</option>
              <option value="OVERDUE">Overdue / Today</option>
            </select>

            {/* Export Button */}
            <button
              onClick={exportToCSV}
              className="no-print inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Summary & Total Counter */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <div>
            Showing <span className="font-bold text-slate-900 font-mono">{sortedItems.length}</span> matching lines
            {selectedStatusFilter !== 'ALL' && ` (Filtered: ${selectedStatusFilter})`}
            {selectedModule !== 'ALL' && ` (Module: ${selectedModule})`}
            {dateFilter !== 'ALL' && ` (${dateFilter})`}
          </div>
          <div className="text-[11px]">
            Sorted by <span className="font-semibold text-slate-700 uppercase">{sortField}</span> ({sortOrder})
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-50/80 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            <tr>
              <th
                onClick={() => toggleSort('module')}
                className="py-3 px-4 text-left cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Module</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('soli')}
                className="py-3 px-4 text-left cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>SO_LI Key</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4 text-left">Customer / Style</th>
              <th
                onClick={() => toggleSort('date')}
                className="py-3 px-4 text-left cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Planned Date</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('qty')}
                className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Sew Qty</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4 text-center">Knitting WIP Status</th>
              <th className="py-3 px-4 text-center">Trims (RMW) Status</th>
              <th
                onClick={() => toggleSort('status')}
                className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center justify-center space-x-1">
                  <span>Overall Status</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4 text-right no-print">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
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
                    className="hover:bg-slate-50/90 transition-colors group"
                  >
                    {/* Module */}
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <button
                        onClick={() => onSelectModule(item.module)}
                        className="inline-flex items-center space-x-1 font-mono font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        <span>{item.module}</span>
                      </button>
                    </td>

                    {/* SO_LI Key */}
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {item.so_li}
                    </td>

                    {/* Customer / Style */}
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="font-semibold text-slate-900 truncate max-w-[180px]">
                        {item.style || item.productType || '-'}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                        {item.customer && <span className="font-medium text-slate-700">{item.customer} · </span>}
                        {item.cw || item.productType || ''}
                      </div>
                    </td>

                    {/* Planned Date */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900">{formatDate(item.plannedDate)}</div>
                      <div className="text-[11px]">
                        {isOverdue ? (
                          <span className="text-rose-600 font-bold">Today / Overdue</span>
                        ) : isUrgentWindow ? (
                          <span className="text-amber-600 font-bold">in {item.diffDays} day{item.diffDays === 1 ? '' : 's'}</span>
                        ) : (
                          <span className="text-slate-400">in {item.diffDays} days</span>
                        )}
                      </div>
                    </td>

                    {/* Sew Qty */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatNumber(item.qtyNeeded)} pcs
                    </td>

                    {/* Knit WIP */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {item.knitFound ? (
                        <div>
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                              item.knitReady
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            <span>
                              {formatNumber(item.knitSmWip)} / {formatNumber(item.qtyNeeded)}
                            </span>
                          </span>
                          <span className="block text-[10px] text-slate-500 mt-0.5">
                            {item.knitReady ? 'Knit Ready' : 'Fabric Shortage'}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-500">
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
                                ? 'bg-sky-50 text-sky-700 border-sky-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            <span>{item.trimsStatus || 'NO'}</span>
                            {item.trimsPedDelayed && (
                              <span className="text-[10px] text-rose-600 font-bold ml-1">(PED Late)</span>
                            )}
                          </span>
                          {item.trimsPed && (
                            <span className="block text-[10px] text-slate-500 mt-0.5">
                              PED: {formatDate(item.trimsPed)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-500">
                          No Trims Record
                        </span>
                      )}
                    </td>

                    {/* Overall Status */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${statusCfg.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.pillClass}`} />
                        <span>{statusCfg.label}</span>
                      </span>
                    </td>

                    {/* Drill-down action */}
                    <td className="py-3.5 px-4 text-right no-print">
                      <button
                        onClick={() => onSelectModule(item.module)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                        title={`View Module ${item.module} Details`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
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
      <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 text-xs text-slate-600">
        <div>
          Showing page <span className="font-bold text-slate-900">{currentPage}</span> of{' '}
          <span className="font-bold text-slate-900">{totalPages}</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
