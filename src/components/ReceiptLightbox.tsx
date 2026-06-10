import React from 'react';
import { X, Calendar, User, FileText, Check, DollarSign, Printer, Download } from 'lucide-react';

interface ReceiptLightboxProps {
  billUrl: string;
  metadata: any;
  onClose: () => void;
}

export default function ReceiptLightbox({
  billUrl,
  metadata,
  onClose,
}: ReceiptLightboxProps) {
  
  if (!metadata) return null;

  // Let's decide if we got an actual uploaded File Data URL, or if we render the gorgeous generated CSS invoice.
  const isRealDataUri = billUrl && billUrl !== 'mock' && billUrl.startsWith('data:');

  // Destructure variables safely
  const title = metadata.title || 'Material Bill Receipt';
  const category = metadata.category || 'Cement';
  const amount = metadata.amount || 0;
  const date = metadata.date || new Date().toISOString().split('T')[0];
  const invoiceNo = metadata.invoiceNo || 'N/A';
  const uploadedBy = metadata.uploadedBy || 'Mestri';
  const supplier = metadata.supplier || 'Local Contractor Depot';
  const rawRef = metadata.rawRef || {};

  return (
    <div id="receipt-lightbox-overlay" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-slate-850">
      
      {/* Lightbox dialog container */}
      <div className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-lg w-full border border-slate-100 flex flex-col max-h-[90vh]">
        
        {/* Header bar */}
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center px-6">
          <div className="space-y-0.5">
            <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest">Document Audit Scanner</span>
            <h4 className="font-extrabold text-sm truncate max-w-[300px]">{title}</h4>
          </div>
          <button
            id="close-lightbox-top-btn"
            onClick={onClose}
            className="p-1.5 bg-slate-800 text-slate-350 hover:bg-slate-700 hover:text-white rounded-xl transition-all cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Content scrolling portal */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-[400px] bg-slate-50/50">

          {isRealDataUri ? (
            /* Render actual uploaded image or document */
            <div className="space-y-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block text-center">Uploaded Document File View</span>
              <div className="border border-slate-200 bg-white rounded-2xl overflow-hidden p-2 flex items-center justify-center">
                <img 
                  id="uploaded-bill-img"
                  referrerPolicy="no-referrer"
                  src={billUrl} 
                  alt="Scanned cash receipt copy" 
                  className="max-h-[380px] w-auto object-contain rounded-xl"
                />
              </div>
            </div>
          ) : (
            /* Simulated Business Letterhead Receipt */
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-6 shadow-inner relative space-y-6 font-mono text-xs">
              
              {/* Circular Rubber Stamp Graphic */}
              <div className="absolute right-6 top-16 border-4 border-emerald-500/55 rounded-full p-2.5 px-3.5 rotate-[-12deg] text-[10px] text-emerald-600/70 font-black uppercase text-center select-none pointer-events-none">
                <Check className="w-4 h-4 mx-auto mb-0.5 text-emerald-500/60" />
                <span>AUDIT CLEARED</span>
                <span className="block text-[8px] tracking-wide">VERIFIED PRO</span>
              </div>

              {/* simulated header and barcode */}
              <div className="text-center space-y-1">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 border-b-2 border-slate-900 pb-2">
                  CONSTRUCTION SUPPLIERS & SERVICE CO.
                </h2>
                <div className="py-2 flex justify-center text-slate-400 select-none">
                  {/* Visual Barcode mockup representation */}
                  <div className="h-5 flex gap-0.5 items-end">
                    {[1,2,1,4,2,3,1,2,4,1,2,3,2,1,2,4,2,1,3].map((val, idx) => (
                      <span key={idx} className="bg-slate-800" style={{ width: val + 'px', height: '100%' }}></span>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-slate-505 font-bold uppercase tracking-wider">TAX INVOICE BILL</p>
              </div>

              {/* Itemized spec logs */}
              <div className="space-y-2 border-t border-b border-dashed border-slate-200 py-3.5 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[9px]">Invoice Slip No:</span>
                  <span className="font-bold text-slate-900 text-right">{invoiceNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[9px]">Transact Date:</span>
                  <span className="font-bold text-slate-900 text-right">{date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[9px]">Authorized By:</span>
                  <span className="font-bold text-slate-900 text-right">{uploadedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[9px]">Supplier Entity:</span>
                  <span className="font-bold text-slate-900 text-right truncate max-w-[200px]">{supplier}</span>
                </div>
              </div>

              {/* Item cost calculations */}
              <div className="space-y-2.5">
                <div className="flex justify-between font-black text-slate-900 text-xs border-b border-slate-100 pb-2">
                  <span>Line Item Account Log</span>
                  <span>Total Amount</span>
                </div>
                
                <div className="flex justify-between text-slate-650">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 block">{rawRef.itemName || title}</span>
                    {rawRef.qtySpec && (
                      <span className="text-[10px] text-slate-400 font-bold">{rawRef.qtySpec} @ {rawRef.rate}</span>
                    )}
                  </div>
                  <span className="font-bold text-slate-900">₹{amount.toLocaleString('en-IN')}</span>
                </div>

                <div className="border-t-2 border-slate-900 pt-3 flex justify-between font-black text-slate-950 text-sm">
                  <span>PAID GRAND TOTAL:</span>
                  <span>₹{amount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Print footer note */}
              <div className="text-center text-[10px] text-slate-400 pt-4 leading-relaxed font-bold">
                * This slip is digitally signed by Administrator *<br />
                Budget Ledger Reconciliation Compliant
              </div>

            </div>
          )}

        </div>

        {/* Action Triggers footer */}
        <div className="p-4 px-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-3xl">
          {billUrl && billUrl !== 'mock' && (
            <button
              id="download-scanned-bill-btn"
              onClick={() => {
                const link = document.createElement('a');
                link.href = billUrl;
                // Infer file extension if it is a data URL
                let ext = 'png';
                if (billUrl.startsWith('data:image/jpeg') || billUrl.startsWith('data:image/jpg')) ext = 'jpg';
                else if (billUrl.startsWith('data:application/pdf')) ext = 'pdf';
                else if (billUrl.startsWith('data:image/webp')) ext = 'webp';
                link.download = `${title.replace(/\s+/g, '_')}_bill.${ext}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="flex items-center gap-1.5 px-4 md:px-4.5 py-2.5 bg-emerald-55 border border-emerald-250 text-emerald-800 hover:bg-emerald-100 font-bold rounded-xl text-xs transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-600" /> Download Scan
            </button>
          )}

          <button
            id="print-single-bill-btn"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" /> Print Slip
          </button>
          
          <button
            id="close-lightbox-footer-btn"
            onClick={onClose}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all cursor-pointer select-none"
          >
            Acknowledge View
          </button>
        </div>

      </div>

    </div>
  );
}
