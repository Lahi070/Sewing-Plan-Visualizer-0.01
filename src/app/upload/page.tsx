'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Lock,
  KeyRound,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  Database,
  Layers,
  Sparkles,
  Info,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { FileUploadZone } from '@/components/FileUploadZone';
import {
  parseSewingPlanWorkbook,
  parseKnittingWipWorkbook,
  parseTrimsReadinessWorkbook,
  discoverTrimsDatedSheets,
} from '@/lib/excelParser';
import { evaluateReadiness } from '@/lib/matcherEngine';
import {
  getActiveDataset,
  saveLocalDataset,
  isSupabaseConfigured,
} from '@/lib/supabase';
import { INITIAL_DATASET } from '@/lib/sampleData';
import { AppDataset, SewingPlanRow, KnittingPlanRow, TrimsPlanRow, UploadMetadataRecord } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import * as XLSX from 'xlsx';

export default function AdminUploadPage() {
  const router = useRouter();

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [overrideSearch, setOverrideSearch] = useState('');
  const [isOverriding, setIsOverriding] = useState<string | null>(null);

  // Dataset & Staged uploads state
  const [currentDataset, setCurrentDataset] = useState<AppDataset>(INITIAL_DATASET);

  // Compute readiness to display for Overrides
  const { items: evaluatedItems } = React.useMemo(() => {
    return evaluateReadiness(
      currentDataset.sewingPlan,
      currentDataset.knittingPlan,
      currentDataset.trimsPlan,
      currentDataset.overrides || {}
    );
  }, [currentDataset]);

  const filteredOverrides = React.useMemo(() => {
    if (!overrideSearch) return evaluatedItems;
    const lower = overrideSearch.toLowerCase();
    return evaluatedItems.filter(i => 
      i.module.toLowerCase().includes(lower) || 
      i.so_li.toLowerCase().includes(lower) || 
      (i.customer && i.customer.toLowerCase().includes(lower))
    );
  }, [evaluatedItems, overrideSearch]);

  const toggleOverride = async (so_li: string, currentStatus: string) => {
    try {
      setIsOverriding(so_li);
      const isManual = currentDataset.overrides && currentDataset.overrides[so_li];
      // If it has an override, remove it (DELETE)
      // Otherwise, mark as NOT READY (UPSERT 'NO')
      const action = isManual ? 'DELETE' : 'UPSERT';
      const status = 'NO';
      
      const res = await fetch('/api/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ so_li, action, status })
      });
      
      if (!res.ok) throw new Error('Failed to update override');
      
      // Update local state
      const newOverrides = { ...(currentDataset.overrides || {}) };
      if (isManual) {
        delete newOverrides[so_li];
      } else {
        newOverrides[so_li] = 'NO';
      }
      
      const nextData = { ...currentDataset, overrides: newOverrides };
      setCurrentDataset(nextData);
      
    } catch (e) {
      alert('Failed to save manual override.');
      console.error(e);
    } finally {
      setIsOverriding(null);
    }
  };

  const [stagedSewing, setStagedSewing] = useState<{
    rows: SewingPlanRow[];
    fileName: string;
    sheetUsed: string;
    skippedCount: number;
  } | null>(null);

  const [stagedKnitting, setStagedKnitting] = useState<{
    rows: KnittingPlanRow[];
    fileName: string;
    sheetUsed: string;
    rawCount: number;
  } | null>(null);

  const [stagedTrims, setStagedTrims] = useState<{
    rows: TrimsPlanRow[];
    fileName: string;
    sheetUsed: string;
    availableSheets: ReturnType<typeof discoverTrimsDatedSheets>;
    rawCount: number;
    rawWorkbook?: XLSX.WorkBook;
  } | null>(null);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  // Load existing dataset & session auth
  useEffect(() => {
    const savedAuth = sessionStorage.getItem('sewing_admin_authenticated');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }

    async function loadData() {
      const data = await getActiveDataset();
      setCurrentDataset(data);
    }
    loadData();
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsVerifying(true);

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        sessionStorage.setItem('sewing_admin_authenticated', 'true');
      } else {
        setAuthError(data.error || 'Incorrect admin password');
      }
    } catch (err: any) {
      setAuthError('Connection failed: ' + err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  // 1. Sewing Plan Parse Handler
  const handleSewingParsed = ({ fileName, workbook }: { fileName: string; workbook: XLSX.WorkBook }) => {
    try {
      const { rows, sheetUsed, totalSkipped } = parseSewingPlanWorkbook(workbook);
      setStagedSewing({
        rows,
        fileName,
        sheetUsed,
        skippedCount: totalSkipped,
      });
      setSyncStatus({ type: null, message: '' });
    } catch (err: any) {
      alert(`Error in Pre Work Plan: ${err.message}`);
    }
  };

  // 2. Knitting WIP Parse Handler
  const handleKnittingParsed = ({ fileName, workbook }: { fileName: string; workbook: XLSX.WorkBook }) => {
    try {
      const { rows, sheetUsed, totalRawRows } = parseKnittingWipWorkbook(workbook);
      setStagedKnitting({
        rows,
        fileName,
        sheetUsed,
        rawCount: totalRawRows,
      });
      setSyncStatus({ type: null, message: '' });
    } catch (err: any) {
      alert(`Error in Knitting WIP: ${err.message}`);
    }
  };

  // 3. Trims Readiness Parse Handler
  const handleTrimsParsed = ({ fileName, workbook }: { fileName: string; workbook: XLSX.WorkBook }) => {
    try {
      const { rows, sheetUsed, availableSheets, totalRawRows } = parseTrimsReadinessWorkbook(workbook);
      setStagedTrims({
        rows,
        fileName,
        sheetUsed,
        availableSheets,
        rawCount: totalRawRows,
        rawWorkbook: workbook,
      });
      setSyncStatus({ type: null, message: '' });
    } catch (err: any) {
      alert(`Error in Trims Readiness: ${err.message}`);
    }
  };

  // Trims Sheet Change Override
  const handleTrimsSheetChange = (newSheetName: string) => {
    if (!stagedTrims?.rawWorkbook) return;
    try {
      const { rows, sheetUsed, availableSheets, totalRawRows } = parseTrimsReadinessWorkbook(
        stagedTrims.rawWorkbook,
        newSheetName
      );
      setStagedTrims({
        rows,
        fileName: stagedTrims.fileName,
        sheetUsed,
        availableSheets,
        rawCount: totalRawRows,
        rawWorkbook: stagedTrims.rawWorkbook,
      });
    } catch (err: any) {
      alert(`Could not parse sheet ${newSheetName}: ${err.message}`);
    }
  };

  // Synchronize staged data to Database & Local Store
  const handleCommitSync = async () => {
    if (!stagedSewing && !stagedKnitting && !stagedTrims) {
      alert('Please upload at least one Excel file to synchronize.');
      return;
    }

    setIsSyncing(true);
    setSyncStatus({ type: null, message: '' });

    try {
      const updatedDataset: AppDataset = {
        sewingPlan: stagedSewing ? stagedSewing.rows : currentDataset.sewingPlan,
        knittingPlan: stagedKnitting ? stagedKnitting.rows : currentDataset.knittingPlan,
        trimsPlan: stagedTrims ? stagedTrims.rows : currentDataset.trimsPlan,
        overrides: currentDataset.overrides || {},
        metadata: {
          ...currentDataset.metadata,
          lastUpdated: new Date().toISOString(),
        },
      };

      // 1. Sync Sewing Plan if staged
      if (stagedSewing) {
        const metadata: UploadMetadataRecord = {
          fileType: 'sewing',
          fileName: stagedSewing.fileName,
          sheetUsed: stagedSewing.sheetUsed,
          rowCount: stagedSewing.rows.length,
          uniqueSoLis: new Set(stagedSewing.rows.map((r) => r.so_li)).size,
          uploadedAt: new Date().toISOString(),
        };
        updatedDataset.metadata.sewing = metadata;

        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileType: 'sewing',
            rows: stagedSewing.rows,
            metadata,
          }),
        });
      }

      // 2. Sync Knitting Plan if staged
      if (stagedKnitting) {
        const metadata: UploadMetadataRecord = {
          fileType: 'knitting',
          fileName: stagedKnitting.fileName,
          sheetUsed: stagedKnitting.sheetUsed,
          rowCount: stagedKnitting.rows.length,
          uniqueSoLis: stagedKnitting.rows.length,
          uploadedAt: new Date().toISOString(),
        };
        updatedDataset.metadata.knitting = metadata;

        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileType: 'knitting',
            rows: stagedKnitting.rows,
            metadata,
          }),
        });
      }

      // 3. Sync Trims Plan if staged
      if (stagedTrims) {
        const metadata: UploadMetadataRecord = {
          fileType: 'trims',
          fileName: stagedTrims.fileName,
          sheetUsed: stagedTrims.sheetUsed,
          rowCount: stagedTrims.rows.length,
          uniqueSoLis: new Set(stagedTrims.rows.map((r) => r.soli)).size,
          uploadedAt: new Date().toISOString(),
        };
        updatedDataset.metadata.trims = metadata;

        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileType: 'trims',
            rows: stagedTrims.rows,
            metadata,
          }),
        });
      }

      // Save locally as well
      saveLocalDataset(updatedDataset);
      setCurrentDataset(updatedDataset);

      // Clear staged
      setStagedSewing(null);
      setStagedKnitting(null);
      setStagedTrims(null);

      setSyncStatus({
        type: 'success',
        message: 'Successfully updated database! Floor dashboard has been refreshed.',
      });
    } catch (err: any) {
      setSyncStatus({
        type: 'error',
        message: `Sync failed: ${err.message || 'Unknown error'}`,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Reset to authentic factory data
  const handleResetToFactoryData = () => {
    if (confirm('Reset dashboard data to authentic factory sample records?')) {
      saveLocalDataset(INITIAL_DATASET);
      setCurrentDataset(INITIAL_DATASET);
      setStagedSewing(null);
      setStagedKnitting(null);
      setStagedTrims(null);
      setSyncStatus({
        type: 'success',
        message: 'Reset back to authentic factory sample records.',
      });
    }
  };

  // Password Lock Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-navy-950 text-slate-100 selection:bg-cyan-500 selection:text-white">
        <div className="max-w-md w-full bg-gradient-to-br from-navy-850 to-navy-900 rounded-3xl border border-navy-700/80 p-8 shadow-2xl shadow-navy-950/60 backdrop-blur-md">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-navy-800 border border-blue-400/30 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 mb-4">
              <Lock className="w-7 h-7 text-cyan-300" />
            </div>
            <h1 className="text-xl font-extrabold text-white">Admin Upload Access</h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Enter the admin authorization password to upload and update sewing floor Excel records.
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Admin Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter admin password..."
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-navy-950/80 border border-navy-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            {authError && (
              <div className="flex items-center space-x-2 text-xs text-rose-300 bg-rose-950/80 p-3 rounded-xl border border-rose-500/40">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/30 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 border border-blue-400/30"
            >
              {isVerifying && <RefreshCw className="w-4 h-4 animate-spin text-cyan-200" />}
              <span>{isVerifying ? 'Verifying...' : 'Unlock Upload Center'}</span>
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-navy-700/60 flex items-center justify-between text-xs">
            <Link href="/" className="inline-flex items-center space-x-1.5 text-slate-400 hover:text-white font-medium">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Floor Dashboard</span>
            </Link>
            <span className="text-[11px] text-slate-500">Public floor requires no login</span>
          </div>
        </div>
      </div>
    );
  }

  const hasAnyStaged = Boolean(stagedSewing || stagedKnitting || stagedTrims);

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-navy-700/80 bg-navy-950/90 shadow-lg shadow-navy-950/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-navy-700/80 bg-navy-900 text-xs font-semibold text-slate-300 hover:text-white hover:bg-navy-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-cyan-400" />
              <span>Back to Dashboard</span>
            </Link>
            <h1 className="text-base font-bold text-white hidden sm:block">
              Admin Excel Ingestion Portal
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleResetToFactoryData}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-navy-700/80 bg-navy-900 text-xs font-medium text-slate-300 hover:text-white hover:bg-navy-800 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Reset Factory Sample Data</span>
            </button>
            <button
              onClick={() => {
                setIsAuthenticated(false);
                sessionStorage.removeItem('sewing_admin_authenticated');
              }}
              className="text-xs text-rose-400 hover:text-rose-300 font-semibold px-2 py-1"
            >
              Lock / Exit
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Banner */}
        <div className="rounded-3xl border border-navy-700/80 bg-gradient-to-br from-navy-850 to-navy-900 p-6 sm:p-8 shadow-xl shadow-navy-950/40 backdrop-blur-md">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-navy-800 border border-blue-400/30 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-600/30">
              <UploadCloud className="w-6 h-6 text-cyan-300" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                Upload & Cross-Reference Factory Datasets
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-3xl">
                Upload whenever you have a new version of any file. Excel parsing is performed client-side in your browser,
                automatically formatting join keys (`SO_LI`), filtering text dash rows, and synchronizing to Supabase so all
                floor personnel see the latest readiness status instantly.
              </p>
            </div>
          </div>
        </div>

        {/* Sync notification */}
        {syncStatus.message && (
          <div
            className={`p-4 rounded-2xl border flex items-center space-x-3 text-xs font-semibold ${
              syncStatus.type === 'success'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-emerald-glow'
                : 'bg-rose-950/80 text-rose-300 border-rose-500/40 shadow-rose-glow'
            }`}
          >
            {syncStatus.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{syncStatus.message}</span>
          </div>
        )}

        {/* Manual Overrides Section */}
        <div className="rounded-3xl border border-navy-700/80 bg-gradient-to-br from-navy-850 to-navy-900 p-6 sm:p-8 shadow-xl shadow-navy-950/40 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-extrabold text-white">Manual Status Overrides</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Force Trims status to "Not Ready" if physical availability does not match Excel data.
              </p>
            </div>
            <input
              type="text"
              placeholder="Search SO/LI or Module..."
              value={overrideSearch}
              onChange={e => setOverrideSearch(e.target.value)}
              className="bg-navy-950/80 border border-navy-700 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 min-w-[250px] focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-navy-800 bg-navy-950/50">
            <table className="min-w-full divide-y divide-navy-800 text-xs">
              <thead className="bg-navy-900/80">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-slate-300">Module</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-300">SO/LI</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-300">Planned Date</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-300">Current Trims Status</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-300">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800">
                {filteredOverrides.slice(0, 50).map((item) => {
                  const hasManualOverride = currentDataset.overrides?.[item.so_li];
                  const trimsStatus = hasManualOverride ? 'NOT READY (Manual)' : (item.trimsReady ? 'READY' : 'NOT READY');
                  
                  return (
                    <tr key={item.so_li} className="hover:bg-navy-800/30">
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-cyan-400">{item.module}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-300">{item.so_li}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-400">{item.plannedDate || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          trimsStatus.includes('READY') && !trimsStatus.includes('NOT')
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {trimsStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => toggleOverride(item.so_li, trimsStatus)}
                          disabled={isOverriding === item.so_li}
                          className={`px-3 py-1.5 rounded-lg font-bold text-[10px] transition-colors ${
                            hasManualOverride
                              ? 'bg-navy-700 hover:bg-navy-600 text-white border border-navy-500'
                              : 'bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {isOverriding === item.so_li ? 'Saving...' : hasManualOverride ? 'Remove Override' : 'Mark Not Ready'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredOverrides.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No modules found matching your search.
                    </td>
                  </tr>
                )}
                {filteredOverrides.length > 50 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-center text-slate-500 text-[11px]">
                      Showing first 50 results. Use search to find specific SO/LIs.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3 Upload Dropzones */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 1. Sewing Plan */}
          <FileUploadZone
            stepNumber={1}
            title="Pre Work Plan (Sewing)"
            subtitle="Auto-reads 'Sheet1'. Skips '-' dash rows. Joins by SO_LI."
            fileType="sewing"
            lastFileName={currentDataset.metadata.sewing?.fileName}
            lastSheetUsed={currentDataset.metadata.sewing?.sheetUsed}
            lastUploadedAt={currentDataset.metadata.sewing?.uploadedAt}
            onFileParsed={handleSewingParsed}
          />

          {/* 2. Knitting WIP */}
          <FileUploadZone
            stepNumber={2}
            title="Knitting WIP"
            subtitle="Strips leading zeros on Sales Order. Sums SM WIP across size variants."
            fileType="knitting"
            lastFileName={currentDataset.metadata.knitting?.fileName}
            lastSheetUsed={currentDataset.metadata.knitting?.sheetUsed}
            lastUploadedAt={currentDataset.metadata.knitting?.uploadedAt}
            onFileParsed={handleKnittingParsed}
          />

          {/* 3. Trims Readiness */}
          <FileUploadZone
            stepNumber={3}
            title="Trims Readiness (RMW)"
            subtitle="Auto-detects closest dated 'Plan summary' snapshot. Uses clean SOLI column."
            fileType="trims"
            lastFileName={currentDataset.metadata.trims?.fileName}
            lastSheetUsed={currentDataset.metadata.trims?.sheetUsed}
            lastUploadedAt={currentDataset.metadata.trims?.uploadedAt}
            onFileParsed={handleTrimsParsed}
          />
        </div>

        {/* Staged Upload Verification Card */}
        {hasAnyStaged && (
          <div className="rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 to-navy-900/90 p-6 sm:p-7 shadow-emerald-glow space-y-4 animate-in fade-in duration-300 backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-emerald-500/30 pb-4">
              <div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
                  Ready to Synchronize
                </span>
                <h3 className="text-lg font-bold text-white mt-1">Staged Files Preview</h3>
              </div>

              <button
                onClick={handleCommitSync}
                disabled={isSyncing}
                className="inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSyncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-slate-950" />
                )}
                <span>{isSyncing ? 'Synchronizing to Database...' : 'Save & Publish to Floor'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Sewing Staged Info */}
              <div className="bg-navy-900/80 p-4 rounded-2xl border border-navy-700/80">
                <div className="flex items-center justify-between font-bold text-white mb-1">
                  <span>Sewing Plan</span>
                  <span className="font-mono text-emerald-400">
                    {stagedSewing ? `${stagedSewing.rows.length} rows` : 'Unchanged'}
                  </span>
                </div>
                {stagedSewing ? (
                  <div className="text-[11px] text-slate-400 space-y-0.5">
                    <div>File: <span className="font-semibold text-slate-200">{stagedSewing.fileName}</span></div>
                    <div>Sheet: <span className="font-mono font-medium text-cyan-300">{stagedSewing.sheetUsed}</span></div>
                    <div>Skipped '-' rows: <span className="font-mono text-amber-400">{stagedSewing.skippedCount}</span></div>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-500">Retaining previously uploaded data</span>
                )}
              </div>

              {/* Knitting Staged Info */}
              <div className="bg-navy-900/80 p-4 rounded-2xl border border-navy-700/80">
                <div className="flex items-center justify-between font-bold text-white mb-1">
                  <span>Knitting WIP</span>
                  <span className="font-mono text-emerald-400">
                    {stagedKnitting ? `${stagedKnitting.rows.length} unique SO_LIs` : 'Unchanged'}
                  </span>
                </div>
                {stagedKnitting ? (
                  <div className="text-[11px] text-slate-400 space-y-0.5">
                    <div>File: <span className="font-semibold text-slate-200">{stagedKnitting.fileName}</span></div>
                    <div>Aggregated from: <span className="font-mono text-cyan-300">{stagedKnitting.rawCount} size rows</span></div>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-500">Retaining previously uploaded data</span>
                )}
              </div>

              {/* Trims Staged Info & Sheet Picker */}
              <div className="bg-navy-900/80 p-4 rounded-2xl border border-navy-700/80">
                <div className="flex items-center justify-between font-bold text-white mb-1">
                  <span>Trims Readiness</span>
                  <span className="font-mono text-emerald-400">
                    {stagedTrims ? `${stagedTrims.rows.length} rows` : 'Unchanged'}
                  </span>
                </div>
                {stagedTrims ? (
                  <div className="text-[11px] text-slate-400 space-y-1.5">
                    <div>File: <span className="font-semibold text-slate-200">{stagedTrims.fileName}</span></div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-300 mt-1 mb-0.5">
                        Selected Snapshot Sheet:
                      </label>
                      <select
                        value={stagedTrims.sheetUsed}
                        onChange={(e) => handleTrimsSheetChange(e.target.value)}
                        className="w-full px-2 py-1 rounded-lg border border-navy-700 bg-navy-950 text-white font-mono text-[11px] focus:ring-1 focus:ring-cyan-500"
                      >
                        {stagedTrims.availableSheets.map((s) => (
                          <option key={s.sheetName} value={s.sheetName}>
                            {s.sheetName} {s.isRecommended ? '(Auto-Detected Closest)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-500">Retaining previously uploaded data</span>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
