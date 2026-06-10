import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Printer, 
  Save, 
  Download, 
  RefreshCcw, 
  Building, 
  ChevronRight,
  Sparkles,
  CheckCircle,
  FileSpreadsheet
} from 'lucide-react';
import { Project } from '../types';

interface TaxInvoiceGeneratorProps {
  activeProject: Project | null;
  projects?: Project[];
}

interface InvoiceItem {
  slNo: number;
  description: string;
  qty: number;
  rate: number;
  amount: number;
}

interface RaisedInvoice {
  id: string;
  invoiceNo: string;
  date: string;
  projectName: string;
  siteName: string;
  clientName: string;
  grandTotal: number;
}

// Convert numbers into standard Indian Words
function convertToIndianWords(amount: number): string {
  const value = Math.floor(amount);
  if (value === 0) return 'Zero Only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertLessThanOneThousand(n: number): string {
    if (n < 20) return ones[n];
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    let res = '';
    
    if (hundred > 0) {
      res += ones[hundred] + ' Hundred';
      if (remainder > 0) res += ' ';
    }
    
    if (remainder < 20) {
      res += ones[remainder];
    } else {
      const ten = Math.floor(remainder / 10);
      const one = remainder % 10;
      res += tens[ten];
      if (one > 0) res += ' ' + ones[one];
    }
    return res;
  }

  let temp = value;
  let str = '';

  // Crores
  const crores = Math.floor(temp / 10000000);
  temp %= 10000000;
  if (crores > 0) {
    str += convertLessThanOneThousand(crores) + ' Crore ';
  }

  // Lakhs
  const lakhs = Math.floor(temp / 100000);
  temp %= 100000;
  if (lakhs > 0) {
    str += convertLessThanOneThousand(lakhs) + ' Lakh ';
  }

  // Thousands
  const thousands = Math.floor(temp / 1000);
  temp %= 1000;
  if (thousands > 0) {
    str += convertLessThanOneThousand(thousands) + ' Thousand ';
  }

  // Tens & Ones
  if (temp > 0) {
    str += convertLessThanOneThousand(temp) + ' ';
  }

  return str.trim() + ' Only';
}

