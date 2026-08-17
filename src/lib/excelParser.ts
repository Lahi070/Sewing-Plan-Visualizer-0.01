import * as XLSX from 'xlsx';
import { SewingPlanRow, KnittingPlanRow, TrimsPlanRow } from './types';

/**
 * Converts an Excel serial date number (e.g. 45870) or date string/Date to ISO "YYYY-MM-DD"
 */
export function parseExcelDate(val: any): string {
  if (!val || val === '-' || val === ' ' || val === 'N/A') return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return val.toISOString().split('T')[0];
  }
  const num = Number(val);
  if (!isNaN(num) && num > 30000 && num < 65000) {
    // Excel epoch 1899-12-30
    const utc_days = Math.floor(num - 25569);
    const utc_value = utc_days * 86400;
    const date = new Date(utc_value * 1000);
    return date.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return str;
}

/**
 * 1. Parse Pre Work Sewing Plan file
 * Rule: Always parse 'Sheet1' specifically, ignore 'Summary' and wide-format sheets.
 * Skip rows where Qty is '-' or <= 0.
 */
export function parseSewingPlanWorkbook(workbook: XLSX.WorkBook): {
  rows: SewingPlanRow[];
  sheetUsed: string;
  totalSkipped: number;
} {
  const sheetName = workbook.SheetNames.find(
    (name) => name.toLowerCase() === 'sheet1'
  ) || workbook.SheetNames[0];

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`Could not find sheet [Sheet1] in sewing plan file.`);
  }

  // Parse raw table
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  const rows: SewingPlanRow[] = [];
  let totalSkipped = 0;

  for (const r of rawRows) {
    const rawQty = r['Qty'] ?? r['qty'] ?? r['QTY'];
    if (rawQty === '-' || rawQty === '' || rawQty === undefined || rawQty === null) {
      totalSkipped++;
      continue;
    }

    const qty = typeof rawQty === 'number' ? rawQty : parseFloat(String(rawQty).replace(/,/g, ''));
    if (isNaN(qty) || qty <= 0) {
      totalSkipped++;
      continue;
    }

    const moduleRaw = r['Module'] ?? r['Module#'] ?? r['module'] ?? '';
    const moduleNo = String(moduleRaw).trim().toUpperCase();
    const so_li = String(r['SO_LI'] ?? r['so_li'] ?? r['SOLI'] ?? '').trim();
    const plannedDate = parseExcelDate(r['Date'] ?? r['date'] ?? r['Planned Date']);

    if (!so_li || !moduleNo) {
      totalSkipped++;
      continue;
    }

    rows.push({
      module: moduleNo,
      customer: String(r['Customer'] ?? r['customer'] ?? '').trim(),
      style: String(r['Style'] ?? r['style'] ?? '').trim(),
      productType: String(r['Produt Type'] ?? r['Product Type'] ?? r['Cat'] ?? '').trim(),
      cw: String(r['CW'] ?? r['Color way'] ?? '').trim(),
      so_li,
      smv: Number(r['SMV'] ?? 0) || 0,
      plannedDate,
      qty,
      sah: Number(r['SAH'] ?? 0) || 0,
    });
  }

  return { rows, sheetUsed: sheetName, totalSkipped };
}

/**
 * 2. Parse Knitting WIP file
 * Rule: Join key SO_LI = str(int(Sales Order)) + "/" + str(Line Item)
 * Sum SM WIP across all SAP Size rows for that SO_LI.
 */
