export type ReadinessStatus = 'READY' | 'AT_RISK' | 'NOT_READY' | 'UPCOMING' | 'NO_DATA';

export interface SewingPlanRow {
  id?: number;
  module: string; // e.g. "M01", "M11"
  customer: string; // e.g. "STOKO", "Decathlon", "Nike"
  style: string; // e.g. "PID-YP843R-Turtleneck"
  productType: string;
  cw: string; // Color way
  so_li: string; // "80005172/40"
  smv: number;
  plannedDate: string; // "YYYY-MM-DD"
  qty: number; // planned sewing quantity for this date
  sah?: number;
}

export interface KnittingPlanRow {
  id?: number;
  so_li: string; // "80005105/990" (leading zeros stripped from SO)
  salesOrder: string; // "80005105"
  lineItem: string; // "990"
  smWipTotal: number; // Sum of SM WIP across size variants
  orderQtyTotal: number;
  knitQtyTotal: number;
  pkinQtyTotal?: number;
  qcQtyTotal?: number;
  shippedQtyTotal?: number;
  sizeCount: number;
}

export interface TrimsPlanRow {
  id?: number;
  soli: string; // "80004437/710" (no suffix)
  module: string; // "M01"
  customer: string;
  product: string;
  cw: string;
  status: string; // "OK" or "NO"
  psd: string; // "YYYY-MM-DD"
  ped: string; // "YYYY-MM-DD"
  deliveryDate?: string;
  daysLate?: number;
  rmComments?: string;
  merchComments?: string;
  totalQty?: number;
  sheetName?: string;
}

export interface MatchedReadinessItem {
  id: string; // unique identifier (module + so_li + plannedDate)
  module: string;
  customer: string;
  style: string;
  productType: string;
  cw: string;
  so_li: string;
  plannedDate: string;
  diffDays: number; // plannedDate - today (in days)
  qtyNeeded: number;

  // Knitting Side
  knitFound: boolean;
  knitSmWip: number;
  knitReady: boolean;
  knitDetails?: {
    orderQty: number;
    knitQty: number;
    sizeCount: number;
  };

  // Trims Side
  trimsFound: boolean;
  trimsStatus: string; // "OK", "NO", or ""
  trimsPsd: string;
  trimsPed: string;
  trimsReady: boolean;
  trimsPedDelayed: boolean; // true if PED > plannedDate
  trimsComments: {
    rm: string;
    merch: string;
  };

  // Overall Status
  overallStatus: ReadinessStatus;
  statusReason: string;
}

export interface OverallMetrics {
  totalItems: number;
  totalQtyNeeded: number;
  readyCount: number;
  atRiskCount: number;
  notReadyCount: number;
  upcomingCount: number;
  noDataCount: number;
  readyPercentage: number;
  atRiskPercentage: number;
  notReadyPercentage: number;
  urgentCount: number; // items at risk or delayed in next 3 days
}

export interface ModuleSummary {
  module: string;
  totalItems: number;
  totalQty: number;
  readyCount: number;
  atRiskCount: number;
  notReadyCount: number;
  upcomingCount: number;
  noDataCount: number;
  knitCompletedQty: number;
  knitTotalNeededQty: number;
  trimsOkCount: number;
  trimsTotalCount: number;
  items: MatchedReadinessItem[];
}

export interface UploadMetadataRecord {
  fileType: 'sewing' | 'knitting' | 'trims';
  fileName: string;
  sheetUsed: string;
  rowCount: number;
  uniqueSoLis: number;
  uploadedAt: string;
}

export interface AppDataset {
  sewingPlan: SewingPlanRow[];
  knittingPlan: KnittingPlanRow[];
  trimsPlan: TrimsPlanRow[];
  overrides: Record<string, string>;
  metadata: {
    sewing?: UploadMetadataRecord;
    knitting?: UploadMetadataRecord;
    trims?: UploadMetadataRecord;
    lastUpdated?: string;
  };
}
