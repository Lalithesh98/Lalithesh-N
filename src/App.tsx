import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  User, 
  MapPin, 
  Wallet, 
  TrendingUp, 
  Hammer, 
  Compass, 
  Scale, 
  FileText, 
  BookOpen, 
  History, 
  RefreshCw,
  X,
  PlusCircle,
  TrendingDown,
  Bell,
  HardHat,
  ChevronRight,
  LogOut,
  Sliders,
  CheckCircle,
  IndianRupee,
  Lock,
  Search
} from 'lucide-react';

// Custom types and API helpers
import { 
  Project, 
  Advance, 
  MaterialPurchase, 
  LaborExpense, 
  DailyExpense, 
  Notification, 
  AuditLog, 
  UserRole,
  User as AppUser
} from './types';
import appApi from './api';

// Subcomponents
import Dashboard from './components/Dashboard';
import ProjectManager from './components/ProjectManager';
import AdvanceManager from './components/AdvanceManager';
import MaterialPurchaseTracker from './components/MaterialPurchaseTracker';
import LaborExpenseTracker from './components/LaborExpenseTracker';
import DailyExpenseTracker from './components/DailyExpenseTracker';
import ExpenseReconciliation from './components/ExpenseReconciliation';
import DocumentManager from './components/DocumentManager';
import ReportGenerator from './components/ReportGenerator';
import AuditTrailViewer from './components/AuditTrailViewer';
import NotificationDrawer from './components/NotificationDrawer';
import ReceiptLightbox from './components/ReceiptLightbox';

