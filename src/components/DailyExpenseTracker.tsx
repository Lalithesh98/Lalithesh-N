import React, { useState } from 'react';
import { 
  PlusCircle, 
  Eye, 
  Calendar, 
  MapPin, 
  Tag, 
  FileText, 
  X,
  UploadCloud,
  FileCheck,
  IndianRupee,
  Coffee,
  Fuel,
  Truck,
  Droplet,
  Compass,
  DollarSign
} from 'lucide-react';
import { Project, DailyExpense, DailyExpenseCategory, UserRole, PaymentStatus } from '../types';

interface DailyExpenseTrackerProps {
  activeProject: Project | null;
  dailyExpenses: DailyExpense[];
  currentUserRole: UserRole;
  currentUserName: string;
  onAddDailyExpense: (dailyData: Partial<DailyExpense>) => Promise<void>;
  onPreviewBill: (billUrl: string) => void;
}

export default function DailyExpenseTracker({
  activeProject,
  dailyExpenses,
  currentUserRole,
  currentUserName,
  onAddDailyExpense,
  onPreviewBill,
}: DailyExpenseTrackerProps) {

  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form states
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<DailyExpenseCategory>(DailyExpenseCategory.MISCELLANEOUS);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [billUrl, setBillUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(PaymentStatus.PAID);

  const canEdit = currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.MESTRI;

  // Handle bill file upload via FileReader (converting to Base64 dataURL)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBillUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !description.trim() || !amount) return;

    await onAddDailyExpense({
      projectId: activeProject.id,
      date,
      category,
      description,
      amount: parseFloat(amount) || 0,
      billUrl,
      paymentStatus,
    });

    setIsFormOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setCategory(DailyExpenseCategory.MISCELLANEOUS);
    setDescription('');
    setAmount('');
    setBillUrl('');
    setFileName('');
    setPaymentStatus(PaymentStatus.PAID);
  };

  // Filter daily expenses for active project
  const displayProjectId = activeProject?.id || '';
  const filteredDaily = dailyExpenses.filter(d => d.projectId === displayProjectId);
  const totalDailyAmt = filteredDaily.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div id="daily-expense-container" className="space-y-6">
      
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 border border-slate-100 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Daily Site Vouchers</h2>
          <p className="text-xs text-slate-400">Record local operations invoices such as transport sand, machine diesel, curated tanker water, and team refreshments.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Daily Expenses Debit</span>
            <span className="text-lg font-black text-slate-800 flex items-center justify-end">
              <IndianRupee className="w-4.5 h-4.5 mr-0.5 text-slate-500" />
              {totalDailyAmt.toLocaleString('en-IN')}
            </span>
          </div>

          {canEdit && activeProject && (
            <button
              id="log-daily-trigger-btn"
              onClick={() => {
                resetForm();
                setIsFormOpen(true);
              }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer select-none"
            >
              <PlusCircle className="w-4 h-4" /> Log Site Voucher
            </button>
          )}
        </div>
      </div>

      {activeProject ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          
          {/* Form component (Column 1) */}
          {isFormOpen && canEdit && (
            <div id="daily-upsert-card" className="xl:col-span-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-800 text-sm">
                  Log Site Miscellaneous Expense
                </h3>
                <button
                  id="close-daily-form-btn"
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
                    <label htmlFor="dcat-select" className="text-[10px] font-bold text-slate-500 uppercase">Expense Category *</label>
                    <select
                      id="dcat-select"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as DailyExpenseCategory)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 outline-none text-slate-700 font-semibold"
                    >
                      {Object.values(DailyExpenseCategory).map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="ddate-input" className="text-[10px] font-bold text-slate-500 uppercase">Occurrence Date *</label>
                    <input
                      id="ddate-input"
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="damount-input" className="text-[10px] font-bold text-slate-500 uppercase">Debited Amount (₹) *</label>
                  <input
                    id="damount-input"
                    type="number"
                    required
                    min="1"
                    placeholder="Wired/Cash amount in INR"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none font-bold text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="ddesc" className="text-[10px] font-bold text-slate-500 uppercase">Description / Purpose *</label>
                  <textarea
                    id="ddesc"
                    required
                    rows={2}
                    placeholder="e.g. Concrete curing tanker (2 loads), machine grease oil"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none placeholder-slate-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Voucher Payment Status *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      id="daily-pay-status-paid-btn"
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
                      id="daily-pay-status-credit-btn"
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

                {/* Voucher file upload picker */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Voucher / Bill Upload (JPG, PNG, PDF)</span>
                  <div className="border border-dashed border-slate-200 hover:border-emerald-400 rounded-xl p-4 bg-slate-50 hover:bg-emerald-50/10 transition-colors relative flex flex-col items-center justify-center cursor-pointer text-center group">
                    <input
                      id="daily-file-input"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    {fileName ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
                        <FileCheck className="w-4 h-4 text-emerald-600" />
                        <span className="truncate max-w-[180px]">{fileName}</span>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="w-8 h-8 text-slate-300 group-hover:text-emerald-500 transition-colors mb-1.5" />
                        <p className="text-xs text-slate-500 font-semibold">Upload scan copy / cash memo</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">JPG, PNG, PDF formats</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    id="submit-daily-btn"
                    type="submit"
                    className="flex-1 bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer select-none"
                  >
                    Commit Voucher
                  </button>
                  <button
                    id="cancel-daily-btn"
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
          <div className={`${isFormOpen && canEdit ? 'xl:col-span-2' : 'xl:col-span-3'} bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4`}>
            <div className="space-y-1">
              <h3 className="font-extrabold text-slate-800 text-base">Recorded Site Vouchers</h3>
              <p className="text-xs text-slate-400">Detailed list of site-running miscellaneous purchases and bills logged for project {activeProject.projectName}.</p>
            </div>

            {filteredDaily.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                No site vouchers have been logged for this project yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                {filteredDaily.map((d) => {
                  let icon = <Compass className="w-4 h-4 text-blue-500" />;
                  if (d.category === "Transport") icon = <Truck className="w-4 h-4 text-indigo-500" />;
                  if (d.category === "Food") icon = <Coffee className="w-4 h-4 text-emerald-500" />;
                  if (d.category === "Water") icon = <Droplet className="w-4 h-4 text-sky-500" />;
                  if (d.category === "Fuel") icon = <Fuel className="w-4 h-4 text-rose-500" />;

                  return (
                    <div
                      id={`daily-voucher-card-${d.id}`}
                      key={d.id}
                      className="p-4 rounded-2xl border border-slate-100 bg-slate-50/20 hover:border-slate-200 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-white rounded-lg shadow-xs">{icon}</div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">{d.category}</span>
                              <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md border ${
                                d.paymentStatus === PaymentStatus.CREDIT
                                  ? 'bg-rose-50 text-rose-650 border-rose-100'
                                  : 'bg-emerald-50 text-emerald-650 border-emerald-100'
                              }`}>
                                {d.paymentStatus || PaymentStatus.PAID}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-semibold block">{d.date}</span>
                          </div>
                        </div>
                        <span className="text-right font-black text-slate-900 text-sm whitespace-nowrap">
                          ₹{d.amount.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 font-bold leading-relaxed">{d.description}</p>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-50 pt-2 pb-0.5 font-medium">
                        <span>Logger: <strong className="text-slate-600 truncate">{d.enteredBy}</strong></span>
                        {d.billUrl && (
                          <button
                            id={`preview-voucher-btn-${d.id}`}
                            onClick={() => onPreviewBill(d.billUrl!)}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 text-sky-600 font-bold rounded-lg transition-colors cursor-pointer text-[9px]"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Voucher
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-slate-400">
          Please configure or select a project to analyze miscellaneous sitelog.
        </div>
      )}
    </div>
  );
}
