-- LV Constructions - Complete Supabase PostgreSQL Schema
-- Includes dynamic RBAC roles, users with site assignments, projects with per-site Mestri,
-- advances, material purchases, labor & daily expenses, stage photos, tax invoices, audit logs, notifications, and storage.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Dynamic Roles & Permissions Matrix
CREATE TABLE IF NOT EXISTS public.app_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  allowed_tabs TEXT[] NOT NULL DEFAULT '{}',
  can_write_expenses BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_projects BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_roles BOOLEAN NOT NULL DEFAULT FALSE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Users / Supervisors
CREATE TABLE IF NOT EXISTS public.app_users (
  id TEXT PRIMARY KEY,
  auth_user_id UUID UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  username TEXT UNIQUE,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  assigned_project_ids TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Construction Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  project_name TEXT NOT NULL,
  site_name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  expected_end_date DATE NOT NULL,
  total_budget NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'On Hold')),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_mestri_id TEXT,
  assigned_mestri_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Cash Advances
CREATE TABLE IF NOT EXISTS public.advances (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  given_by TEXT NOT NULL,
  received_by TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  payment_mode TEXT NOT NULL DEFAULT 'Cash',
  remarks TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Material Purchases
CREATE TABLE IF NOT EXISTS public.material_purchases (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  material_name TEXT NOT NULL,
  quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'Pcs',
  supplier TEXT NOT NULL DEFAULT 'Local Store',
  rate NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  invoice_no TEXT NOT NULL DEFAULT '',
  bill_url TEXT NOT NULL DEFAULT '',
  entered_by TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  payment_status TEXT CHECK (payment_status IN ('Paid', 'In Credit')),
  paid_amount NUMERIC(14, 2),
  credit_amount NUMERIC(14, 2),
  transport_charges NUMERIC(14, 2) NOT NULL DEFAULT 0,
  extra_expenses NUMERIC(14, 2) NOT NULL DEFAULT 0,
  extra_expenses_remarks TEXT NOT NULL DEFAULT '',
  weight_kg NUMERIC(12, 3),
  thickness_specs TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Labor Expenses
CREATE TABLE IF NOT EXISTS public.labor_expenses (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  worker_type TEXT NOT NULL,
  num_workers INTEGER NOT NULL DEFAULT 0,
  daily_wage NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_wage NUMERIC(14, 2) NOT NULL DEFAULT 0,
  remarks TEXT NOT NULL DEFAULT '',
  entered_by TEXT NOT NULL,
  payment_status TEXT CHECK (payment_status IN ('Paid', 'In Credit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Daily Site Expenses
CREATE TABLE IF NOT EXISTS public.daily_expenses (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  bill_url TEXT NOT NULL DEFAULT '',
  entered_by TEXT NOT NULL,
  payment_status TEXT CHECK (payment_status IN ('Paid', 'In Credit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Stage Progress Photos
CREATE TABLE IF NOT EXISTS public.stage_photos (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_key TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  remarks TEXT NOT NULL DEFAULT '',
  uploaded_by TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Raised GST Tax Invoices
CREATE TABLE IF NOT EXISTS public.tax_invoices (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
  invoice_no TEXT NOT NULL,
  date DATE NOT NULL,
  project_name TEXT NOT NULL,
  site_name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  grand_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  table_affected TEXT NOT NULL,
  record_id TEXT NOT NULL,
  previous_value TEXT NOT NULL DEFAULT '',
  new_value TEXT NOT NULL DEFAULT '',
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL
);

-- 11. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('advance_issued', 'purchase_recorded', 'budget_exceeded', 'large_expense', 'low_advance_balance')),
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount NUMERIC(14, 2),
  is_read_by TEXT[] NOT NULL DEFAULT '{}'
);

-- 12. Project Borrowings (External loans from friends/lenders for project cash flow)
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_advances_project ON public.advances(project_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_project ON public.material_purchases(project_id, date DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_labor_project ON public.labor_expenses(project_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_project ON public.daily_expenses(project_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_stage_photos_project ON public.stage_photos(project_id, stage_key);
CREATE INDEX IF NOT EXISTS idx_notifications_project ON public.notifications(project_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON public.audit_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_borrowings_project ON public.project_borrowings(project_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_borrowings_status ON public.project_borrowings(status);
CREATE INDEX IF NOT EXISTS idx_repayments_borrowing ON public.borrowing_repayments(borrowing_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_repayments_project ON public.borrowing_repayments(project_id, date DESC);

-- Storage bucket for receipt bills and stage progress photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('lv-documents', 'lv-documents', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_borrowings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrowing_repayments ENABLE ROW LEVEL SECURITY;

-- Default Roles Seed
INSERT INTO public.app_roles (id, name, description, allowed_tabs, can_write_expenses, can_manage_projects, can_manage_roles, is_system)
VALUES
  (
    'role_admin',
    'Admin',
    'Full system control over sites, advances, borrowings, expenses, role access, and user accounts.',
    ARRAY['dashboard','projects','advances','borrowings','materials','labor','daily','reconciliation','documents','reports','audit','photos'],
    TRUE,
    TRUE,
    TRUE,
    TRUE
  ),
  (
    'role_proprietor',
    'Proprietor',
    'Executive oversight, financial reconciliations, borrowings, reports, documents, and stage progress.',
    ARRAY['dashboard','borrowings','reconciliation','documents','reports','photos'],
    FALSE,
    FALSE,
    FALSE,
    FALSE
  ),
  (
    'role_mestri',
    'Mestri',
    'On-site supervisor logging material purchases, labor wages, daily expenses, and stage photos.',
    ARRAY['dashboard','materials','labor','daily','documents','photos'],
    TRUE,
    FALSE,
    FALSE,
    FALSE
  )
ON CONFLICT (id) DO NOTHING;
