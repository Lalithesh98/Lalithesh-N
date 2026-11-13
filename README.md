# LV Constructions — Budget & Expense Management

Full-stack construction site finance, operations, and progress tracking platform backed by **Supabase (PostgreSQL + Storage + Realtime)** and **Gemini AI** receipt scanning.

## Key Features
- **Dynamic Role-Based Access Control (RBAC)**: Create custom roles (e.g., *Site Engineer*, *Junior Mestri*, *Accountant*), configure per-tab access and write/manage capabilities, and assign site-specific Mestris.
- **Project & Site Management**: Track multiple construction sites, budgets, timelines, and assigned supervisors.
- **Cash Advances & Ledger Reconciliation**: Monitor site advances vs. paid and `In Credit` expenses with real-time low-balance and over-budget alerts.
- **Material, Labor & Daily Site Expenses**: Log material purchases (with transport, extra charges, split paid/credit, and credit settlement), labor wages, and daily petty vouchers.
- **AI Receipt Auto-Fill**: Scan uploaded bill images/PDFs using Gemini (`gemini-2.5-flash`) to auto-populate supplier, invoice number, items, quantities, and rates.
- **Cloud Document & Stage Photo Storage**: Upload receipts and stage progress photos directly to Supabase Storage (`lv-documents`).
- **GST Tax Invoice Generator & Audit Logs**: Generate printable LV GST tax invoices and track immutable audit histories.

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS v4, Lucide Icons
- **Backend**: Express 4, Node.js, `scrypt` password hashing, HMAC-SHA256 session tokens
- **Database & Storage**: Supabase PostgreSQL + Supabase Storage + Realtime
- **AI**: Google `@google/genai`

## Local Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run [supabase/schema.sql](supabase/schema.sql) in your Supabase SQL Editor.
3. Copy `.env.example` to `.env.local` and fill in your Supabase and Gemini credentials.
4. Start the development server:
   ```bash
   npm run dev
   ```
   To run on a custom port (e.g., `3001`):
   ```powershell
   $env:PORT=3001; npm run dev
   ```

## Scripts
- `npm run dev` — Bundle server and run Express + Vite dev middleware
- `npm run build` — Build frontend (`dist/`) and server (`dist/server.cjs`)
- `npm run start` — Run production build (`node dist/server.cjs`)
- `npm run lint` — TypeScript typecheck (`tsc --noEmit`)
- `npm run clean` — Remove `dist/` build artifacts
