import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const expectedPassword = process.env.ADMIN_UPLOAD_PASSWORD || 'sewingadmin2026';

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    if (password === expectedPassword) {
      return NextResponse.json({
        success: true,
        message: 'Admin authentication verified',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Incorrect admin password' },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
