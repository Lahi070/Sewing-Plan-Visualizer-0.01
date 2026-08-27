import {
  SewingPlanRow,
  KnittingPlanRow,
  TrimsPlanRow,
  MatchedReadinessItem,
  OverallMetrics,
  ModuleSummary,
  ReadinessStatus,
} from './types';
import { normalizeSoLi, normalizeModuleName } from './excelParser';

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

  const anchorMidnight = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  const diffMs = targetMidnight.getTime() - anchorMidnight.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Checks if trims status is Green / OK / Allocated
 */
export function isTrimsReady(status: string | undefined): boolean {
  if (status === undefined || status === null) return true;
  const s = String(status).trim().toUpperCase();
  if (!s || s === '0' || s === '1' || s === 'OK' || s === 'GREEN' || s === 'ALLOCATED' || s === 'READY' || s === 'YES' || s === 'PASS') {
    return true;
  }
  if (
    s.includes('RED') ||
    s.includes('NO') ||
    s.includes('FAIL') ||
    s.includes('SHORT') ||
    s.includes('NOT') ||
    s.includes('HOLD') ||
    s.includes('DELAY') ||
    s.includes('LATE')
  ) {
    return false;
  }
  return true;
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

  // DIAGNOSTIC: Log data sizes
  console.log('[MatcherEngine] Input sizes → Sewing:', safeSewing.length, 'Knitting:', safeKnitting.length, 'Trims:', safeTrims.length);
  if (safeKnitting.length > 0) {
    console.log('[MatcherEngine] First 3 knitting SO_LIs:', safeKnitting.slice(0, 3).map(k => k.so_li));
    console.log('[MatcherEngine] First knitting row keys:', Object.keys(safeKnitting[0]));
  } else {
    console.warn('[MatcherEngine] ⚠️ KNITTING DATA IS EMPTY - this will cause 0% WIP');
  }

  // 1. Build fast Lookup Map for Knitting WIP with Normalized Keys & SO Fallback
  const knitMap = new Map<string, KnittingPlanRow>();
  const soKnitMap = new Map<string, KnittingPlanRow>();

  for (const k of safeKnitting) {
    const norm = normalizeSoLi(k.so_li, k.salesOrder, k.lineItem);
    if (norm) {
      knitMap.set(norm, k);
      const soOnly = norm.split('/')[0];
      if (soOnly && !soKnitMap.has(soOnly)) {
        soKnitMap.set(soOnly, k);
      }
    }
    if (k.so_li) {
      const cleanKey = k.so_li.trim();
      knitMap.set(cleanKey, k);
      knitMap.set(cleanKey.replace(/\s+/g, ''), k);
      knitMap.set(cleanKey.replace(/^0+/, ''), k);
      const soOnly = cleanKey.split('/')[0];
      if (soOnly && !soKnitMap.has(soOnly)) {
        soKnitMap.set(soOnly, k);
      }
    }
    if (k.salesOrder && !soKnitMap.has(k.salesOrder.trim())) {
      soKnitMap.set(k.salesOrder.trim(), k);
    }
  }

  console.log('[MatcherEngine] KnitMap size:', knitMap.size, 'SO fallback size:', soKnitMap.size);

  // 2. Build fast Lookup Map for Trims Readiness with Normalized Keys & Module Hierarchies
  const trimsMap = new Map<string, TrimsPlanRow>();
  const moduleTrimsStatusMap = new Map<string, string>(); // module -> 'OK' | 'NO'
  const moduleDateTrimsMap = new Map<string, string>(); // module_date -> 'OK' | 'NO'

  for (const t of safeTrims) {
    const norm = normalizeSoLi(t.soli);
    if (norm) {
      trimsMap.set(norm, t);
    }
    if (t.soli) {
      const cleanKey = t.soli.trim();
      trimsMap.set(cleanKey, t);
      trimsMap.set(cleanKey.replace(/\s+/g, ''), t);
      trimsMap.set(cleanKey.replace(/^0+/, ''), t);
    }

    const tStatus = isTrimsReady(t.status) ? 'OK' : 'NO';
    const cleanMod = normalizeModuleName(t.module);

    if (cleanMod) {
      if (tStatus === 'OK' || !moduleTrimsStatusMap.has(cleanMod)) {
        moduleTrimsStatusMap.set(cleanMod, tStatus);
      }
      if (t.psd) {
        moduleDateTrimsMap.set(`${cleanMod}_${t.psd}`, tStatus);
      }
      if (t.ped) {
        moduleDateTrimsMap.set(`${cleanMod}_${t.ped}`, tStatus);
      }
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

  // DIAGNOSTIC: Track per-module match counts
  const _debugModuleKnitMatches: Record<string, { matched: number; total: number; missedSoLis: string[] }> = {};

  for (const sew of safeSewing) {
    const normKey = normalizeSoLi(sew.so_li);
    const soOnly = normKey ? normKey.split('/')[0] : (sew.so_li ? sew.so_li.split('/')[0] : '');

    let knit = knitMap.get(normKey) 
            || knitMap.get(sew.so_li?.trim()) 
            || knitMap.get(sew.so_li?.replace(/\s+/g, ''))
            || (soOnly ? soKnitMap.get(soOnly) : undefined);

    // DIAGNOSTIC: Track per-module knitting matches
    const _mod = sew.module || 'UNKNOWN';
    if (!_debugModuleKnitMatches[_mod]) _debugModuleKnitMatches[_mod] = { matched: 0, total: 0, missedSoLis: [] };
    _debugModuleKnitMatches[_mod].total++;
    if (knit) {
      _debugModuleKnitMatches[_mod].matched++;
    } else {
      if (_debugModuleKnitMatches[_mod].missedSoLis.length < 3) {
        _debugModuleKnitMatches[_mod].missedSoLis.push(sew.so_li || 'empty');
      }
    }

    let trims = trimsMap.get(normKey) 
             || trimsMap.get(sew.so_li?.trim()) 
             || trimsMap.get(sew.so_li?.replace(/\s+/g, ''));

    // 1. Evaluate Knitting Side (SM WIP, Knit Qty, Order Qty, PKIN Qty, QC Qty)
    const knitFound = Boolean(knit);
    const knitSmWip = knit
      ? Math.max(
          Number(knit.smWipTotal) || 0,
          Number(knit.knitQtyTotal) || 0,
          Number(knit.orderQtyTotal) || 0,
          Number(knit.pkinQtyTotal) || 0,
          Number(knit.qcQtyTotal) || 0
        )
      : 0;
    const knitReady = knitFound && knitSmWip >= sew.qty;

    // 2. Evaluate Trims Side (Master Module Status + Date + Item Hierarchy)
    const cleanMod = normalizeModuleName(sew.module);
    let trimsFound = Boolean(trims);
    let trimsStatus = trims ? String(trims.status || '').toUpperCase() : '';

    const isModuleMasterOk = Boolean(cleanMod && moduleTrimsStatusMap.get(cleanMod) === 'OK');
    const isModuleDateOk = Boolean(cleanMod && sew.plannedDate && moduleDateTrimsMap.get(`${cleanMod}_${sew.plannedDate}`) === 'OK');

    let trimsReady = false;

    if (isModuleDateOk || isModuleMasterOk) {
      trimsFound = true;
      trimsStatus = 'OK';
      trimsReady = true;
    } else if (trimsFound) {
      trimsReady = isTrimsReady(trimsStatus);
    } else if (cleanMod && moduleTrimsStatusMap.has(cleanMod)) {
      trimsFound = true;
      trimsStatus = moduleTrimsStatusMap.get(cleanMod) || 'OK';
      trimsReady = isTrimsReady(trimsStatus);
    }

    const diffDays = calculateDaysRemaining(sew.plannedDate, anchorDate);
    totalQtyNeeded += Number(sew.qty) || 0;

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
      id: `${cleanMod || sew.module}_${sew.so_li}_${sew.plannedDate}_${Math.random().toString(36).substr(2, 4)}`,
      module: cleanMod || sew.module || 'M01',
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
    const m = cleanMod || sew.module || 'M01';
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

  // DIAGNOSTIC: Log per-module knitting match results
  console.log('[MatcherEngine] Per-module knitting match results:');
  for (const [mod, info] of Object.entries(_debugModuleKnitMatches)) {
    if (info.matched < info.total) {
      console.warn(`  ${mod}: ${info.matched}/${info.total} matched. Missed SO_LIs:`, info.missedSoLis);
    } else {
      console.log(`  ${mod}: ${info.matched}/${info.total} ✓`);
    }
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