export function parseKnittingWipWorkbook(workbook: XLSX.WorkBook): {
  rows: KnittingPlanRow[];
  sheetUsed: string;
  totalRawRows: number;
} {
  const sheetName = workbook.SheetNames[0] || 'Sheet1';
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`Could not find sheet in Knitting WIP file.`);
  }

  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  const map = new Map<string, KnittingPlanRow>();

  for (const r of rawRows) {
    let rawSo = String(r['Sales Order'] ?? r['Sales order'] ?? r['SO'] ?? '').trim();
    const rawLi = String(r['Line Item'] ?? r['Line item'] ?? r['LI'] ?? '').trim();

    if (!rawSo || !rawLi) continue;

    // Strip leading zeros from Sales Order e.g. 0080005105 -> 80005105
    const parsedSoNum = parseInt(rawSo, 10);
    const cleanSo = isNaN(parsedSoNum) ? rawSo.replace(/^0+/, '') : String(parsedSoNum);
    const cleanLi = rawLi.replace(/^0+/, '') || rawLi; // keep or format
    const so_li = `${cleanSo}/${rawLi}`;

    const smWip = Number(r['SM WIP'] ?? r['SM_WIP'] ?? 0) || 0;
    const orderQty = Number(r['Order Qty'] ?? r['Order Qty + Scrap'] ?? 0) || 0;
    const knitQty = Number(r['Knit Qty'] ?? 0) || 0;
    const pkinQty = Number(r['PKIN Qty'] ?? 0) || 0;
    const qcQty = Number(r['QC Qty'] ?? 0) || 0;
    const shippedQty = Number(r['Shipped Qty'] ?? 0) || 0;

    if (!map.has(so_li)) {
      map.set(so_li, {
        so_li,
        salesOrder: cleanSo,
        lineItem: rawLi,
        smWipTotal: 0,
        orderQtyTotal: 0,
        knitQtyTotal: 0,
        pkinQtyTotal: 0,
        qcQtyTotal: 0,
        shippedQtyTotal: 0,
        sizeCount: 0,
      });
    }

    const item = map.get(so_li)!;
    item.smWipTotal += smWip;
    item.orderQtyTotal += orderQty;
    item.knitQtyTotal += knitQty;
    item.pkinQtyTotal = (item.pkinQtyTotal || 0) + pkinQty;
    item.qcQtyTotal = (item.qcQtyTotal || 0) + qcQty;
    item.shippedQtyTotal = (item.shippedQtyTotal || 0) + shippedQty;
    item.sizeCount += 1;
  }

  return {
    rows: Array.from(map.values()),
    sheetUsed: sheetName,
    totalRawRows: rawRows.length,
  };
}

/**
 * Helper to discover and score dated sheets in Trims workbook
 */
export function discoverTrimsDatedSheets(workbook: XLSX.WorkBook): {
  sheetName: string;
  parsedDate: string | null;
  score: number; // closeness to today
  isRecommended: boolean;
}[] {
  const today = new Date();
  const currentMonth = today.getMonth() + 1; // 1-12
  const currentYear = today.getFullYear();

  const results = workbook.SheetNames.map((name) => {
    const lower = name.toLowerCase().trim();
    // Exclude summary and non-plan sheets
    if (
      lower.includes('trim readiness status') ||
      lower.includes('mrp') ||
      lower.includes('lbl') ||
      lower === 'plan summery' // legacy undated sheet
    ) {
      return { sheetName: name, parsedDate: null, score: 999999, isRecommended: false };
    }

    let parsedDate: Date | null = null;

    // Pattern: 'Plan summary 13.8', 'plan sum 29.8', 'Plan Summary 10_25', 'Plan summary 10.1'
    const dotMatch = lower.match(/(?:plan\s*(?:summary|sum)\s*)([0-9]{1,2})[._]([0-9]{1,2})/i);
    const monthWordMatch = lower.match(/(?:plan\s*(?:summary|sum)\s*)([0-9]{1,2})\s*([a-z]{3})/i);

    if (monthWordMatch) {
      const day = parseInt(monthWordMatch[1], 10);
      const monthStr = monthWordMatch[2];
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const mIdx = monthNames.indexOf(monthStr);
      if (mIdx >= 0) {
        parsedDate = new Date(currentYear, mIdx, day);
      }
    } else if (dotMatch) {
      const num1 = parseInt(dotMatch[1], 10);
      const num2 = parseInt(dotMatch[2], 10);

      // Prompt explains: '13.8' = 13 August (day.month).
      // If num1 > 12, it's definitely day.month (e.g. 29.8 -> 29 Aug).
      // If num2 > 12, it's month.day (e.g. 10.20 -> Oct 20).
      let day = num1;
      let month = num2;
      if (num2 > 12) {
        month = num1;
        day = num2;
      }
      parsedDate = new Date(currentYear, month - 1, day);
    }

    let diffMs = 999999999;
    if (parsedDate && !isNaN(parsedDate.getTime())) {
      diffMs = Math.abs(today.getTime() - parsedDate.getTime());
    }

    return {
      sheetName: name,
      parsedDate: parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.toISOString().split('T')[0] : null,
      score: diffMs,
      isRecommended: false,
    };
  });

  // Filter to valid candidate sheets
  const candidates = results.filter((r) => r.parsedDate !== null);
  if (candidates.length > 0) {
    candidates.sort((a, b) => a.score - b.score);
    candidates[0].isRecommended = true;
    return candidates;
  }

  // Fallback if no dates parsed
  const fallback = results.filter((r) => !r.sheetName.toLowerCase().includes('trim readiness'));
  if (fallback.length > 0) {
    fallback[0].isRecommended = true;
  }
  return results;
}

