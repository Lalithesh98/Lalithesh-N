import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Advance,
  AppTab,
  AuditLog,
  BorrowingRepayment,
  BorrowingStatus,
  DailyExpense,
  LaborExpense,
  MaterialPurchase,
  Notification,
  PaymentStatus,
  Project,
  ProjectBorrowing,
  RoleDefinition,
  StagePhoto,
  TaxInvoice,
  User,
} from '../types';

export const STORAGE_BUCKET = 'lv-documents';

/**
 * Create an administrative Supabase client using the service role key.
 */
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured in environment variables.');
  }
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Hash a plaintext password using Node's scrypt with a random 16-byte salt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

/**
 * Verify a candidate password against a stored scrypt hash (or legacy plaintext fallback).
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;
  if (!storedHash.startsWith('scrypt$')) {
    return crypto.timingSafeEqual(Buffer.from(password), Buffer.from(storedHash));
  }
  const parts = storedHash.split('$');
  if (parts.length !== 3) return false;
  const [, salt, hashHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hashHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function getAuthSecret(): string {
  return process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'lv-constructions-dev-secret';
}

export interface SessionPayload {
  userId: string;
  role: string;
  name: string;
  email: string;
  exp: number;
}

/**
 * Create an HMAC-SHA256 signed stateless session token valid for 7 days.
 */
export function signSessionToken(user: User): string {
  const payload: SessionPayload = {
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', getAuthSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

/**
 * Verify and decode an HMAC-SHA256 signed session token.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;
    const expectedSig = crypto.createHmac('sha256', getAuthSecret()).update(encoded).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Upload a data URI (base64 image/pdf) to Supabase Storage and return its public URL.
 * Non-data URIs (already hosted URLs or empty strings) are returned as-is.
 */
export async function uploadDataUrlIfNeeded(
  supabase: SupabaseClient,
  maybeDataUrl: string | undefined,
  folder: string,
  filePrefix: string
): Promise<string> {
  if (!maybeDataUrl) return '';
  if (!maybeDataUrl.startsWith('data:')) return maybeDataUrl;

  const match = maybeDataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return maybeDataUrl;

  const mimeType = match[1];
  const base64Data = match[2];
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  };
  const ext = extMap[mimeType.toLowerCase()] || 'bin';
  const filePath = `${folder}/${filePrefix}_${Date.now()}.${ext}`;
  const buffer = Buffer.from(base64Data, 'base64');

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    console.error('Supabase storage upload warning:', error.message);
    return maybeDataUrl;
  }

  const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  return pub.publicUrl;
}

// Row <-> Domain mappers
export const mapRole = (r: any): RoleDefinition => ({
  id: r.id,
  name: r.name,
  description: r.description || '',
  allowedTabs: Array.isArray(r.allowed_tabs) ? (r.allowed_tabs as AppTab[]) : [],
  canWriteExpenses: Boolean(r.can_write_expenses),
  canManageProjects: Boolean(r.can_manage_projects),
  canManageRoles: Boolean(r.can_manage_roles),
  isSystem: Boolean(r.is_system),
});

export const mapUser = (r: any): User => ({
  id: r.id,
  name: r.name,
  email: r.email,
  role: r.role,
  username: r.username || undefined,
  assignedProjectIds: Array.isArray(r.assigned_project_ids) ? r.assigned_project_ids : [],
});

export const mapProject = (r: any): Project => ({
  id: r.id,
  projectName: r.project_name,
  siteName: r.site_name,
  clientName: r.client_name,
  startDate: r.start_date,
  expectedEndDate: r.expected_end_date,
  totalBudget: Number(r.total_budget) || 0,
  status: r.status,
  isDeleted: Boolean(r.is_deleted),
  assignedMestriId: r.assigned_mestri_id || undefined,
  assignedMestriName: r.assigned_mestri_name || '',
});

export const mapAdvance = (r: any): Advance => ({
  id: r.id,
  projectId: r.project_id,
  date: r.date,
  givenBy: r.given_by,
  receivedBy: r.received_by,
  amount: Number(r.amount) || 0,
  paymentMode: r.payment_mode,
  remarks: r.remarks || '',
});

export const mapPurchase = (r: any): MaterialPurchase => ({
  id: r.id,
  projectId: r.project_id,
  date: r.date,
  category: r.category,
  materialName: r.material_name,
  quantity: Number(r.quantity) || 0,
  unit: r.unit,
  supplier: r.supplier,
  rate: Number(r.rate) || 0,
  totalAmount: Number(r.total_amount) || 0,
  invoiceNo: r.invoice_no || '',
  billUrl: r.bill_url || '',
  enteredBy: r.entered_by,
  isDeleted: Boolean(r.is_deleted),
  paymentStatus: (r.payment_status as PaymentStatus) || undefined,
  paidAmount: r.paid_amount !== null && r.paid_amount !== undefined ? Number(r.paid_amount) : undefined,
  creditAmount: r.credit_amount !== null && r.credit_amount !== undefined ? Number(r.credit_amount) : undefined,
  transportCharges: Number(r.transport_charges) || 0,
  extraExpenses: Number(r.extra_expenses) || 0,
  extraExpensesRemarks: r.extra_expenses_remarks || '',
  weightKg: r.weight_kg !== null && r.weight_kg !== undefined ? Number(r.weight_kg) : undefined,
  thicknessSpecs: r.thickness_specs || undefined,
  paidByPartner: r.paid_by_partner || undefined,
  isPartnerPocket: Boolean(r.is_partner_pocket),
});

