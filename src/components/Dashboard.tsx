import React, { useState } from 'react';
import { 
  Building2, 
  Wallet, 
  Layers, 
  Users, 
  Wrench, 
  TrendingUp, 
  AlertTriangle, 
  Calendar, 
  User as UserIcon, 
  IndianRupee 
} from 'lucide-react';
import { 
  Project, 
  Advance, 
  MaterialPurchase, 
  LaborExpense, 
  DailyExpense, 
  MaterialCategory,
  UserRole,
  PaymentStatus
} from '../types';

interface DashboardProps {
  activeProject: Project | null;
  projects: Project[];
  advances: Advance[];
  purchases: MaterialPurchase[];
  laborExpenses: LaborExpense[];
  dailyExpenses: DailyExpense[];
  currentUserRole: UserRole;
  onChangeProject: (project: Project) => void;
}

export default function Dashboard({
  activeProject,
  projects,
  advances,
  purchases,
  laborExpenses,
  dailyExpenses,
  currentUserRole,
  onChangeProject,
}: DashboardProps) {

  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);

  if (!activeProject) {
    return (
      <div id="no-project-dashboard" className="bg-white rounded-2xl border border-slate-100 p-12 text-center max-w-xl mx-auto my-12">
        <Building2 className="w-16 h-16 mx-auto text-slate-300 stroke-[1.5] mb-4" />
        <h3 className="text-xl font-bold text-slate-800">No Projects Configured</h3>
        <p className="text-slate-500 mt-2">
          {currentUserRole === UserRole.ADMIN 
            ? "Please head over to the 'Projects' module to create your first construction site." 
            : "No active projects are configured in the system. Please consult with the Administrator."}
        </p>
      </div>
    );
  }

  const pId = activeProject.id;

  // Filter dataset for active project
  const projectAdvances = advances.filter(a => a.projectId === pId);
  const projectPurchases = purchases.filter(m => m.projectId === pId && !m.isDeleted);
  const projectLabor = laborExpenses.filter(l => l.projectId === pId);
  const projectDaily = dailyExpenses.filter(d => d.projectId === pId);

  // Financial aggregates
  const totalBudget = activeProject.totalBudget;
  const totalAdvances = projectAdvances.reduce((sum, a) => sum + a.amount, 0);
  const totalMaterialCost = projectPurchases.reduce((sum, m) => sum + m.totalAmount, 0);
  const totalLaborCost = projectLabor.reduce((sum, l) => sum + l.totalWage, 0);
  const totalSiteExpense = projectDaily.reduce((sum, d) => sum + d.amount, 0);

  // Paid and In Credit breakdowns for budget tallying
  const paidMaterialCost = projectPurchases.reduce((sum, m) => {
    if (m.paidAmount !== undefined) return sum + m.paidAmount;
    return sum + (m.paymentStatus !== PaymentStatus.CREDIT ? m.totalAmount : 0);
  }, 0);
  const paidLaborCost = projectLabor.filter(l => l.paymentStatus !== PaymentStatus.CREDIT).reduce((sum, l) => sum + l.totalWage, 0);
  const paidSiteExpense = projectDaily.filter(d => d.paymentStatus !== PaymentStatus.CREDIT).reduce((sum, d) => sum + d.amount, 0);

  const creditMaterialCost = projectPurchases.reduce((sum, m) => {
    if (m.creditAmount !== undefined) return sum + m.creditAmount;
    return sum + (m.paymentStatus === PaymentStatus.CREDIT ? m.totalAmount : 0);
  }, 0);
  const creditLaborCost = projectLabor.filter(l => l.paymentStatus === PaymentStatus.CREDIT).reduce((sum, l) => sum + l.totalWage, 0);
  const creditSiteExpense = projectDaily.filter(d => d.paymentStatus === PaymentStatus.CREDIT).reduce((sum, d) => sum + d.amount, 0);

  const totalSpent = totalMaterialCost + totalLaborCost + totalSiteExpense;
  const totalSpentPaid = paidMaterialCost + paidLaborCost + paidSiteExpense;
  const totalSpentCredit = creditMaterialCost + creditLaborCost + creditSiteExpense;

  const remainingBudget = totalBudget - totalSpent;
  const remainingAdvance = totalAdvances - totalSpentPaid; // Outstanding in-credit sheets do not spend active cash advance!

  // Percentage trackers
  const budgetUtilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const advanceUtilization = totalAdvances > 0 ? (totalSpent / totalAdvances) * 100 : 0;

  // Materials Category grouping for secondary charts
  const materialCategorySums: Record<string, number> = {};
  Object.values(MaterialCategory).forEach(cat => {
    materialCategorySums[cat] = 0;
  });
  projectPurchases.forEach(m => {
    materialCategorySums[m.category] = (materialCategorySums[m.category] || 0) + m.totalAmount;
  });

  const materialCategoriesSorted = Object.entries(materialCategorySums)
    .filter(([_, sum]) => sum > 0)
    .sort((a, b) => b[1] - a[1]);

  // SVG Doughnut Chart Calculation variables
  const data = [
    { name: 'Materials', value: totalMaterialCost, color: '#3b82f6' }, // Blue
    { name: 'Labor', value: totalLaborCost, color: '#f59e0b' }, // Amber
    { name: 'Daily Site', value: totalSiteExpense, color: '#10b981' }, // Emerald
  ];
  
  const valuesSum = totalSpent || 1; // Safeguard division by zero

  // Cumulative angles for SVG doughnut arcs
  let accumulatedPercent = 0;
  const pieSlices = data.map((slice, index) => {
    const percent = slice.value / valuesSum;
    const startAngle = accumulatedPercent * 360;
    accumulatedPercent += percent;
    const endAngle = accumulatedPercent * 360;

    // Convert polar coordinates to Cartesian for SVG path
    const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
      const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
      return {
        x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInRadians),
      };
    };

    const describeArc = (x: number, y: number, radius: number, startA: number, endA: number) => {
      const start = polarToCartesian(x, y, radius, endA);
      const end = polarToCartesian(x, y, radius, startA);
      const largeArcFlag = endA - startA <= 180 ? "0" : "1";
      return [
        "M", start.x, start.y, 
        "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
      ].join(" ");
    };

    const dPath = percent >= 0.999 
      ? `M 100,60 A 40,40 0 1,1 99.99,60` // Almost complete circle
      : describeArc(100, 100, 60, startAngle, endAngle);

    return {
      path: dPath,
      color: slice.color,
      name: slice.name,
      value: slice.value,
      percent: percent * 100,
    };
  });

  return (
    <div id="dashboard-container" className="space-y-8">
      {/* Upper Selector Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-slate-500 font-semibold text-xs uppercase tracking-wider">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span>Active Project Dashboard</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-850 tracking-tight">
            {activeProject.projectName}
          </h2>
          <p className="text-slate-500 text-sm flex items-center gap-4 font-sans">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-slate-400" /> Timeline: {activeProject.startDate} to {activeProject.expectedEndDate}
            </span>
            <span className="flex items-center gap-1">
              <UserIcon className="w-4 h-4 text-slate-400" /> Client: {activeProject.clientName}
            </span>
          </p>
        </div>

        {/* Quick Swapper Dropdown */}
        <div className="flex items-center gap-2">
          <label htmlFor="dashboard-proj-selector" className="text-slate-650 text-sm font-bold select-none">Switch Project:</label>
          <select
            id="dashboard-proj-selector"
            value={pId}
            onChange={(e) => {
              const proj = projects.find(p => p.id === e.target.value);
              if (proj) onChangeProject(proj);
            }}
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none transition-colors cursor-pointer"
          >
            {projects.map((proj) => (
              <option key={proj.id} value={proj.id}>
                {proj.projectName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Budget Card */}
        <div id="stat-card-budget" className="stat-card border-blue-600 bg-white rounded-xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Project Budget</span>
              <h3 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center mono">
                <IndianRupee className="w-5 h-5 text-slate-450 mr-0.5" />
                {totalBudget.toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400">Status</span>
            <span className={`px-2 py-0.5 rounded-md ${
              activeProject.status === 'Active' ? 'bg-emerald-50 text-emerald-600' :
              activeProject.status === 'Completed' ? 'bg-sky-50 text-sky-600' : 'bg-red-50 text-red-600'
            }`}>
              {activeProject.status}
            </span>
          </div>
        </div>

        {/* Total Advances Issued Card */}
        <div id="stat-card-advance" className="stat-card border-emerald-500 bg-white rounded-xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Issued Advances</span>
              <h3 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center mono">
                <IndianRupee className="w-5 h-5 text-slate-450 mr-0.5" />
                {totalAdvances.toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400">Allocated Batches</span>
            <span className="text-slate-700 font-bold">{projectAdvances.length} Payments</span>
          </div>
        </div>

        {/* Total Expenses Card */}
        <div id="stat-card-expenses" className="stat-card border-orange-500 bg-white rounded-xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Expenses Debited</span>
              <h3 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center mono">
                <IndianRupee className="w-5 h-5 text-slate-450 mr-0.5" />
                {totalSpent.toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-600">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-2 text-[10px] bg-slate-50 border border-slate-100 p-2 rounded-xl flex items-center justify-between font-bold">
            <span className="text-emerald-700">💰 Paid: ₹{totalSpentPaid.toLocaleString('en-IN')}</span>
            <span className="text-rose-700">💳 Credit: ₹{totalSpentCredit.toLocaleString('en-IN')}</span>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-400">Budget Spent</span>
              <span className="text-slate-700 font-bold">{budgetUtilization.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${budgetUtilization > 100 ? 'bg-red-500' : 'bg-orange-500'}`}
                style={{ width: `${Math.min(budgetUtilization, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Remaining Budget vs Advances Alert Card */}
        <div id="stat-card-balance" className="stat-card border-slate-300 bg-white rounded-xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Remaining Budget</span>
              <h3 className={`text-2xl font-bold tracking-tight flex items-center mono ${remainingBudget < 0 ? 'text-red-650' : 'text-slate-700'}`}>
                <IndianRupee className="w-5 h-5 text-slate-450 mr-0.5" />
                {remainingBudget.toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-500">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400">Available Balance</span>
            <span className={`${remainingBudget < 0 ? 'text-red-500 font-bold' : 'text-slate-500 font-bold'}`}>
              {remainingBudget < 0 ? 'Overspent' : 'Under Budget'}
            </span>
          </div>
        </div>
      </div>

      {/* Reconciliation Callout & Advance Balance indicator */}
      <div className={`p-5 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
        remainingAdvance < 10000 ? 'bg-red-50/50 border-red-100' : 'bg-slate-50 border-slate-100'
      }`}>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Mestri Workspace Reconciliation</h4>
          <p className="text-xs text-slate-500 max-w-xl">
            This compares the sum of advances given to the Site supervisor (₹{totalAdvances.toLocaleString('en-IN')}) against itemized bills recorded on the site (₹{totalSpent.toLocaleString('en-IN')}).
            <span className="text-emerald-700 font-extrabold block mt-1">
              💡 Outstanding credit purchases of ₹{totalSpentCredit.toLocaleString('en-IN')} are excluded from cash deductions to keep your actual cash-in-hand accurate!
            </span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-slate-400 font-semibold uppercase">Mestri Advance Balance</div>
            <div className={`text-xl font-extrabold flex items-center justify-end ${remainingAdvance < 10000 ? 'text-red-600' : 'text-slate-800'}`}>
              <IndianRupee className="w-4 h-4 mr-0.5" />
              {remainingAdvance.toLocaleString('en-IN')}
            </div>
          </div>
          {remainingAdvance < 10000 && (
            <div className="bg-red-100 text-red-600 px-3 py-1.5 rounded-xl text-xs font-bold leading-none flex items-center gap-1.5 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" /> Low Advance
            </div>
          )}
        </div>
      </div>

      {/* Analytics Graphs Visual grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Graphic 1: Expense Breakdown Ring (Doughnut) */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-1 mb-4">
            <h4 className="font-bold text-slate-800 text-base">Expense Breakdown</h4>
            <p className="text-xs text-slate-400">Comparative split between materials, labor and local site utility voucher payouts.</p>
          </div>

          {totalSpent === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm">
              <Layers className="w-12 h-12 stroke-[1.2] mb-2 text-slate-300" />
              There are no expenses logged on this project yet.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-around gap-6 h-64">
              {/* Custom interactive SVG Doughnut */}
              <div className="relative w-44 h-44 flex-shrink-0">
                <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
                  {pieSlices.map((slice, i) => (
                    <path
                      id={`pie-slice-${i}`}
                      key={i}
                      d={slice.path}
                      fill="none"
                      stroke={slice.color}
                      strokeWidth={hoveredSlice === i ? 26 : 20}
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setHoveredSlice(i)}
                      onMouseLeave={() => setHoveredSlice(null)}
                      style={{ transformOrigin: 'center' }}
                    />
                  ))}
                  {/* Outer boundary Ring */}
                  <circle cx="100" cy="100" r="72" fill="none" stroke="#f1f5f9" strokeWidth="1" />
                  <circle cx="100" cy="100" r="48" fill="none" stroke="#f1f5f9" strokeWidth="1" />
                </svg>

                {/* Center Value Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-center">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Spent Total</span>
                  <span className="text-sm font-black text-slate-800">
                    ₹{totalSpent < 100000 ? totalSpent.toLocaleString() : `${(totalSpent / 100000).toFixed(1)}L`}
                  </span>
                </div>
              </div>

              {/* Labels & Details */}
              <div className="flex-1 space-y-4">
                {pieSlices.map((slice, i) => (
                  <div 
                    id={`legend-item-${i}`}
                    key={i} 
                    className={`p-2.5 rounded-xl border transition-all ${
                      hoveredSlice === i ? 'bg-slate-50 border-slate-200 shadow-xs scale-102' : 'border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: slice.color }} />
                        <span className="text-xs font-bold text-slate-700">{slice.name}</span>
                      </div>
                      <span className="text-xs font-black text-slate-800">₹{slice.value.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="flex justify-between items-center mt-1 text-[10px] text-slate-400 font-semibold">
                      <span>Proportion</span>
                      <span>{slice.percent.toFixed(1)}%</span>
                    </div>

                    {/* Progress slider mini */}
                    <div className="w-full bg-slate-100 h-1 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${slice.percent}%`, backgroundColor: slice.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Graphic 2: Material-wise Spending Breakdown */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-1 mb-4 flex justify-between items-start">
            <div>
              <h4 className="font-bold text-slate-800 text-base">Material Payout Split</h4>
              <p className="text-xs text-slate-400">Total expenditure breakdown by structural material categories.</p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 bg-amber-50 text-amber-600 rounded-full">
              🧱 {projectPurchases.length} Purchases
            </span>
          </div>

          {projectPurchases.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm">
              <Building2 className="w-12 h-12 stroke-[1.2] mb-2 text-slate-300" />
              No material purchases logged yet.
            </div>
          ) : (
            <div className="space-y-3 p-1 overflow-y-auto max-h-64">
              {materialCategoriesSorted.map(([category, sum]) => {
                const proportionOfMaterials = totalMaterialCost > 0 ? (sum / totalMaterialCost) * 100 : 0;
                return (
                  <div id={`material-split-item-${category}`} key={category} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {category}
                      </span>
                      <div className="space-x-1">
                        <span className="text-slate-400">({proportionOfMaterials.toFixed(0)}%)</span>
                        <span className="text-slate-800 font-extrabold">₹{sum.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${proportionOfMaterials}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Labor type stats panel */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 text-base">Site Labor Workforce Payouts</h4>
            <p className="text-xs text-slate-400">Wage analysis across masonry, carpentry, helper, electrical, mechanical and painting domains.</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Total Wage Debit</div>
            <div className="text-lg font-black text-slate-800">₹{totalLaborCost.toLocaleString('en-IN')}</div>
          </div>
        </div>

        {projectLabor.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            No Labor payments registered on this week's worksheets.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from(new Set(projectLabor.map(l => l.workerType))).map(workerType => {
              const matches = projectLabor.filter(l => l.workerType === workerType);
              const workerWage = matches.reduce((sum, l) => sum + l.totalWage, 0);
              const workerCount = matches.reduce((sum, l) => sum + l.numWorkers, 0);
              
              let bg = "bg-rose-50/50 border-rose-100 text-rose-600";
              if (workerType === "Mason") bg = "bg-orange-50/50 border-orange-100 text-orange-600";
              if (workerType === "Helper") bg = "bg-amber-50/50 border-amber-100 text-amber-600";
              if (workerType === "Electrician") bg = "bg-blue-50/50 border-blue-100 text-blue-600";
              if (workerType === "Plumber") bg = "bg-indigo-50/50 border-indigo-100 text-indigo-600";

              return (
                <div id={`worker-box-${workerType}`} key={workerType} className={`p-4 rounded-2xl border flex gap-3 items-center ${bg}`}>
                  <div className="p-3 bg-white rounded-xl shadow-xs font-bold text-sm">
                    {workerCount}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{workerType} Payments</h5>
                    <p className="text-lg font-black mt-0.5 text-slate-800">₹{workerWage.toLocaleString('en-IN')}</p>
                    <span className="text-[10px] text-slate-400 font-semibold">{matches.length} entry sheets</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
