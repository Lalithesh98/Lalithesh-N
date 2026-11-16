-- Migration: Cash Flow Borrowings & Loan Repayments Tracker
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 12. Project Borrowings (Loans from friends/lenders for project cash flow)
CREATE TABLE IF NOT EXISTS public.project_borrowings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  lender_name TEXT NOT NULL,
  lender_contact TEXT NOT NULL DEFAULT '',
  borrower_name TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  interest_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_due NUMERIC(14, 2) NOT NULL DEFAULT 0,
  repaid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(14, 2) NOT NULL DEFAULT 0,
  purpose TEXT NOT NULL DEFAULT '',
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Partially Repaid', 'Settled')),
  receipt_url TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Borrowing Repayments (Installments/settlements repaid back to friends)
CREATE TABLE IF NOT EXISTS public.borrowing_repayments (
  id TEXT PRIMARY KEY,
  borrowing_id TEXT NOT NULL REFERENCES public.project_borrowings(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  repaid_by TEXT NOT NULL,
  payment_mode TEXT NOT NULL DEFAULT 'UPI / Bank Transfer',
  reference_no TEXT NOT NULL DEFAULT '',
  receipt_url TEXT NOT NULL DEFAULT '',
  remarks TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_borrowings_project ON public.project_borrowings(project_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_borrowings_status ON public.project_borrowings(status);
CREATE INDEX IF NOT EXISTS idx_repayments_borrowing ON public.borrowing_repayments(borrowing_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_repayments_project ON public.borrowing_repayments(project_id, date DESC);

-- Enable Row Level Security
ALTER TABLE public.project_borrowings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrowing_repayments ENABLE ROW LEVEL SECURITY;

-- Permissive public policies matching existing project architecture
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'project_borrowings' AND policyname = 'Allow public full access to project_borrowings'
  ) THEN
    CREATE POLICY "Allow public full access to project_borrowings" ON public.project_borrowings FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'borrowing_repayments' AND policyname = 'Allow public full access to borrowing_repayments'
  ) THEN
    CREATE POLICY "Allow public full access to borrowing_repayments" ON public.borrowing_repayments FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Update Admin and Proprietor role allowed_tabs to include 'borrowings'
UPDATE public.app_roles
SET allowed_tabs = array_append(allowed_tabs, 'borrowings')
WHERE id IN ('role_admin', 'role_proprietor')
  AND NOT ('borrowings' = ANY(allowed_tabs));
