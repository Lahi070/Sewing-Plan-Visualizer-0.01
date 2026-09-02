import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase Client
const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseUrl = rawSupabaseUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function POST(req: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  try {
    const { so_li, status, action } = await req.json();

    if (!so_li) {
      return NextResponse.json({ error: 'so_li is required' }, { status: 400 });
    }

    if (action === 'DELETE') {
      const { error } = await supabase
        .from('manual_overrides')
        .delete()
        .eq('so_li', so_li);
      
      if (error) throw error;
      return NextResponse.json({ success: true, action: 'deleted' });
    }

    // Default to UPSERT
    const { error } = await supabase
      .from('manual_overrides')
      .upsert({ so_li, override_status: status || 'NO', updated_at: new Date().toISOString() }, { onConflict: 'so_li' });

    if (error) throw error;

    return NextResponse.json({ success: true, action: 'upserted', so_li, status });
  } catch (error: any) {
    console.error('Manual override API error:', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}
