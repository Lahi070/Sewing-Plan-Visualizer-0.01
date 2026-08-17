import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl !== 'https://your-project-id.supabase.co' &&
  supabaseUrl.startsWith('http')
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileType, rows, metadata } = body;

    if (!fileType || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Missing fileType or rows array' }, { status: 400 });
    }

    if (!isConfigured) {
      // Running in Demo / Offline Mode - acknowledge reception
      return NextResponse.json({
        success: true,
        mode: 'local',
        message: `Parsed ${rows.length} rows (Running in Local Mode, no Supabase URL set)`,
        rowCount: rows.length,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Map according to table
    if (fileType === 'sewing') {
      // Overwrite sewing_plan table
      await supabase.from('sewing_plan').delete().neq('id', -1);

      // Batch insert in chunks of 500
      const dbRows = rows.map((r: any) => ({
        module: r.module,
        customer: r.customer,
        style: r.style,
        product_type: r.productType,
        cw: r.cw,
        so_li: r.so_li,
        smv: r.smv,
        planned_date: r.plannedDate,
        qty: r.qty,
        sah: r.sah,
      }));

      const chunkSize = 500;
      for (let i = 0; i < dbRows.length; i += chunkSize) {
        const chunk = dbRows.slice(i, i + chunkSize);
        const { error } = await supabase.from('sewing_plan').insert(chunk);
        if (error) throw error;
      }
    } else if (fileType === 'knitting') {
      // Overwrite knitting_plan table
      await supabase.from('knitting_plan').delete().neq('id', -1);

      const dbRows = rows.map((r: any) => ({
        so_li: r.so_li,
        sales_order: r.salesOrder,
        line_item: r.lineItem,
        sm_wip_total: r.smWipTotal,
        order_qty_total: r.orderQtyTotal,
        knit_qty_total: r.knitQtyTotal,
        pkin_qty_total: r.pkinQtyTotal || 0,
        qc_qty_total: r.qcQtyTotal || 0,
        shipped_qty_total: r.shippedQtyTotal || 0,
        size_count: r.sizeCount,
      }));

      const chunkSize = 500;
      for (let i = 0; i < dbRows.length; i += chunkSize) {
        const chunk = dbRows.slice(i, i + chunkSize);
        const { error } = await supabase.from('knitting_plan').insert(chunk);
        if (error) throw error;
      }
    } else if (fileType === 'trims') {
      // Overwrite trims_plan table
      await supabase.from('trims_plan').delete().neq('id', -1);

      const dbRows = rows.map((r: any) => ({
        soli: r.soli,
        module: r.module,
        customer: r.customer,
        product: r.product,
        cw: r.cw,
        status: r.status,
        psd: r.psd || null,
        ped: r.ped || null,
        delivery_date: r.deliveryDate || null,
        days_late: r.daysLate || 0,
        rm_comments: r.rmComments || '',
        merch_comments: r.merchComments || '',
        total_qty: r.totalQty || 0,
        sheet_name: r.sheetName || '',
      }));

      const chunkSize = 500;
      for (let i = 0; i < dbRows.length; i += chunkSize) {
        const chunk = dbRows.slice(i, i + chunkSize);
        const { error } = await supabase.from('trims_plan').insert(chunk);
        if (error) throw error;
      }
    }

    // Insert metadata record
    if (metadata) {
      await supabase.from('upload_metadata').insert({
        file_type: metadata.fileType,
        file_name: metadata.fileName,
        sheet_used: metadata.sheetUsed || '',
        row_count: metadata.rowCount || rows.length,
        unique_so_lis: metadata.uniqueSoLis || 0,
      });
    }

    return NextResponse.json({
      success: true,
      mode: 'supabase',
      message: `Successfully synchronized ${rows.length} rows to Supabase`,
      rowCount: rows.length,
    });
  } catch (error: any) {
    console.error('API sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Database sync failed' },
      { status: 500 }
    );
  }
}
