import {
  SewingPlanRow,
  KnittingPlanRow,
  TrimsPlanRow,
  MatchedReadinessItem,
  OverallMetrics,
  ModuleSummary,
  ReadinessStatus,
} from './types';
import { normalizeSoLi } from './excelParser';

/**
 * Calculates day difference between target date and anchor date
 * diffDays <= 0: Today or Overdue
 * diffDays 1..3: At Risk window (within 3 days)
 * diffDays > 3: Upcoming
 */
export function calculateDaysRemaining(targetDateStr: string, anchorDate: Date = new Date()): number {
  if (!targetDateStr) return 999;
  const target = new Date(targetDateStr);
  if (isNaN(target.getTime())) return 999;

  // Compare calendar days
  const anchorMidnight = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  const diffMs = targetMidnight.getTime() - anchorMidnight.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Checks if trims status is Green / OK / Allocated
 */
export function isTrimsReady(status: string | undefined): boolean {
  if (!status) return false;
  const s = String(status).trim().toUpperCase();
  return (
    s === 'OK' ||
    s === 'GREEN' ||
    s === 'ALLOCATED' ||
    s === 'READY' ||
    s === 'YES' ||
    s === '0' ||
    s === '1' ||
    s === 'PASS'
  );
}

/**
 * Helper to build clear reason messages for floor operators
 */
function buildIssueReason(
  knitFound: boolean,
  knitReady: boolean,
  knitSmWip: number,
  qtyNeeded: number,
  trimsFound: boolean,
  trimsReady: boolean,
  trimsStatus: string
): string {
  const issues: string[] = [];

  if (!knitFound) {
    issues.push('Knitting WIP not found');
  } else if (!knitReady) {
    issues.push(`Knit short (${knitSmWip}/${qtyNeeded} pcs)`);
  }

  if (!trimsFound) {
    issues.push('Trims verification pending');
  } else if (!trimsReady) {
    issues.push(`Trims allocation: ${trimsStatus || 'RED'}`);
  }

  if (issues.length === 0) return 'Prerequisites verified';
  return issues.join(' • ');
}

/**
 * Core Cross-Referencing Matching Engine
 */
export function evaluateReadiness(
  sewingPlan: SewingPlanRow[] = [],
  knittingPlan: KnittingPlanRow[] = [],
  trimsPlan: TrimsPlanRow[] = [],
  anchorDate: Date = new Date()
): {
  items: MatchedReadinessItem[];
  metrics: OverallMetrics;
  moduleSummaries: ModuleSummary[];
} {
  const safeSewing = Array.isArray(sewingPlan) ? sewingPlan : [];
  const safeKnitting = Array.isArray(knittingPlan) ? knittingPlan : [];
  const safeTrims = Array.isArray(trimsPlan) ? trimsPlan : [];

  // 1. Build fast Lookup Map for Knitting WIP with Normalized Keys
  const knitMap = new Map<string, KnittingPlanRow>();
  for (const k of safeKnitting) {
    const norm = normalizeSoLi(k.so_li, k.salesOrder, k.lineItem);
    if (norm) {
      knitMap.set(norm, k);
    }
    if (k.so_li) {
      knitMap.set(k.so_li.trim(), k);
    }
  }

  // 2. Build fast Lookup Map for Trims Readiness with Normalized Keys
  const trimsMap = new Map<string, TrimsPlanRow>();
  for (const t of safeTrims) {
    const norm = normalizeSoLi(t.soli);
    if (norm) {
      trimsMap.set(norm, t);
    }
    if (t.soli) {
      trimsMap.set(t.soli.trim(), t);
    }
  }

  const items: MatchedReadinessItem[] = [];
  let readyCount = 0;
  let atRiskCount = 0;
  let notReadyCount = 0;
  let upcomingCount = 0;
  let noDataCount = 0;
  let totalQtyNeeded = 0;

  // Module summaries aggregator
  const moduleAgg: Record<
    string,
    {
      module: string;
      totalItems: number;
      readyCount: number;
      atRiskCount: number;
      notReadyCount: number;
      upcomingCount: number;
      noDataCount: number;
      totalQty: number;
      knitCompletedQty: number;
      knitTotalNeededQty: number;
      trimsOkCount: number;
      trimsTotalCount: number;
      items: MatchedReadinessItem[];
    }
  > = {};

  for (const sew of safeSewing) {
    const normKey = normalizeSoLi(sew.so_li);
    const knit = knitMap.get(normKey) || knitMap.get(sew.so_li?.trim());
    const trims = trimsMap.get(normKey) || trimsMap.get(sew.so_li?.trim());

    const diffDays = calculateDaysRemaining(sew.plannedDate, anchorDate);
    totalQtyNeeded += Number(sew.qty) || 0;

    // 1. Evaluate Knitting Side
    const knitFound = Boolean(knit);
    const knitSmWip = knit ? (Number(knit.smWipTotal) || 0) : 0;
    const knitReady = knitFound && knitSmWip >= sew.qty;

    // 2. Evaluate Trims Side (Only check Status: Green/OK vs Red/NO, no quantity logic)
    const trimsFound = Boolean(trims);
    const trimsStatus = trims ? String(trims.status || 'NO').toUpperCase() : '';
    const trimsReady = trimsFound && isTrimsReady(trimsStatus);

    // 3. Determine Overall Status
    let overallStatus: ReadinessStatus = 'UPCOMING';
    let statusReason = '';

    if (knitReady && trimsReady) {
      overallStatus = 'READY';
      statusReason = `Ready: Knit (${sew.qty}/${knitSmWip} pcs) & Trims OK`;
      readyCount++;
    } else if (knitFound || trimsFound) {
      if (diffDays <= 0) {
        overallStatus = 'NOT_READY';
        statusReason = buildIssueReason(knitFound, knitReady, knitSmWip, sew.qty, trimsFound, trimsReady, trimsStatus);
        notReadyCount++;
      } else if (diffDays <= 3) {
        overallStatus = 'AT_RISK';
        statusReason = buildIssueReason(knitFound, knitReady, knitSmWip, sew.qty, trimsFound, trimsReady, trimsStatus);
        atRiskCount++;
      } else {
        overallStatus = 'UPCOMING';
        statusReason = buildIssueReason(knitFound, knitReady, knitSmWip, sew.qty, trimsFound, trimsReady, trimsStatus);
        upcomingCount++;
      }
    } else {
      if (diffDays <= 0) {
        overallStatus = 'NOT_READY';
        statusReason = 'Sewing date passed/today • No Knitting/Trims WIP confirmed';
        notReadyCount++;
      } else if (diffDays <= 3) {
        overallStatus = 'AT_RISK';
        statusReason = `Sewing in ${diffDays} day(s) • WIP records pending upload`;
        atRiskCount++;
      } else if (sew.plannedDate) {
        overallStatus = 'UPCOMING';
        statusReason = `Sewing in ${diffDays} days • Prerequisites pending`;
        upcomingCount++;
      } else {
        overallStatus = 'NO_DATA';
        statusReason = 'SO_LI missing from Knitting & Trims records';
        noDataCount++;
      }
    }

    const itemObj: MatchedReadinessItem = {
      id: `${sew.module}_${sew.so_li}_${sew.plannedDate}_${Math.random().toString(36).substr(2, 4)}`,
      module: sew.module || 'M01',
      customer: sew.customer || trims?.customer || '',
      style: sew.style || trims?.product || '',
      productType: sew.productType || '',
      cw: sew.cw || trims?.cw || '',
      so_li: sew.so_li,
      plannedDate: sew.plannedDate,
      diffDays,
      qtyNeeded: Number(sew.qty) || 0,
      knitFound,
      knitSmWip,
      knitReady,
      knitDetails: knit
        ? {
            orderQty: knit.orderQtyTotal,
            knitQty: knit.knitQtyTotal,
            sizeCount: knit.sizeCount,
          }
        : undefined,
      trimsFound,
      trimsStatus: trimsStatus || (trimsFound ? 'OK' : 'PENDING'),
      trimsPsd: trims?.psd || '',
      trimsPed: trims?.ped || '',
      trimsReady,
      trimsPedDelayed: false,
      trimsComments: {
        rm: trims?.rmComments || '',
        merch: trims?.merchComments || '',
      },
      overallStatus,
      statusReason,
    };

    items.push(itemObj);

    // Module Aggregator
    const m = sew.module || 'M01';
    if (!moduleAgg[m]) {
      moduleAgg[m] = {
        module: m,
        totalItems: 0,
        readyCount: 0,
        atRiskCount: 0,
        notReadyCount: 0,
        upcomingCount: 0,
        noDataCount: 0,
        totalQty: 0,
        knitCompletedQty: 0,
        knitTotalNeededQty: 0,
        trimsOkCount: 0,
        trimsTotalCount: 0,
        items: [],
      };
    }

    const mod = moduleAgg[m];
    mod.totalItems += 1;
    mod.totalQty += Number(sew.qty) || 0;
    mod.knitTotalNeededQty += Number(sew.qty) || 0;
    mod.knitCompletedQty += Math.min(Number(sew.qty) || 0, knitSmWip);
    if (trimsReady) mod.trimsOkCount += 1;
    mod.trimsTotalCount += 1;

    if (overallStatus === 'READY') mod.readyCount += 1;
    else if (overallStatus === 'AT_RISK') mod.atRiskCount += 1;
    else if (overallStatus === 'NOT_READY') mod.notReadyCount += 1;
    else if (overallStatus === 'UPCOMING') mod.upcomingCount += 1;
    else if (overallStatus === 'NO_DATA') mod.noDataCount += 1;

    mod.items.push(itemObj);
  }

  // Sort items by Planned Date ascending, then Module
  items.sort((a, b) => {
    if (a.plannedDate && b.plannedDate) {
      const cmp = a.plannedDate.localeCompare(b.plannedDate);
      if (cmp !== 0) return cmp;
    }
    return (a.module || '').localeCompare(b.module || '');
  });

  const total = items.length || 1;
  const metrics: OverallMetrics = {
    totalItems: items.length,
    totalQtyNeeded,
    readyCount,
    readyPercentage: Math.round((readyCount / total) * 100),
    atRiskCount,
    atRiskPercentage: Math.round((atRiskCount / total) * 100),
    notReadyCount,
    notReadyPercentage: Math.round((notReadyCount / total) * 100),
    upcomingCount,
    noDataCount,
    urgentCount: atRiskCount + notReadyCount,
  };

  // Sort modules naturally: M01, M02, ... M26
  const moduleSummaries: ModuleSummary[] = Object.values(moduleAgg).sort((a, b) => {
    const numA = parseInt(a.module.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.module.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });

  return { items, metrics, moduleSummaries };
}
