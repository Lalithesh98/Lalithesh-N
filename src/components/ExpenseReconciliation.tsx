import React from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle,
  FileCheck, 
  FileWarning, 
  TrendingDown, 
  Scale, 
  IndianRupee,
  Layers,
  ArrowDownCircle,
  ArrowUpCircle
} from 'lucide-react';
import { Project, Advance, MaterialPurchase, LaborExpense, DailyExpense } from '../types';

interface ExpenseReconciliationProps {
  activeProject: Project | null;
  advances: Advance[];
  purchases: MaterialPurchase[];
  laborExpenses: LaborExpense[];
  dailyExpenses: DailyExpense[];
}

export default function ExpenseReconciliation({
  activeProject,
  advances,
  purchases,
  laborExpenses,
  dailyExpenses,
}: ExpenseReconciliationProps) {

  if (!activeProject) {
    return (
      <div className="py-8 text-center text-slate-400">
        Please configure or select a project to analyze accounts reconciliation.
      </div>
    );
  }

  const pId = activeProject.id;

  // Filter datasets
  const projectAdvances = advances.filter(a => a.projectId === pId);
  const projectPurchases = purchases.filter(m => m.projectId === pId && !m.isDeleted);
  const projectLabor = laborExpenses.filter(l => l.projectId === pId);
  const projectDaily = dailyExpenses.filter(d => d.projectId === pId);

  // Totals
  const totalAdvances = projectAdvances.reduce((sum, a) => sum + a.amount, 0);
  const totalMaterial = projectPurchases.reduce((sum, m) => sum + m.totalAmount, 0);
  const totalLabor = projectLabor.reduce((sum, l) => sum + l.totalWage, 0);
  const totalDaily = projectDaily.reduce((sum, d) => sum + d.amount, 0);
  const totalExpenses = totalMaterial + totalLabor + totalDaily;

  const remainingBalance = totalAdvances - totalExpenses;

  // Audit triggers
  const purchasesWithoutBills = projectPurchases.filter(p => !p.billUrl).length;
  const dailyWithoutBills = projectDaily.filter(d => !d.billUrl).length;
  const totalMissingDocuments = purchasesWithoutBills + dailyWithoutBills;

  const totalDocumentsAttached = projectPurchases.filter(p => p.billUrl).length + projectDaily.filter(d => d.billUrl).length;

  const excessSpending = totalExpenses > totalAdvances;

  return (
    <div id="reconciliation-container" className="space-y-6">
      
      {/* Upper info card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 border border-slate-100 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Financial Audit & Reconciliation</h2>
          <p className="text-xs text-slate-400">Main source-of-truth reconciliation ledger verifying Site advances against actual recorded disbursements.</p>
        </div>
        <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-2">
          <Scale className="w-5 h-5 text-emerald-600" />
          <span className="text-xs font-bold text-slate-700">Account status: Reconciled</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Quick Audit Highlights widgets */}
        <div className="space-y-4 lg:col-span-1">
          
          {/* Reserve Health Block */}
          <div className={`p-5 rounded-2xl border ${
            excessSpending ? 'bg-red-50/50 border-red-100 text-red-700' : 'bg-emerald-50/50 border-emerald-100 text-emerald-800'
          }`}>
            <div className="flex items-center gap-2 mb-2 font-extrabold text-sm uppercase tracking-wider">
              {excessSpending ? <AlertCircle className="w-5 h-5 text-red-600" /> : <CheckCircle className="w-5 h-5 text-emerald-600" />}
              <span>Site Capital Status</span>
            </div>
            {excessSpending ? (
              <div className="space-y-1">
                <p className="text-sm font-bold">Excess Spending Detected!</p>
                <p className="text-xs text-slate-500">Mestri Nagaraj S has recorded on-site purchases which exceed the total advances received by <strong className="text-red-700">₹{Math.abs(remainingBalance).toLocaleString()}</strong>. Please disburse advance capital immediately.</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-bold">Reserves Balanced</p>
                <p className="text-xs text-slate-600">The site supervisor operates within the provided advance bounds, maintaining a safety margin of <strong className="text-emerald-800">₹{remainingBalance.toLocaleString()}</strong>.</p>
              </div>
            )}
          </div>

          {/* Missing Documents Check Block */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Operational Audit Checklist</h4>
            
            <div className="space-y-3">
              {/* Stat 1: Missing vouchers */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-50 bg-slate-50/20">
                <div className="flex items-center gap-2">
                  {totalMissingDocuments > 0 ? (
                    <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                      <FileWarning className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                      <FileCheck className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Missing Receipts</span>
                    <span className="text-[10px] text-slate-400 font-semibold">{totalMissingDocuments} Transactions need scans</span>
                  </div>
                </div>
                {totalMissingDocuments > 0 ? (
                  <span className="bg-rose-50 text-rose-600 text-[10px] font-black px-2.5 py-1 rounded-full border border-rose-100">
                    {totalMissingDocuments} Missing
                  </span>
                ) : (
                  <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-100">
                    Compliant
                  </span>
                )}
              </div>

              {/* Stat 2: Document Compliance Percentage */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-50 bg-slate-50/20">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-sky-50 text-sky-600 rounded-lg">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Receipt Coverage</span>
                    <span className="text-[10px] text-slate-400 font-semibold">{totalDocumentsAttached} documents uploaded</span>
                  </div>
                </div>
                <span className="text-slate-800 font-black text-xs">
                  {projectPurchases.length + projectDaily.length > 0
                    ? ((totalDocumentsAttached / (projectPurchases.length + projectDaily.length)) * 100).toFixed(0)
                    : 100}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Core Reconciliation Ledger (Column 2/3) */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm lg:col-span-2 space-y-5">
          <div className="space-y-1">
            <h3 className="font-extrabold text-slate-800 text-base">Reconciliation Income vs Expense Statement</h3>
            <p className="text-xs text-slate-400 text-slate-400">Continuous monitoring of available funds versus structural and operational debits.</p>
          </div>

          <div className="rounded-xl border border-slate-100 overflow-hidden">
            <table className="w-full border-collapse text-left text-xs" id="recon-statement-table">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-wider text-[10px]">
                  <th className="px-5 py-3.5">Reconciliation Description Line</th>
                  <th className="px-5 py-3.5 text-right">Debit Selection (Dr)</th>
                  <th className="px-5 py-3.5 text-right">Credit Selection (Cr)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                
                {/* Row 1: Total advances given */}
                <tr className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-5 py-4 flex items-center gap-2">
                    <ArrowDownCircle className="w-4.5 h-4.5 text-emerald-500" />
                    <div>
                      <span className="font-bold text-slate-800 block">Total Advances Issued</span>
                      <span className="text-[10px] text-slate-400 font-semibold">Funds transferred to Nagaraj S (Mestri)</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right text-slate-400">-</td>
                  <td className="px-5 py-4 text-right text-emerald-600 font-extrabold text-sm">
                    ₹{totalAdvances.toLocaleString('en-IN')}
                  </td>
                </tr>

                {/* Row 2: Materials Expense */}
                <tr className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-5 py-4 flex items-center gap-2">
                    <ArrowUpCircle className="w-4.5 h-4.5 text-blue-500" />
                    <div>
                      <span className="font-bold text-slate-800 block">Material Expense debit</span>
                      <span className="text-[10px] text-slate-400 font-semibold">Bulk materials including cement, sand, brick and metals</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right text-slate-800 font-bold">
                    ₹{totalMaterial.toLocaleString('en-IN')}
                  </td>
                  <td className="px-5 py-4 text-right text-slate-400">-</td>
                </tr>

                {/* Row 3: Labor Expense */}
                <tr className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-5 py-4 flex items-center gap-2">
                    <ArrowUpCircle className="w-4.5 h-4.5 text-orange-500" />
                    <div>
                      <span className="font-bold text-slate-800 block">Labor wages debit</span>
                      <span className="text-[10px] text-slate-400 font-semibold">Wages drawn for masonry, electrical and on-site helpers</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right text-slate-800 font-bold">
                    ₹{totalLabor.toLocaleString('en-IN')}
                  </td>
                  <td className="px-5 py-4 text-right text-slate-400">-</td>
                </tr>

                {/* Row 4: Site Expense */}
                <tr className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-5 py-4 flex items-center gap-2">
                    <ArrowUpCircle className="w-4.5 h-4.5 text-emerald-500" />
                    <div>
                      <span className="font-bold text-slate-800 block">Other site expenses debit</span>
                      <span className="text-[10px] text-slate-400 font-semibold">Operating expenses transport, diesel machinery and curing water</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right text-slate-800 font-bold">
                    ₹{totalDaily.toLocaleString('en-IN')}
                  </td>
                  <td className="px-5 py-4 text-right text-slate-400">-</td>
                </tr>

                {/* Total summarized line */}
                <tr className="bg-slate-900 text-white">
                  <td className="px-5 py-4">
                    <span className="font-extrabold uppercase text-slate-200 block text-[10px] tracking-wider">Summarized Net Totals</span>
                    <span className="text-[10px] text-slate-440 font-semibold">Total active operating debits vs received credits</span>
                  </td>
                  <td className="px-5 py-4 text-right font-black text-rose-300 text-sm">
                    ₹{totalExpenses.toLocaleString('en-IN')}
                  </td>
                  <td className="px-5 py-4 text-right font-black text-emerald-400 text-sm">
                    ₹{totalAdvances.toLocaleString('en-IN')}
                  </td>
                </tr>

                {/* Balance Line */}
                <tr className={`${excessSpending ? 'bg-red-50' : 'bg-emerald-50'}`}>
                  <td className="px-5 py-4">
                    <span className="font-black text-slate-800 uppercase tracking-wide text-[10px] block">Reconciliation Reserve Balance</span>
                    <span className="text-[10px] text-slate-500">Unspent advanced reserve currently remaining on site</span>
                  </td>
                  <td colSpan={2} className={`px-5 py-4 text-right font-black text-base ${
                    excessSpending ? 'text-red-700' : 'text-emerald-800'
                  }`}>
                    {excessSpending ? '-' : ''}₹{Math.abs(remainingBalance).toLocaleString('en-IN')}
                  </td>
                </tr>

              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
