import { SewingPlanRow, KnittingPlanRow, TrimsPlanRow, AppDataset } from './types';

// Minimal sample data for initial render - real data is loaded from Supabase
export const SAMPLE_SEWING_PLAN: SewingPlanRow[] = [
  {
    id: 1,
    module: 'M01',
    customer: 'STOKO',
    style: 'MERINO T-W',
    productType: 'Stoko Thermal',
    cw: '',
    so_li: '80005129/120',
    smv: 110.2,
    plannedDate: '2026-09-10',
    qty: 187,
    sah: 343.46,
  },
  {
    id: 2,
    module: 'M02',
    customer: 'STOKO',
    style: 'SHORT-M',
    productType: 'Pant',
    cw: '',
    so_li: '80005129/80',
    smv: 95.2,
    plannedDate: '2026-09-12',
    qty: 296,
    sah: 469.65,
  },
];

export const SAMPLE_KNITTING_PLAN: KnittingPlanRow[] = [
  {
    id: 1,
    so_li: '80005129/120',
    salesOrder: '80005129',
    lineItem: '120',
    smWipTotal: 200,
    orderQtyTotal: 187,
    knitQtyTotal: 187,
    pkinQtyTotal: 150,
    qcQtyTotal: 100,
    shippedQtyTotal: 0,
    sizeCount: 1,
  },
];

export const SAMPLE_TRIMS_PLAN: TrimsPlanRow[] = [
  {
    id: 1,
    soli: '80005129/120',
    module: 'M01',
    customer: 'STOKO',
    product: 'MERINO T-W',
    cw: '',
    status: 'GREEN',
    psd: '2026-09-10',
    ped: '2026-09-10',
    deliveryDate: undefined,
    daysLate: 0,
    rmComments: '',
    merchComments: '',
    totalQty: 187,
    sheetName: 'Plan Summary',
  },
];

export const INITIAL_DATASET: AppDataset = {
  sewingPlan: SAMPLE_SEWING_PLAN,
  knittingPlan: SAMPLE_KNITTING_PLAN,
  trimsPlan: SAMPLE_TRIMS_PLAN,
  overrides: {},
  metadata: {
    sewing: {
      fileType: 'sewing',
      fileName: 'Sample Data',
      sheetUsed: 'Sheet1',
      rowCount: 2,
      uniqueSoLis: 2,
      uploadedAt: '2026-09-01T12:00:00Z',
    },
    knitting: {
      fileType: 'knitting',
      fileName: 'Sample Data',
      sheetUsed: 'Sheet1',
      rowCount: 1,
      uniqueSoLis: 1,
      uploadedAt: '2026-09-01T12:00:00Z',
    },
    trims: {
      fileType: 'trims',
      fileName: 'Sample Data',
      sheetUsed: 'Plan Summary',
      rowCount: 1,
      uniqueSoLis: 1,
      uploadedAt: '2026-09-01T12:00:00Z',
    },
    lastUpdated: '2026-09-01T12:00:00Z',
  },
};
