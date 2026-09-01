import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  SewingPlanRow,
  KnittingPlanRow,
  TrimsPlanRow,
  UploadMetadataRecord,
  AppDataset,
} from './types';
import { INITIAL_DATASET } from './sampleData';

// Clean URL: strip trailing /rest/v1/, /rest/v1, trailing slashes, and whitespace
const rawSupabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseUrl = rawSupabaseUrl
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '');
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'https://your-project-id.supabase.co' &&
    supabaseAnonKey !== 'your-supabase-anon-key-here' &&
    supabaseUrl.startsWith('http')
  );
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Local storage key for offline / demo mode overrides
const LOCAL_STORAGE_KEY = 'sewing_tracker_local_dataset_v1';

export async function getActiveDataset(): Promise<AppDataset> {
  // If Supabase is configured, fetch latest tables
  if (isSupabaseConfigured() && supabase) {
    try {
      const [sewingRes, knitRes, trimsRes, metaRes] = await Promise.all([
        supabase.from('sewing_plan').select('*'),
        supabase.from('knitting_plan').select('*'),
        supabase.from('trims_plan').select('*'),
        supabase.from('upload_metadata').select('*').order('uploaded_at', { ascending: false }),
      ]);

      if (!sewingRes.error && !knitRes.error && !trimsRes.error) {
        const sewingPlan: SewingPlanRow[] = (sewingRes.data || []).map((r: any) => ({
          id: r.id,
          module: r.module,
          customer: r.customer,
          style: r.style,
          productType: r.product_type,
          cw: r.cw,
          so_li: r.so_li,
          smv: Number(r.smv) || 0,
          plannedDate: r.planned_date,
          qty: Number(r.qty) || 0,
          sah: Number(r.sah) || 0,
        }));

        const knittingPlan: KnittingPlanRow[] = (knitRes.data || []).map((r: any) => ({
          id: r.id,
          so_li: r.so_li,
          salesOrder: r.sales_order,
          lineItem: r.line_item,
          smWipTotal: Number(r.sm_wip_total) || 0,
          orderQtyTotal: Number(r.order_qty_total) || 0,
          knitQtyTotal: Number(r.knit_qty_total) || 0,
          pkinQtyTotal: Number(r.pkin_qty_total) || 0,
          qcQtyTotal: Number(r.qc_qty_total) || 0,
          shippedQtyTotal: Number(r.shipped_qty_total) || 0,
          sizeCount: r.size_count || 1,
        }));

        const trimsPlan: TrimsPlanRow[] = (trimsRes.data || []).map((r: any) => ({
          id: r.id,
          soli: r.soli,
          module: r.module,
          customer: r.customer,
          product: r.product,
          cw: r.cw,
          status: r.status,
          psd: r.psd,
          ped: r.ped,
          deliveryDate: r.delivery_date,
          daysLate: Number(r.days_late) || 0,
          rmComments: r.rm_comments,
          merchComments: r.merch_comments,
          totalQty: Number(r.total_qty) || 0,
          sheetName: r.sheet_name,
        }));

        const metadataList: any[] = metaRes.data || [];
        const metadata: AppDataset['metadata'] = {};
        for (const m of metadataList) {
          if (m.file_type === 'sewing' && !metadata.sewing) {
            metadata.sewing = {
              fileType: 'sewing',
              fileName: m.file_name,
              sheetUsed: m.sheet_used,
              rowCount: m.row_count,
              uniqueSoLis: m.unique_so_lis,
              uploadedAt: m.uploaded_at,
            };
          } else if (m.file_type === 'knitting' && !metadata.knitting) {
            metadata.knitting = {
              fileType: 'knitting',
              fileName: m.file_name,
              sheetUsed: m.sheet_used,
              rowCount: m.row_count,
              uniqueSoLis: m.unique_so_lis,
              uploadedAt: m.uploaded_at,
            };
          } else if (m.file_type === 'trims' && !metadata.trims) {
            metadata.trims = {
              fileType: 'trims',
              fileName: m.file_name,
              sheetUsed: m.sheet_used,
              rowCount: m.row_count,
              uniqueSoLis: m.unique_so_lis,
              uploadedAt: m.uploaded_at,
            };
          }
        }

        // Always return Supabase data when connected, even if tables are empty.
        // This prevents fallback to localStorage/demo data on other devices.
        return {
          sewingPlan,
          knittingPlan,
          trimsPlan,
          metadata: {
            ...metadata,
            lastUpdated: metadataList.length > 0
              ? metadataList[0].uploaded_at
              : new Date().toISOString(),
          },
        };
      }
    } catch (err) {
      console.warn('Supabase fetch failed, falling back to local dataset:', err);
    }
  }

  // Client-side local storage check
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Could not read from localStorage', e);
    }
  }

  return INITIAL_DATASET;
}

export function saveLocalDataset(dataset: AppDataset): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataset));
    } catch (e) {
      console.warn('Could not write to localStorage', e);
    }
  }
}

export function clearLocalDataset(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (e) {
      console.warn('Could not clear localStorage', e);
    }
  }
}
