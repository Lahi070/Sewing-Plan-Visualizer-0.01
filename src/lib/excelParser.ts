import * as XLSX from 'xlsx';
import { SewingPlanRow, KnittingPlanRow, TrimsPlanRow } from './types';

/**
 * Normalizes Module strings e.g. "M7", "Module 07", "Line 7", "07", "M-07" -> "M07"
 */
export function normalizeModuleName(modStr?: any): string {
  if (!modStr) return '';
  const str = String(modStr).trim().toUpperCase();
  const digits = str.replace(/\D/g, '');
  if (digits) {
    const num = parseInt(digits, 10);
    return `M${String(num).padStart(2, '0')}`;
  }
  return str;
}

/**
 * Normalizes any Sales Order and Line Item variation into standard "cleanSo/cleanLi"
 */
export function normalizeSoLi(rawSoLi?: any, rawSo?: any, rawLi?: any): string {
  let combined = String(rawSoLi || '').trim();

  if (!combined && (rawSo !== undefined || rawLi !== undefined)) {
    const s = String(rawSo ?? '').trim();
    const l = String(rawLi ?? '').trim();
    if (s && l) {
      combined = `${s}/${l}`;
    } else if (s) {
      combined = s;
    }
  }

  if (!combined || combined === '-' || combined === 'N/A' || combined === 'undefined') {
    return '';
  }

  combined = combined.replace(/[:;\s]+$/, '').trim();

  const match = combined.match(/^([a-zA-Z0-9]+)[\/\-_:\s\.]+([a-zA-Z0-9]+)/);
  if (match) {
    let so = match[1].trim();
    let li = match[2].trim();

    const parsedSo = parseInt(so, 10);
    if (!isNaN(parsedSo) && /^\d+$/.test(so)) {
      so = String(parsedSo);
    }

    const parsedLi = parseInt(li, 10);
    if (!isNaN(parsedLi) && /^\d+$/.test(li)) {
      li = String(parsedLi);
    }

    return `${so}/${li}`;
  }

  const singleParsed = parseInt(combined, 10);
  if (!isNaN(singleParsed) && /^\d+$/.test(combined)) {
    return String(singleParsed);
  }

  return combined;
}

/**
 * Extracts key from any row object by checking all known column aliases
 */
export function extractRowSoLi(row: Record<string, any>): string {
  const combinedKeys = [
    'SO_LI', 'so_li', 'SO/LI', 'so/li', 'SOLI', 'soli', 'SO-LI', 'so-li',
    'SO_Li', 'So_Li', 'SO LI', 'so li', 'Sales Order / Line Item',
    'Sales Order / Line', 'SO_Item', 'SO / Item'
  ];
  for (const k of combinedKeys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      const normalized = normalizeSoLi(row[k]);
      if (normalized) return normalized;
    }
  }

  const soKeys = [
    'Sales Order', 'Sales order', 'sales order', 'Sales Order No', 'Sales Order #',
    'SO', 'so', 'SO No', 'SO#', 'Order', 'Order No', 'Order#'
  ];
  const liKeys = [
    'Line Item', 'Line item', 'line item', 'Line Item No', 'Line Item #',
    'LI', 'li', 'LI No', 'LI#', 'Item', 'Item No', 'Item#', 'Line'
  ];

  let foundSo = '';
  let foundLi = '';

  for (const k of soKeys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      foundSo = String(row[k]).trim();
      break;
    }
  }

  for (const k of liKeys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      foundLi = String(row[k]).trim();
      break;
    }
  }

  if (foundSo || foundLi) {
    return normalizeSoLi('', foundSo, foundLi);
  }

  return '';
}

/**
 * Converts an Excel serial date number or date string/Date to ISO "YYYY-MM-DD"
 */