export default function TaxInvoiceGenerator({ activeProject, projects = [] }: TaxInvoiceGeneratorProps) {
  
  // Header section states
  const [invoiceNo, setInvoiceNo] = useState('01/2026-27');
  const [invoiceDate, setInvoiceDate] = useState('2026-06-02');
  const [siteName, setSiteName] = useState('PILLAHALLI - DASANAPURA');

  // Supplier info (LV CONSTRUCTIONS)
  const [supplierName, setSupplierName] = useState('LV CONSTRUCTIONS');
  const [supplierAddress, setSupplierAddress] = useState('#58, Rajathadri, 4th Cross, Condord Garden City, RR Nagar, Bangalore-560059');
  const [supplierGst, setSupplierGst] = useState('29ECFPK4861J1Z4');
  const [supplierPhone, setSupplierPhone] = useState('+91 9148672917');

  // Client info (Bill To)
  const [clientName, setClientName] = useState('KARNATAKA STATE HABITAT CENTRE');
  const [clientAddress, setClientAddress] = useState('Cauvery Bhavan, Ground Floor,\nE & F Block, K G Road,\nBengaluru');
  const [clientGst, setClientGst] = useState('29AAAAK4523H1ZQ');
  const [clientState, setClientState] = useState('Karnataka');
  const [clientStateCode, setClientStateCode] = useState('29');

  // Interactive items list initialized with the exact items in format photo
  const [items, setItems] = useState<InvoiceItem[]>([
    { slNo: 1, description: 'TMT FE 550 REINFORCEMENT', qty: 3240, rate: 72, amount: 233280 },
    { slNo: 2, description: 'RCC SLAB - M25 GRADE CONCRETE', qty: 208, rate: 360, amount: 14976 },
    { slNo: 3, description: 'Providing and laying in position', qty: 25, rate: 7058, amount: 176450 }
  ]);

  // Dynamic values
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemQty, setNewItemQty] = useState<number>(0);
  const [newItemRate, setNewItemRate] = useState<number>(0);

  // Bank Info
  const [bankName, setBankName] = useState('KOTAK MAHINDRA BANK LTD');
  const [bankAcc, setBankAcc] = useState('0053003539');
  const [bankIfsc, setBankIfsc] = useState('KKBK0008057');
  const [bankBranch, setBankBranch] = useState('BOMMANAHALLI');

  // Terms & Conditions block
  const [terms, setTerms] = useState([
    'We are registered under GST Act and liable to pay tax.',
    'Payment should be made by Account payee Cheque/DD/RTGS/NEFT in favour of anjan constructions.'
  ]);

  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [savedInvoices, setSavedInvoices] = useState<RaisedInvoice[]>([]);

  // Monitor active project changes to auto-fill details if available
  useEffect(() => {
    if (activeProject) {
      setSiteName(activeProject.siteName?.toUpperCase() || `${activeProject.projectName?.toUpperCase()}`);
      
      // Attempt to intelligently parse project details
      if (activeProject.clientName) {
        setClientName(activeProject.clientName.toUpperCase());
      }
    }
  }, [activeProject]);

  // Load registered invoices history
  useEffect(() => {
    const raw = localStorage.getItem('lv_raised_invoices');
    if (raw) {
      setSavedInvoices(JSON.parse(raw));
    }
  }, []);

  // Compute calculated values
  const subTotal = items.reduce((sum, item) => sum + item.amount, 0);
  const taxPercent = 9; // CGST 9%, SGST 9%
  const cgst = parseFloat((subTotal * (taxPercent / 100)).toFixed(2));
  const sgst = parseFloat((subTotal * (taxPercent / 100)).toFixed(2));
  const rawTotal = subTotal + cgst + sgst;
  const grandTotal = Math.round(rawTotal);
  const roundOff = parseFloat((grandTotal - rawTotal).toFixed(2));

  const wordsRepresent = convertToIndianWords(grandTotal);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemDesc.trim() || newItemQty <= 0 || newItemRate <= 0) return;

    const calculatedAmt = parseFloat((newItemQty * newItemRate).toFixed(2));
    const newItem: InvoiceItem = {
      slNo: items.length + 1,
      description: newItemDesc.trim(),
      qty: newItemQty,
      rate: newItemRate,
      amount: calculatedAmt
    };

    setItems([...items, newItem]);
    setNewItemDesc('');
    setNewItemQty(0);
    setNewItemRate(0);
  };

  const handleRemoveItem = (index: number) => {
    const filtered = items.filter((_, i) => i !== index).map((item, i) => ({
      ...item,
      slNo: i + 1
    }));
    setItems(filtered);
  };

  const handleSaveInvoice = () => {
    const raised: RaisedInvoice = {
      id: `inv_${Date.now()}`,
      invoiceNo,
      date: invoiceDate,
      projectName: activeProject?.projectName || 'General Site',
      siteName,
      clientName,
      grandTotal
    };

    const updated = [raised, ...savedInvoices];
    setSavedInvoices(updated);
    localStorage.setItem('lv_raised_invoices', JSON.stringify(updated));

    setSavingStatus('Tax invoice recorded successfully');
    setTimeout(() => setSavingStatus(null), 3000);
  };

  const handleResetToDefault = () => {
    if (window.confirm('Reset this workspace to the standard default Karntaka Habitat Centre layout?')) {
      setInvoiceNo('01/2026-27');
      setInvoiceDate('2026-06-02');
      setSiteName('PILLAHALLI - DASANAPURA');
      setClientName('KARNATAKA STATE HABITAT CENTRE');
      setClientAddress('Cauvery Bhavan, Ground Floor,\nE & F Block, K G Road,\nBengaluru');
      setClientGst('29AAAAK4523H1ZQ');
      setItems([
        { slNo: 1, description: 'TMT FE 550 REINFORCEMENT', qty: 3240, rate: 72, amount: 233280 },
        { slNo: 2, description: 'RCC SLAB - M25 GRADE CONCRETE', qty: 208, rate: 360, amount: 14976 },
        { slNo: 3, description: 'Providing and laying in position', qty: 25, rate: 7058, amount: 176450 }
      ]);
    }
  };

  const handleTriggerPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* Configuration Controls Bar - Hide when printing */}
      <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" /> LV Tax Invoice Workdesk
            </h3>
            <p className="text-xs text-slate-400">
              Customize values below to dynamically generate a tax compliant invoice, compile totals, and render the print sheet.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleResetToDefault}
              className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
              title="Reset workspace"
            >
              <RefreshCcw className="w-4 h-4" /> Reset Template
            </button>
            
            <button
              onClick={handleSaveInvoice}
              className="p-2 px-3 bg-slate-900 hover:bg-slate-950 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Save className="w-4 h-4" /> Record Ledger entry
            </button>

            <button
              onClick={handleTriggerPrint}
              className="p-2 px-4.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm animate-pulse hover:animate-none"
            >
              <Printer className="w-4 h-4" /> Print / Export PDF
            </button>
          </div>
        </div>

        {/* Info Feedbacks */}
        {savingStatus && (
          <div className="p-2.5 px-4 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" /> {savingStatus}
          </div>
        )}

        {/* Double forms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
          
          {/* Column 1: Header Meta */}
          <div className="bg-slate-50/55 rounded-2xl border border-slate-150 p-4 space-y-3">
            <span className="block text-[9px] font-black uppercase text-slate-500 block tracking-widest">Header Information</span>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label htmlFor="inv-no-input" className="text-[9px] font-bold text-slate-400 uppercase">Invoice No</label>
                <input
                  id="inv-no-input"
                  type="text"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  className="w-full bg-white border border-slate-200 px-2 py-1.5 rounded-lg text-xs font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="inv-date-input" className="text-[9px] font-bold text-slate-400 uppercase">Invoice Date</label>
                <input
                  id="inv-date-input"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 px-2 py-1.5 rounded-lg text-xs font-semibold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="inv-site-input" className="text-[9px] font-bold text-slate-400 uppercase block">Site Location / Job name</label>
              <input
                id="inv-site-input"
                type="text"
                placeholder="Site location info"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value.toUpperCase())}
                className="w-full bg-white border border-slate-200 px-2 py-1.5 rounded-lg text-xs font-extrabold uppercase"
              />
            </div>
          </div>

          {/* Column 2: Client Block (Bill To) */}
          <div className="bg-slate-50/55 rounded-2xl border border-slate-150 p-4 space-y-3">
            <span className="block text-[9px] font-black uppercase text-slate-500 block tracking-widest">Buyer (Bill To) Information</span>
            
            <div className="space-y-1.5">
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value.toUpperCase())}
                placeholder="Buyer agency title"
                className="w-full bg-white border border-slate-205 px-2 py-1.5 rounded-lg text-xs font-extrabold"
              />
              <textarea
                rows={2}
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="Buyer location postal addresses"
                className="w-full bg-white border border-slate-205 px-2 py-1.5 rounded-lg text-xs leading-tight font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="GSTIN No"
                  value={clientGst}
                  onChange={(e) => setClientGst(e.target.value.toUpperCase())}
                  className="w-full bg-white border border-slate-205 px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold"
                />
              </div>
              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="State / Code"
                  value={`${clientState}, Code-${clientStateCode}`}
                  onChange={(e) => {
                    const val = e.target.value;
                    const sp = val.split(', Code-');
                    setClientState(sp[0] || 'Karnataka');
                    setClientStateCode(sp[1] || '29');
                  }}
                  className="w-full bg-white border border-slate-205 px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold"
                />
              </div>
            </div>
          </div>

          {/* Column 3: Add Items Form */}
          <form onSubmit={handleAddItem} className="bg-slate-50/55 rounded-2xl border border-slate-150 p-4 space-y-3">
            <span className="block text-[9px] font-black uppercase text-slate-500 block tracking-widest">Append Item / Rate details</span>
            
            <input
              type="text"
              required
              placeholder="Provide job / material item details"
              value={newItemDesc}
              onChange={(e) => setNewItemDesc(e.target.value)}
              className="w-full bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
            />

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Quantity (QTY)"
                  value={newItemQty === 0 ? '' : newItemQty}
                  onChange={(e) => setNewItemQty(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-200 px-2 py-1.5 rounded-lg text-xs font-semibold"
                />
              </div>
              
              <div className="space-y-0.5">
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Rate (Per)"
                  value={newItemRate === 0 ? '' : newItemRate}
                  onChange={(e) => setNewItemRate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-200 px-2 py-1.5 rounded-lg text-xs font-semibold"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-1.5 bg-slate-800 hover:bg-slate-850 text-white text-[10px] uppercase font-black tracking-widest rounded-lg flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Append Item row
            </button>
          </form>

        </div>
      </div>

      {/* RENDER BOARD: TAX INVOICE matching user layout */}
      <div 
        id="tax-invoice-form-paper" 
        className="mx-auto bg-white p-6 md:p-10 border border-slate-200 shadow-sm max-w-[800px] font-sans text-slate-850 print:border-none print:shadow-none print:p-0 select-text relative"
      >
        {/* Strict visual alignment layout */}
        <div className="border-[1.85px] border-slate-900 w-full flex flex-col">
          
          {/* Tax Invoice Banner centered highlight */}
          <div className="bg-[#E4ECF4] border-b-[1.85px] border-slate-900 text-center py-1.5">
            <h1 className="text-sm font-black uppercase text-slate-800 border-none font-sans tracking-widest select-none">
              TAX INVOICE
            </h1>
          </div>

          {/* Supplier (Left) vs Date Meta (Right) */}
          <div className="grid grid-cols-12 border-b-[1.85px] border-slate-900">
            
            {/* Left side brand details */}
            <div className="col-span-7 border-r-[1.85px] border-slate-900 p-3.5 space-y-2">
              <h2 className="text-sm font-black bg-yellow-300 px-1 py-0.5 inline-block text-slate-900 font-sans tracking-wide">
                {supplierName}
              </h2>
              <div className="text-[10px] leading-tight text-slate-800 font-semibold font-mono font-sans whitespace-pre-line">
                {supplierAddress}
              </div>
              <div className="pt-2 text-[10px] font-sans">
                <span className="font-extrabold">GSTN - </span>
                <span className="font-mono font-bold">{supplierGst}</span>
              </div>
              <div className="text-[10px] font-sans">
                <span className="font-extrabold">Phone no - </span>
                <span className="font-mono font-bold">{supplierPhone}</span>
              </div>
            </div>

            {/* Right side Invoice details */}
            <div className="col-span-12 sm:col-span-5 flex flex-col divide-y-[1.85px] divide-slate-900">
              <div className="p-3.5 flex justify-between items-center text-[10.5px] font-sans">
                <span className="font-black uppercase tracking-wider">Invoice Date:</span>
                <span className="font-mono font-extrabold bg-amber-50 px-1">{invoiceDate.split('-').reverse().join('/')}</span>
              </div>
              <div className="p-3.5 flex justify-between items-center text-[10.5px] font-sans">
                <span className="font-black uppercase tracking-wider">Invoice No :</span>
                <span className="font-mono font-extrabold bg-blue-50 px-1">{invoiceNo}</span>
              </div>
              <div className="p-3.5 flex flex-col justify-center items-start text-[10.5px] font-sans space-y-1">
                <span className="font-black uppercase tracking-wider text-slate-400 text-[8.5px]">Site Name:</span>
                <span className="font-extrabold tracking-tight text-slate-900 uppercase font-mono">{siteName}</span>
              </div>
            </div>

          </div>

          {/* Customer / Buyer Information Block */}
          <div className="bg-slate-50/40 p-3.5 border-b-[1.85px] border-slate-900 text-[10.5px] space-y-1.5">
            <div className="font-black text-[9px] uppercase tracking-wider text-slate-400">Buyer (Bill To)</div>
            <div className="font-black text-[11px] text-slate-905">{clientName}</div>
            <div className="text-[10px] text-slate-700 whitespace-pre-line tracking-tight font-medium font-sans max-w-lg">
              {clientAddress}
            </div>
            <div className="flex flex-wrap items-center gap-6 pt-1">
              <div>
                <span className="font-extrabold">GSTIN: </span>
                <span className="font-mono font-bold text-slate-800">{clientGst}</span>
              </div>
              <div>
                <span className="font-extrabold">State Name: </span>
                <span className="font-semibold text-slate-800">{clientState}, Code-{clientStateCode}</span>
              </div>
            </div>
          </div>

          {/* Items Ledger Grid table matching the PDF layout exactly */}
          <div className="w-full flex-1 min-h-[220px]">
            <table className="w-full border-collapse text-[10.5px] font-sans">
              <thead>
                <tr className="border-b-[1.85px] border-slate-900 font-black uppercase text-center text-slate-800 bg-[#F8FAFC]">
                  <th className="border-r-[1.85px] border-slate-900 py-2 px-1.5 w-12 text-center">Sl No.</th>
                  <th className="border-r-[1.85px] border-slate-900 py-2 px-3 text-left">Description</th>
                  <th className="border-r-[1.85px] border-slate-900 py-2 px-1.5 w-24 text-right">QTY</th>
                  <th className="border-r-[1.85px] border-slate-900 py-2 px-1.5 w-24 text-right">Rate</th>
                  <th className="py-2 px-2.5 w-32 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 italic font-medium font-sans">
                      No items appended. Please add line items using the control desk.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="border-r-[1.85px] border-slate-900 py-2.5 px-1.5 text-center font-mono font-bold text-slate-500">
                        {item.slNo}
                      </td>
                      <td className="border-r-[1.85px] border-slate-900 py-2.5 px-3 font-extrabold text-slate-800 select-text relative">
                        {item.description}
                        
                        {/* Hover remove button - hidden in print */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-100 hover:opacity-100 text-rose-500 hover:text-rose-600 print:hidden cursor-pointer bg-white rounded p-0.5"
                          title="Remove row"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                      <td className="border-r-[1.85px] border-slate-900 py-2.5 px-1.5 text-right font-mono font-extrabold">
                        {item.qty.toFixed(2)}
                      </td>
                      <td className="border-r-[1.85px] border-slate-900 py-2.5 px-1.5 text-right font-mono text-slate-705">
                        {item.rate.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono font-extrabold text-slate-900">
                        {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
                
                {/* Visual filler rows to match visual aesthetic height of physical print */}
                {Array.from({ length: Math.max(0, 5 - items.length) }).map((_, i) => (
                  <tr key={`fill-${i}`} className="border-none h-8 select-none">
                    <td className="border-r-[1.85px] border-slate-900 py-1 text-center"></td>
                    <td className="border-r-[1.85px] border-slate-900 py-1"></td>
                    <td className="border-r-[1.85px] border-slate-900 py-1"></td>
                    <td className="border-r-[1.85px] border-slate-900 py-1"></td>
                    <td className="py-1"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Summary Footer Grid Section */}
          <div className="border-t-[1.85px] border-slate-900 grid grid-cols-12 select-text text-[11px]">
            
            {/* Blank placeholder left */}
            <div className="col-span-7 border-r-[1.85px] border-slate-900"></div>

            {/* Calculations summaries right */}
            <div className="col-span-5 flex flex-col divide-y divide-slate-800 font-sans font-extrabold p-0.5">
              
              <div className="flex justify-between py-1.5 px-3">
                <span className="uppercase text-[9.5px] font-black">Sub Total</span>
                <span className="font-mono">
                  {subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between py-1.5 px-3 text-slate-650">
                <span>CGST @ 9%</span>
                <span className="font-mono">
                  {cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between py-1.5 px-3 text-slate-650">
                <span>SGST @ 9%</span>
                <span className="font-mono">
                  {sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between py-1.5 px-3 text-slate-400">
                <span>Round off</span>
                <span className="font-mono font-bold">
                  {roundOff === 0 ? '-' : roundOff > 0 ? `+${roundOff}` : roundOff}
                </span>
              </div>

              <div className="flex justify-between py-2 px-3 bg-slate-50 border-t border-slate-900 text-slate-950 font-black text-[11.5px]">
                <span className="uppercase tracking-wider">Grand Total</span>
                <span className="font-mono bg-yellow-100 px-1 font-extrabold text-slate-900">
                  ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

            </div>

          </div>

          {/* Amount In Words Block */}
          <div className="border-t-[1.85px] border-slate-900 p-3 select-text bg-slate-50/20 text-[10.5px]">
            <span className="font-black text-slate-550 mr-1.5 block sm:inline">Amount in Word:</span>
            <strong className="text-slate-850 font-sans text-[11px] bg-sky-50/30 px-1 inline-block">
              {wordsRepresent}
            </strong>
          </div>

          {/* Bank Details section */}
          <div className="border-t-[1.85px] border-slate-900 p-3.5 select-text grid grid-cols-1 sm:grid-cols-2 gap-4 text-[10px] leading-tight">
            
            {/* Bank detail specifications */}
            <div className="space-y-1 font-sans">
              <div className="font-black text-[8.5px] uppercase tracking-wider text-slate-400">Bank Details:</div>
              <div>
                <span className="font-extrabold text-slate-605">Bank Name : </span>
                <span className="font-bold text-slate-800">{bankName}</span>
              </div>
              <div>
                <span className="font-extrabold text-slate-605 font-sans">Account Number: </span>
                <span className="font-mono font-black text-slate-900">{bankAcc}</span>
              </div>
              <div>
                <span className="font-extrabold text-slate-605">IFSC Code: </span>
                <span className="font-mono font-bold text-slate-800">{bankIfsc}</span>
              </div>
              <div>
                <span className="font-extrabold text-slate-605">Branch : </span>
                <span className="font-semibold text-slate-800 uppercase">{bankBranch}</span>
              </div>
            </div>

            {/* Static statutory compliance checklist as mapped from layout */}
            <div className="space-y-1.5 font-sans justify-end self-end">
              {terms.map((item, id) => (
                <div key={id} className="flex gap-2 items-start text-[9.5px] font-medium leading-normal text-slate-600">
                  <span className="font-black text-slate-900 p-0.5 bg-slate-100 rounded text-[9px] block leading-none">{id + 1}</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>

          </div>

          {/* Understatement & Signature Block */}
          <div className="border-t-[1.85px] border-slate-900 grid grid-cols-2 h-28 select-none text-[10.5px] font-sans">
            
            {/* Blank Left spacer spacing */}
            <div className="border-r-[1.85px] border-slate-900"></div>

            {/* Right signature verification coordinate */}
            <div className="flex flex-col justify-between items-center p-3 text-center">
              <span className="font-black text-slate-700 italic select-all">
                FOR {supplierName}
              </span>
              
              <div className="flex flex-col items-center">
                <div className="w-24 h-5 border-b border-dashed border-slate-300"></div>
                <span className="text-[9px] text-slate-400 font-extrabold mt-1 uppercase block tracking-wider leading-none">
                  Authorised Signature
                </span>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Raised Invoices Register list */}
      {savedInvoices.length > 0 && (
        <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-xs space-y-3 print:hidden">
          <div className="pb-2 border-b border-slate-100">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Raised Invoices History ({savedInvoices.length})</h4>
            <p className="text-[10px] text-slate-400">Previous documents registered in browser session logs.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {savedInvoices.map((inv) => (
              <div 
                key={inv.id} 
                className="p-3 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col justify-between space-y-2 text-xs"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-black text-slate-800 block">{inv.invoiceNo}</span>
                    <span className="text-[9px] text-slate-400 font-bold block mt-0.5">{inv.date}</span>
                  </div>
                  <span className="text-[10px] font-extrabold text-slate-90% bg-yellow-105 border border-yellow-250 px-1.5 py-0.5 rounded-md">
                    ₹{inv.grandTotal.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="text-[10px] font-medium leading-tight">
                  <span className="text-slate-400 block font-bold text-[8.5px] uppercase">Client:</span>
                  <span className="text-slate-700 font-extrabold truncate block max-w-[200px]">{inv.clientName}</span>
                </div>

                <div className="flex justify-between pt-1 border-t border-slate-200/50">
                  <button
                    onClick={() => {
                      setInvoiceNo(inv.invoiceNo);
                      setInvoiceDate(inv.date);
                      setSiteName(inv.siteName);
                      setClientName(inv.clientName);
                      // Set items if matches mock or stored.
                    }}
                    className="text-[9px] font-black uppercase text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    Load Document
                  </button>

                  <button
                    onClick={() => {
                      const filterLogs = savedInvoices.filter(i => i.id !== inv.id);
                      setSavedInvoices(filterLogs);
                      localStorage.setItem('lv_raised_invoices', JSON.stringify(filterLogs));
                    }}
                    className="text-[9px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer"
                  >
                    Delete log
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Styled Print Block injected style to strip default page headers, footers and show pristine fit */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #tax-invoice-form-paper, #tax-invoice-form-paper * {
            visibility: visible;
          }
          #tax-invoice-form-paper {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none;
            padding: 0;
            margin: 0;
            outline: none;
            box-shadow: none;
          }
          header, nav, aside, footer, button, .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>

    </div>
  );
}