/**
 * 3. Parse Trims Readiness file
 * Rule: Dynamically detect header row, use 'SOLI' (or clean 'SO_LI'), check 'Status' (OK/NO) and PSD/PED.
 */
export function parseTrimsReadinessWorkbook(
  workbook: XLSX.WorkBook,
  selectedSheetName?: string
): {
  rows: TrimsPlanRow[];
  sheetUsed: string;
  availableSheets: ReturnType<typeof discoverTrimsDatedSheets>;
  totalRawRows: number;
} {
  const availableSheets = discoverTrimsDatedSheets(workbook);
  const recommended = availableSheets.find((s) => s.isRecommended)?.sheetName;
  const targetSheet = selectedSheetName || recommended || workbook.SheetNames[0];

  const worksheet = workbook.Sheets[targetSheet];
  if (!worksheet) {
    throw new Error(`Could not find sheet [${targetSheet}] in Trims file.`);
  }

  const rawTable: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  // Locate the header row (scan first 10 rows)
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(10, rawTable.length); i++) {
    const row = rawTable[i];
    if (
      Array.isArray(row) &&
      row.some((cell) => String(cell).trim().toLowerCase() === 'module') &&
      row.some((cell) => {
        const s = String(cell).trim().toLowerCase();
        return s === 'status' || s === 'so_li' || s === 'soli' || s === 'so';
      })
    ) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    // Default to row 0 if no clear header found
    headerRowIdx = 0;
  }

  const headerRow = rawTable[headerRowIdx].map((h) => String(h || '').trim());
  const headerMap: Record<string, number> = {};
  headerRow.forEach((h, idx) => {
    if (h) headerMap[h] = idx;
  });

  const getCol = (row: any[], possibleNames: string[]) => {
    for (const name of possibleNames) {
      if (headerMap[name] !== undefined) return row[headerMap[name]];
      // case-insensitive lookup
      const foundKey = Object.keys(headerMap).find((k) => k.toLowerCase() === name.toLowerCase());
      if (foundKey !== undefined) return row[headerMap[foundKey]];
    }
    return '';
  };

  const rows: TrimsPlanRow[] = [];
  const soliSeen = new Set<string>();

  for (let i = headerRowIdx + 1; i < rawTable.length; i++) {
    const row = rawTable[i];
    if (!row || row.length === 0) continue;

    // Get SOLI
    let soli = String(getCol(row, ['SOLI']) || '').trim();
    if (!soli) {
      const so = String(getCol(row, ['SO']) || '').trim();
      const li = String(getCol(row, ['LI']) || '').trim();
      if (so && li) {
        soli = `${so}/${li}`;
      }
    }
    if (!soli) {
      const so_li_raw = String(getCol(row, ['SO_LI']) || '').trim();
      if (so_li_raw) {
        soli = so_li_raw.replace(/::+$/, '').trim();
      }
    }

    if (!soli) continue;

    const moduleVal = String(getCol(row, ['Module', 'Module No']) || '').trim().toUpperCase();
    const statusVal = String(getCol(row, ['Status']) || '').trim().toUpperCase();
    const psd = parseExcelDate(getCol(row, ['PSD', 'RM IH']));
    const ped = parseExcelDate(getCol(row, ['PED']));
    const deliveryDate = parseExcelDate(getCol(row, ['Delivery Date']));
    const daysLate = Number(getCol(row, ['Days Late']) || 0) || 0;
    const rmComments = String(getCol(row, ['RM Comments', 'RM Comment']) || '').trim();
    const merchComments = String(getCol(row, ['Merch comments', 'Merch Comments', 'Merch comment ']) || '').trim();
    const totalQty = Number(getCol(row, ['Total QTY', 'Total Qty', 'Qty']) || 0) || 0;
    const product = String(getCol(row, ['Product', 'Style']) || '').trim();
    const customer = String(getCol(row, ['Customer']) || '').trim();
    const cw = String(getCol(row, ['CW', 'Color way']) || '').trim();

    rows.push({
      soli,
      module: moduleVal,
      customer,
      product,
      cw,
      status: statusVal || 'NO',
      psd,
      ped,
      deliveryDate,
      daysLate,
      rmComments,
      merchComments,
      totalQty,
      sheetName: targetSheet,
    });
  }

  return {
    rows,
    sheetUsed: targetSheet,
    availableSheets,
    totalRawRows: rawTable.length,
  };
}
