# Sewing Module Readiness Tracker

A Next.js web application built for garment manufacturing operations to cross-reference Sewing Pre-Work Plans, Knitting WIP, and Trims (Raw Material Warehouse) datasets, detecting at-risk sewing modules 3 days prior to production.

## Features
- **Public Dashboard**: Publicly accessible floor view with 0 login barriers for operators and line supervisors.
- **Admin Upload Portal**: Single-password protected upload center (`ADMIN_UPLOAD_PASSWORD`) with client-side SheetJS parsing.
- **Dynamic Trims Snapshot Detection**: Auto-detects the closest dated snapshot sheet in multi-sheet trims workbooks.
- **Dual Side-by-Side Module Pie Charts**: Displays exact piece counts (`SM WIP vs Planned Qty` and `Trims OK vs Total SO_LIs`).
- **Interactive Floor Table**: Multi-level filtering by module, status, customer, date range, and text search + 1-click CSV export and print view.
- **Free Tier Ready**: Built specifically for Vercel Hobby tier and Supabase free PostgreSQL.

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Run local development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the floor dashboard.

### 3. Build for production
```bash
npm run build
```

## Environment Variables
Create a `.env.local` file with:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
ADMIN_UPLOAD_PASSWORD=sewingadmin2026
```
*(Note: Leaving Supabase keys blank enables the instant Zero-Config Demo Mode with pre-loaded factory data).*
