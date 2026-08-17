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
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Dataset & Staged uploads state
  const [currentDataset, setCurrentDataset] = useState<AppDataset>(INITIAL_DATASET);
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
    setAuthError(null);
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
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 shadow-xl">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-900/20 mb-4">
              <Lock className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">Admin Upload Access</h1>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Enter the admin authorization password to upload and update sewing floor Excel records.
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Admin Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter admin password..."
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                />
              </div>
            </div>

            {authError && (
              <div className="flex items-center space-x-2 text-xs text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isVerifying && <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />}
              <span>{isVerifying ? 'Verifying...' : 'Unlock Upload Center'}</span>
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link href="/" className="inline-flex items-center space-x-1.5 text-slate-600 hover:text-slate-900 font-medium">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Floor Dashboard</span>
            </Link>
            <span className="text-[11px] text-slate-400">Public viewing requires no login</span>
          </div>
        </div>
      </div>
    );
  }

  const hasAnyStaged = Boolean(stagedSewing || stagedKnitting || stagedTrims);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Link>
            <h1 className="text-base font-bold text-slate-900 hidden sm:block">
              Admin Excel Ingestion Portal
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleResetToFactoryData}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Reset Factory Sample Data</span>
            </button>
            <button
              onClick={() => {
                setIsAuthenticated(false);
                sessionStorage.removeItem('sewing_admin_authenticated');
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1"
            >
              Lock / Exit
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Banner */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-md shadow-slate-900/10">
              <UploadCloud className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Upload & Cross-Reference Factory Datasets
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-3xl">
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
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-rose-50 text-rose-900 border-rose-300'
            }`}
          >
            {syncStatus.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{syncStatus.message}</span>
          </div>
        )}

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
          <div className="rounded-3xl border-2 border-emerald-400 bg-emerald-50/40 p-6 sm:p-7 shadow-md space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-emerald-200 pb-4">
              <div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-200 text-emerald-900 uppercase tracking-wider">
                  Ready to Synchronize
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">Staged Files Preview</h3>
              </div>

              <button
                onClick={handleCommitSync}
                disabled={isSyncing}
                className="inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {isSyncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
                <span>{isSyncing ? 'Synchronizing to Database...' : 'Save & Publish to Floor'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Sewing Staged Info */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between font-bold text-slate-900 mb-1">
                  <span>Sewing Plan</span>
                  <span className="font-mono text-emerald-600">
                    {stagedSewing ? `${stagedSewing.rows.length} rows` : 'Unchanged'}
                  </span>
                </div>
                {stagedSewing ? (
                  <div className="text-[11px] text-slate-500 space-y-0.5">
                    <div>File: <span className="font-semibold text-slate-700">{stagedSewing.fileName}</span></div>
                    <div>Sheet: <span className="font-mono font-medium text-slate-700">{stagedSewing.sheetUsed}</span></div>
                    <div>Skipped '-' rows: <span className="font-mono text-amber-600">{stagedSewing.skippedCount}</span></div>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400">Retaining previously uploaded data</span>
                )}
              </div>

              {/* Knitting Staged Info */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between font-bold text-slate-900 mb-1">
                  <span>Knitting WIP</span>
                  <span className="font-mono text-emerald-600">
                    {stagedKnitting ? `${stagedKnitting.rows.length} unique SO_LIs` : 'Unchanged'}
                  </span>
                </div>
                {stagedKnitting ? (
                  <div className="text-[11px] text-slate-500 space-y-0.5">
                    <div>File: <span className="font-semibold text-slate-700">{stagedKnitting.fileName}</span></div>
                    <div>Aggregated from: <span className="font-mono text-slate-700">{stagedKnitting.rawCount} size rows</span></div>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400">Retaining previously uploaded data</span>
                )}
              </div>

              {/* Trims Staged Info & Sheet Picker */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between font-bold text-slate-900 mb-1">
                  <span>Trims Readiness</span>
                  <span className="font-mono text-emerald-600">
                    {stagedTrims ? `${stagedTrims.rows.length} rows` : 'Unchanged'}
                  </span>
                </div>
                {stagedTrims ? (
                  <div className="text-[11px] text-slate-500 space-y-1.5">
                    <div>File: <span className="font-semibold text-slate-700">{stagedTrims.fileName}</span></div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mt-1 mb-0.5">
                        Selected Snapshot Sheet:
                      </label>
                      <select
                        value={stagedTrims.sheetUsed}
                        onChange={(e) => handleTrimsSheetChange(e.target.value)}
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 font-mono text-[11px] focus:ring-1 focus:ring-slate-900"
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
                  <span className="text-[11px] text-slate-400">Retaining previously uploaded data</span>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
