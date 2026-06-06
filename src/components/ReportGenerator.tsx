import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Printer, 
  Calendar, 
  Search, 
  Filter, 
  Layers, 
  Building2, 
  Clock, 
  BookOpen, 
  Hammer, 
  IndianRupee 
} from 'lucide-react';
import { 
  Project, 
  Advance, 
  MaterialPurchase, 
  LaborExpense, 
  DailyExpense, 
  MaterialCategory, 
  WorkerType, 
  DailyExpenseCategory 
} from '../types';

interface ReportGeneratorProps {
  activeProject: Project | null;
  projects: Project[];
  advances: Advance[];
  purchases: MaterialPurchase[];
  laborExpenses: LaborExpense[];
  dailyExpenses: DailyExpense[];
}

type ReportType = 'budget' | 'advance' | 'material' | 'labor' | 'daily' | 'monthly_summary';

export default function ReportGenerator({
  activeProject,
  projects,
  advances,
  purchases,
  laborExpenses,
  dailyExpenses,
}: ReportGeneratorProps) {

  const [activeReportTab, setActiveReportTab] = useState<ReportType>('budget');
  
  // Custom filter grids
  const [materialFilter, setMaterialFilter] = useState<string>('All');
  const [supplierFilter, setSupplierFilter] = useState<string>('All');
  const [workerFilter, setWorkerFilter] = useState<string>('All');
  const [dailyFilter, setDailyFilter] = useState<string>('All');
  
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  if (!activeProject) {
    return (
      <div className="py-8 text-center text-slate-400">
        Please configure or select a project to analyze reports models.
      </div>
    );
  }

  const pId = activeProject.id;

  // Gather dataset
  const projectAdvances = advances.filter(a => a.projectId === pId);
  const projectPurchases = purchases.filter(m => m.projectId === pId && !m.isDeleted);
  const projectLabor = laborExpenses.filter(l => l.projectId === pId);
  const projectDaily = dailyExpenses.filter(d => d.projectId === pId);

  // Financial statistics
  const totalAdvances = projectAdvances.reduce((sum, a) => sum + a.amount, 0);
  const totalMaterial = projectPurchases.reduce((sum, m) => sum + m.totalAmount, 0);
  const totalLabor = projectLabor.reduce((sum, l) => sum + l.totalWage, 0);
  const totalDaily = projectDaily.reduce((sum, d) => sum + d.amount, 0);
  const totalExpenses = totalMaterial + totalLabor + totalDaily;

  const remainingBudget = activeProject.totalBudget - totalExpenses;
  const remainingAdvance = totalAdvances - totalExpenses;

  // Filter criteria options
  const existingSuppliers = Array.from(new Set(projectPurchases.map(p => p.supplier).filter(Boolean)));

  // Filter application helper
  const dateRangeFilter = (itemDate: string) => {
    if (startDate && itemDate < startDate) return false;
    if (endDate && itemDate > endDate) return false;
    return true;
  };

  // Compile datasets for active report selection
  let reportRows: any[] = [];
  let tableHeaders: string[] = [];
  let csvName = 'construction_report';

  if (activeReportTab === 'budget') {
    reportRows = [
      { metric: 'Initial Assigned Project Budget', debit: '-', credit: activeProject.totalBudget, ref: 'PROJECT-' + activeProject.id.toUpperCase() },
      { metric: 'Material Cost Drawdowns', debit: totalMaterial, credit: '-', ref: 'MAT-' + projectPurchases.length + ' pcs' },
      { metric: 'Labor Wages Drafts', debit: totalLabor, credit: '-', ref: 'LABOR-' + projectLabor.length + ' log' },
      { metric: 'Daily site expenses draw', debit: totalDaily, credit: '-', ref: 'UTILITY-' + projectDaily.length + ' vouchers' },
    ];
    tableHeaders = ['Financial Parameter Line', 'Debit Drawn (Dr)', 'Credit Disbursed (Cr)', 'Reference Spec'];
    csvName = `${activeProject.projectName}_budget_audit`;
  } 
  else if (activeReportTab === 'advance') {
    reportRows = projectAdvances
      .filter(a => dateRangeFilter(a.date))
      .map(a => ({
        date: a.date,
        issuedBy: a.givenBy,
        recipient: a.receivedBy,
        method: a.paymentMode,
        remarks: a.remarks || '-',
        amount: a.amount,
      }));
    tableHeaders = ['Payment Date', 'Issuing Contractor', 'Supervisor Recipient', 'Transfer Method', 'Remarks', 'Amount (Cr)'];
    csvName = `${activeProject.projectName}_advances_record`;
  } 
  else if (activeReportTab === 'material') {
    reportRows = projectPurchases
      .filter(p => dateRangeFilter(p.date))
      .filter(p => materialFilter === 'All' || p.category === materialFilter)
      .filter(p => supplierFilter === 'All' || p.supplier === supplierFilter)
      .map(p => ({
        date: p.date,
        category: p.category,
        itemName: p.materialName,
        supplier: p.supplier || '-',
        qtySpec: `${p.quantity} ${p.unit}`,
        rate: `₹${p.rate}`,
        invoiceNo: p.invoiceNo || 'N/A',
        total: p.totalAmount,
      }));
    tableHeaders = ['Invoice Date', 'Category', 'Structure item Specs', 'Supplier Agency', 'Qty & units', 'Rate spec', 'Invoice ID', 'Total Bill amount (Dr)'];
    csvName = `${activeProject.projectName}_material_statement`;
  } 
  else if (activeReportTab === 'labor') {
    reportRows = projectLabor
      .filter(l => dateRangeFilter(l.date))
      .filter(l => workerFilter === 'All' || l.workerType === workerFilter)
      .map(l => ({
        date: l.date,
        workerType: l.workerType,
        workers: `${l.numWorkers} workers`,
        dailyWage: `₹${l.dailyWage}/day`,
        remarks: l.remarks || '-',
        total: l.totalWage,
      }));
    tableHeaders = ['Sheet Date', 'Worker Domain', 'Labor headcount', 'Daily Wage Spec', 'Notes / Task registered', 'Wages drawn (Dr)'];
    csvName = `${activeProject.projectName}_labor_worksheet`;
  } 
  else if (activeReportTab === 'daily') {
    reportRows = projectDaily
      .filter(d => dateRangeFilter(d.date))
      .filter(d => dailyFilter === 'All' || d.category === dailyFilter)
      .map(d => ({
        date: d.date,
        category: d.category,
        description: d.description,
        amt: d.amount,
      }));
    tableHeaders = ['Occurrence Date', 'Voucher Category', 'Debited Description / Details', 'Voucher Amount (Dr)'];
    csvName = `${activeProject.projectName}_operating_vouchers`;
  } 
  else if (activeReportTab === 'monthly_summary') {
    reportRows = [
      { label: 'Overall Construction Site Budget', value: activeProject.totalBudget, highlight: false },
      { label: 'Cumulative Site Advances Received', value: totalAdvances, highlight: false },
      { label: 'Material Ledger Total Purchases', value: totalMaterial, highlight: true },
      { label: 'Labor Ledger Worksheets Wages Drawn', value: totalLabor, highlight: true },
      { label: 'Utility Ledger Site Vouchers Drawn', value: totalDaily, highlight: true },
      { label: 'Total site expenses drawn (Materials + Wages + Vouchers)', value: totalExpenses, highlight: false },
      { label: 'Total Project Budget Reserve Balance', value: remainingBudget, highlight: true },
      { label: 'Mestri Net Bank Reconciliation Reserve Balance', value: remainingAdvance, highlight: false },
    ];
    tableHeaders = ['Monthly Balance Sheets Financial Parameters', 'Sum Aggregations (₹)'];
    csvName = `${activeProject.projectName}_net_summary`;
  }

  // Real client-side CSV trigger
  const handleExportCSV = () => {
    setIsExporting(true);
    
    setTimeout(() => {
      let csvContent = "data:text/csv;charset=utf-8,";
      
      // Headers
      csvContent += tableHeaders.join(",") + "\n";
      
      // Rows convert to values
      reportRows.forEach(row => {
        const values = Object.values(row).map(val => {
          const escaped = String(val).replace(/"/g, '""');
          return `"${escaped}"`;
        });
        csvContent += values.join(",") + "\n";
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${csvName}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link); // Required for FF
      
      link.click();
      document.body.removeChild(link);
      setIsExporting(false);
    }, 850);
  };

  return (
    <div id="reports-module-container" className="space-y-6">
      
      {/* Tab Navigation header */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 flex flex-wrap gap-1.5 overflow-x-auto">
        {(['budget', 'advance', 'material', 'labor', 'daily', 'monthly_summary'] as const).map(tab => {
          let tabLabel = "Budget Allocation";
          if (tab === 'advance') tabLabel = "Advances History";
          if (tab === 'material') tabLabel = "Materials Ledger";
          if (tab === 'labor') tabLabel = "Labor Worksheets";
          if (tab === 'daily') tabLabel = "Daily Site Vouchers";
          if (tab === 'monthly_summary') tabLabel = "Financial Summary Sheets";

          return (
            <button
              id={`report-tab-btn-${tab}`}
              key={tab}
              onClick={() => {
                setActiveReportTab(tab);
                setStartDate('');
                setEndDate('');
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer select-none ${
                activeReportTab === tab 
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              {tabLabel}
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar Controls */}
      <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
          <Filter className="w-4 h-4 text-emerald-500" /> Filter Criteria Configuration
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          
          <div className="space-y-1">
            <label htmlFor="rep-start-date" className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Start Date</label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                id="rep-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-500 text-slate-650 font-medium"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="rep-end-date" className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">End Date</label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                id="rep-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-500 text-slate-650 font-medium"
              />
            </div>
          </div>

          {/* Dynamic selectors based on active report tab */}
          {activeReportTab === 'material' && (
            <>
              <div className="space-y-1">
                <label htmlFor="rep-mat-cat" className="text-[10px] text-slate-400 font-bold uppercase block">Material Category</label>
                <select
                  id="rep-mat-cat"
                  value={materialFilter}
                  onChange={(e) => setMaterialFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-705 font-bold outline-none"
                >
                  <option value="All">All Categories</option>
                  {Object.values(MaterialCategory).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="rep-mat-supp" className="text-[10px] text-slate-400 font-bold uppercase block">Supplier Agency</label>
                <select
                  id="rep-mat-supp"
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-705 font-bold outline-none"
                >
                  <option value="All">All Suppliers</option>
                  {existingSuppliers.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeReportTab === 'labor' && (
            <div className="space-y-1">
              <label htmlFor="rep-work-type" className="text-[10px] text-slate-400 font-bold uppercase block">Worker domain</label>
              <select
                id="rep-work-type"
                value={workerFilter}
                onChange={(e) => setWorkerFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-705 font-bold outline-none"
              >
                <option value="All">All Workers</option>
                {Object.values(WorkerType).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}

          {activeReportTab === 'daily' && (
            <div className="space-y-1">
              <label htmlFor="rep-daily-cat" className="text-[10px] text-slate-400 font-bold uppercase block">Voucher Category</label>
              <select
                id="rep-daily-cat"
                value={dailyFilter}
                onChange={(e) => setDailyFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-705 font-bold outline-none"
              >
                <option value="All">All Categories</option>
                {Object.values(DailyExpenseCategory).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}

        </div>

        {/* Action Triggers */}
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-50">
          <button
            id="print-report-btn"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 rounded-xl text-xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" /> Local Print / PDF
          </button>
          
          <button
            id="export-csv-btn"
            onClick={handleExportCSV}
            disabled={isExporting}
            className={`flex items-center gap-1.5 bg-slate-900 active:bg-slate-950 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer select-none ${
              isExporting ? 'opacity-50 pointer-events-none' : 'hover:bg-slate-950'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" /> 
            {isExporting ? 'Compiling Spreadsheet...' : 'Export formatted CSV'}
          </button>
        </div>
      </div>

      {/* List / Data grids reports results */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4 printable-report-sheet">
        
        {/* Invoice Letterhead visual element */}
        <div className="hidden print:block border-b-2 border-slate-900 pb-5 mb-5">
          <div className="text-right">
            <h1 className="text-2xl font-black text-slate-950 uppercase tracking-tight">Contractor Budget Pro Real-time Auditing</h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">Audit Ledger Statement Sheet</p>
          </div>
          <div className="mt-4 grid grid-cols-2 text-xs font-bold text-slate-700">
            <div>
              <p>Project Name: <span className="text-slate-950">{activeProject.projectName}</span></p>
              <p>Location: {activeProject.siteName}</p>
            </div>
            <div className="text-right">
              <p>Client Name: {activeProject.clientName}</p>
              <p>Report Date: {new Date().toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>
            </div>
          </div>
        </div>

        {/* Dynamic header label inside dashboard screen */}
        <div className="flex items-center gap-2 text-slate-800 font-black border-b border-slate-100 pb-3">
          <BookOpen className="w-5 h-5 text-blue-500" />
          <h3 className="text-base uppercase tracking-wider">
            {activeReportTab.replace('_', ' ')} Statement Registry
          </h3>
        </div>

        {reportRows.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            No entries found matching the active filter parameters in this timeframe.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full border-collapse text-left text-xs" id="custom-reports-table">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-wider text-[10px]">
                  {tableHeaders.map((head, index) => (
                    <th key={index} className={`px-5 py-3.5 ${
                      index === tableHeaders.length - 1 && activeReportTab !== 'budget' ? 'text-right' : 'text-left'
                    }`}>
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                
                {activeReportTab === 'budget' && reportRows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/25">
                    <td className="px-5 py-3.5 text-slate-800 font-bold">{r.metric}</td>
                    <td className="px-5 py-3.5 text-rose-600">
                      {r.debit !== '-' ? `₹${r.debit.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="px-5 py-3.5 text-emerald-600 font-bold">
                      {r.credit !== '-' ? `₹${r.credit.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 font-bold text-[10px] font-mono">{r.ref}</td>
                  </tr>
                ))}

                {activeReportTab === 'advance' && reportRows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/25">
                    <td className="px-5 py-3.5 text-slate-500 font-bold whitespace-nowrap">{r.date}</td>
                    <td className="px-5 py-3.5 text-slate-800 font-bold">{r.issuedBy}</td>
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">{r.recipient}</td>
                    <td className="px-5 py-3.5 text-[10px] whitespace-nowrap">
                      <span className="p-1 px-2 bg-slate-100 text-slate-600 rounded-md">{r.method}</span>
                    </td>
                    <td className="px-5 py-3.5 max-w-[180px] truncate text-slate-400">{r.remarks}</td>
                    <td className="px-5 py-3.5 text-right font-black text-slate-900 whitespace-nowrap">
                      ₹{r.amount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}

                {activeReportTab === 'material' && reportRows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/25">
                    <td className="px-5 py-3.5 text-slate-505 font-bold whitespace-nowrap">{r.date}</td>
                    <td className="px-5 py-3.5 text-slate-500">
                      <span className="p-1 px-2.5 bg-blue-50 text-blue-600 text-[9px] uppercase font-bold tracking-wider rounded-lg border border-blue-100">
                        {r.category}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-800 font-bold">{r.itemName}</td>
                    <td className="px-5 py-3.5 text-slate-500">{r.supplier}</td>
                    <td className="px-5 py-3.5 text-slate-500 focus:font-black whitespace-nowrap">{r.qtySpec}</td>
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">{r.rate}</td>
                    <td className="px-5 py-3.5 font-bold font-mono text-[10px] text-slate-400">{r.invoiceNo}</td>
                    <td className="px-5 py-3.5 text-right font-black text-slate-900 whitespace-nowrap">
                      ₹{r.total.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}

                {activeReportTab === 'labor' && reportRows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/25">
                    <td className="px-5 py-3.5 text-slate-500 font-bold whitespace-nowrap">{r.date}</td>
                    <td className="px-5 py-3.5 font-bold text-slate-800">{r.workerType}</td>
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">{r.workers}</td>
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">{r.dailyWage}</td>
                    <td className="px-5 py-3.5 text-slate-405 truncate max-w-sm" title={r.remarks}>{r.remarks}</td>
                    <td className="px-5 py-3.5 text-right font-black text-slate-900 whitespace-nowrap">
                      ₹{r.total.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}

                {activeReportTab === 'daily' && reportRows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/25">
                    <td className="px-5 py-3.5 text-slate-505 font-bold whitespace-nowrap">{r.date}</td>
                    <td className="px-5 py-3.5 font-bold text-slate-800 uppercase tracking-wide text-[9px]">{r.category}</td>
                    <td className="px-5 py-3.5 text-slate-550 leading-relaxed max-w-md">{r.description}</td>
                    <td className="px-5 py-3.5 text-right font-black text-slate-900 whitespace-nowrap">
                      ₹{r.amt.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}

                {activeReportTab === 'monthly_summary' && reportRows.map((r, i) => {
                  let textClass = "text-slate-850";
                  let rowBg = "hover:bg-slate-50/25";
                  if (r.highlight) {
                    textClass = "text-emerald-800 font-black";
                    rowBg = "bg-emerald-50/10";
                  }

                  const isHeaderTotalLine = r.label.includes('Reserve Balance') || r.label.includes('Overall');

                  return (
                    <tr key={i} className={`${rowBg} ${isHeaderTotalLine ? 'bg-slate-50 border-t border-slate-200' : ''}`}>
                      <td className={`px-5 py-4 ${isHeaderTotalLine ? 'font-black text-slate-950 text-xs uppercase tracking-wide' : textClass}`}>
                        {r.label}
                      </td>
                      <td className={`px-5 py-4 text-right font-black text-sm whitespace-nowrap ${
                        isHeaderTotalLine ? 'text-slate-950 font-extrabold text-sm' : 'text-slate-800'
                      }`}>
                        ₹{r.value.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}

              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
