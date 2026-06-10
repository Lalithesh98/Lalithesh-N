import React, { useState } from 'react';
import { 
  PlusCircle, 
  Trash2, 
  Eye, 
  Calendar, 
  Tag, 
  Layers, 
  Truck, 
  FileText, 
  DollarSign, 
  X,
  UploadCloud,
  FileCheck,
  IndianRupee,
  Activity
} from 'lucide-react';
import { Project, MaterialPurchase, MaterialCategory, UserRole, PaymentStatus } from '../types';

interface MaterialPurchaseTrackerProps {
  activeProject: Project | null;
  purchases: MaterialPurchase[];
  currentUserRole: UserRole;
  currentUserName: string;
  onAddPurchase: (purchaseData: Partial<MaterialPurchase>) => Promise<void>;
  onDeletePurchase: (purchaseId: string) => Promise<void>;
  onPreviewBill: (billUrl: string) => void;
}

export default function MaterialPurchaseTracker({
  activeProject,
  purchases,
  currentUserRole,
  currentUserName,
  onAddPurchase,
  onDeletePurchase,
  onPreviewBill,
}: MaterialPurchaseTrackerProps) {

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<MaterialCategory>(MaterialCategory.CEMENT);
  const [materialName, setMaterialName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('Bags');
  const [supplier, setSupplier] = useState('');
  const [rate, setRate] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [billUrl, setBillUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(PaymentStatus.PAID);

  // New states for customizable splits
  const [paymentMode, setPaymentMode] = useState<'PAID' | 'CREDIT' | 'SPLIT'>('PAID');
  const [customPaidAmount, setCustomPaidAmount] = useState('');
  const [customCreditAmount, setCustomCreditAmount] = useState('');

  // Transport and extra expenses states
  const [transportCharges, setTransportCharges] = useState('');
  const [extraExpenses, setExtraExpenses] = useState('');
  const [extraExpensesRemarks, setExtraExpensesRemarks] = useState('');

  const canEdit = currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.MESTRI;

  // Sync helpers for custom split
  const handlePaidAmountChange = (valStr: string, total: number) => {
    setCustomPaidAmount(valStr);
    const num = parseFloat(valStr) || 0;
    const leftover = Math.max(0, total - num);
    setCustomCreditAmount(leftover.toFixed(2));
  };

  const handleCreditAmountChange = (valStr: string, total: number) => {
    setCustomCreditAmount(valStr);
    const num = parseFloat(valStr) || 0;
    const leftover = Math.max(0, total - num);
    setCustomPaidAmount(leftover.toFixed(2));
  };

  const handleCategoryChange = (cat: MaterialCategory) => {
    setCategory(cat);
    if (cat === MaterialCategory.BARBENDING) {
      setUnit('Feet');
      if (!materialName || materialName.trim() === '') {
        setMaterialName('Steel Barbending Labor Work');
      }
    } else {
      if (unit === 'Feet' && cat === MaterialCategory.CEMENT) {
        setUnit('Bags');
      }
    }
  };

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

  const handleEditClick = (p: MaterialPurchase) => {
    setEditingId(p.id);
    setDate(p.date);
    setCategory(p.category);
    setMaterialName(p.materialName);
    setQuantity(p.quantity.toString());
    setUnit(p.unit);
    setSupplier(p.supplier);
    setRate(p.rate.toString());
    setInvoiceNo(p.invoiceNo);
    setBillUrl(p.billUrl || '');
    setFileName(p.billUrl ? 'Attached_Bill.png' : '');
    setTransportCharges(p.transportCharges ? p.transportCharges.toString() : '');
    setExtraExpenses(p.extraExpenses ? p.extraExpenses.toString() : '');
    setExtraExpensesRemarks(p.extraExpensesRemarks || '');
    
    // Determine payment mode based on paidAmount / creditAmount / paymentStatus
    const originalTotal = p.totalAmount;
    if (p.paidAmount !== undefined && p.creditAmount !== undefined && p.paidAmount > 0 && p.creditAmount > 0) {
      setPaymentMode('SPLIT');
      setCustomPaidAmount(p.paidAmount.toString());
      setCustomCreditAmount(p.creditAmount.toString());
      setPaymentStatus(PaymentStatus.PAID);
    } else if (p.paymentStatus === PaymentStatus.CREDIT || (p.creditAmount !== undefined && p.creditAmount === originalTotal)) {
      setPaymentMode('CREDIT');
      setCustomPaidAmount('');
      setCustomCreditAmount('');
      setPaymentStatus(PaymentStatus.CREDIT);
    } else {
      setPaymentMode('PAID');
      setCustomPaidAmount('');
      setCustomCreditAmount('');
      setPaymentStatus(PaymentStatus.PAID);
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !materialName.trim() || !quantity || !rate) return;

    const qtyVal = parseFloat(quantity) || 0;
    const rateVal = parseFloat(rate) || 0;
    const transportVal = parseFloat(transportCharges) || 0;
    const extraVal = parseFloat(extraExpenses) || 0;
    const computedTotal = (qtyVal * rateVal) + transportVal + extraVal;

    let finalPaidAmount = computedTotal;
    let finalCreditAmount = 0;
    let finalPaymentStatus = PaymentStatus.PAID;

    if (paymentMode === 'PAID') {
      finalPaidAmount = computedTotal;
      finalCreditAmount = 0;
      finalPaymentStatus = PaymentStatus.PAID;
    } else if (paymentMode === 'CREDIT') {
      finalPaidAmount = 0;
      finalCreditAmount = computedTotal;
      finalPaymentStatus = PaymentStatus.CREDIT;
    } else {
      // Split payment mode
      const userPaid = parseFloat(customPaidAmount) || 0;
      finalPaidAmount = userPaid;
      finalCreditAmount = Math.max(0, computedTotal - userPaid);
      // Backwards compatible paymentStatus check
      finalPaymentStatus = finalCreditAmount > 0 && finalPaidAmount === 0 
        ? PaymentStatus.CREDIT 
        : PaymentStatus.PAID;
    }

    await onAddPurchase({
      id: editingId || undefined,
      projectId: activeProject.id,
      date,
      category,
      materialName,
      quantity: qtyVal,
      unit,
      supplier,
      rate: rateVal,
      invoiceNo,
      billUrl,
      paymentStatus: finalPaymentStatus,
      paidAmount: finalPaidAmount,
      creditAmount: finalCreditAmount,
      transportCharges: transportVal,
      extraExpenses: extraVal,
      extraExpensesRemarks: extraExpensesRemarks,
    });

    setIsFormOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setDate(new Date().toISOString().split('T')[0]);
    setCategory(MaterialCategory.CEMENT);
    setMaterialName('');
    setQuantity('');
    setUnit('Bags');
    setSupplier('');
    setRate('');
    setInvoiceNo('');
    setBillUrl('');
    setFileName('');
    setPaymentStatus(PaymentStatus.PAID);
    setPaymentMode('PAID');
    setCustomPaidAmount('');
    setCustomCreditAmount('');
    setTransportCharges('');
    setExtraExpenses('');
    setExtraExpensesRemarks('');
  };

  // Filter purchases for active project
  const activeProjectId = activeProject?.id || '';
  const filteredPurchases = purchases.filter(
    p => p.projectId === activeProjectId && !p.isDeleted
  );

  const totalSpentMat = filteredPurchases.reduce((sum, p) => sum + p.totalAmount, 0);

  // Barbending statistics calculations
  const barbendingPurchases = filteredPurchases.filter(p => p.category === MaterialCategory.BARBENDING);
  const totalBarbFeet = barbendingPurchases.reduce((sum, p) => sum + p.quantity, 0);
  const totalBarbCost = barbendingPurchases.reduce((sum, p) => sum + p.totalAmount, 0);

  const totalBarbPaid = barbendingPurchases.reduce((sum, p) => {
    if (p.paidAmount !== undefined) return sum + p.paidAmount;
    return sum + (p.paymentStatus !== PaymentStatus.CREDIT ? p.totalAmount : 0);
  }, 0);

  const totalBarbCredit = barbendingPurchases.reduce((sum, p) => {
    if (p.creditAmount !== undefined) return sum + p.creditAmount;
    return sum + (p.paymentStatus === PaymentStatus.CREDIT ? p.totalAmount : 0);
  }, 0);

  return (
    <div id="material-purchase-container" className="space-y-6">
      
      {/* Top informational rail */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 border border-slate-100 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Material Purchases Log</h2>
          <p className="text-xs text-slate-400">Track structural purchases including concrete sand, steel rebars, cement, plumb assets, paints and hardware.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Material Spending</span>
            <span className="text-lg font-black text-slate-800 flex items-center justify-end">
              <IndianRupee className="w-4.5 h-4.5 mr-0.5 text-slate-500" />
              {totalSpentMat.toLocaleString('en-IN')}
            </span>
          </div>

          {canEdit && activeProject && (
            <button
               id="log-purchase-trigger-btn"
               onClick={() => {
                 resetForm();
                 setIsFormOpen(true);
               }}
               className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer select-none"
            >
              <PlusCircle className="w-4 h-4" /> Log Purchase
            </button>
          )}
        </div>
      </div>

      {/* Barbending Labor Tracker Box */}
      {activeProject && barbendingPurchases.length > 0 && (
        <div id="barbending-summary-card" className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-5 border border-indigo-500/30 shadow-md space-y-3.5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] select-none pointer-events-none">
            <Layers className="w-24 h-24 text-white" />
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-indigo-500/20">
            <div>
              <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest block">Contractor Ledger</span>
              <h3 className="font-extrabold text-white text-base">Bar-bending Labor Breakdown</h3>
            </div>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 px-2.5 py-1 rounded-full font-bold">
              {barbendingPurchases.length} Log Entries
            </span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
            <div className="space-y-0.5">
              <span className="text-[10px] text-indigo-200/80 block uppercase font-bold tracking-wider">Total Length Work</span>
              <span className="text-lg font-black tracking-tight flex items-baseline">
                {totalBarbFeet.toLocaleString('en-IN')} 
                <span className="text-xs font-semibold text-indigo-300 ml-1">Feet</span>
              </span>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-indigo-200/80 block uppercase font-bold tracking-wider">Total Charged Value</span>
              <span className="text-lg font-black tracking-tight text-amber-300">₹{totalBarbCost.toLocaleString('en-IN')}</span>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-indigo-200/80 block uppercase font-bold tracking-wider">Disbursed (Paid)</span>
              <span className="text-lg font-black tracking-tight text-emerald-400">₹{totalBarbPaid.toLocaleString('en-IN')}</span>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-indigo-200/80 block uppercase font-bold tracking-wider font-extrabold text-orange-200">Pending (In Credit)</span>
              <span className="text-lg font-black tracking-tight text-rose-400">₹{totalBarbCredit.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}

      {activeProject ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          
          {/* Upsert Modal Card (Column 1) */}
          {isFormOpen && canEdit && (
            <div id="purchase-upsert-card" className="xl:col-span-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-800 text-sm">
                  {editingId ? 'Modify Material Log' : 'Log New Material Purchase'}
                </h3>
                <button
                  id="close-upsert-form-btn"
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5 text-slate-700">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="pcat-select" className="text-[10px] font-bold text-slate-500 uppercase">Category *</label>
                    <select
                      id="pcat-select"
                      value={category}
                      onChange={(e) => handleCategoryChange(e.target.value as MaterialCategory)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 outline-none font-semibold text-slate-700"
                    >
                      {Object.values(MaterialCategory).map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="pdate-input" className="text-[10px] font-bold text-slate-500 uppercase">Purchase Date *</label>
                    <input
                      id="pdate-input"
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="pname-input" className="text-[10px] font-bold text-slate-500 uppercase">
                    {category === MaterialCategory.BARBENDING ? 'Labor Specification / Work Name *' : 'Material Name / Specs *'}
                  </label>
                  <input
                    id="pname-input"
                    type="text"
                    required
                    placeholder={category === MaterialCategory.BARBENDING ? 'e.g. Ground Floor Slab & Column Barbending' : 'e.g. Ultratech 43 Grade Cement, FE550 Steel'}
                    value={materialName}
                    onChange={(e) => setMaterialName(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none placeholder-slate-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="pqty-input" className="text-[10px] font-bold text-slate-500 uppercase">
                      {category === MaterialCategory.BARBENDING ? 'Total Length (Feet) *' : 'Quantity *'}
                    </label>
                    <input
                      id="pqty-input"
                      type="number"
                      required
                      min="0.01"
                      step="any"
                      placeholder={category === MaterialCategory.BARBENDING ? 'e.g. 1200' : 'e.g. 150, 2.5'}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 outline-none font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="punit-input" className="text-[10px] font-bold text-slate-500 uppercase">
                      {category === MaterialCategory.BARBENDING ? 'Unit of Measure' : 'Unit Spec (e.g. Bags, Tons)'}
                    </label>
                    <input
                      id="punit-input"
                      type="text"
                      required
                      placeholder="Bags, Tons, Brass, Feet"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="prate-input" className="text-[10px] font-bold text-slate-500 uppercase">
                      {category === MaterialCategory.BARBENDING ? 'Rate per Foot (₹) *' : 'Rate per Unit (₹) *'}
                    </label>
                    <input
                      id="prate-input"
                      type="number"
                      required
                      min="0.1"
                      step="any"
                      placeholder={category === MaterialCategory.BARBENDING ? 'e.g. 15' : 'Rate in INR'}
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 outline-none font-bold text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="pinvoice" className="text-[10px] font-bold text-slate-500 uppercase">Invoice / Bill no.</label>
                    <input
                      id="pinvoice"
                      type="text"
                      placeholder="e.g. IN-2981"
                      value={invoiceNo}
                      onChange={(e) => setInvoiceNo(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 outline-none"
                    />
                  </div>
                </div>

                {/* Transport & Extra Expenses Section */}
                <div id="additional-expenses-block" className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3.5">
                  <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                    <Truck className="w-4 h-4 text-indigo-600" />
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">Addon Costs & Transport Fees</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label htmlFor="ptransport-input" className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                          Transport Fee (₹)
                        </label>
                        {(category === MaterialCategory.CEMENT || category === MaterialCategory.STEEL) && (
                          <span className="text-[8px] bg-indigo-100 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded-full uppercase">For {category}</span>
                        )}
                      </div>
                      <input
                        id="ptransport-input"
                        type="number"
                        min="0"
                        step="any"
                        placeholder="e.g. 1500"
                        value={transportCharges}
                        onChange={(e) => setTransportCharges(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs outline-none font-bold text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="pextra-input" className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                        Extra Expenses (₹)
                      </label>
                      <input
                        id="pextra-input"
                        type="number"
                        min="0"
                        step="any"
                        placeholder="e.g. 450"
                        value={extraExpenses}
                        onChange={(e) => setExtraExpenses(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs outline-none font-bold text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="pextra-remarks" className="text-[9px] font-bold text-slate-500 uppercase">Extra Expense Remarks (e.g. Binding Wire/Tape)</label>
                    <input
                      id="pextra-remarks"
                      type="text"
                      placeholder="e.g. Binding wire & measuring pipe/tape"
                      value={extraExpensesRemarks}
                      onChange={(e) => setExtraExpensesRemarks(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs outline-none placeholder-slate-400 text-slate-700 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="psupplier" className="text-[10px] font-bold text-slate-500 uppercase">
                    {category === MaterialCategory.BARBENDING ? 'Barbender / Contractor Name' : 'Supplier Agency Name'}
                  </label>
                  <input
                    id="psupplier"
                    type="text"
                    placeholder={category === MaterialCategory.BARBENDING ? 'e.g. Raju Barbender' : 'e.g. Suresh & Sons Steel Corp'}
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50 outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Payment Option *</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      id="mat-pay-status-paid-btn"
                      type="button"
                      onClick={() => {
                        setPaymentMode('PAID');
                        setPaymentStatus(PaymentStatus.PAID);
                        setCustomPaidAmount('');
                        setCustomCreditAmount('');
                      }}
                      className={`px-2.5 py-2 rounded-xl text-[10px] md:text-xs font-bold border transition-all cursor-pointer text-center ${
                        paymentMode === 'PAID'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-extrabold shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      Fully Paid
                    </button>
                    <button
                      id="mat-pay-status-credit-btn"
                      type="button"
                      onClick={() => {
                        setPaymentMode('CREDIT');
                        setPaymentStatus(PaymentStatus.CREDIT);
                        setCustomPaidAmount('');
                        setCustomCreditAmount('');
                      }}
                      className={`px-2.5 py-2 rounded-xl text-[10px] md:text-xs font-bold border transition-all cursor-pointer text-center ${
                        paymentMode === 'CREDIT'
                          ? 'bg-rose-50 border-rose-500 text-rose-700 font-extrabold shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      In Credit
                    </button>
                    <button
                      id="mat-pay-status-split-btn"
                      type="button"
                      onClick={() => {
                        setPaymentMode('SPLIT');
                        const totValue = (parseFloat(quantity) * parseFloat(rate) || 0) + (parseFloat(transportCharges) || 0) + (parseFloat(extraExpenses) || 0);
                        setCustomPaidAmount((totValue / 2).toFixed(2));
                        setCustomCreditAmount((totValue / 2).toFixed(2));
                      }}
                      className={`px-2.5 py-2 rounded-xl text-[10px] md:text-xs font-bold border transition-all cursor-pointer text-center ${
                        paymentMode === 'SPLIT'
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-extrabold shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      Part Split
                    </button>
                  </div>

                  {/* Manual Inputs when Part Split is selected */}
                  {paymentMode === 'SPLIT' && (
                    <div className="bg-indigo-50/20 border border-indigo-100/40 p-3 rounded-xl space-y-2.5">
                      <div className="flex gap-2">
                        <div className="flex-1 space-y-1">
                          <label htmlFor="split-paid-input" className="text-[9px] font-extrabold text-indigo-900 block uppercase">Paid Amount (₹)</label>
                          <input
                            id="split-paid-input"
                            type="number"
                            min="0"
                            step="any"
                            placeholder="Amount paid"
                            value={customPaidAmount}
                            onChange={(e) => {
                              const val = e.target.value;
                              const tot = (parseFloat(quantity) * parseFloat(rate) || 0) + (parseFloat(transportCharges) || 0) + (parseFloat(extraExpenses) || 0);
                              handlePaidAmountChange(val, tot);
                            }}
                            className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-xs outline-none font-bold text-emerald-700 shadow-sm"
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <label htmlFor="split-credit-input" className="text-[9px] font-extrabold text-rose-900 block uppercase">Credit Amount (₹)</label>
                          <input
                            id="split-credit-input"
                            type="number"
                            min="0"
                            step="any"
                            placeholder="In credit"
                            value={customCreditAmount}
                            onChange={(e) => {
                              const val = e.target.value;
                              const tot = (parseFloat(quantity) * parseFloat(rate) || 0) + (parseFloat(transportCharges) || 0) + (parseFloat(extraExpenses) || 0);
                              handleCreditAmountChange(val, tot);
                            }}
                            className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-xs outline-none font-bold text-rose-700 shadow-sm"
                          />
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 font-semibold flex justify-between">
                        <span>Total Bill: ₹{((parseFloat(quantity) * parseFloat(rate) || 0) + (parseFloat(transportCharges) || 0) + (parseFloat(extraExpenses) || 0)).toLocaleString('en-IN')}</span>
                        <span className="text-slate-400">|</span>
                        <span>Paid: <span className="text-emerald-600">₹{parseFloat(customPaidAmount) || 0}</span></span>
                        <span className="text-slate-400">|</span>
                        <span>Credit: <span className="text-rose-600 font-bold">₹{parseFloat(customCreditAmount) || 0}</span></span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bill upload field */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Invoice Document Upload (JPG, PNG, PDF)</span>
                  <div className="border border-dashed border-slate-200 hover:border-emerald-400 rounded-xl p-4 bg-slate-50 hover:bg-emerald-50/10 transition-colors relative flex flex-col items-center justify-center cursor-pointer text-center group">
                    <input
                      id="invoice-file-input"
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
                        <p className="text-xs text-slate-500 font-semibold">Drag & Drop or Click to attach bill</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">Scanned receipts in JPG, PNG, PDF</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Auto Calculated Live Feedback Row */}
                {quantity && rate && (
                  <div className="bg-emerald-50/40 border border-emerald-100/50 p-3 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-emerald-700 font-semibold">Computed Expense (incl. Addons):</span>
                    <span className="font-extrabold text-emerald-800 text-sm mono">
                      ₹{((parseFloat(quantity) * parseFloat(rate) || 0) + (parseFloat(transportCharges) || 0) + (parseFloat(extraExpenses) || 0)).toLocaleString('en-IN')}
                    </span>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    id="save-purchase-btn"
                    type="submit"
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer select-none"
                  >
                    {editingId ? 'Modify Record' : 'Record Purchase'}
                  </button>
                  <button
                    id="cancel-upsert-btn"
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

          {/* List display matching the active project (Column 2/3) */}
          <div className={`${isFormOpen && canEdit ? 'xl:col-span-2' : 'xl:col-span-3'} bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4`}>
            <div className="space-y-1">
              <h3 className="font-extrabold text-slate-800 text-base">Structural purchases registry</h3>
              <p className="text-xs text-slate-400">Showing active entries in local log database for {activeProject.projectName}. Soft-deleted logs reside in audit histories.</p>
            </div>

            {filteredPurchases.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                No material purchases logged for this project yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPurchases.map((pur) => (
                  <div
                    id={`purchase-card-${pur.id}`}
                    key={pur.id}
                    className="p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all flex flex-col justify-between space-y-3 relative overflow-hidden bg-slate-50/20"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-md">
                            {pur.category}
                          </span>
                          {pur.paidAmount !== undefined && pur.creditAmount !== undefined && pur.paidAmount > 0 && pur.creditAmount > 0 ? (
                            <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-amber-50 text-amber-700 border-amber-100">
                              Part Paid Split
                            </span>
                          ) : (
                            <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                              pur.paymentStatus === PaymentStatus.CREDIT
                                ? 'bg-rose-50 text-rose-600 border-rose-100 animate-pulse'
                                : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            }`}>
                              {pur.paymentStatus || PaymentStatus.PAID}
                            </span>
                          )}
                        </div>
                        <h4 className="font-extrabold text-slate-850 text-sm tracking-tight">{pur.materialName}</h4>
                        <p className="text-xs text-slate-400 font-semibold">
                          {pur.category === MaterialCategory.BARBENDING ? 'Barbender: ' : 'Supplier: '}
                          <strong className="text-slate-605">{pur.supplier || 'Local Supplier'}</strong>
                        </p>
                      </div>
                      <span className="text-right font-black text-slate-900 text-sm whitespace-nowrap">
                        ₹{pur.totalAmount.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-t border-b border-dashed border-slate-100 py-2.5 text-[11px] text-slate-500 font-medium">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase">
                          {pur.category === MaterialCategory.BARBENDING ? 'Length' : 'Quantity'}
                        </span>
                        <span className="text-slate-800 font-bold">{pur.quantity} {pur.unit}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase">
                          {pur.category === MaterialCategory.BARBENDING ? 'Rate / Ft' : 'Rate'}
                        </span>
                        <span className="text-slate-800 font-bold">₹{pur.rate}/{pur.unit}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase">Date</span>
                        <span className="text-slate-800 font-bold truncate block">{pur.date}</span>
                      </div>
                    </div>

                    {/* Extra Addons Ledger Indicators */}
                    {((pur.transportCharges && pur.transportCharges > 0) || (pur.extraExpenses && pur.extraExpenses > 0)) && (
                      <div className="bg-indigo-50/30 border border-indigo-100/30 rounded-xl p-2.5 space-y-1.5 text-[10px] text-slate-600 font-semibold shadow-inner">
                        <div className="flex justify-between items-center text-slate-400 uppercase tracking-wider text-[8px] border-b border-indigo-100/50 pb-1">
                          <span>Log Addons Detail</span>
                          <span className="text-indigo-600 font-bold">Ancillary Costs</span>
                        </div>
                        <div className="flex justify-between">
                          {pur.transportCharges && pur.transportCharges > 0 ? (
                            <span className="flex items-center gap-1">
                              <Truck className="w-3 h-3 text-indigo-500" /> Transport: <strong className="text-slate-800">₹{pur.transportCharges.toLocaleString('en-IN')}</strong>
                            </span>
                          ) : <span className="text-slate-300">-</span>}
                          {pur.extraExpenses && pur.extraExpenses > 0 ? (
                            <span className="flex items-center gap-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block"></span> Extras: <strong className="text-slate-800">₹{pur.extraExpenses.toLocaleString('en-IN')}</strong>
                            </span>
                          ) : <span className="text-slate-300">-</span>}
                        </div>
                        {pur.extraExpensesRemarks && (
                          <div className="text-[10px] text-slate-500 italic font-medium pt-1 border-t border-slate-100/60 block truncate" title={pur.extraExpensesRemarks}>
                            Notes: &ldquo;{pur.extraExpensesRemarks}&rdquo;
                          </div>
                        )}
                      </div>
                    )}

                    {/* Paid vs Credit Split Breakdown */}
                    {(pur.paidAmount !== undefined || pur.creditAmount !== undefined) && (
                      <div className="bg-white border border-slate-100/70 rounded-xl p-2 flex justify-between text-[10px] font-semibold text-slate-500 shadow-sm gap-2">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block"></span>
                          Paid: <strong className="text-slate-800">₹{(pur.paidAmount ?? (pur.paymentStatus === PaymentStatus.CREDIT ? 0 : pur.totalAmount)).toLocaleString('en-IN')}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 block"></span>
                          Credit: <strong className="text-rose-600">₹{(pur.creditAmount ?? (pur.paymentStatus === PaymentStatus.CREDIT ? pur.totalAmount : 0)).toLocaleString('en-IN')}</strong>
                        </span>
                      </div>
                    )}

                    {/* Footer buttons / indicators */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium pt-1">
                      <span>Entered by: <strong className="text-slate-600">{pur.enteredBy}</strong></span>

                      <div className="flex items-center gap-1.5">
                        {pur.billUrl && (
                          <button
                            id={`preview-bill-btn-${pur.id}`}
                            onClick={() => onPreviewBill(pur.billUrl!)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-md transition-colors font-bold cursor-pointer"
                            title="Inspect Attached Bill Invoice"
                          >
                            <Eye className="w-3.5 h-3.5" /> Receipt
                          </button>
                        )}
                        {canEdit && (
                          <>
                            <button
                              id={`edit-purchase-btn-${pur.id}`}
                              onClick={() => handleEditClick(pur)}
                              className="p-1.5 border border-slate-100 text-slate-500 hover:text-emerald-600 hover:bg-slate-50 rounded-md transition-colors"
                              title="Edit specification"
                            >
                              <Activity className="w-3.5 h-3.5" />
                            </button>
                            <button
                              id={`delete-purchase-btn-${pur.id}`}
                              onClick={() => {
                                if (window.confirm(`Soft delete the material transaction for "${pur.materialName}"?`)) {
                                  onDeletePurchase(pur.id);
                                }
                              }}
                              className="p-1.5 border border-slate-100 text-slate-500 hover:text-red-600 hover:bg-white rounded-md transition-colors"
                              title="Soft delete record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-slate-400">
          Please configure or select a project to analyze material logs.
        </div>
      )}
    </div>
  );
}
