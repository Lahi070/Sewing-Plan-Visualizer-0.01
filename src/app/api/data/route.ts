import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl !== 'https://your-project-id.supabase.co' &&
  supabaseUrl.startsWith('http')
);

export async function GET() {
  try {
    if (!isConfigured) {
      return NextResponse.json({
        isConfigured: false,
        mode: 'demo',
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const [sewingRes, knitRes, trimsRes, metaRes] = await Promise.all([
      supabase.from('sewing_plan').select('*'),
      supabase.from('knitting_plan').select('*'),
      supabase.from('trims_plan').select('*'),
      supabase.from('upload_metadata').select('*').order('uploaded_at', { ascending: false }),
    ]);

    if (sewingRes.error || knitRes.error || trimsRes.error) {
      throw new Error('Failed to query Supabase tables');
    }

    return NextResponse.json({
      isConfigured: true,
      mode: 'supabase',
      sewingPlan: sewingRes.data,
      knittingPlan: knitRes.data,
      trimsPlan: trimsRes.data,
      metadata: metaRes.data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error fetching data' },
      { status: 500 }
    );
  }
}