export function parseExcelDate(val: any): string {
  if (!val || val === '-' || val === ' ' || val === 'N/A') return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return val.toISOString().split('T')[0];
  }
  const num = Number(val);
  if (!isNaN(num) && num > 30000 && num < 65000) {
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
 */
export function parseSewingPlanWorkbook(workbook: XLSX.WorkBook): {
  rows: SewingPlanRow[];
  sheetUsed: string;
  totalSkipped: number;
} {
  let sheetName = workbook.SheetNames.find((name) => name.toLowerCase() === 'sheet1');
  if (!sheetName) {
    sheetName = workbook.SheetNames.find((name) => {
      const lower = name.toLowerCase();
      return !lower.includes('summary') && !lower.includes('pivot');
    }) || workbook.SheetNames[0];
  }

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`Could not find sheet [${sheetName}] in sewing plan file.`);
  }

  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  const rows: SewingPlanRow[] = [];
  let totalSkipped = 0;

  for (const r of rawRows) {
    const rawQty = r['Qty'] ?? r['qty'] ?? r['QTY'] ?? r['Planned Qty'] ?? r['Sew Qty'] ?? r['Quantity'];
    if (rawQty === '-' || rawQty === '' || rawQty === undefined || rawQty === null) {
      totalSkipped++;
      continue;
    }

    const qty = typeof rawQty === 'number' ? rawQty : parseFloat(String(rawQty).replace(/,/g, ''));
    if (isNaN(qty) || qty <= 0) {
      totalSkipped++;
      continue;
    }

    const moduleRaw = r['Module'] ?? r['Module#'] ?? r['module'] ?? r['Line'] ?? r['Line#'] ?? r['Module No'] ?? 'M01';
    const moduleNo = normalizeModuleName(moduleRaw) || 'M01';

    const so_li = extractRowSoLi(r);
    const plannedDate = parseExcelDate(r['Date'] ?? r['date'] ?? r['Planned Date'] ?? r['Sewing Date'] ?? r['PSD']);

    if (!so_li) {
      totalSkipped++;
      continue;
    }

    rows.push({
      module: moduleNo,
      customer: String(r['Customer'] ?? r['customer'] ?? r['Buyer'] ?? '').trim(),
      style: String(r['Style'] ?? r['style'] ?? r['Style#'] ?? r['Product'] ?? '').trim(),
      productType: String(r['Produt Type'] ?? r['Product Type'] ?? r['Cat'] ?? r['Category'] ?? '').trim(),
      cw: String(r['CW'] ?? r['Color way'] ?? r['Color'] ?? '').trim(),
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
    const so_li = extractRowSoLi(r);
    if (!so_li) continue;

    const parts = so_li.split('/');
    const cleanSo = parts[0] || so_li;
    const cleanLi = parts[1] || '';

    const smWip = Number(r['SM WIP'] ?? r['SM_WIP'] ?? r['SMWIP'] ?? r['WIP Qty'] ?? r['WIP'] ?? 0) || 0;
    const orderQty = Number(r['Order Qty'] ?? r['Order Qty + Scrap'] ?? r['Total Qty'] ?? 0) || 0;
    const knitQty = Number(r['Knit Qty'] ?? r['Knitted Qty'] ?? r['Knit'] ?? r['Actual Knit'] ?? 0) || 0;
    const pkinQty = Number(r['PKIN Qty'] ?? r['PKIN'] ?? 0) || 0;
    const qcQty = Number(r['QC Qty'] ?? r['QC'] ?? 0) || 0;
    const shippedQty = Number(r['Shipped Qty'] ?? r['Shipped'] ?? 0) || 0;

    if (!map.has(so_li)) {
      map.set(so_li, {
        so_li,
        salesOrder: cleanSo,
        lineItem: cleanLi,
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
 * Helper to parse "Trim readiness status" Module-Date Matrix Sheet
 */
export function parseTrimReadinessMatrixSheet(worksheet: XLSX.WorkSheet, currentYear: number = new Date().getFullYear()): TrimsPlanRow[] {
  const rawTable: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  const rows: TrimsPlanRow[] = [];
  
  let headerRowIdx = -1;
  let moduleColIdx = 0;

  for (let i = 0; i < Math.min(10, rawTable.length); i++) {
    const row = rawTable[i];
    if (Array.isArray(row)) {
      for (let j = 0; j < row.length; j++) {
        const val = String(row[j] || '').trim().toLowerCase();
        if (val.includes('module') || val === 'line' || val === 'module no') {
          headerRowIdx = i;
          moduleColIdx = j;
          break;
        }
      }
      if (headerRowIdx >= 0) break;
    }
  }

  if (headerRowIdx < 0) return [];

  const headerRow = rawTable[headerRowIdx];
  const dateCols: { colIdx: number; dateStr: string }[] = [];

  for (let j = moduleColIdx + 1; j < headerRow.length; j++) {
    const rawHeader = String(headerRow[j] || '').trim();
    if (!rawHeader || rawHeader.toLowerCase().includes('remark') || rawHeader.toLowerCase().includes('comment')) continue;

    const dStr = parseExcelDate(rawHeader);
    if (dStr) {
      dateCols.push({ colIdx: j, dateStr: dStr });
    } else {
      const match = rawHeader.match(/^([0-9]{1,2})[-/\s]([a-zA-Z]{3})/i);
      if (match) {
        const day = parseInt(match[1], 10);
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const mIdx = monthNames.indexOf(match[2].toLowerCase());
        if (mIdx >= 0) {
          const d = new Date(currentYear, mIdx, day);
          dateCols.push({ colIdx: j, dateStr: d.toISOString().split('T')[0] });
        }
      }
    }
  }

  for (let i = headerRowIdx + 1; i < rawTable.length; i++) {
    const row = rawTable[i];
    if (!row || row.length === 0) continue;

    const rawMod = String(row[moduleColIdx] || '').trim();
    if (!rawMod || rawMod.toLowerCase().includes('total')) continue;

    const moduleNo = normalizeModuleName(rawMod);
    if (!moduleNo) continue;

    let hasAnyReady = false;
    for (const dc of dateCols) {
      const cellVal = row[dc.colIdx];
      const cellStr = String(cellVal || '').trim();
      const cellNum = Number(cellVal);

      let cellStatus = 'NO';
      if ((!isNaN(cellNum) && cellNum > 0) || cellStr.toLowerCase() === 'plan' || cellStr.toLowerCase() === 'ok' || cellStr.toLowerCase() === 'green') {
        cellStatus = 'GREEN';
        hasAnyReady = true;
      } else if (cellStr !== '') {
        cellStatus = cellStr; // Could be 'Not plan', etc.
      } else {
        cellStatus = 'NO'; // Blank means not ready for that date
      }

      rows.push({
        soli: `MODULE_${moduleNo}_${dc.dateStr}`,
        module: moduleNo,
        customer: '',
        product: '',
        cw: '',
        status: cellStatus,
        psd: dc.dateStr,
        ped: dc.dateStr,
        sheetName: 'Trim readiness status',
      });
    }

    if (hasAnyReady || moduleNo) {
      rows.push({
        soli: `MODULE_MASTER_${moduleNo}`,
        module: moduleNo,
        customer: '',
        product: '',
        cw: '',
        status: hasAnyReady ? 'GREEN' : 'NO',
        psd: '',
        ped: '',
        sheetName: 'Trim readiness status',
      });
    }
  }

  return rows;
}

/**
 * Helper to discover and score dated sheets in Trims workbook
 */
export function discoverTrimsDatedSheets(workbook: XLSX.WorkBook): {
  sheetName: string;
  parsedDate: string | null;
  score: number;
  isRecommended: boolean;
}[] {
  const today = new Date();
  const currentYear = today.getFullYear();

  const results = workbook.SheetNames.map((name) => {
    const lower = name.toLowerCase().trim();
    if (lower.includes('pivot')) {
      return { sheetName: name, parsedDate: null, score: 999999, isRecommended: false };
    }

    let parsedDate: Date | null = null;
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

  const candidates = results.filter((r) => r.parsedDate !== null);
  if (candidates.length > 0) {
    candidates.sort((a, b) => a.score - b.score);
    candidates[0].isRecommended = true;
    return candidates;
  }

  const fallback = results.filter((r) => !r.sheetName.toLowerCase().includes('pivot'));
  if (fallback.length > 0) {
    fallback[0].isRecommended = true;
  }
  return results;
}

/**
 * 3. Parse Trims Readiness file
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

  const rows: TrimsPlanRow[] = [];
  const seenSoli = new Set<string>();
  let totalRawCount = 0;

  // 1. Parse matrix sheet if present
  for (const s of workbook.SheetNames) {
    const lower = s.toLowerCase();
    if (lower.includes('readiness status') || lower.includes('trim readiness') || lower === 'status') {
      const matrixSheet = workbook.Sheets[s];
      if (matrixSheet) {
        const matrixRows = parseTrimReadinessMatrixSheet(matrixSheet);
        for (const mr of matrixRows) {
          if (!seenSoli.has(mr.soli)) {
            seenSoli.add(mr.soli);
            rows.push(mr);
          }
        }
      }
    }
  }

  // 2. Scan all item detail sheets
  const sheetsToScan = [targetSheet];
  for (const s of workbook.SheetNames) {
    if (!sheetsToScan.includes(s) && !s.toLowerCase().includes('pivot') && !s.toLowerCase().includes('readiness status')) {
      sheetsToScan.push(s);
    }
  }

  for (const sheetName of sheetsToScan) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rawTable: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    totalRawCount += rawTable.length;

    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(10, rawTable.length); i++) {
      const r = rawTable[i];
      if (
        Array.isArray(r) &&
        r.some((cell) => {
          const str = String(cell).trim().toLowerCase();
          return str.includes('module') || str.includes('status') || str.includes('so') || str.includes('soli');
        })
      ) {
        headerRowIdx = i;
        break;
      }
    }

    const headerRow = (rawTable[headerRowIdx] || []).map((h) => String(h || '').trim());
    const headerMap: Record<string, number> = {};
    headerRow.forEach((h, idx) => {
      if (h) headerMap[h.toLowerCase()] = idx;
    });

    const getColVal = (row: any[], aliases: string[]) => {
      for (const a of aliases) {
        const idx = headerMap[a.toLowerCase()];
        if (idx !== undefined && row[idx] !== undefined) return row[idx];
      }
      return '';
    };

    for (let i = headerRowIdx + 1; i < rawTable.length; i++) {
      const row = rawTable[i];
      if (!row || row.length === 0) continue;

      const rowObj: Record<string, any> = {};
      headerRow.forEach((h, idx) => {
        if (h) rowObj[h] = row[idx];
      });

      const soli = extractRowSoLi(rowObj);
      if (!soli) continue;

      let rawStatus = String(
        getColVal(row, [
          'Status', 'Trims Status', 'Status (OK/NO)', 'Readiness', 'Allocation',
          'Trim Status', 'Allocation Status', 'Trim Readiness', 'RMW Status', 'RMW',
          'Color', 'Trim', 'Trims'
        ])
      ).trim().toUpperCase();

      if (
        rawStatus.includes('RED') ||
        rawStatus.includes('NO') ||
        rawStatus.includes('FAIL') ||
        rawStatus.includes('SHORT') ||
        rawStatus.includes('NOT') ||
        rawStatus.includes('HOLD') ||
        rawStatus.includes('DELAY')
      ) {
        rawStatus = 'NO';
      } else {
        rawStatus = 'OK';
      }

      const psd = parseExcelDate(getColVal(row, ['PSD', 'Plan Sewing Date', 'Planned Date', 'Start Date']));
      const ped = parseExcelDate(getColVal(row, ['PED', 'Plan End Date', 'Trims Date', 'Delivery Date']));
      const daysLate = Number(getColVal(row, ['Days Late', 'Late Days', 'Delay'])) || 0;

      const rawModule = String(getColVal(row, ['Module', 'Module No', 'Module#', 'Module #', 'Line', 'Line No', 'Line#'])).trim();
      const moduleNo = normalizeModuleName(rawModule);
      const customer = String(getColVal(row, ['Customer', 'Buyer'])).trim();
      const product = String(getColVal(row, ['Product', 'Style', 'Item'])).trim();
      const cw = String(getColVal(row, ['CW', 'Color'])).trim();
      const totalQty = Number(getColVal(row, ['Total QTY', 'Total Qty', 'Qty'])) || 0;

      if (!seenSoli.has(soli)) {
        seenSoli.add(soli);
        rows.push({
          soli,
          module: moduleNo || rawModule,
          customer,
          product,
          cw,
          status: rawStatus || 'OK',
          psd,
          ped,
          daysLate,
          rmComments: String(getColVal(row, ['RM Comments', 'RM Comment'])).trim(),
          merchComments: String(getColVal(row, ['Merch comments', 'Merch Comments'])).trim(),
          totalQty,
          sheetName,
        });
      }
    }
  }

  return {
    rows,
    sheetUsed: targetSheet,
    availableSheets,
    totalRawRows: totalRawCount,
  };
}
