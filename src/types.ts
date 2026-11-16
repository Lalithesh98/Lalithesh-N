export enum UserRole {
  ADMIN = 'Admin', // Contractor (Admin)
  PROPRIETOR = 'Proprietor', // Owner
  MESTRI = 'Mestri', // Site Supervisor
}

export type AppTab =
  | 'dashboard'
  | 'projects'
  | 'advances'
  | 'borrowings'
  | 'materials'
  | 'labor'
  | 'daily'
  | 'reconciliation'
  | 'documents'
  | 'reports'
  | 'audit'
  | 'photos';

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  allowedTabs: AppTab[];
  canWriteExpenses: boolean;
  canManageProjects: boolean;
  canManageRoles: boolean;
  isSystem: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  username?: string;
  assignedProjectIds?: string[];
}

export enum ProjectStatus {
  ACTIVE = 'Active',
  COMPLETED = 'Completed',
  ON_HOLD = 'On Hold',
}

export enum PaymentStatus {
  PAID = 'Paid',
  CREDIT = 'In Credit',
}

export interface Project {
  id: string;
  projectName: string;
  siteName: string;
  clientName: string;
  startDate: string;
  expectedEndDate: string;
  totalBudget: number;
  status: ProjectStatus;
  isDeleted: boolean;
  assignedMestriId?: string;
  assignedMestriName?: string;
}

export interface Advance {
  id: string;
  projectId: string;
  date: string;
  givenBy: string; // User Name or ID
  receivedBy: string; // Mestri User ID / Name
  amount: number;
  paymentMode: string;
  remarks: string;
}

export enum MaterialCategory {
  CEMENT = 'Cement',
  STEEL = 'Steel',
  SAND = 'Sand',
  JELLY = 'Jelly',
  BRICKS = 'Bricks',
  BARBENDING = 'Barbending Labor',
  CENTRING = 'Centring',
  ELECTRICAL = 'Electrical',
  PLUMBING = 'Plumbing',
  PAINT = 'Paint',
  HARDWARE = 'Hardware',
  OTHER = 'Other',
}

export interface MaterialPurchase {
  id: string;
  projectId: string;
  date: string;
  category: MaterialCategory;
  materialName: string;
  quantity: number;
  unit: string;
  supplier: string;
  rate: number;
  totalAmount: number;
  invoiceNo: string;
  billUrl?: string; // Supabase Storage URL or Data URI
  enteredBy: string; // User Name/ID
  isDeleted: boolean; // For soft delete
  paymentStatus?: PaymentStatus; // Paid or In Credit
  paidAmount?: number;
  creditAmount?: number;
  transportCharges?: number;
  extraExpenses?: number;
  extraExpensesRemarks?: string;
  weightKg?: number;
  thicknessSpecs?: string;
  paidByPartner?: string; // If partner paid from personal pocket
  isPartnerPocket?: boolean;
}

export enum WorkerType {
  MASON = 'Mason',
  HELPER = 'Helper',
  ELECTRICIAN = 'Electrician',
  PLUMBER = 'Plumber',
  PAINTER = 'Painter',
  CARPENTER = 'Carpenter',
}

export interface LaborExpense {
  id: string;
  projectId: string;
  date: string;
  workerType: WorkerType;
  numWorkers: number;
  dailyWage: number;
  totalWage: number;
  remarks: string;
  enteredBy: string;
  paymentStatus?: PaymentStatus; // Paid or In Credit
  paidByPartner?: string;
  isPartnerPocket?: boolean;
}

export enum DailyExpenseCategory {
  TRANSPORT = 'Transport',
  FOOD = 'Food',
  WATER = 'Water',
  FUEL = 'Fuel',
  EQUIPMENT_RENTAL = 'Equipment Rental',
  MISCELLANEOUS = 'Miscellaneous',
}

export interface DailyExpense {
  id: string;
  projectId: string;
  date: string;
  category: DailyExpenseCategory;
  description: string;
  amount: number;
  billUrl?: string; // Supabase Storage URL or Data URI
  enteredBy: string;
  paymentStatus?: PaymentStatus; // Paid or In Credit
  paidByPartner?: string;
  isPartnerPocket?: boolean;
}

export interface StagePhoto {
  id: string;
  projectId: string;
  stageKey: string;
  photoUrl: string;
  remarks: string;
  uploadedBy: string;
  date: string;
}

export interface TaxInvoiceItem {
  slNo: number;
  description: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface TaxInvoice {
  id: string;
  projectId?: string | null;
  invoiceNo: string;
  date: string;
  projectName: string;
  siteName: string;
  clientName: string;
  grandTotal: number;
  items?: TaxInvoiceItem[];
  metadata?: Record<string, any>;
}

export interface AuditLog {
  id: string;
  action: string;
  tableAffected: string;
  recordId: string;
  previousValue: string; // stringified JSON or plain text
  newValue: string; // stringified JSON or plain text
  date: string;
  userId: string;
  userName: string;
}

export interface Notification {
  id: string;
  projectId: string;
  projectName: string;
  message: string;
  type:
    | 'advance_issued'
    | 'purchase_recorded'
    | 'budget_exceeded'
    | 'large_expense'
    | 'low_advance_balance'
    | 'borrowing_recorded'
    | 'loan_repaid'
    | 'loan_settled';
  date: string;
  amount?: number;
  isReadBy: string[]; // List of userIds who read it
}

export enum BorrowingStatus {
  ACTIVE = 'Active',
  PARTIALLY_REPAID = 'Partially Repaid',
  SETTLED = 'Settled',
}

export interface BorrowingRepayment {
  id: string;
  borrowingId: string;
  projectId: string;
  date: string;
  amount: number;
  repaidBy: string; // Partner/Accountant who repaid it
  paymentMode: string; // UPI / Bank Transfer / Cash / Cheque
  referenceNo?: string; // UPI UTR or Txn ID
  receiptUrl?: string; // Proof screenshot
  remarks?: string;
  createdAt?: string;
}

export interface ProjectBorrowing {
  id: string;
  projectId: string;
  date: string;
  lenderName: string; // Friend / Relative / Source name
  lenderContact?: string; // Phone or UPI ID
  borrowerName: string; // Partner who arranged/took the borrowing
  amount: number; // Principal amount
  interestAmount?: number; // Extra fee/interest, default 0
  totalDue: number; // amount + (interestAmount || 0)
  repaidAmount: number; // Sum of repayments made so far
  balanceDue: number; // totalDue - repaidAmount
  purpose: string; // e.g. "Urgent cement delivery payment"
  dueDate?: string; // Target repayment date
  status: BorrowingStatus; // Active | Partially Repaid | Settled
  receiptUrl?: string; // Borrowing proof / agreement / UPI voucher
  notes?: string;
  repayments?: BorrowingRepayment[];
  createdAt?: string;
  updatedAt?: string;
}
