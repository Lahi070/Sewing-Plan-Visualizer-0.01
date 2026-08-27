import {
  SewingPlanRow,
  KnittingPlanRow,
  TrimsPlanRow,
  ReadinessItem,
  ReadinessMetrics,
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
 * Helper to build clear reason messages for floor operators
 */
function buildIssueReason(
  knitFound: boolean,
  knitReady: boolean,
  knitSmWip: number,
  qtyNeeded: number,
  trimsFound: boolean,
  trimsReady: boolean,
  trimsStatus: string,
  trimsPedDelayed: boolean
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
    if (trimsPedDelayed) {
      issues.push('Trims delivery date after sewing date');
    } else {
      issues.push(`Trims status: ${trimsStatus || 'NO'}`);
    }
  }

  if (issues.length === 0) return 'Prerequisites verified';
  return issues.join(' • ');
}

/**
 * Core Cross-Referencing Matching Engine
 */
export function evaluateReadiness(
  sewingPlan: SewingPlanRow[],
  knittingPlan: KnittingPlanRow[],
  trimsPlan: TrimsPlanRow[],
  anchorDate: Date = new Date()
): {
  items: ReadinessItem[];
  metrics: ReadinessMetrics;
  moduleSummaries: ModuleSummary[];
} {
  // 1. Build fast Lookup Map for Knitting WIP with Normalized Keys
  const knitMap = new Map<string, KnittingPlanRow>();
  for (const k of knittingPlan) {
    const norm = normalizeSoLi(k.so_li, k.salesOrder, k.lineItem);
    if (norm) {
      knitMap.set(norm, k);
    }
    // Also store raw so_li as fallback
    if (k.so_li) {
      knitMap.set(k.so_li.trim(), k);
    }
  }

  // 2. Build fast Lookup Map for Trims Readiness with Normalized Keys
  const trimsMap = new Map<string, TrimsPlanRow>();
  for (const t of trimsPlan) {
    const norm = normalizeSoLi(t.soli);
    if (norm) {
      trimsMap.set(norm, t);
    }
    if (t.soli) {
      trimsMap.set(t.soli.trim(), t);
    }
  }

  const items: ReadinessItem[] = [];
  let readyCount = 0;
  let atRiskCount = 0;
  let notReadyCount = 0;
  let upcomingCount = 0;
  let noDataCount = 0;

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
      items: ReadinessItem[];
    }
  > = {};

  for (const sew of sewingPlan) {
    const normKey = normalizeSoLi(sew.so_li);
    const knit = knitMap.get(normKey) || knitMap.get(sew.so_li.trim());
    const trims = trimsMap.get(normKey) || trimsMap.get(sew.so_li.trim());

    const diffDays = calculateDaysRemaining(sew.plannedDate, anchorDate);

    // 1. Evaluate Knitting Side
    const knitFound = Boolean(knit);
    const knitSmWip = knit ? knit.smWipTotal : 0;
    const knitReady = knitFound && knitSmWip >= sew.qty;

    // 2. Evaluate Trims Side
    const trimsFound = Boolean(trims);
    const trimsStatus = trims ? String(trims.status || 'NO').toUpperCase() : '';
    let trimsPedDelayed = false;
    if (trims && trims.ped && sew.plannedDate) {
      const sewTime = new Date(sew.plannedDate).getTime();
      const pedTime = new Date(trims.ped).getTime();
      if (!isNaN(sewTime) && !isNaN(pedTime) && pedTime > sewTime) {
        trimsPedDelayed = true;
      }
    }
    const trimsReady = trimsFound && (trimsStatus === 'OK' || trimsStatus === '0') && !trimsPedDelayed;

    // 3. Determine Overall Status
    let overallStatus: ReadinessStatus = 'UPCOMING';
    let statusReason = '';

    if (knitReady && trimsReady) {
      // Both completely ready!
      overallStatus = 'READY';
      statusReason = `Ready: Knit (${sew.qty}/${knitSmWip} pcs) & Trims OK`;
      readyCount++;
    } else if (knitFound || trimsFound) {
      // At least one prerequisite file verified
      if (diffDays <= 0) {
        overallStatus = 'NOT_READY';
        statusReason = buildIssueReason(knitFound, knitReady, knitSmWip, sew.qty, trimsFound, trimsReady, trimsStatus, trimsPedDelayed);
        notReadyCount++;
      } else if (diffDays <= 3) {
        overallStatus = 'AT_RISK';
        statusReason = buildIssueReason(knitFound, knitReady, knitSmWip, sew.qty, trimsFound, trimsReady, trimsStatus, trimsPedDelayed);
        atRiskCount++;
      } else {
        overallStatus = 'UPCOMING';
        statusReason = buildIssueReason(knitFound, knitReady, knitSmWip, sew.qty, trimsFound, trimsReady, trimsStatus, trimsPedDelayed);
        upcomingCount++;
      }
    } else {
      // Order not found in either WIP sheet
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

    const itemObj: ReadinessItem = {
      id: `${sew.module}_${sew.so_li}_${sew.plannedDate}_${Math.random().toString(36).substr(2, 4)}`,
      module: sew.module,
      customer: sew.customer || trims?.customer || '',
      style: sew.style || trims?.product || '',
      productType: sew.productType || '',
      cw: sew.cw || trims?.cw || '',
      so_li: sew.so_li,
      plannedDate: sew.plannedDate,
      diffDays,
      qtyNeeded: sew.qty,
      knitFound,
      knitSmWip,
      knitReady,
      knitDetails: knit
        ? {
            orderQty: knit.orderQtyTotal,
            knitQty: knit.knitQtyTotal,
            pkinQty: knit.pkinQtyTotal,
            qcQty: knit.qcQtyTotal,
            shippedQty: knit.shippedQtyTotal,
            sizeCount: knit.sizeCount,
          }
        : undefined,
      trimsFound,
      trimsStatus: trimsStatus || (trimsFound ? 'OK' : 'PENDING'),
      trimsReady,
      trimsPed: trims?.ped,
      trimsPsd: trims?.psd,
      trimsDaysLate: trims?.daysLate || 0,
      trimsComments: [trims?.rmComments, trims?.merchComments].filter(Boolean).join(' | '),
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
    mod.totalQty += sew.qty;
    mod.knitTotalNeededQty += sew.qty;
    mod.knitCompletedQty += Math.min(sew.qty, knitSmWip);
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
    return a.module.localeCompare(b.module);
  });

  const total = items.length || 1;
  const metrics: ReadinessMetrics = {
    totalRequirements: items.length,
    ready: readyCount,
    readyPct: Math.round((readyCount / total) * 100),
    atRisk: atRiskCount,
    atRiskPct: Math.round((atRiskCount / total) * 100),
    notReady: notReadyCount,
    notReadyPct: Math.round((notReadyCount / total) * 100),
    upcoming: upcomingCount,
    upcomingPct: Math.round((upcomingCount / total) * 100),
    noData: noDataCount,
    noDataPct: Math.round((noDataCount / total) * 100),
  };

  // Sort modules naturally: M01, M02, ... M26
  const moduleSummaries: ModuleSummary[] = Object.values(moduleAgg).sort((a, b) => {
    const numA = parseInt(a.module.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.module.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });

  return { items, metrics, moduleSummaries };
}