type AppTabs = 
  | 'dashboard' 
  | 'projects' 
  | 'advances' 
  | 'materials' 
  | 'labor' 
  | 'daily' 
  | 'reconciliation' 
  | 'documents' 
  | 'reports' 
  | 'audit';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTabs>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Core Data Lists
  const [projects, setProjects] = useState<Project[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [purchases, setPurchases] = useState<MaterialPurchase[]>([]);
  const [laborExpenses, setLaborExpenses] = useState<LaborExpense[]>([]);
  const [dailyExpenses, setDailyExpenses] = useState<DailyExpense[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  // Auth session states
  const [sessionUser, setSessionUser] = useState<AppUser | null>(() => {
    const cached = localStorage.getItem('cms_session_user');
    return cached ? JSON.parse(cached) : null;
  });

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const currentUserRole = sessionUser?.role || UserRole.ADMIN;
  const activeUser = sessionUser || { id: 'u1', name: 'Lalithesh N', role: UserRole.ADMIN, email: 'lalithesh@lvconstructions.com' };

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [previewBillUrl, setPreviewBillUrl] = useState<string | null>(null);
  const [previewMetadata, setPreviewMetadata] = useState<any | null>(null);

  // Define tab pages permissions for each of the 3 roles
  const getTabsForRole = (role: UserRole): AppTabs[] => {
    switch (role) {
      case UserRole.ADMIN:
        return ['dashboard', 'projects', 'advances', 'materials', 'labor', 'daily', 'reconciliation', 'documents', 'reports', 'audit'];
      case UserRole.PROPRIETOR:
        return ['dashboard', 'reconciliation', 'documents', 'reports'];
      case UserRole.MESTRI:
        return ['dashboard', 'materials', 'labor', 'daily', 'documents'];
      default:
        return ['dashboard'];
    }
  };

  const handleQuickLogin = async (email: string, password?: string) => {
    setLoading(true);
    setLoginError(null);
    try {
      const res = await appApi.login(email, password);
      if (res?.user) {
        setSessionUser(res.user);
        localStorage.setItem('cms_session_user', JSON.stringify(res.user));
        
        // Always reset navigation tab to allowed view upon login
        setActiveTab('dashboard');
      } else {
        setLoginError('Verification failed. Try again.');
      }
    } catch (e: any) {
      setLoginError(e.message || 'Login credentials rejected.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) return;
    handleQuickLogin(loginEmail.trim(), loginPassword.trim());
  };

  const handleLogout = () => {
    setSessionUser(null);
    setLoginPassword('');
    localStorage.removeItem('cms_session_user');
  };

  // Initial and reactive loader
  const loadDatabaseState = async (silently = false) => {
    if (!silently) setLoading(true);
    try {
      const data = await appApi.getData();
      
      // Filter out deleted projects
      const activeProjects = (data.projects || []).filter((p: Project) => !p.isDeleted);
      setProjects(activeProjects);
      
      setAdvances(data.advances || []);
      setPurchases(data.purchases || []);
      setLaborExpenses(data.laborExpenses || []);
      setDailyExpenses(data.dailyExpenses || []);
      setNotifications(data.notifications || []);
      setAuditLogs(data.auditLogs || []);

      // Retain or select active project
      if (activeProjects.length > 0) {
        if (activeProject) {
          const currentFresh = activeProjects.find((p: Project) => p.id === activeProject.id);
          setActiveProject(currentFresh || activeProjects[0]);
        } else {
          setActiveProject(activeProjects[0]);
        }
      } else {
        setActiveProject(null);
      }
      
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failure loading construction budget databases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatabaseState();
  }, []);

  // Callback triggers for child components
  const handleAddProject = async (projectData: Partial<Project>) => {
    try {
      await appApi.saveProject({
        ...projectData,
        userId: activeUser.id,
        userName: activeUser.name,
      });
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Cannot save project metadata');
    }
  };

  const handleDeleteProject = async (pId: string) => {
    try {
      await appApi.deleteProject(pId, activeUser.id, activeUser.name);
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Cannot delete project');
    }
  };

  const handleAddAdvance = async (advanceData: Partial<Advance>) => {
    try {
      await appApi.addAdvance({
        ...advanceData,
        userId: activeUser.id,
        userName: activeUser.name,
      });
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Disbursement failure');
    }
  };

  const handleAddPurchase = async (purchaseData: Partial<MaterialPurchase>) => {
    try {
      await appApi.addPurchase({
        ...purchaseData,
        userId: activeUser.id,
        userName: activeUser.name,
      });
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Material entry failure');
    }
  };

  const handleDeletePurchase = async (purchaseId: string) => {
    try {
      await appApi.deletePurchase(purchaseId, activeUser.id, activeUser.name);
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Failed log removal');
    }
  };

  const handleAddLabor = async (laborData: Partial<LaborExpense>) => {
    try {
      await appApi.addLabor({
        ...laborData,
        userId: activeUser.id,
        userName: activeUser.name,
      });
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Wage registration failure');
    }
  };

  const handleAddDailyExpense = async (dailyData: Partial<DailyExpense>) => {
    try {
      await appApi.addDailyExpense({
        ...dailyData,
        userId: activeUser.id,
        userName: activeUser.name,
      });
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Voucher logging failure');
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await appApi.markNotificationsRead(activeUser.id);
      await loadDatabaseState(true);
    } catch (err) {
      console.warn('Failed clearing indicators', err);
    }
  };

  const handleOpenPreviewLightbox = (billUrl: string, metadata?: any) => {
    setPreviewBillUrl(billUrl);
    setPreviewMetadata(metadata || null);
  };

  // Derive unread alerts
  const unreadNotifs = notifications.filter(n => !n.isRead);

  // Selectable navigation tab specs
  const getTabLabel = (key: AppTabs) => {
    switch (key) {
      case 'dashboard': return 'Dashboard Analytics';
      case 'projects': return 'Project Sites';
      case 'advances': return 'Cash Advances';
      case 'materials': return 'Material Bills';
      case 'labor': return 'Labor Wages';
      case 'daily': return 'Site Vouchers';
      case 'reconciliation': return 'Ledger Reconciliation';
      case 'documents': return 'Invoices & Files';
      case 'reports': return 'Financial Reports';
      case 'audit': return 'Audit Logs';
    }
  };

  // Secure Login Gate
  if (!sessionUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 font-sans selection:bg-emerald-100 selection:text-emerald-800">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200/50">
          
          {/* Aesthetic info column with geometric/construction outline */}
          <div className="bg-slate-900 p-8 md:p-12 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-600/10 rounded-full blur-2xl -ml-16 -mb-16"></div>
            
            {/* Header Branding */}
            <div className="flex items-center gap-3 relative z-10">
              <div className="p-2.5 bg-emerald-600 rounded-2xl text-white shadow-lg shadow-emerald-600/20">
                <Building2 className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-base font-extrabold tracking-tight uppercase">LV Constructions</h1>
                <p className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest leading-none">Dashboard Terminal</p>
              </div>
            </div>

            {/* Core Message / Mission of CMS */}
            <div className="space-y-6 my-12 relative z-10">
              <span className="px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold rounded-full text-[10px] uppercase tracking-wider inline-block">
                LV Constructions Active System
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight leading-tight">
                Construction Budget & Expense Management
              </h2>
              <p className="text-slate-400 text-xs leading-relaxed">
                Seamless real-time logs, on-site material deliveries, labor payouts, and executive reconciliations in one central ledger. Fully secure with credential protection.
              </p>
              
              <div className="space-y-3 pt-2 text-xs font-semibold text-slate-300">
                <div className="flex gap-2.5 items-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Project Administrator: Lalithesh N</span>
                </div>
                <div className="flex gap-2.5 items-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Project Proprietor: Varun Kashyap</span>
                </div>
                <div className="flex gap-2.5 items-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Site Supervisor Mestri: Nagaraj S</span>
                </div>
              </div>
            </div>

            {/* Footer tags */}
            <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest relative z-10">
              LV Constructions • Ledger Terminal v2.1
            </div>
          </div>

          {/* Actual Login Interactive Form column */}
          <div className="p-8 md:p-12 flex flex-col justify-center space-y-8 bg-white">
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Supervisor Portal Access</h3>
              <p className="text-slate-500 text-xs leading-relaxed">Choose an account below for instant demo login, or enter credentials manually with the newly configured passwords.</p>
            </div>

            {/* Quick-select role options with credentials displayed */}
            <div className="space-y-3">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Instant Portal Gateways</label>
              
              <button
                onClick={() => handleQuickLogin('lalithesh@lvconstructions.com', 'admin123')}
                className="w-full text-left p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/10 transition-all flex items-center gap-3.5 group cursor-pointer"
              >
                <div className="p-2 mr-0.5 rounded-xl bg-blue-500/10 text-blue-600 group-hover:bg-blue-500/20 transition-all">
                  <User className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-800 text-xs">Lalithesh N (Admin)</span>
                    <span className="text-[8px] font-black bg-blue-50 text-blue-605 border border-blue-100 uppercase px-1.5 py-0.5 rounded-md">Pass: admin123</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">lalithesh@lvconstructions.com • Full Control</p>
                </div>
              </button>

              <button
                onClick={() => handleQuickLogin('varun@lvconstructions.com', 'varun123')}
                className="w-full text-left p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/10 transition-all flex items-center gap-3.5 group cursor-pointer"
              >
                <div className="p-2 mr-0.5 rounded-xl bg-purple-500/10 text-purple-600 group-hover:bg-purple-500/20 transition-all">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-800 text-xs">Varun Kashyap (Proprietor)</span>
                    <span className="text-[8px] font-black bg-purple-50 text-purple-605 border border-purple-100 uppercase px-1.5 py-0.5 rounded-md">Pass: varun123</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">varun@lvconstructions.com • Audit Access</p>
                </div>
              </button>

              <button
                onClick={() => handleQuickLogin('nagaraj@lvconstructions.com', 'nagaraj123')}
                className="w-full text-left p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/10 transition-all flex items-center gap-3.5 group cursor-pointer"
              >
                <div className="p-2 mr-0.5 rounded-xl bg-amber-500/10 text-amber-600 group-hover:bg-amber-500/20 transition-all">
                  <HardHat className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-800 text-xs">Nagaraj S (Mestri)</span>
                    <span className="text-[8px] font-black bg-amber-50 text-amber-650 border border-amber-100 uppercase px-1.5 py-0.5 rounded-md">Pass: nagaraj123</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">nagaraj@lvconstructions.com • Daily Site Logs</p>
                </div>
              </button>
            </div>

            {/* OR text dividing line */}
            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold">
              <div className="flex-1 h-px bg-slate-100"></div>
              <span>OR LOG IN SECURELY</span>
              <div className="flex-1 h-px bg-slate-100"></div>
            </div>

            {/* Custom Input sign-in */}
            <form onSubmit={handleManualLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="login-email-input" className="text-[9px] font-bold text-slate-500 uppercase block tracking-widest">Username or Email</label>
                <input
                  id="login-email-input"
                  type="text"
                  required
                  placeholder="lalithesh / varun / nagaraj"
                  value={loginEmail}
                  onChange={(e) => {
                    setLoginEmail(e.target.value);
                    setLoginError(null);
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl text-xs outline-none transition-all placeholder-slate-400 font-medium text-slate-700"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="login-password-input" className="text-[9px] font-bold text-slate-500 uppercase block tracking-widest">Password</label>
                <input
                  id="login-password-input"
                  type="password"
                  required
                  placeholder="admin123 / varun123 / nagaraj123"
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    setLoginError(null);
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl text-xs outline-none transition-all placeholder-slate-400 font-medium text-slate-700"
                />
              </div>

              {loginError && (
                <p className="text-xs text-rose-500 font-extrabold flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  {loginError}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-slate-900 hover:bg-slate-950 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer select-none"
              >
                <span>Launch LV Console</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 selection:bg-emerald-100 selection:text-emerald-800 flex flex-col font-sans">
      
      {/* Simulation Persona Bar at Top (AI Studio Demo control, absolute transparency) */}
      <div className="bg-slate-900 border-b border-slate-800 text-white p-3 py-2 px-4 flex flex-col md:flex-row justify-between items-center gap-3 no-print">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-500 animate-spin-slow" />
          <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Quick Simulation Switch:</span>
          <div className="flex gap-1.5 flex-wrap">
            {Object.values(UserRole).map(role => (
              <button
                id={`switch-role-btn-${role.toLowerCase()}`}
                key={role}
                onClick={async () => {
                  let email = 'lalithesh@lvconstructions.com';
                  let pass = 'admin123';
                  if (role === UserRole.PROPRIETOR) {
                    email = 'varun@lvconstructions.com';
                    pass = 'varun123';
                  }
                  if (role === UserRole.MESTRI) {
                    email = 'nagaraj@lvconstructions.com';
                    pass = 'nagaraj123';
                  }
                  await handleQuickLogin(email, pass);
                  setIsNotifOpen(false);
                }}
                className={`px-3 py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-650 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all cursor-pointer ${
                  currentUserRole === role 
                    ? 'border border-emerald-500 text-emerald-400 bg-emerald-500/10' 
                    : 'border border-transparent text-slate-350'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-slate-350">
          <p className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            Authenticated As: <strong className="text-white font-bold">{activeUser.name} ({activeUser.role})</strong>
          </p>
        </div>
      </div>

      {/* Main Container Workspace */}
      <div className="flex flex-1 flex-col lg:flex-row">
        
        {/* Left Side Utility Navigation Drawer (Web Dashboard) - Slate-900 Professional Polish style */}
        <div className="w-full lg:w-64 bg-slate-900 text-white border-r border-slate-950 p-6 flex flex-col justify-between no-print gap-6 shadow-xl">
          <div className="space-y-6">
            
            {/* Branding Letterhead */}
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-5">
              <div className="p-2.5 bg-emerald-600 rounded-2xl text-white shadow-md shadow-emerald-500/15">
                <Building2 className="w-6 h-6 stroke-[1.85]" />
              </div>
              <div>
                <h1 className="font-extrabold text-white tracking-tight text-sm leading-tight uppercase">LV Constructions</h1>
                <p className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest leading-none">Dashboard Terminal</p>
              </div>
            </div>

            {/* Active Project Dropdown Switcher (Central Source) */}
            <div className="space-y-1.5">
              <label htmlFor="central-proj-select" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Selected Site Project</label>
              {projects.length === 0 ? (
                <p className="text-xs text-rose-450 font-bold">No active sites setup</p>
              ) : (
                <div className="relative">
                  <select
                    id="central-proj-select"
                    value={activeProject?.id || ''}
                    onChange={(e) => {
                      const selected = projects.find(p => p.id === e.target.value);
                      if (selected) setActiveProject(selected);
                    }}
                    className="w-full pl-3 pr-8 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white font-bold rounded-xl text-xs outline-none focus:border-emerald-500 transition-colors cursor-pointer appearance-none"
                  >
                    {projects.map((proj) => (
                      <option key={proj.id} value={proj.id} className="bg-slate-900 text-white">
                        {proj.projectName}
                      </option>
                    ))}
                  </select>
                  <ChevronRight className="w-4 h-4 absolute right-3 top-3 text-slate-400 pointer-events-none rotate-90" />
                </div>
              )}
            </div>

            {/* Nav Panel Tabs links */}
            <nav className="space-y-1 flex flex-col" id="app-navigation-links">
              {getTabsForRole(currentUserRole).map(tab => {
                const isActive = activeTab === tab;
                
                let icon = <TrendingUp className="w-4 h-4" />;
                if (tab === 'projects') icon = <Building2 className="w-4 h-4" />;
                if (tab === 'advances') icon = <Wallet className="w-4 h-4" />;
                if (tab === 'materials') icon = <FileText className="w-4 h-4" />;
                if (tab === 'labor') icon = <Hammer className="w-4 h-4" />;
                if (tab === 'daily') icon = <Compass className="w-4 h-4" />;
                if (tab === 'reconciliation') icon = <Scale className="w-4 h-4" />;
                if (tab === 'documents') icon = <FileText className="w-4 h-4" />;
                if (tab === 'reports') icon = <BookOpen className="w-4 h-4" />;
                if (tab === 'audit') icon = <History className="w-4 h-4" />;

                return (
                  <button
                    id={`nav-link-${tab}`}
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all justify-between cursor-pointer select-none ${
                      isActive 
                        ? 'bg-white/10 text-emerald-405 border-r-3 border-emerald-500 font-bold shadow-sm' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-805'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {icon}
                      <span>{getTabLabel(tab)}</span>
                    </div>
                  </button>
                );
              })}
            </nav>

          </div>

          {/* Quick Stats sidebar widget or user logout drawer */}
          <div className="space-y-5">
            {activeProject && (
              <div className="pt-6 border-t border-slate-800 space-y-3.5">
                <div>
                  <dt className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">Overall Project Name</dt>
                  <dd className="text-xs font-black text-slate-200 mt-1 truncate">{activeProject.projectName}</dd>
                </div>

                <div>
                  <dt className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">Location</dt>
                  <dd className="text-xs font-bold text-slate-350 mt-1 truncate flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" /> {activeProject.siteName}
                  </dd>
                </div>
              </div>
            )}

            {/* Authenticated User Session Detail & Logout */}
            <div className="pt-6 border-t border-slate-800 gap-3 flex flex-col">
              <div className="flex items-center gap-3 bg-slate-850 p-2.5 rounded-xl border border-slate-800/40">
                <div className="w-8 h-8 rounded-xl bg-emerald-600/25 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-extrabold text-xs">
                  {activeUser.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="text-[11px] font-bold text-slate-155 truncate">{activeUser.name}</h5>
                  <p className="text-[9px] text-slate-450 font-bold truncate">{activeUser.role} Account</p>
                </div>
              </div>

              <button
                id="sidebar-logout-btn"
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-800/50 hover:bg-rose-950/20 hover:text-rose-401 border border-slate-800 hover:border-rose-900/30 rounded-xl text-[11px] font-bold text-slate-400 hover:text-rose-400 transition-all cursor-pointer select-none"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Exit Console</span>
              </button>
            </div>
          </div>

        </div>

        {/* Right workspace core body */}
        <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-full overflow-hidden">
          
          {/* Central Control bar header */}
          <header className="flex justify-between items-center bg-white p-4.5 px-6 border border-slate-200 rounded-2xl shadow-sm no-print">
            <div className="space-y-0.5">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Active Terminal Panel</h2>
              <p className="text-xs text-slate-500">Manage, review, print and run compliance filters on project data pipelines.</p>
            </div>

            <div className="flex items-center gap-3.5">
              
              {/* Trigger Notification icon */}
              <div className="relative">
                <button
                  id="header-notif-btn"
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl relative text-slate-600 border border-slate-150 transition-colors cursor-pointer"
                >
                  <Bell className="w-5 h-5" />
                  {unreadNotifs.length > 0 && (
                    <span id="unread-notifs-badge" className="absolute -top-1 -right-1 bg-red-500 text-white w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center animate-bounce">
                      {unreadNotifs.length}
                    </span>
                  )}
                </button>

                {/* Popover Notification absolute box style replacement */}
                <NotificationDrawer 
                  isOpen={isNotifOpen}
                  notifications={notifications}
                  currentUser={{ id: activeUser.id, role: currentUserRole, email: '', name: activeUser.name }}
                  onMarkRead={handleMarkAllNotificationsRead}
                  onClose={() => setIsNotifOpen(false)}
                />
              </div>

              {/* Data Refresh pipeline trigger */}
              <button
                id="header-data-refresh-btn"
                onClick={() => loadDatabaseState()}
                className="p-2.5 bg-slate-50 border border-slate-150 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors cursor-pointer"
                title="Synchronize Databases State"
              >
                <RefreshCw className="w-5 h-5" />
              </button>

            </div>
          </header>

          {/* Quick Database load states feedback */}
          {loading ? (
            <div className="py-24 text-center text-slate-400 space-y-3">
              <RefreshCw className="w-10 h-10 animate-spin text-amber-500 mx-auto" />
              <p className="text-sm font-semibold">Running server data sync...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-100 text-red-700 rounded-3xl p-6 text-center space-y-3">
              <Lock className="w-10 h-10 text-red-500 mx-auto" />
              <p className="font-extrabold text-sm">System Interrupted</p>
              <p className="text-xs text-red-600">{error}</p>
              <button
                onClick={() => loadDatabaseState()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black"
              >
                Force Retry Sync
              </button>
            </div>
          ) : (
            /* Render active tab viewport components */
            <div className="space-y-6">
              
              {!activeProject && activeTab !== 'projects' && activeTab !== 'dashboard' ? (
                <div id="no-project-selected-fallback" className="bg-white rounded-2xl border border-slate-100 p-12 text-center max-w-xl mx-auto my-12 shadow-sm">
                  <Building2 className="w-16 h-16 mx-auto text-slate-300 stroke-[1.5] mb-4" />
                  <h3 className="text-lg font-bold text-slate-800">No Construction Sites Configured</h3>
                  <p className="text-slate-550 mt-2 text-xs leading-relaxed max-w-md mx-auto">
                    {currentUserRole === UserRole.ADMIN 
                      ? "You need to register at least one project site before tracking site advances or daily vouchers. Let's add details for your first site now." 
                      : "No active projects are configured in the system yet. Please wait for the Contract Administrator to add site details so you can view reports or log expenses."}
                  </p>
                  {currentUserRole === UserRole.ADMIN && (
                    <button 
                      onClick={() => setActiveTab('projects')}
                      className="mt-6 px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer select-none"
                    >
                      Configure First Site Project
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {activeTab === 'dashboard' && (
                    <Dashboard 
                      activeProject={activeProject}
                      projects={projects}
                      advances={advances}
                      purchases={purchases}
                      laborExpenses={laborExpenses}
                      dailyExpenses={dailyExpenses}
                      currentUserRole={currentUserRole}
                      onChangeProject={(proj) => setActiveProject(proj)}
                    />
                  )}

                  {activeTab === 'projects' && (
                    <ProjectManager 
                      projects={projects}
                      currentUserRole={currentUserRole}
                      currentUserId={activeUser.id}
                      currentUserName={activeUser.name}
                      onSaveProject={handleAddProject}
                      onDeleteProject={handleDeleteProject}
                    />
                  )}

                  {activeTab === 'advances' && (
                    <AdvanceManager 
                      activeProject={activeProject}
                      projects={projects}
                      advances={advances}
                      purchases={purchases}
                      laborExpenses={laborExpenses}
                      dailyExpenses={dailyExpenses}
                      currentUserRole={currentUserRole}
                      currentUserName={activeUser.name}
                      onAddAdvance={handleAddAdvance}
                    />
                  )}

                  {activeTab === 'materials' && (
                    <MaterialPurchaseTracker 
                      activeProject={activeProject}
                      purchases={purchases}
                      currentUserRole={currentUserRole}
                      currentUserName={activeUser.name}
                      onAddPurchase={handleAddPurchase}
                      onDeletePurchase={handleDeletePurchase}
                      onPreviewBill={handleOpenPreviewLightbox}
                    />
                  )}

                  {activeTab === 'labor' && (
                    <LaborExpenseTracker 
                      activeProject={activeProject}
                      laborExpenses={laborExpenses}
                      currentUserRole={currentUserRole}
                      currentUserName={activeUser.name}
                      onAddLabor={handleAddLabor}
                    />
                  )}

                  {activeTab === 'daily' && (
                    <DailyExpenseTracker 
                      activeProject={activeProject}
                      dailyExpenses={dailyExpenses}
                      currentUserRole={currentUserRole}
                      currentUserName={activeUser.name}
                      onAddDailyExpense={handleAddDailyExpense}
                      onPreviewBill={handleOpenPreviewLightbox}
                    />
                  )}

                  {activeTab === 'reconciliation' && (
                    <ExpenseReconciliation 
                      activeProject={activeProject}
                      advances={advances}
                      purchases={purchases}
                      laborExpenses={laborExpenses}
                      dailyExpenses={dailyExpenses}
                    />
                  )}

                  {activeTab === 'documents' && (
                    <DocumentManager 
                      activeProject={activeProject}
                      purchases={purchases}
                      dailyExpenses={dailyExpenses}
                      onPreviewBill={handleOpenPreviewLightbox}
                    />
                  )}

                  {activeTab === 'reports' && (
                    <ReportGenerator 
                      activeProject={activeProject}
                      projects={projects}
                      advances={advances}
                      purchases={purchases}
                      laborExpenses={laborExpenses}
                      dailyExpenses={dailyExpenses}
                    />
                  )}

                  {activeTab === 'audit' && (
                    <AuditTrailViewer 
                      auditLogs={auditLogs}
                      currentUserRole={currentUserRole}
                    />
                  )}
                </>
              )}

            </div>
          )}

        </main>

      </div>

      {/* Lightbox absolute Portal view popup */}
      {previewBillUrl && (
        <ReceiptLightbox 
          billUrl={previewBillUrl} 
          metadata={previewMetadata} 
          onClose={() => {
            setPreviewBillUrl(null);
            setPreviewMetadata(null);
          }} 
        />
      )}

    </div>
  );
}
