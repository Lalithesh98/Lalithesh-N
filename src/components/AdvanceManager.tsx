import React, { useState } from 'react';
import { 
  PlusCircle, 
  Wallet, 
  Calendar, 
  FileText, 
  CreditCard, 
  IndianRupee, 
  ChevronRight, 
  X,
  AlertCircle 
} from 'lucide-react';
import { Project, Advance, UserRole, MaterialPurchase, LaborExpense, DailyExpense } from '../types';

interface AdvanceManagerProps {
  activeProject: Project | null;
  projects: Project[];
  advances: Advance[];
  purchases: MaterialPurchase[];
  laborExpenses: LaborExpense[];
  dailyExpenses: DailyExpense[];
  currentUserRole: UserRole;
  currentUserName: string;
  onAddAdvance: (advanceData: Partial<Advance>) => Promise<void>;
}

export default function AdvanceManager({
  activeProject,
  projects,
  advances,
  purchases,
  laborExpenses,
  dailyExpenses,
  currentUserRole,
  currentUserName,
  onAddAdvance,
}: AdvanceManagerProps) {

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [projectId, setProjectId] = useState(activeProject?.id || '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('UPI / Bank Transfer');
  const [remarks, setRemarks] = useState('');
  const [receivedBy, setReceivedBy] = useState('Nagaraj S (Site Supervisor)');

  const isAdmin = currentUserRole === UserRole.ADMIN;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !amount || !receivedBy) return;

    await onAddAdvance({
      projectId,
      amount: parseFloat(amount) || 0,
      date,
      givenBy: currentUserName,
      receivedBy,
      paymentMode,
      remarks,
    });

    setIsFormOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setPaymentMode('UPI / Bank Transfer');
    setRemarks('');
    setReceivedBy('Nagaraj S (Site Supervisor)');
  };

  // Compute calculated metrics
  const displayProjectId = activeProject?.id || '';
  const filteredAdvances = advances.filter(a => a.projectId === displayProjectId);
  
  const totalAdvancesGiven = filteredAdvances.reduce((sum, a) => sum + a.amount, 0);
  
  const projectPurchases = purchases.filter(m => m.projectId === displayProjectId && !m.isDeleted);
  const projectLabor = laborExpenses.filter(l => l.projectId === displayProjectId);
  const projectDaily = dailyExpenses.filter(d => d.projectId === displayProjectId);

  const totalMaterial = projectPurchases.reduce((sum, m) => sum + m.totalAmount, 0);
  const totalLabor = projectLabor.reduce((sum, l) => sum + l.totalWage, 0);
  const totalDaily = projectDaily.reduce((sum, d) => sum + d.amount, 0);
  const totalSubmittedExpenses = totalMaterial + totalLabor + totalDaily;

  const remainingAdvance = totalAdvancesGiven - totalSubmittedExpenses;

  return (
    <div id="advance-manager-container" className="space-y-6">
      
      {/* Dynamic Summary Ledger Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Total advances card */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Advances Disbursed</span>
            <span className="p-1 px-2.5 bg-slate-800 rounded-lg text-emerald-400 text-[10px] font-black uppercase">Cr</span>
          </div>
          <div className="mt-4">
            <h4 className="text-3xl font-black flex items-center tracking-tight">
              <IndianRupee className="w-6 h-6 text-slate-400 mr-0.5" />
              {totalAdvancesGiven.toLocaleString('en-IN')}
            </h4>
            <p className="text-[10px] text-slate-400 mt-1 font-semibold">{filteredAdvances.length} Advance logs registered</p>
          </div>
        </div>

        {/* Expenses submitted card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Mestri Expense Submitted</span>
            <span className="p-1 px-2.5 bg-slate-50 text-red-500 rounded-lg text-[10px] font-black uppercase">Dr</span>
          </div>
          <div className="mt-4">
            <h4 className="text-3xl font-black text-slate-800 flex items-center tracking-tight">
              <IndianRupee className="w-6 h-6 text-slate-300 mr-0.5" />
              {totalSubmittedExpenses.toLocaleString('en-IN')}
            </h4>
            <p className="text-[10px] text-slate-400 mt-1 font-semibold">Includes Material, Labor & site accounts</p>
          </div>
        </div>

        {/* Remaining balance card */}
        <div className={`rounded-2xl p-5 border shadow-xs flex flex-col justify-between ${
          remainingAdvance < 10000 ? 'bg-red-50/50 border-red-100' : 'bg-emerald-50/40 border-emerald-100'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Calculated Reserve Balance</span>
            <span className={`p-1 px-2.5 rounded-lg text-[10px] font-black uppercase ${
              remainingAdvance < 10000 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
            }`}>Bal</span>
          </div>
          <div className="mt-4">
            <h4 className={`text-3xl font-black flex items-center tracking-tight ${
              remainingAdvance < 10000 ? 'text-red-600' : 'text-emerald-700'
            }`}>
              <IndianRupee className="w-6 h-6 text-opacity-50 mr-0.5" />
              {remainingAdvance.toLocaleString('en-IN')}
            </h4>
            {remainingAdvance < 10000 ? (
              <p className="text-[10px] text-red-500 mt-1 font-black leading-none flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Low Site Capital Reserve!
              </p>
            ) : (
              <p className="text-[10px] text-emerald-600 mt-1 font-semibold">Sufficient operational buffer</p>
            )}
          </div>
        </div>
      </div>

      {activeProject ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          
          {/* Action Trigger forms */}
          {isAdmin && (
            <div className="xl:col-span-1 bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-emerald-500" /> Disburse New Advance
                </h3>
                {isFormOpen && (
                  <button
                    id="close-adv-form-btn"
                    onClick={() => setIsFormOpen(false)}
                    className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {!isFormOpen ? (
                <div className="py-4 text-center">
                  <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                    Issue monetary advances to Site Supervisor (Mestri) for purchasing materials or hiring quick hands on site.
                  </p>
                  <button
                    id="open-disburse-form-btn"
                    onClick={() => {
                      setProjectId(activeProject.id);
                      setIsFormOpen(true);
                    }}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer select-none"
                  >
                    Disburse Cash / Wire
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 text-slate-700">
                  <div className="space-y-1">
                    <label htmlFor="adv-proj-select" className="text-[10px] font-bold text-slate-400 uppercase">Target Project Site</label>
                    <select
                      id="adv-proj-select"
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.projectName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="adv-received-by" className="text-[10px] font-bold text-slate-400 uppercase">Supervisor / Mestri</label>
                    <input
                      id="adv-received-by"
                      type="text"
                      placeholder="e.g. Nagaraj S"
                      required
                      value={receivedBy}
                      onChange={(e) => setReceivedBy(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="adv-amt-input" className="text-[10px] font-bold text-slate-400 uppercase">Disbursed Amount (₹) *</label>
                    <input
                      id="adv-amt-input"
                      type="number"
                      required
                      min="1"
                      placeholder="Amount in Rupees"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none focus:border-emerald-500 font-bold text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="adv-date-input" className="text-[10px] font-bold text-slate-400 uppercase">Payment Date</label>
                    <input
                      id="adv-date-input"
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="adv-pay-mode" className="text-[10px] font-bold text-slate-400 uppercase">Payment Mode</label>
                    <select
                      id="adv-pay-mode"
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none"
                    >
                      <option value="UPI / Bank Transfer">UPI / Bank Transfer</option>
                      <option value="Cash Disbursement">Cash Disbursement</option>
                      <option value="Cheque Payee">Cheque Payee</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="adv-remarks" className="text-[10px] font-bold text-slate-400 uppercase">Remarks / notes</label>
                    <textarea
                      id="adv-remarks"
                      rows={2}
                      placeholder="Enter specific allocation purpose..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none placeholder-slate-400"
                    />
                  </div>

                  <button
                    id="submit-disburse-btn"
                    type="submit"
                    className="w-full bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer select-none"
                  >
                    Confirm Disbursement
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Table list of recorded advances */}
          <div className={`${isAdmin ? 'xl:col-span-2' : 'xl:col-span-3'} bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4`}>
            <div className="space-y-1">
              <h3 className="font-extrabold text-slate-800 text-base">Advance Ledger List</h3>
              <p className="text-xs text-slate-400">Chronological list of all advances issued to site supervisor Nagaraj S for project {activeProject.projectName}.</p>
            </div>

            {filteredAdvances.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                No advances have been logged for this project yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full border-collapse text-left text-xs" id="adv-ledger-table">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-wider text-[10px]">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Issuer (Given By)</th>
                      <th className="px-4 py-3">Recipient</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Remarks</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                    {filteredAdvances.map((adv) => (
                      <tr id={`adv-row-${adv.id}`} key={adv.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-slate-500 font-bold whitespace-nowrap">
                          {adv.date}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-800 font-semibold">{adv.givenBy}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {adv.receivedBy}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="p-1 px-2 bg-slate-100 text-slate-600 rounded-md text-[9px] font-bold">
                            {adv.paymentMode}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[180px] truncate text-slate-500" title={adv.remarks}>
                          {adv.remarks || '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-950 font-black text-sm whitespace-nowrap">
                          ₹{adv.amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-slate-400">
          Please configure or select a project to analyze advance balances.
        </div>
      )}
    </div>
  );
}
