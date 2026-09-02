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
 */
export function calculateDaysRemaining(targetDateStr: string, anchorDate: Date = new Date()): number {
  if (!targetDateStr) return 999;
  const target = new Date(targetDateStr);
  if (isNaN(target.getTime())) return 999;
  const anchorMidnight = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((targetMidnight.getTime() - anchorMidnight.getTime()) / (1000 * 60 * 60 * 24));
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
  if (s.includes('RED') || s.includes('NO') || s.includes('FAIL') || s.includes('SHORT') || s.includes('NOT') || s.includes('HOLD') || s.includes('DELAY') || s.includes('LATE')) {
    return false;
  }
  return true;
}

function buildIssueReason(knitFound: boolean, knitReady: boolean, knitSmWip: number, qtyNeeded: number, trimsFound: boolean, trimsReady: boolean, trimsStatus: string): string {
  const issues: string[] = [];
  if (!knitFound) issues.push('Knitting WIP not found');
  else if (!knitReady) issues.push(`Knit short (${knitSmWip}/${qtyNeeded} pcs)`);
  if (!trimsFound) issues.push('Trims verification pending');
  else if (!trimsReady) issues.push(`Trims allocation: ${trimsStatus || 'RED'}`);
  return issues.length === 0 ? 'Prerequisites verified' : issues.join(' • ');
}

/**
 * Core Cross-Referencing Matching Engine
 */
