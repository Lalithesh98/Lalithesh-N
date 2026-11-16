import React, { useState } from 'react';
import {
  HandCoins,
  PlusCircle,
  Calendar,
  User as UserIcon,
  Phone,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Receipt,
  Trash2,
  Share2,
  FileText,
  DollarSign,
  TrendingDown,
  TrendingUp,
  X,
  CreditCard,
  Building2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Info
} from 'lucide-react';
import {
  BorrowingRepayment,
  BorrowingStatus,
  Project,
  ProjectBorrowing,
  User,
  UserRole
} from '../types';

interface BorrowingsTrackerProps {
  activeProject: Project | null;
  projects: Project[];
  users: User[];
  borrowings: ProjectBorrowing[];
  currentUserRole: string;
  canManage: boolean;
  currentUserName: string;
  onSaveBorrowing: (data: Partial<ProjectBorrowing>) => Promise<void>;
  onRepayBorrowing: (borrowingId: string, data: Partial<BorrowingRepayment>) => Promise<void>;
  onDeleteBorrowing: (id: string) => Promise<void>;
  onDeleteRepayment: (repaymentId: string) => Promise<void>;
  onPreviewReceipt: (url: string, metadata?: any) => void;
}

export default function BorrowingsTracker({
  activeProject,
  projects,
  users,
  borrowings,
  currentUserRole,
  canManage,
  currentUserName,
  onSaveBorrowing,
  onRepayBorrowing,
  onDeleteBorrowing,
  onDeleteRepayment,
  onPreviewReceipt,
}: BorrowingsTrackerProps) {
  // Filters and views
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SETTLED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [borrowerFilter, setBorrowerFilter] = useState('ALL');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [repayingBorrowing, setRepayingBorrowing] = useState<ProjectBorrowing | null>(null);
  const [expandedHistories, setExpandedHistories] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Borrowing form
  const [projectId, setProjectId] = useState(activeProject?.id || '');
  const [lenderName, setLenderName] = useState('');
  const [lenderContact, setLenderContact] = useState('');
  const [borrowerName, setBorrowerName] = useState(currentUserName || '');
  const [amount, setAmount] = useState('');
  const [interestAmount, setInterestAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Repayment form
  const [repayAmount, setRepayAmount] = useState('');
  const [repayDate, setRepayDate] = useState(new Date().toISOString().split('T')[0]);
  const [repaidBy, setRepaidBy] = useState(currentUserName || '');
  const [repayMode, setRepayMode] = useState('UPI / Bank Transfer');
  const [repayRef, setRepayRef] = useState('');
  const [repayReceipt, setRepayReceipt] = useState('');
  const [repayRemarks, setRepayRemarks] = useState('');
  const [isRepaying, setIsRepaying] = useState(false);

  // Filter project-specific borrowings
  const pId = activeProject?.id || '';
  const projectBorrowings = borrowings.filter((b) => b.projectId === pId);

  // Aggregate Metrics
  const totalBorrowed = projectBorrowings.reduce((sum, b) => sum + b.amount, 0);
  const totalInterest = projectBorrowings.reduce((sum, b) => sum + (b.interestAmount || 0), 0);
  const totalDue = projectBorrowings.reduce((sum, b) => sum + b.totalDue, 0);
  const totalRepaid = projectBorrowings.reduce((sum, b) => sum + b.repaidAmount, 0);
  const totalOutstanding = projectBorrowings.reduce((sum, b) => sum + b.balanceDue, 0);
  const activeCount = projectBorrowings.filter((b) => b.balanceDue > 0).length;
  const settledCount = projectBorrowings.filter((b) => b.status === BorrowingStatus.SETTLED || b.balanceDue <= 0).length;
  const repaymentPercentage = totalDue > 0 ? Math.min(100, Math.round((totalRepaid / totalDue) * 100)) : 100;

  // Filtered list
  const filteredBorrowings = projectBorrowings.filter((b) => {
    if (statusFilter === 'ACTIVE' && b.balanceDue <= 0) return false;
    if (statusFilter === 'SETTLED' && b.balanceDue > 0) return false;
    if (borrowerFilter !== 'ALL' && b.borrowerName.toLowerCase() !== borrowerFilter.toLowerCase()) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = b.lenderName.toLowerCase().includes(q);
      const matchContact = (b.lenderContact || '').toLowerCase().includes(q);
      const matchPurpose = (b.purpose || '').toLowerCase().includes(q);
      const matchBorrower = b.borrowerName.toLowerCase().includes(q);
      if (!matchName && !matchContact && !matchPurpose && !matchBorrower) return false;
    }
    return true;
  });

  // Unique borrowers for filter dropdown
  const uniqueBorrowers = Array.from(new Set(projectBorrowings.map((b) => b.borrowerName).filter(Boolean)));

  const handleCreateBorrowingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(amount) || 0;
    if (amtNum <= 0 || !lenderName.trim()) {
      alert('Please enter a valid amount and friend / lender name.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSaveBorrowing({
        projectId: projectId || pId,
        date,
        lenderName: lenderName.trim(),
        lenderContact: lenderContact.trim(),
        borrowerName: borrowerName.trim() || currentUserName,
        amount: amtNum,
        interestAmount: parseFloat(interestAmount) || 0,
        purpose: purpose.trim(),
        dueDate: dueDate || undefined,
        receiptUrl,
        notes: notes.trim(),
      });
      setIsAddModalOpen(false);
      resetAddForm();
    } catch (err: any) {
      alert(err.message || 'Failed saving borrowing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAddForm = () => {
    setLenderName('');
    setLenderContact('');
    setAmount('');
    setInterestAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setDueDate('');
    setPurpose('');
    setReceiptUrl('');
    setNotes('');
  };

  const handleRepaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayingBorrowing) return;
    const repAmtNum = parseFloat(repayAmount) || 0;
    if (repAmtNum <= 0) {
      alert('Please enter a repayment amount greater than 0.');
      return;
    }
    if (repAmtNum > repayingBorrowing.balanceDue + 0.01) {
      alert(`Repayment cannot exceed the outstanding balance of ₹${repayingBorrowing.balanceDue.toLocaleString()}`);
      return;
    }
    setIsRepaying(true);
    try {
      await onRepayBorrowing(repayingBorrowing.id, {
        projectId: repayingBorrowing.projectId,
        date: repayDate,
        amount: repAmtNum,
        repaidBy: repaidBy.trim() || currentUserName,
        paymentMode: repayMode,
        referenceNo: repayRef.trim(),
        receiptUrl: repayReceipt,
        remarks: repayRemarks.trim(),
      });
      setRepayingBorrowing(null);
      resetRepayForm();
    } catch (err: any) {
      alert(err.message || 'Failed recording loan repayment.');
    } finally {
      setIsRepaying(false);
    }
  };

  const resetRepayForm = () => {
    setRepayAmount('');
    setRepayDate(new Date().toISOString().split('T')[0]);
    setRepayRef('');
    setRepayReceipt('');
    setRepayRemarks('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'borrow' | 'repay') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (target === 'borrow') setReceiptUrl(dataUrl);
      else setRepayReceipt(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const copyWhatsAppStatement = (b: ProjectBorrowing) => {
    const text = `*LV Constructions — Loan Statement*\nSite: ${activeProject?.projectName || 'Project Site'}\nLender: ${b.lenderName}\nAmount Borrowed: ₹${b.amount.toLocaleString()} (on ${b.date})\nRepaid So Far: ₹${b.repaidAmount.toLocaleString()}\n*Current Balance Due: ₹${b.balanceDue.toLocaleString()}*\nStatus: ${b.balanceDue <= 0 ? 'FULLY SETTLED' : 'ACTIVE'}\n${b.dueDate ? `Target Due Date: ${b.dueDate}` : ''}\nThank you!`;
    navigator.clipboard.writeText(text);
    setCopiedId(b.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const toggleHistory = (id: string) => {
    setExpandedHistories((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!activeProject) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center max-w-xl mx-auto my-12">
        <Building2 className="w-16 h-16 mx-auto text-slate-300 stroke-[1.5] mb-4" />
        <h3 className="text-xl font-bold text-slate-800">No Project Site Selected</h3>
        <p className="text-slate-500 mt-2 text-xs">
          Please select or register a construction site to track cash flow borrowings and friend debt.
        </p>
      </div>
    );
  }

  return (
    <div id="borrowings-tracker-module" className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 border border-slate-200/80 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl border border-amber-500/20">
              <HandCoins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Cash Flow Borrowings & Friend Loans
              </h2>
              <p className="text-xs text-slate-500">
                Track temporary cash borrowed from friends, family, or partners to ensure 100% accurate profit reconciliation.
              </p>
            </div>
          </div>
        </div>

        {canManage && (
          <button
            id="add-borrowing-btn"
            onClick={() => {
              setProjectId(pId);
              setBorrowerName(currentUserName);
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer select-none shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Record New Borrowing</span>
          </button>
        )}
      </div>

      {/* Critical Cash Flow & Profit Guard Notice */}
      {totalOutstanding > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-rose-50 border-2 border-amber-200/70 p-4.5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-xl shadow-sm shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-amber-950">
                Profit Calculation Alert: ₹{totalOutstanding.toLocaleString()} in Unsettled Friend Debt
              </h4>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                Money borrowed from friends is an <strong>external liability</strong>, NOT project revenue. You must reimburse these {activeCount} active borrowings before calculating or distributing final partner profits.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-stretch md:self-auto justify-end shrink-0">
            <span className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 font-extrabold rounded-xl text-xs shadow-xs">
              {activeCount} Active Debt{activeCount > 1 ? 's' : ''} Pending
            </span>
          </div>
        </div>
      )}

      {/* 4 KPI Aggregate Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Injected */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Borrowed</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">₹{totalBorrowed.toLocaleString()}</p>
          <p className="text-[11px] text-slate-500 mt-1 font-semibold">
            {projectBorrowings.length} total borrowing records
          </p>
        </div>

        {/* Total Repaid */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Repaid Back</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">₹{totalRepaid.toLocaleString()}</p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${repaymentPercentage}%` }}
            ></div>
          </div>
          <p className="text-[11px] text-emerald-700 mt-1 font-bold">
            {repaymentPercentage}% of borrowed funds settled
          </p>
        </div>

        {/* Outstanding Pending Debt */}
        <div className={`p-5 rounded-2xl border shadow-sm relative overflow-hidden ${
          totalOutstanding > 0 ? 'bg-rose-50/40 border-rose-200 text-rose-950' : 'bg-white border-slate-200/70'
        }`}>
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Outstanding Debt</span>
            <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-700 mt-2">₹{totalOutstanding.toLocaleString()}</p>
          <p className="text-[11px] font-bold text-rose-600 mt-1">
            {totalOutstanding > 0 ? '⚠️ Must settle before profit split' : 'All friend loans are fully cleared'}
          </p>
        </div>

        {/* Settlement Status Ratio */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Loan Status</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <HandCoins className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900">{settledCount}</span>
            <span className="text-xs font-bold text-emerald-600">Settled</span>
            <span className="text-slate-300">/</span>
            <span className="text-2xl font-black text-amber-600">{activeCount}</span>
            <span className="text-xs font-bold text-amber-600">Active</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-semibold">
            Across {activeProject.projectName}
          </p>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="inline-flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'ALL' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({projectBorrowings.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'ACTIVE' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active Debt ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('SETTLED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'SETTLED' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Settled ({settledCount})
            </button>
          </div>

          {/* Borrower Filter */}
          {uniqueBorrowers.length > 1 && (
            <select
              value={borrowerFilter}
              onChange={(e) => setBorrowerFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold outline-none cursor-pointer"
            >
              <option value="ALL">All Borrowers</option>
              {uniqueBorrowers.map((b) => (
                <option key={b} value={b}>
                  Taken by: {b}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search lender, contact, purpose..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-64 pl-3.5 pr-8 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl text-xs font-medium outline-none focus:border-amber-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Borrowings Cards List */}
      {filteredBorrowings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center max-w-lg mx-auto">
          <HandCoins className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-800">No Borrowing Records Found</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {projectBorrowings.length === 0
              ? 'No external borrowings have been logged for this site. When you borrow cash from friends to cover expenses, record it here to track repayments and protect profits.'
              : 'No borrowings match your selected filter criteria.'}
          </p>
          {canManage && projectBorrowings.length === 0 && (
            <button
              onClick={() => {
                setProjectId(pId);
                setBorrowerName(currentUserName);
                setIsAddModalOpen(true);
              }}
              className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Record First Borrowing
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBorrowings.map((b) => {
            const isSettled = b.balanceDue <= 0 || b.status === BorrowingStatus.SETTLED;
            const isPartiallyRepaid = b.repaidAmount > 0 && !isSettled;
            const repaymentsList = b.repayments || [];
            const isExpanded = Boolean(expandedHistories[b.id]);
            const pct = b.totalDue > 0 ? Math.min(100, Math.round((b.repaidAmount / b.totalDue) * 100)) : 100;

            return (
              <div
                key={b.id}
                className={`bg-white rounded-2xl border transition-all duration-200 shadow-xs overflow-hidden ${
                  isSettled ? 'border-slate-200' : 'border-amber-200/80 ring-1 ring-amber-100'
                }`}
              >
                {/* Main Card Header */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/50 to-white">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-black text-slate-900">{b.lenderName}</span>
                      {b.lenderContact && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {b.lenderContact}
                        </span>
                      )}
                      {/* Status Badge */}
                      {isSettled ? (
                        <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold rounded-lg text-[10px] uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Fully Settled
                        </span>
                      ) : isPartiallyRepaid ? (
                        <span className="px-2.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 font-extrabold rounded-lg text-[10px] uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Partially Repaid ({pct}%)
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 font-extrabold rounded-lg text-[10px] uppercase tracking-wider flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Active Debt
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>
                        Borrowed by: <strong className="text-slate-700">{b.borrowerName}</strong>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" /> Date: <strong>{b.date}</strong>
                      </span>
                      {b.dueDate && (
                        <>
                          <span>•</span>
                          <span className={`flex items-center gap-1 font-bold ${
                            !isSettled && new Date(b.dueDate) < new Date() ? 'text-rose-600' : 'text-slate-600'
                          }`}>
                            Target Due: {b.dueDate}
                            {!isSettled && new Date(b.dueDate) < new Date() && ' (Overdue!)'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Financial Values & Actions */}
                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-left md:text-right">
                      <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Balance Remaining</div>
                      <div className={`text-xl font-black ${isSettled ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ₹{b.balanceDue.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-slate-500 font-semibold">
                        Repaid: ₹{b.repaidAmount.toLocaleString()} / ₹{b.totalDue.toLocaleString()}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isSettled && canManage && (
                        <button
                          onClick={() => {
                            setRepayingBorrowing(b);
                            setRepayAmount(b.balanceDue.toString());
                            setRepaidBy(currentUserName);
                            setRepayDate(new Date().toISOString().split('T')[0]);
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                          title="Record a payment back to this friend"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Pay Back</span>
                        </button>
                      )}

                      <button
                        onClick={() => copyWhatsAppStatement(b)}
                        className={`p-2 border rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          copiedId === b.id
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                        title="Copy Statement for WhatsApp"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{copiedId === b.id ? 'Copied!' : 'WhatsApp'}</span>
                      </button>

                      {b.receiptUrl && (
                        <button
                          onClick={() => onPreviewReceipt(b.receiptUrl!, { title: `Borrowing Receipt: ${b.lenderName}` })}
                          className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          title="View Receipt"
                        >
                          <Receipt className="w-3.5 h-3.5 text-blue-600" />
                        </button>
                      )}

                      {canManage && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete borrowing record for "${b.lenderName}" (₹${b.amount.toLocaleString()})?`)) {
                              onDeleteBorrowing(b.id);
                            }
                          }}
                          className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-transparent hover:border-rose-200 rounded-xl transition-all cursor-pointer"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress Bar & Purpose Note */}
                <div className="p-4 bg-white space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-600">
                      Purpose: <strong className="text-slate-800">{b.purpose || 'Site Cash Flow / Material Advance'}</strong>
                    </span>
                    <span className="font-extrabold text-slate-700">{pct}% Settled</span>
                  </div>

                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isSettled ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-emerald-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>

                  {b.notes && (
                    <p className="text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      Note: {b.notes}
                    </p>
                  )}

                  {/* Repayment History Accordion */}
                  {repaymentsList.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <button
                        onClick={() => toggleHistory(b.id)}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer select-none"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        <span>
                          Repayment History ({repaymentsList.length} installment{repaymentsList.length > 1 ? 's' : ''})
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="mt-3 space-y-2">
                          {repaymentsList.map((r) => (
                            <div
                              key={r.id}
                              className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/70 rounded-xl text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <strong className="text-emerald-700 font-extrabold text-sm">
                                    ₹{r.amount.toLocaleString()}
                                  </strong>
                                  <span className="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 rounded-md text-[10px] font-semibold">
                                    {r.paymentMode}
                                  </span>
                                  {r.referenceNo && (
                                    <span className="text-slate-400 text-[11px]">Ref: {r.referenceNo}</span>
                                  )}
                                </div>
                                <div className="text-slate-500 text-[11px]">
                                  Paid by <strong>{r.repaidBy}</strong> on {r.date}
                                  {r.remarks && ` • "${r.remarks}"`}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {r.receiptUrl && (
                                  <button
                                    onClick={() => onPreviewReceipt(r.receiptUrl!, { title: `Repayment Proof: ₹${r.amount}` })}
                                    className="p-1.5 bg-white border border-slate-200 text-blue-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                                    title="View Repayment Proof"
                                  >
                                    <Receipt className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canManage && (
                                  <button
                                    onClick={() => {
                                      if (window.confirm(`Delete repayment of ₹${r.amount.toLocaleString()}? This will restore the balance owed to ₹${(b.balanceDue + r.amount).toLocaleString()}.`)) {
                                        onDeleteRepayment(r.id);
                                      }
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete Repayment"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal 1: Record New Borrowing */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-slate-100 my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl">
                  <HandCoins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Record New Borrowing</h3>
                  <p className="text-xs text-slate-400">Log cash borrowed from a friend or external source</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBorrowingSubmit} className="space-y-4">
              {/* Project selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Site Project
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                  required
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectName} ({p.siteName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Friend / Lender info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Lender Name (Friend / Source) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar (Friend)"
                    value={lenderName}
                    onChange={(e) => setLenderName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Phone / Contact (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210 or UPI ID"
                    value={lenderContact}
                    onChange={(e) => setLenderContact(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Amount & Borrowed By */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Amount Borrowed (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 50000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Taken By (Partner / Supervisor) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Your Name"
                    value={borrowerName}
                    onChange={(e) => setBorrowerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Borrowing Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Target Repayment Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Purpose */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Purpose / Expense Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Urgent RMC concrete payment for slab casting"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                />
              </div>

              {/* Receipt / Voucher upload */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Attachment Proof (UPI Screenshot / Slip)
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => handleFileUpload(e, 'borrow')}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-600 file:text-white hover:file:bg-amber-700 cursor-pointer"
                />
              </div>

              {/* Extra Notes */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Internal Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Any extra terms or agreement details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Record Borrowing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Record Repayment */}
      {repayingBorrowing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-slate-100 my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Record Loan Repayment</h3>
                  <p className="text-xs text-slate-400">Paying back to {repayingBorrowing.lenderName}</p>
                </div>
              </div>
              <button
                onClick={() => setRepayingBorrowing(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Borrowed:</span>
                <strong className="text-slate-800">₹{repayingBorrowing.totalDue.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Already Repaid:</span>
                <strong className="text-emerald-600">₹{repayingBorrowing.repaidAmount.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-700 font-extrabold">Current Outstanding Balance:</span>
                <strong className="text-rose-600 font-black">₹{repayingBorrowing.balanceDue.toLocaleString()}</strong>
              </div>
            </div>

            <form onSubmit={handleRepaySubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Repayment Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={repayingBorrowing.balanceDue}
                  required
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-emerald-700 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Repayment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={repayDate}
                    onChange={(e) => setRepayDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Paid By (Partner) *
                  </label>
                  <input
                    type="text"
                    required
                    value={repaidBy}
                    onChange={(e) => setRepaidBy(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={repayMode}
                    onChange={(e) => setRepayMode(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                  >
                    <option value="UPI / Bank Transfer">UPI / GPay / PhonePe</option>
                    <option value="NEFT / RTGS / IMPS">NEFT / RTGS / IMPS</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Txn / UTR Ref No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UPI 43109281..."
                    value={repayRef}
                    onChange={(e) => setRepayRef(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Repayment Proof Screenshot (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => handleFileUpload(e, 'repay')}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Remarks / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Settled from client stage milestone 2 payment"
                  value={repayRemarks}
                  onChange={(e) => setRepayRemarks(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRepayingBorrowing(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRepaying}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isRepaying ? 'Processing...' : 'Confirm Repayment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
