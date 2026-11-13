import React, { useState } from 'react';
import { 
  PlusCircle, 
  Trash2, 
  Calendar, 
  Users, 
  TrendingUp, 
  Briefcase, 
  Info, 
  X,
  MapPin,
  IndianRupee 
} from 'lucide-react';
import { Project, LaborExpense, WorkerType, UserRole, PaymentStatus } from '../types';

interface LaborExpenseTrackerProps {
  activeProject: Project | null;
  laborExpenses: LaborExpense[];
  currentUserRole: string;
  canWrite?: boolean;
  currentUserName: string;
  onAddLabor: (laborData: Partial<LaborExpense>) => Promise<void>;
  onSettleLabor?: (laborId: string) => Promise<void>;
}

export default function LaborExpenseTracker({
  activeProject,
  laborExpenses,
  currentUserRole,
  canWrite,
  currentUserName,
  onAddLabor,
  onSettleLabor,
}: LaborExpenseTrackerProps) {

  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form states
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [workerType, setWorkerType] = useState<WorkerType>(WorkerType.MASON);
  const [numWorkers, setNumWorkers] = useState('');
  const [dailyWage, setDailyWage] = useState('');
  const [remarks, setRemarks] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(PaymentStatus.PAID);

  const canEdit = canWrite ?? (currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.MESTRI);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !numWorkers || !dailyWage) return;

    await onAddLabor({
      projectId: activeProject.id,
      date,
      workerType,
      numWorkers: parseInt(numWorkers) || 0,
      dailyWage: parseFloat(dailyWage) || 0,
      remarks,
      paymentStatus,
    });

    setIsFormOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setWorkerType(WorkerType.MASON);
    setNumWorkers('');
    setDailyWage('');
    setRemarks('');
    setPaymentStatus(PaymentStatus.PAID);
  };

  // Filter labor for active project
  const displayProjectId = activeProject?.id || '';
  const filteredLabor = laborExpenses.filter(l => l.projectId === displayProjectId);
  const totalLaborWage = filteredLabor.reduce((sum, l) => sum + l.totalWage, 0);

  return (
    <div id="labor-expense-container" className="space-y-6">
      
      {/* Informational banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-5 border border-slate-100 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Labor Wage Disbursements</h2>
          <p className="text-xs text-slate-400">Track and authorize daily labor disbursements paid on site{activeProject?.assignedMestriName ? ` by ${activeProject.assignedMestriName}` : ''}.</p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
          <div className="text-left sm:text-right">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Paid Wages</span>
            <span className="text-base sm:text-lg font-black text-slate-800 flex items-center sm:justify-end">
              <IndianRupee className="w-4 sm:w-4.5 h-4 sm:h-4.5 mr-0.5 text-slate-500" />
              {totalLaborWage.toLocaleString('en-IN')}
            </span>
          </div>

          {canEdit && activeProject && (
            <button
              id="log-labor-trigger-btn"
              onClick={() => {
                resetForm();
                setIsFormOpen(true);
              }}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs transition-colors cursor-pointer select-none"
            >
              <PlusCircle className="w-4 h-4" /> Add Labor Worksheet
            </button>
          )}
        </div>
      </div>

      {activeProject ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          
          {/* Upsert Labor form (Column 1) */}
          {isFormOpen && canEdit && (
            <div id="labor-upsert-card" className="xl:col-span-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-800 text-sm">
                  Log Labor Attendance & Wages
                </h3>
                <button
                  id="close-labor-form-btn"
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-slate-700">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="wtype-select" className="text-[10px] font-bold text-slate-500 uppercase">Worker Domain *</label>
                    <select
                      id="wtype-select"
                      value={workerType}
                      onChange={(e) => setWorkerType(e.target.value as WorkerType)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 outline-none text-slate-700 font-semibold"
                    >
                      {Object.values(WorkerType).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="ldate-input" className="text-[10px] font-bold text-slate-500 uppercase">Pay Date *</label>
                    <input
                      id="ldate-input"
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="num-workers" className="text-[10px] font-bold text-slate-500 uppercase">Active Workers *</label>
                    <input
                      id="num-workers"
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 5"
                      value={numWorkers}
                      onChange={(e) => setNumWorkers(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 outline-none text-slate-800 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="daily-wage" className="text-[10px] font-bold text-slate-500 uppercase">Daily Wage per Hand (₹) *</label>
                    <input
                      id="daily-wage"
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 900"
                      value={dailyWage}
                      onChange={(e) => setDailyWage(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 outline-none text-slate-800 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="work-remarks" className="text-[10px] font-bold text-slate-500 uppercase">Tasks completed / Remarks</label>
                  <textarea
                    id="work-remarks"
                    rows={2}
                    placeholder="e.g. Concrete curing and leveling tasks completed"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none placeholder-slate-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Expense Payment Status *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      id="labor-pay-status-paid-btn"
                      type="button"
                      onClick={() => setPaymentStatus(PaymentStatus.PAID)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        paymentStatus === PaymentStatus.PAID
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      Paid
                    </button>
                    <button
                      id="labor-pay-status-credit-btn"
                      type="button"
                      onClick={() => setPaymentStatus(PaymentStatus.CREDIT)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        paymentStatus === PaymentStatus.CREDIT
                          ? 'bg-rose-50 border-rose-500 text-rose-700'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      In Credit
                    </button>
                  </div>
                </div>

                {/* Live total widget */}
                {numWorkers && dailyWage && (
                  <div className="bg-red-50/50 border border-red-100 p-3 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-red-700 font-semibold">Total Wages to Debit:</span>
                    <span className="font-extrabold text-red-800 text-sm">
                      ₹{(parseInt(numWorkers) * parseFloat(dailyWage)).toLocaleString('en-IN')}
                    </span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    id="submit-labor-btn"
                    type="submit"
                    className="flex-1 bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer select-none"
                  >
                    Authorize Sheet
                  </button>
                  <button
                    id="cancel-labor-btn"
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Table display matching active project (Column 2/3) */}
          <div className={`${isFormOpen && canEdit ? 'xl:col-span-2' : 'xl:col-span-3'} bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4`}>
            <div className="space-y-1">
              <h3 className="font-extrabold text-slate-800 text-base">Recorded Wage Sheets</h3>
              <p className="text-xs text-slate-400">Detailed wages ledger showing total active workers, daily payouts, and registered tasks on {activeProject.projectName}.</p>
            </div>

            {filteredLabor.length === 0 ? (
              <div className="p-8 sm:p-12 text-center text-slate-400 text-sm">
                No labor worksheets have been logged for this project yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100 no-scrollbar">
                <table className="w-full min-w-[640px] border-collapse text-left text-xs" id="labor-worksheet-table">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-wider text-[10px]">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Worker Domain</th>
                      <th className="px-3 py-3 text-center">Hands on Site</th>
                      <th className="px-4 py-3 text-right">Daily Wage Rate</th>
                      <th className="px-4 py-3">Remarks / Operations done</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Total Debit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                    {filteredLabor.map((lab) => (
                      <tr id={`labor-row-${lab.id}`} key={lab.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-slate-500 font-bold whitespace-nowrap">
                          {lab.date}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {lab.workerType}
                        </td>
                        <td className="px-3 py-3 text-center font-bold text-slate-900 bg-slate-50/20">
                          {lab.numWorkers} Workers
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          ₹{lab.dailyWage.toLocaleString('en-IN')}/day
                        </td>
                        <td className="px-4 py-3 max-w-[200px] truncate text-slate-500" title={lab.remarks}>
                          {lab.remarks || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                              lab.paymentStatus === PaymentStatus.CREDIT
                                ? 'bg-rose-50 text-rose-600 border-rose-100'
                                : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            }`}>
                              {lab.paymentStatus || PaymentStatus.PAID}
                            </span>
                            {canEdit && onSettleLabor && lab.paymentStatus === PaymentStatus.CREDIT && (
                              <button
                                type="button"
                                onClick={() => onSettleLabor(lab.id)}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-bold cursor-pointer"
                              >
                                Mark Paid
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-950 font-black text-sm whitespace-nowrap">
                          ₹{lab.totalWage.toLocaleString('en-IN')}
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
          Please configure or select a project to analyze labor logs.
        </div>
      )}
    </div>
  );
}