export const mapLabor = (r: any): LaborExpense => ({
  id: r.id,
  projectId: r.project_id,
  date: r.date,
  workerType: r.worker_type,
  numWorkers: Number(r.num_workers) || 0,
  dailyWage: Number(r.daily_wage) || 0,
  totalWage: Number(r.total_wage) || 0,
  remarks: r.remarks || '',
  enteredBy: r.entered_by,
  paymentStatus: (r.payment_status as PaymentStatus) || undefined,
  paidByPartner: r.paid_by_partner || undefined,
  isPartnerPocket: Boolean(r.is_partner_pocket),
});

export const mapDaily = (r: any): DailyExpense => ({
  id: r.id,
  projectId: r.project_id,
  date: r.date,
  category: r.category,
  description: r.description || '',
  amount: Number(r.amount) || 0,
  billUrl: r.bill_url || '',
  enteredBy: r.entered_by,
  paymentStatus: (r.payment_status as PaymentStatus) || undefined,
  paidByPartner: r.paid_by_partner || undefined,
  isPartnerPocket: Boolean(r.is_partner_pocket),
});

export const mapStagePhoto = (r: any): StagePhoto => ({
  id: r.id,
  projectId: r.project_id,
  stageKey: r.stage_key,
  photoUrl: r.photo_url,
  remarks: r.remarks || '',
  uploadedBy: r.uploaded_by,
  date: r.date,
});

export const mapTaxInvoice = (r: any): TaxInvoice => ({
  id: r.id,
  projectId: r.project_id,
  invoiceNo: r.invoice_no,
  date: r.date,
  projectName: r.project_name,
  siteName: r.site_name,
  clientName: r.client_name,
  grandTotal: Number(r.grand_total) || 0,
  items: r.items || [],
  metadata: r.metadata || {},
});

export const mapAuditLog = (r: any): AuditLog => ({
  id: r.id,
  action: r.action,
  tableAffected: r.table_affected,
  recordId: r.record_id,
  previousValue: r.previous_value || '',
  newValue: r.new_value || '',
  date: r.date,
  userId: r.user_id,
  userName: r.user_name,
});

export const mapNotification = (r: any): Notification => ({
  id: r.id,
  projectId: r.project_id,
  projectName: r.project_name,
  message: r.message,
  type: r.type,
  date: r.date,
  amount: r.amount !== null && r.amount !== undefined ? Number(r.amount) : undefined,
  isReadBy: Array.isArray(r.is_read_by) ? r.is_read_by : [],
});

export const mapRepayment = (r: any): BorrowingRepayment => ({
  id: r.id,
  borrowingId: r.borrowing_id,
  projectId: r.project_id,
  date: r.date,
  amount: Number(r.amount) || 0,
  repaidBy: r.repaid_by,
  paymentMode: r.payment_mode || 'UPI / Bank Transfer',
  referenceNo: r.reference_no || '',
  receiptUrl: r.receipt_url || '',
  remarks: r.remarks || '',
  createdAt: r.created_at,
});

export const mapBorrowing = (r: any, repayments: BorrowingRepayment[] = []): ProjectBorrowing => {
  const principal = Number(r.amount) || 0;
  const interest = Number(r.interest_amount) || 0;
  const totalDue = Number(r.total_due) || (principal + interest);
  const repaid = Number(r.repaid_amount) || 0;
  const balanceDue = Number(r.balance_due) !== undefined ? Number(r.balance_due) : Math.max(0, totalDue - repaid);

  let status: BorrowingStatus = BorrowingStatus.ACTIVE;
  if (r.status === 'Settled' || balanceDue <= 0) {
    status = BorrowingStatus.SETTLED;
  } else if (r.status === 'Partially Repaid' || repaid > 0) {
    status = BorrowingStatus.PARTIALLY_REPAID;
  }

  return {
    id: r.id,
    projectId: r.project_id,
    date: r.date,
    lenderName: r.lender_name,
    lenderContact: r.lender_contact || '',
    borrowerName: r.borrower_name,
    amount: principal,
    interestAmount: interest,
    totalDue,
    repaidAmount: repaid,
    balanceDue,
    purpose: r.purpose || '',
    dueDate: r.due_date || undefined,
    status,
    receiptUrl: r.receipt_url || '',
    notes: r.notes || '',
    repayments,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
};

