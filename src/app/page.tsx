'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { UrgentAlerts } from '@/components/UrgentAlerts';
import { MetricsOverview } from '@/components/MetricsOverview';
import { StatusPieChart } from '@/components/StatusPieChart';
import { ModuleRiskChart } from '@/components/ModuleRiskChart';
import { ReadinessTable } from '@/components/ReadinessTable';
import { ModuleDetailModal } from '@/components/ModuleDetailModal';
import { evaluateReadiness } from '@/lib/matcherEngine';
import { getActiveDataset } from '@/lib/supabase';
import { INITIAL_DATASET } from '@/lib/sampleData';
import { AppDataset, ReadinessStatus, ModuleSummary } from '@/lib/types';
import { RefreshCw, Layers } from 'lucide-react';

export default function DashboardPage() {
  const [dataset, setDataset] = useState<AppDataset>(INITIAL_DATASET);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<ReadinessStatus | 'ALL'>('ALL');
  const [selectedModuleName, setSelectedModuleName] = useState<string | null>(null);

  // Load dataset
  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await getActiveDataset();
      setDataset(data);
    } catch (e) {
      console.error('Error loading dataset:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Run the core matching engine across sewing, knitting and trims records
  const { items, metrics, moduleSummaries } = useMemo(() => {
    console.log('[Dashboard] Dataset sizes → sewingPlan:', dataset.sewingPlan?.length, 'knittingPlan:', dataset.knittingPlan?.length, 'trimsPlan:', dataset.trimsPlan?.length);
    if (dataset.knittingPlan?.length > 0) {
      console.log('[Dashboard] First knitting row:', JSON.stringify(dataset.knittingPlan[0]).substring(0, 200));
    }
    return evaluateReadiness(
      dataset.sewingPlan,
      dataset.knittingPlan,
      dataset.trimsPlan,
      dataset.overrides
    );
  }, [dataset]);

  // Selected module drill-down object
  const activeModuleSummary: ModuleSummary | null = useMemo(() => {
    if (!selectedModuleName) return null;
    return moduleSummaries.find((m) => m.module === selectedModuleName) || null;
  }, [selectedModuleName, moduleSummaries]);

  // Filter urgent lines (At Risk + Not Ready)
  const handleFilterUrgent = () => {
    if (selectedStatusFilter === 'AT_RISK') {
      setSelectedStatusFilter('ALL');
    } else {
      setSelectedStatusFilter('AT_RISK');
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col text-slate-100 selection:bg-cyan-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        lastUpdated={dataset.metadata.lastUpdated}
        onRefresh={loadData}
        isRefreshing={isRefreshing}
      />

      {/* Main Floor Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Floor Status Title & Subtitle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-navy-700/60 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-cyan-glow" />
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                Sewing Module Readiness Floor Tracker
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Automated 3-day prerequisite verification: Knitting WIP completion vs Raw Material Warehouse (Trims) allocation.
            </p>
          </div>

          {dataset.metadata.lastUpdated && (
            <div suppressHydrationWarning className="text-[11px] text-slate-400 font-mono bg-navy-900 px-3 py-1.5 rounded-xl border border-navy-700/80 shadow-md self-start sm:self-auto">
              Last Sync: {new Date(dataset.metadata.lastUpdated).toLocaleDateString()} {new Date(dataset.metadata.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>

        {/* 1. 3-Day Risk Alert Banner */}
        <UrgentAlerts
          items={items}
          onFilterUrgent={handleFilterUrgent}
          isFilteredUrgent={selectedStatusFilter === 'AT_RISK'}
        />

        {/* 2. Top Summary KPI Cards */}
        <MetricsOverview
          metrics={metrics}
          selectedStatus={selectedStatusFilter}
          onSelectStatus={setSelectedStatusFilter}
        />

        {/* 3. Analytics Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StatusPieChart metrics={metrics} />
          <ModuleRiskChart
            moduleSummaries={moduleSummaries}
            onSelectModule={setSelectedModuleName}
          />
        </div>

        {/* 4. Detailed Readiness Table */}
        <ReadinessTable
          items={items}
          selectedStatusFilter={selectedStatusFilter}
          onStatusFilterChange={setSelectedStatusFilter}
          onSelectModule={setSelectedModuleName}
        />
      </main>

      {/* Module Drilldown Modal with Dual Pie Charts */}
      <ModuleDetailModal
        moduleSummary={activeModuleSummary}
        onClose={() => setSelectedModuleName(null)}
      />

      {/* Floor Footer */}
      <footer className="border-t border-navy-800 bg-navy-950/90 py-5 text-center text-xs text-slate-400 no-print mt-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6">
            <span>Sewing Floor Operations • Garment Manufacturing</span>
            <span className="hidden sm:inline text-navy-700">|</span>
            <span className="flex items-center gap-1.5">
              Developer: W.A. Lahiru S. Dissanayake • Contact: 070 2416664
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Deployed on Vercel Hobby Free Tier • Backed by Supabase Postgres
          </span>
        </div>
      </footer>
    </div>
  );
}