export function evaluateReadiness(
  sewingPlan: SewingPlanRow[] = [],
  knittingPlan: KnittingPlanRow[] = [],
  trimsPlan: TrimsPlanRow[] = [],
  overrides: Record<string, string> = {},
  anchorDate: Date = new Date()
): {
  items: MatchedReadinessItem[];
  metrics: OverallMetrics;
  moduleSummaries: ModuleSummary[];
} {
  const safeSewing = Array.isArray(sewingPlan) ? sewingPlan : [];
  const safeKnitting = Array.isArray(knittingPlan) ? knittingPlan : [];
  const safeTrims = Array.isArray(trimsPlan) ? trimsPlan : [];

  // DIAGNOSTIC
  console.log('[MatcherEngine] Input → Sewing:', safeSewing.length, 'Knitting:', safeKnitting.length, 'Trims:', safeTrims.length);

  // ──── 1. KNITTING LOOKUP ────
  const knitMap = new Map<string, KnittingPlanRow>();
  const soKnitMap = new Map<string, KnittingPlanRow>();

  for (const k of safeKnitting) {
    const norm = normalizeSoLi(k.so_li, k.salesOrder, k.lineItem);
    if (norm) {
      knitMap.set(norm, k);
      const soOnly = norm.split('/')[0];
      if (soOnly && !soKnitMap.has(soOnly)) soKnitMap.set(soOnly, k);
    }
    if (k.so_li) {
      const cleanKey = k.so_li.trim();
      knitMap.set(cleanKey, k);
      knitMap.set(cleanKey.replace(/\s+/g, ''), k);
      knitMap.set(cleanKey.replace(/^0+/, ''), k);
      const soOnly = cleanKey.split('/')[0];
      if (soOnly && !soKnitMap.has(soOnly)) soKnitMap.set(soOnly, k);
    }
    if (k.salesOrder && !soKnitMap.has(k.salesOrder.trim())) {
      soKnitMap.set(k.salesOrder.trim(), k);
    }
  }

  console.log('[MatcherEngine] KnitMap size:', knitMap.size, 'SO fallback:', soKnitMap.size);

  // ──── 2. TRIMS LOOKUP ────
  const trimsMap = new Map<string, TrimsPlanRow>();
  const moduleTrimsStatusMap = new Map<string, string>();
  const moduleDateTrimsMap = new Map<string, string>();
  const soTrimsMap = new Map<string, TrimsPlanRow>(); // SO-only fallback for trims

  for (const t of safeTrims) {
    const norm = normalizeSoLi(t.soli);
    if (norm) {
      trimsMap.set(norm, t);
      // Also add SO-only fallback for trims
      const soOnly = norm.split('/')[0];
      if (soOnly && !soTrimsMap.has(soOnly)) soTrimsMap.set(soOnly, t);
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
      // OK status takes priority — if ANY entry for this module is OK, set it OK
      const existing = moduleTrimsStatusMap.get(cleanMod);
      if (tStatus === 'OK' || !existing) {
        moduleTrimsStatusMap.set(cleanMod, tStatus);
      }
      if (t.psd) moduleDateTrimsMap.set(`${cleanMod}_${t.psd}`, tStatus);
      if (t.ped) moduleDateTrimsMap.set(`${cleanMod}_${t.ped}`, tStatus);
    }
  }

  // DIAGNOSTIC: Log trims module status map
  const trimsModuleEntries = Array.from(moduleTrimsStatusMap.entries());
  console.log('[MatcherEngine] TrimsMap size:', trimsMap.size, 'Module status entries:', trimsModuleEntries.length);
  if (trimsModuleEntries.length > 0) {
    console.log('[MatcherEngine] Trims module statuses:', trimsModuleEntries.slice(0, 10).map(([m, s]) => `${m}=${s}`).join(', '));
  } else {
    console.warn('[MatcherEngine] ⚠️ NO MODULE-LEVEL TRIMS STATUS - checking if trims have module data...');
    const trimsWithModule = safeTrims.filter(t => t.module);
    console.log('[MatcherEngine] Trims rows with module field:', trimsWithModule.length, 'out of', safeTrims.length);
    if (safeTrims.length > 0) {
      console.log('[MatcherEngine] First 3 trims rows:', safeTrims.slice(0, 3).map(t => ({ soli: t.soli, module: t.module, status: t.status })));
    }
  }

  // ──── 3. MATCHING LOOP ────
  const items: MatchedReadinessItem[] = [];
  let readyCount = 0, atRiskCount = 0, notReadyCount = 0, upcomingCount = 0, noDataCount = 0;
  let totalQtyNeeded = 0;

  const moduleAgg: Record<string, {
    module: string; totalItems: number; readyCount: number; atRiskCount: number;
    notReadyCount: number; upcomingCount: number; noDataCount: number; totalQty: number;
    knitCompletedQty: number; knitTotalNeededQty: number; trimsOkCount: number;
    trimsTotalCount: number; items: MatchedReadinessItem[];
  }> = {};

  // DIAGNOSTIC
  const _debugModKnit: Record<string, { matched: number; total: number; missed: string[] }> = {};
  const _debugModTrims: Record<string, { ok: number; total: number; missed: string[] }> = {};

  for (const sew of safeSewing) {
    const normKey = normalizeSoLi(sew.so_li);
    const soOnly = normKey ? normKey.split('/')[0] : (sew.so_li ? sew.so_li.split('/')[0] : '');

    // ── Knitting Lookup (multi-strategy) ──
    let knit = knitMap.get(normKey)
            || knitMap.get(sew.so_li?.trim() || '')
            || knitMap.get(sew.so_li?.replace(/\s+/g, '') || '')
            || (soOnly ? soKnitMap.get(soOnly) : undefined);

    // ── Trims Lookup (multi-strategy with SO fallback) ──
    let trims = trimsMap.get(normKey)
             || trimsMap.get(sew.so_li?.trim() || '')
             || trimsMap.get(sew.so_li?.replace(/\s+/g, '') || '')
             || (soOnly ? soTrimsMap.get(soOnly) : undefined);

    // ── DIAGNOSTIC tracking ──
    const _mod = sew.module || 'UNKNOWN';
    if (!_debugModKnit[_mod]) _debugModKnit[_mod] = { matched: 0, total: 0, missed: [] };
    _debugModKnit[_mod].total++;
    if (knit) _debugModKnit[_mod].matched++;
    else if (_debugModKnit[_mod].missed.length < 3) _debugModKnit[_mod].missed.push(sew.so_li || 'empty');

    if (!_debugModTrims[_mod]) _debugModTrims[_mod] = { ok: 0, total: 0, missed: [] };
    _debugModTrims[_mod].total++;

    // ── 1. Evaluate Knitting Side ──
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

    // ── 2. Evaluate Trims Side ──
    const cleanMod = normalizeModuleName(sew.module);
    let trimsFound = Boolean(trims);
    let trimsStatus = trims ? String(trims.status || '').toUpperCase() : '';
    let trimsReady = false;

    const dateKey = cleanMod && sew.plannedDate ? `${cleanMod}_${sew.plannedDate}` : '';
    const hasDateSpecificStatus = dateKey && moduleDateTrimsMap.has(dateKey);
    const dateSpecificStatus = hasDateSpecificStatus ? moduleDateTrimsMap.get(dateKey) : null;
    const isModuleMasterOk = Boolean(cleanMod && moduleTrimsStatusMap.get(cleanMod) === 'OK');

    if (hasDateSpecificStatus) {
      trimsFound = true;
      trimsStatus = dateSpecificStatus || 'NO';
      trimsReady = isTrimsReady(trimsStatus);
    } else if (trimsFound) {
      trimsReady = isTrimsReady(trimsStatus);
    } else if (isModuleMasterOk) {
      trimsFound = true;
      trimsStatus = 'OK';
      trimsReady = true;
    } else if (cleanMod && moduleTrimsStatusMap.has(cleanMod)) {
      trimsFound = true;
      trimsStatus = moduleTrimsStatusMap.get(cleanMod) || 'NO';
      trimsReady = isTrimsReady(trimsStatus);
    }

    // -- APPLY MANUAL OVERRIDES --
    if (overrides[sew.so_li]) {
      const overrideVal = overrides[sew.so_li];
      trimsFound = true;
      trimsStatus = overrideVal;
      trimsReady = isTrimsReady(trimsStatus);
    }

    // DIAGNOSTIC tracking
    if (trimsReady) _debugModTrims[_mod].ok++;
    else if (_debugModTrims[_mod].missed.length < 3) {
      _debugModTrims[_mod].missed.push(`${sew.so_li}(modOK=${isModuleMasterOk},found=${trimsFound},status=${trimsStatus})`);
    }

    const diffDays = calculateDaysRemaining(sew.plannedDate, anchorDate);
    totalQtyNeeded += Number(sew.qty) || 0;

    // ── 3. Overall Status ──
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
      knitDetails: knit ? { orderQty: knit.orderQtyTotal, knitQty: knit.knitQtyTotal, sizeCount: knit.sizeCount } : undefined,
      trimsFound,
      trimsStatus: trimsStatus || (trimsFound ? 'OK' : 'PENDING'),
      trimsPsd: trims?.psd || '',
      trimsPed: trims?.ped || '',
      trimsReady,
      trimsPedDelayed: false,
      trimsComments: { rm: trims?.rmComments || '', merch: trims?.merchComments || '' },
      overallStatus,
      statusReason,
    };

    items.push(itemObj);

    // ── Module Aggregator ──
    const m = cleanMod || sew.module || 'M01';
    if (!moduleAgg[m]) {
      moduleAgg[m] = {
        module: m, totalItems: 0, readyCount: 0, atRiskCount: 0, notReadyCount: 0,
        upcomingCount: 0, noDataCount: 0, totalQty: 0, knitCompletedQty: 0,
        knitTotalNeededQty: 0, trimsOkCount: 0, trimsTotalCount: 0, items: [],
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

  // ──── DIAGNOSTIC OUTPUT ────
  console.log('[MatcherEngine] === PER-MODULE KNITTING MATCH ===');
  for (const [m, info] of Object.entries(_debugModKnit)) {
    if (info.matched < info.total) {
      console.warn(`  ${m}: ${info.matched}/${info.total} knit matched. Missed:`, info.missed);
    }
  }
  console.log('[MatcherEngine] === PER-MODULE TRIMS MATCH ===');
  for (const [m, info] of Object.entries(_debugModTrims)) {
    if (info.ok < info.total) {
      console.warn(`  ${m}: ${info.ok}/${info.total} trims OK. Detail:`, info.missed);
    }
  }

  // Sort
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

  const moduleSummaries: ModuleSummary[] = Object.values(moduleAgg).sort((a, b) => {
    const numA = parseInt(a.module.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.module.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });

  return { items, metrics, moduleSummaries };
}
