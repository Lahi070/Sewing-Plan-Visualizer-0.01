import {
  SewingPlanRow,
  KnittingPlanRow,
  TrimsPlanRow,
  MatchedReadinessItem,
  OverallMetrics,
  ModuleSummary,
  ReadinessStatus,
} from './types';

/**
 * Cross-references Sewing, Knitting, and Trims datasets
 * to determine readiness per Module / SO_LI / Date.
 */
export function evaluateReadiness(
  sewingRows: SewingPlanRow[],
  knittingRows: KnittingPlanRow[],
  trimsRows: TrimsPlanRow[],
  currentDateStr?: string
): {
  items: MatchedReadinessItem[];
  metrics: OverallMetrics;
  moduleSummaries: ModuleSummary[];
} {
  // Normalize reference date
  const today = currentDateStr ? new Date(currentDateStr) : new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Build fast lookup indexes
  const knitMap = new Map<string, KnittingPlanRow>();
  for (const k of knittingRows) {
    const key = k.so_li.trim();
    if (key) knitMap.set(key, k);
  }

  const trimsMap = new Map<string, TrimsPlanRow>();
  for (const t of trimsRows) {
    const key = t.soli.trim();
    if (key) trimsMap.set(key, t);
  }

  const items: MatchedReadinessItem[] = [];

  let readyCount = 0;
  let atRiskCount = 0;
  let notReadyCount = 0;
  let upcomingCount = 0;
  let noDataCount = 0;
  let totalQtyNeeded = 0;

  for (const sew of sewingRows) {
    const key = sew.so_li.trim();
    totalQtyNeeded += sew.qty;

    const knit = knitMap.get(key);
    const trims = trimsMap.get(key);

    const knitFound = !!knit;
    const trimsFound = !!trims;

    const knitSmWip = knit ? knit.smWipTotal : 0;
    const knitReady = knitFound && knitSmWip >= sew.qty;

    const trimsStatus = trims ? trims.status : '';
    let trimsPedDelayed = false;

    // Evaluate Trims PED vs Planned Sewing Date
    if (trims && trims.ped && sew.plannedDate) {
      const pedDate = new Date(trims.ped);
      const sewDate = new Date(sew.plannedDate);
      if (!isNaN(pedDate.getTime()) && !isNaN(sewDate.getTime())) {
        if (pedDate > sewDate) {
          trimsPedDelayed = true;
        }
      }
    }

    const trimsReady = trimsFound && trimsStatus === 'OK' && !trimsPedDelayed;

    // Calculate difference in days to planned sewing date
    let diffDays = 999;
    if (sew.plannedDate) {
      const sewDate = new Date(sew.plannedDate);
      sewDate.setHours(0, 0, 0, 0);
      if (!isNaN(sewDate.getTime())) {
        diffDays = Math.ceil((sewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    // Determine Overall Status
    let overallStatus: ReadinessStatus = 'UPCOMING';
    let statusReason = '';

    if (!knitFound && !trimsFound) {
      overallStatus = 'NO_DATA';
      statusReason = 'SO_LI missing from both Knitting and Trims records';
      noDataCount++;
    } else if (!knitFound) {
      overallStatus = 'NO_DATA';
      statusReason = 'SO_LI not found in Knitting WIP file';
      noDataCount++;
    } else if (!trimsFound) {
      overallStatus = 'NO_DATA';
      statusReason = 'SO_LI not found in Trims Readiness sheet';
      noDataCount++;
    } else if (knitReady && trimsReady) {
      overallStatus = 'READY';
      statusReason = `Ready: Knit (${sew.qty}/${knitSmWip} pcs) & Trims OK`;
      readyCount++;
    } else if (diffDays <= 0) {
      overallStatus = 'NOT_READY';
      statusReason = buildIssueReason(knitReady, knitSmWip, sew.qty, trimsReady, trimsStatus, trimsPedDelayed);
      notReadyCount++;
    } else if (diffDays <= 3) {
      overallStatus = 'AT_RISK';
      statusReason = buildIssueReason(knitReady, knitSmWip, sew.qty, trimsReady, trimsStatus, trimsPedDelayed);
      atRiskCount++;
    } else {
      overallStatus = 'UPCOMING';
      statusReason = buildIssueReason(knitReady, knitSmWip, sew.qty, trimsReady, trimsStatus, trimsPedDelayed);
      upcomingCount++;
    }

    items.push({
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
            sizeCount: knit.sizeCount,
          }
        : undefined,
      trimsFound,
      trimsStatus,
      trimsPsd: trims?.psd || '',
      trimsPed: trims?.ped || '',
      trimsReady,
      trimsPedDelayed,
      trimsComments: {
        rm: trims?.rmComments || '',
        merch: trims?.merchComments || '',
      },
      overallStatus,
      statusReason,
    });
  }

  // Sort items primarily by severity (NOT_READY -> AT_RISK -> UPCOMING -> READY -> NO_DATA), then date
  const statusOrder: Record<ReadinessStatus, number> = {
    NOT_READY: 0,
    AT_RISK: 1,
    UPCOMING: 2,
    NO_DATA: 3,
    READY: 4,
  };

  items.sort((a, b) => {
    const diffStatus = statusOrder[a.overallStatus] - statusOrder[b.overallStatus];
    if (diffStatus !== 0) return diffStatus;
    return (a.plannedDate || '').localeCompare(b.plannedDate || '');
  });

  const totalItems = items.length;
  const metrics: OverallMetrics = {
    totalItems,
    totalQtyNeeded,
    readyCount,
    atRiskCount,
    notReadyCount,
    upcomingCount,
    noDataCount,
    readyPercentage: totalItems > 0 ? Math.round((readyCount / totalItems) * 100) : 0,
    atRiskPercentage: totalItems > 0 ? Math.round((atRiskCount / totalItems) * 100) : 0,
    notReadyPercentage: totalItems > 0 ? Math.round((notReadyCount / totalItems) * 100) : 0,
    urgentCount: atRiskCount + notReadyCount,
  };

  // Group by Module
  const moduleMap = new Map<string, ModuleSummary>();
  for (const item of items) {
    if (!moduleMap.has(item.module)) {
      moduleMap.set(item.module, {
        module: item.module,
        totalItems: 0,
        totalQty: 0,
        readyCount: 0,
        atRiskCount: 0,
        notReadyCount: 0,
        upcomingCount: 0,
        noDataCount: 0,
        knitCompletedQty: 0,
        knitTotalNeededQty: 0,
        trimsOkCount: 0,
        trimsTotalCount: 0,
        items: [],
      });
    }

    const m = moduleMap.get(item.module)!;
    m.totalItems += 1;
    m.totalQty += item.qtyNeeded;
    m.items.push(item);

    if (item.overallStatus === 'READY') m.readyCount++;
    else if (item.overallStatus === 'AT_RISK') m.atRiskCount++;
    else if (item.overallStatus === 'NOT_READY') m.notReadyCount++;
    else if (item.overallStatus === 'UPCOMING') m.upcomingCount++;
    else if (item.overallStatus === 'NO_DATA') m.noDataCount++;

    // Module Dual-Side Calculations
    m.knitCompletedQty += Math.min(item.knitSmWip, item.qtyNeeded);
    m.knitTotalNeededQty += item.qtyNeeded;

    if (item.trimsFound) {
      m.trimsTotalCount += 1;
      if (item.trimsStatus === 'OK' && !item.trimsPedDelayed) {
        m.trimsOkCount += 1;
      }
    }
  }

  const moduleSummaries = Array.from(moduleMap.values()).sort((a, b) => {
    // Sort modules naturally (M01, M02, ... M26)
    return a.module.localeCompare(b.module, undefined, { numeric: true });
  });

  return { items, metrics, moduleSummaries };
}

function buildIssueReason(
  knitReady: boolean,
  knitWip: number,
  qtyNeeded: number,
  trimsReady: boolean,
  trimsStatus: string,
  trimsPedDelayed: boolean
): string {
  const issues: string[] = [];
  if (!knitReady) {
    issues.push(`Knit short (${qtyNeeded}/${knitWip} pcs)`);
  }
  if (!trimsReady) {
    if (trimsStatus !== 'OK') {
      issues.push(`Trims Status ${trimsStatus || 'NO'}`);
    } else if (trimsPedDelayed) {
      issues.push('Trims PED after sewing date');
    }
  }
  return issues.join(' & ') || 'Prerequisites incomplete';
}
