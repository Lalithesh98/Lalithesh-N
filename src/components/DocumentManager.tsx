import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  Eye, 
  Calendar, 
  ExternalLink,
  User, 
  FolderOpen, 
  Filter, 
  ChevronRight, 
  X,
  Tag,
  Download,
  IndianRupee 
} from 'lucide-react';
import { Project, MaterialPurchase, DailyExpense } from '../types';

interface DocumentManagerProps {
  activeProject: Project | null;
  purchases: MaterialPurchase[];
  dailyExpenses: DailyExpense[];
  onPreviewBill: (billUrl: string, metadata?: any) => void;
}

export default function DocumentManager({
  activeProject,
  purchases,
  dailyExpenses,
  onPreviewBill,
}: DocumentManagerProps) {

  const [searchTerm, setSearchTerm] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState<'All' | 'Material Bill' | 'Site Voucher'>('All');

  if (!activeProject) {
    return (
      <div className="py-8 text-center text-slate-400">
        Please configure or select a project to view uploaded documents.
      </div>
    );
  }

  // Gather documents from material purchases and site vouchers that have bill files uploaded or can be previewed!
  // Note: MaterialPurchases has category, totalAmount, date, supplier, invoiceNo, billUrl.
  // DailyExpenses has category, amount, date, description, billUrl.
  
  const mDocs = purchases
    .filter(p => p.projectId === activeProject.id && !p.isDeleted)
    .map(p => ({
      id: p.id,
      title: `${p.category}: ${p.materialName}`,
      docType: 'Material Bill' as const,
      category: p.category,
      amount: p.totalAmount,
      date: p.date,
      invoiceNo: p.invoiceNo || 'N/A',
      uploadedBy: p.enteredBy,
      supplier: p.supplier,
      billUrl: p.billUrl,
      rawRef: p,
    }));

  const dDocs = dailyExpenses
    .filter(d => d.projectId === activeProject.id)
    .map(d => ({
      id: d.id,
      title: `${d.category}: ${d.description}`,
      docType: 'Site Voucher' as const,
      category: d.category,
      amount: d.amount,
      date: d.date,
      invoiceNo: 'VOUCHER-' + d.id.toUpperCase().split('_')[1],
      uploadedBy: d.enteredBy,
      supplier: 'Cash Disbursed',
      billUrl: d.billUrl,
      rawRef: d,
    }));

  const allDocs = [...mDocs, ...dDocs];

  const filteredDocs = allDocs.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          doc.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          doc.uploadedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          doc.supplier.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = docTypeFilter === 'All' || doc.docType === docTypeFilter;

    return matchesSearch && matchesType;
  });

  return (
    <div id="document-manager-container" className="space-y-6">
      
      {/* Search and view metrics */}
      <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="space-y-0.5">
            <h3 className="font-extrabold text-slate-800 text-base">Invoices & Receipts Repository</h3>
            <p className="text-xs text-slate-400">Archived copies of material supplier memos, cash vouchers, and site expenditures for Audit trail compliance.</p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase">Documents indexed:</span>
            <span className="p-1 px-2.5 bg-slate-900 text-white rounded-lg text-xs font-black">
              {allDocs.length} Slips
            </span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              id="doc-search-input"
              type="text"
              placeholder="Search by supplier, voucher ID, catalog item, or creator name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-amber-500 placeholder-slate-400 text-slate-700"
            />
          </div>

          <div className="flex bg-slate-50 border border-slate-200 p-1 rounded-xl gap-1">
            {(['All', 'Material Bill', 'Site Voucher'] as const).map(fType => (
              <button
                id={`doc-filter-btn-${fType.replace(' ', '-')}`}
                key={fType}
                onClick={() => setDocTypeFilter(fType)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  docTypeFilter === fType 
                    ? 'bg-white text-slate-900 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {fType}s
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredDocs.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center text-slate-400">
          <FolderOpen className="w-12 h-12 mx-auto stroke-[1.2] text-slate-300 mb-2" />
          No documents match the specified filter or search tags for this project.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => {
            const isMaterial = doc.docType === 'Material Bill';
            const hasBillFile = !!doc.billUrl;

            return (
              <div 
                id={`doc-card-${doc.id}`}
                key={doc.id} 
                className="bg-white border border-slate-100 rounded-2xl p-5 hover:border-slate-200 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between space-y-4"
              >
                {/* Header indicators */}
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-0.5">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      isMaterial ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-sky-50 text-sky-600 border border-sky-100'
                    }`}>
                      {doc.docType}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold block mt-1">Invoice Ref: {doc.invoiceNo}</span>
                  </div>
                  <span className="font-extrabold text-slate-850 text-sm">
                    ₹{doc.amount.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Doc Title block */}
                <div>
                  <h4 className="font-bold text-slate-800 text-sm leading-snug tracking-tight">{doc.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-1 font-semibold flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-300" /> Date: {doc.date}
                  </p>
                </div>

                {/* Sub Metadata description */}
                <div className="border-t border-slate-50 pt-3 flex items-center justify-between text-[11px] text-slate-500 font-semibold bg-slate-50/10 p-1 bg-slate-50/20 rounded-lg">
                  <div className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-350" />
                    <span className="truncate max-w-[120px]">{doc.uploadedBy}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold block">
                    {doc.supplier}
                  </div>
                </div>

                {/* Open preview triggers */}
                <div className="flex justify-between items-center pt-1 border-t border-slate-50">
                  <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">
                    {hasBillFile ? '📁 File Attached' : '⚠️ No Scan file'}
                  </span>
                  
                  <button
                    id={`doc-preview-trigger-${doc.id}`}
                    onClick={() => {
                      // Call onPreviewBill which will construct a highly polished modal receipt!
                      // If doc.billUrl is missing, we still construct an awesome mock preview receipt from the structured fields!
                      onPreviewBill(doc.billUrl || 'mock', doc);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      hasBillFile 
                        ? 'bg-sky-50 text-sky-600 hover:bg-sky-100' 
                        : 'bg-slate-50 text-amber-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" /> 
                    {hasBillFile ? 'Inspect Bill' : 'Check Receipt'}
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
