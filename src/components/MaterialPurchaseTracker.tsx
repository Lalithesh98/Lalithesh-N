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
import { Project, MaterialPurchase, MaterialCategory, UserRole } from '../types';

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
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !materialName.trim() || !quantity || !rate) return;

    await onAddPurchase({
      id: editingId || undefined,
      projectId: activeProject.id,
      date,
      category,
      materialName,
      quantity: parseFloat(quantity) || 0,
      unit,
      supplier,
      rate: parseFloat(rate) || 0,
      invoiceNo,
      billUrl,
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
  };

  // Filter purchases for active project
  const activeProjectId = activeProject?.id || '';
  const filteredPurchases = purchases.filter(
    p => p.projectId === activeProjectId && !p.isDeleted
  );

  const totalSpentMat = filteredPurchases.reduce((sum, p) => sum + p.totalAmount, 0);

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
                      onChange={(e) => setCategory(e.target.value as MaterialCategory)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 outline-none"
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
                  <label htmlFor="pname-input" className="text-[10px] font-bold text-slate-500 uppercase">Material Name / Specs *</label>
                  <input
                    id="pname-input"
                    type="text"
                    required
                    placeholder="e.g. Ultratech 43 Grade Cement, FE550 Steel"
                    value={materialName}
                    onChange={(e) => setMaterialName(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none placeholder-slate-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="pqty-input" className="text-[10px] font-bold text-slate-500 uppercase">Quantity *</label>
                    <input
                      id="pqty-input"
                      type="number"
                      required
                      min="0.01"
                      step="any"
                      placeholder="e.g. 150, 2.5"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 outline-none font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="punit-input" className="text-[10px] font-bold text-slate-500 uppercase">Unit Spec (e.g. Bags, Tons)</label>
                    <input
                      id="punit-input"
                      type="text"
                      required
                      placeholder="Bags, Tons, Brass, Cft"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="prate-input" className="text-[10px] font-bold text-slate-500 uppercase">Rate per Unit (₹) *</label>
                    <input
                      id="prate-input"
                      type="number"
                      required
                      min="1"
                      placeholder="Rate in INR"
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

                <div className="space-y-1">
                  <label htmlFor="psupplier" className="text-[10px] font-bold text-slate-500 uppercase">Supplier Agency Name</label>
                  <input
                    id="psupplier"
                    type="text"
                    placeholder="e.g. Suresh & Sons Steel Corp"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50 outline-none"
                  />
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
                    <span className="text-emerald-700 font-semibold">Computed Expense Credit:</span>
                    <span className="font-extrabold text-emerald-800 text-sm mono">
                      ₹{(parseFloat(quantity) * parseFloat(rate)).toLocaleString('en-IN')}
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
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-md">
                          {pur.category}
                        </span>
                        <h4 className="font-extrabold text-slate-850 text-sm tracking-tight">{pur.materialName}</h4>
                        <p className="text-xs text-slate-400 font-semibold">{pur.supplier || 'Local Supplier'}</p>
                      </div>
                      <span className="text-right font-black text-slate-900 text-sm whitespace-nowrap">
                        ₹{pur.totalAmount.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-t border-b border-dashed border-slate-100 py-2.5 text-[11px] text-slate-500 font-medium">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase">Quantity</span>
                        <span className="text-slate-800 font-bold">{pur.quantity} {pur.unit}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase">Rate</span>
                        <span className="text-slate-800 font-bold">₹{pur.rate}/{pur.unit}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase">Date</span>
                        <span className="text-slate-800 font-bold truncate block">{pur.date}</span>
                      </div>
                    </div>

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
