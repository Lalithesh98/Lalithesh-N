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
  Search,
  Camera,
  Menu,
  Database,
  Copy,
  Download,
  Upload,
  Smartphone,
  Check
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
import StagePhotosManager from './components/StagePhotosManager';
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
  | 'audit'
  | 'photos';

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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [previewBillUrl, setPreviewBillUrl] = useState<string | null>(null);
  const [previewMetadata, setPreviewMetadata] = useState<any | null>(null);

  // Database Sync Modal states
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncInputText, setSyncInputText] = useState('');
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedSyncCode, setCopiedSyncCode] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Security Credentials Administration State
  const [users, setUsers] = useState<any[]>([]);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [securityEditPasswords, setSecurityEditPasswords] = useState<Record<string, string>>({});
  const [securityFeedback, setSecurityFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isUpdatingPasswordId, setIsUpdatingPasswordId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({
    u1: true,
    u2: true,
    u3: true
  });

  const handleUpdatePassword = async (targetUserId: string, newPass: string) => {
    if (!newPass.trim()) {
      setSecurityFeedback({ type: 'error', message: 'Credentials cannot be completely blank.' });
      return;
    }
    setIsUpdatingPasswordId(targetUserId);
    setSecurityFeedback(null);
    try {
      const res = await appApi.updateUserPassword(targetUserId, newPass, activeUser.id, activeUser.name);
      setSecurityFeedback({ type: 'success', message: res.message });
      // Reload states silently
      await loadDatabaseState(true);
    } catch (err: any) {
      setSecurityFeedback({ type: 'error', message: err?.message || 'Failed to sync credentials configuration.' });
    } finally {
      setIsUpdatingPasswordId(null);
    }
  };

  // Define tab pages permissions for each of the 3 roles
  const getTabsForRole = (role: UserRole): AppTabs[] => {
    switch (role) {
      case UserRole.ADMIN:
        return ['dashboard', 'projects', 'advances', 'materials', 'labor', 'daily', 'reconciliation', 'documents', 'reports', 'audit', 'photos'];
      case UserRole.PROPRIETOR:
        return ['dashboard', 'reconciliation', 'documents', 'reports', 'photos'];
      case UserRole.MESTRI:
        return ['dashboard', 'materials', 'labor', 'daily', 'documents', 'photos'];
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
      setUsers(data.users || []);

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

  const handleApplySyncCode = async (code: string) => {
    if (!code.trim()) {
      setSyncStatus({ type: 'error', message: 'Please paste a valid sync code first.' });
      return;
    }
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const decodedStr = decodeURIComponent(escape(atob(code.trim())));
      const parsed = JSON.parse(decodedStr);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.users) || !Array.isArray(parsed.projects)) {
        throw new Error('Malformed database schema detected within the sync code.');
      }
      
      const res = await appApi.importDatabase(parsed);
      setSyncStatus({ type: 'success', message: 'Database successfully imported! Reloading state...' });
      setSyncInputText('');
      setTimeout(() => {
        setIsSyncModalOpen(false);
        setSyncStatus(null);
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setSyncStatus({ type: 'error', message: 'Failed to restore: ' + err.message });
    } finally {
      setIsSyncing(false);
    }
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
      case 'audit': return 'Audit Logs & Invoices';
      case 'photos': return 'Stage Progress Photos';
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
                <p className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest leading-none">Budget & Expense Management</p>
              </div>
            </div>

            {/* Core Message / Mission of CMS */}
            <div className="space-y-6 my-12 relative z-10">
              <span className="px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold rounded-full text-[10px] uppercase tracking-wider inline-block">
                LV Constructions Active System
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight leading-tight">
                Budget & Expense Management
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
              LV Constructions • Budget & Expense Management
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
                onClick={() => handleQuickLogin('lalithesh@lvconstructions.com', users.find(u => u.id === 'u1')?.password || 'admin123')}
                className="w-full text-left p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/10 transition-all flex items-center gap-3.5 group cursor-pointer"
              >
                <div className="p-2 mr-0.5 rounded-xl bg-blue-500/10 text-blue-600 group-hover:bg-blue-500/20 transition-all">
                  <User className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-800 text-xs">Lalithesh N (Admin)</span>
                    <span className="text-[8px] font-black bg-blue-50 text-blue-605 border border-blue-100 uppercase px-1.5 py-0.5 rounded-md">Pass: {users.find(u => u.id === 'u1')?.password || 'admin123'}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">lalithesh@lvconstructions.com • Full Control</p>
                </div>
              </button>

              <button
                onClick={() => handleQuickLogin('varun@lvconstructions.com', users.find(u => u.id === 'u2')?.password || 'varun123')}
                className="w-full text-left p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/10 transition-all flex items-center gap-3.5 group cursor-pointer"
              >
                <div className="p-2 mr-0.5 rounded-xl bg-purple-500/10 text-purple-600 group-hover:bg-purple-500/20 transition-all">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-800 text-xs">Varun Kashyap (Proprietor)</span>
                    <span className="text-[8px] font-black bg-purple-50 text-purple-605 border border-purple-100 uppercase px-1.5 py-0.5 rounded-md">Pass: {users.find(u => u.id === 'u2')?.password || 'varun123'}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">varun@lvconstructions.com • Audit Access</p>
                </div>
              </button>

              <button
                onClick={() => handleQuickLogin('nagaraj@lvconstructions.com', users.find(u => u.id === 'u3')?.password || 'nagaraj123')}
                className="w-full text-left p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/10 transition-all flex items-center gap-3.5 group cursor-pointer"
              >
                <div className="p-2 mr-0.5 rounded-xl bg-amber-500/10 text-amber-600 group-hover:bg-amber-500/20 transition-all">
                  <HardHat className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-800 text-xs">Nagaraj S (Mestri)</span>
                    <span className="text-[8px] font-black bg-amber-50 text-amber-650 border border-amber-100 uppercase px-1.5 py-0.5 rounded-md">Pass: {users.find(u => u.id === 'u3')?.password || 'nagaraj123'}</span>
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
                  let pass = users.find(u => u.id === 'u1')?.password || 'admin123';
                  if (role === UserRole.PROPRIETOR) {
                    email = 'varun@lvconstructions.com';
                    pass = users.find(u => u.id === 'u2')?.password || 'varun123';
                  }
                  if (role === UserRole.MESTRI) {
                    email = 'nagaraj@lvconstructions.com';
                    pass = users.find(u => u.id === 'u3')?.password || 'nagaraj123';
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
      <div className="flex flex-1 flex-col lg:flex-row relative">
        
        {/* Mobile Backdrop Overlay */}
        {isMobileSidebarOpen && (
          <div 
            id="mobile-sidebar-backdrop"
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden no-print"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}

        {/* Left Side Utility Navigation Drawer (Web Dashboard) - Slate-900 Professional Polish style */}
        <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white border-r border-slate-950 p-6 flex flex-col justify-between no-print gap-6 shadow-xl transition-transform duration-300 ease-in-out lg:static lg:w-64 lg:translate-x-0 ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}>
          <div className="space-y-6">
            
            {/* Branding Letterhead */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-600 rounded-2xl text-white shadow-md shadow-emerald-500/15">
                  <Building2 className="w-6 h-6 stroke-[1.85]" />
                </div>
                <div>
                  <h1 className="font-extrabold text-white tracking-tight text-sm leading-tight uppercase truncate max-w-[130px] lg:max-w-none">LV Constructions</h1>
                  <p className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest leading-none">Budget & Expense Mgmt</p>
                </div>
              </div>
              <button
                id="close-sidebar-mobile-btn"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Close Navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Active Project Dropdown Switcher (Central Source) */}
            <div className="space-y-1.5">
              <label htmlFor="central-proj-select" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Selected Site Project</label>
              {projects.length === 0 ? (
                <p className="text-xs text-rose-455 font-bold">No active sites setup</p>
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
                if (tab === 'photos') icon = <Camera className="w-4 h-4" />;

                return (
                  <button
                    id={`nav-link-${tab}`}
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      setIsMobileSidebarOpen(false);
                    }}
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
              <div className="pt-6 border-t border-slate-800 space-y-3.5 pb-2">
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
            <div className="pt-4 border-t border-slate-800 gap-3 flex flex-col">
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
                onClick={() => {
                  handleLogout();
                  setIsMobileSidebarOpen(false);
                }}
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
            <div className="flex items-center gap-3.5">
              <button
                id="mobile-sidebar-hamburger"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="lg:hidden p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-605 rounded-xl transition-colors cursor-pointer flex items-center justify-center mr-0.5"
                title="Open Navigation"
              >
                <Menu className="w-4.5 h-4.5 text-slate-600" />
              </button>

              <div className="space-y-0.5">
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Active Terminal Panel</h2>
                <p className="text-xs text-slate-500 hidden md:block">Manage, review, print and run compliance filters on project data pipelines.</p>
                <p className="text-xs text-slate-500 md:hidden">LV Site Control Center Panels.</p>
              </div>
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

              {/* Database Sync Tool */}
              <button
                id="header-db-sync-btn"
                onClick={() => {
                  setSyncStatus(null);
                  setIsSyncModalOpen(true);
                }}
                className="px-3.5 py-2.5 bg-indigo-50/50 hover:bg-slate-100 border border-slate-150 text-indigo-700 hover:text-indigo-805 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                title="Cross-Device Data Syncing, Backups & Uploads"
              >
                <Database className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">Sync & Backups</span>
              </button>

              {/* Security Credentials Shield (Admin Only) */}
              {currentUserRole === UserRole.ADMIN && (
                <button
                  id="header-security-btn"
                  onClick={() => setIsSecurityModalOpen(true)}
                  className="px-3.5 py-2.5 bg-amber-50 border border-amber-200 hover:border-amber-300 text-amber-800 hover:text-amber-900 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title="🔑 Admin Credentials Security Panel"
                >
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">Credentials Shield</span>
                </button>
              )}

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
                      activeProject={activeProject}
                      projects={projects}
                    />
                  )}

                  {activeTab === 'photos' && (
                    <StagePhotosManager 
                      activeProject={activeProject}
                      currentUserRole={currentUserRole}
                      currentUserName={sessionUser.name}
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

      {/* Database Sync Modal */}
      {isSyncModalOpen && (
        <div id="database-sync-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 md:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start border-b border-slate-105 pb-4">
              <div className="flex items-center gap-2 text-indigo-700">
                <Database className="w-6 h-6 animate-pulse" />
                <div className="space-y-0.5 animate-pulse">
                  <h3 className="text-xs font-black text-slate-900 uppercase">Cross-Device Database Synchronizer</h3>
                  <p className="text-[9px] font-semibold text-indigo-500 uppercase">Sync Development & Mobile Databases</p>
                </div>
              </div>
              <button
                onClick={() => setIsSyncModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Explainer */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 text-[11px] text-slate-600 space-y-2 leading-relaxed">
              <p className="font-bold text-slate-700">💡 Why are the editor and mobile data different?</p>
              <p>
                To provide safe drafting and responsive previewing, Google AI Studio hosts your <strong>Editor Preview (Dev Container)</strong> and <strong>Mobile Shared App (Production Container)</strong> on two separate, fully isolated environments.
              </p>
              <p>
                As a result, changes made inside your editor do not automatically show up on your mobile app, and vice versa. Use this panel to instantly sync your data across both platforms using a simple <strong>Sync Code</strong> or <strong>Backup file</strong>.
              </p>
            </div>

            {/* Direct Sync Option 1: Clipboard Base64 Transfer */}
            <div className="bg-indigo-50/40 border border-indigo-100/50 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-indigo-900 uppercase tracking-wide block">Option A: Wireless Copy-Paste (Sync Code)</span>
                <span className="text-[8px] bg-indigo-100 text-indigo-805 font-extrabold px-1.5 py-0.5 rounded-full uppercase">Simplest! No Files Required</span>
              </div>

              <div className="space-y-2 text-xs">
                <p className="text-[11px] font-semibold text-slate-600 leading-normal">
                  <strong>1. Export Code:</strong> Click below to generate and copy a compact sync code containing your current database records.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const fullDb = await appApi.getData();
                      const stringified = JSON.stringify(fullDb);
                      const b64 = btoa(unescape(encodeURIComponent(stringified)));
                      await navigator.clipboard.writeText(b64);
                      setCopiedSyncCode(true);
                      setTimeout(() => setCopiedSyncCode(false), 3000);
                    } catch (err: any) {
                      alert('Failed to generate sync code: ' + err.message);
                    }
                  }}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all border shadow-xs ${
                    copiedSyncCode
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white hover:bg-slate-50 text-indigo-700 border-indigo-200 hover:border-indigo-300'
                  }`}
                >
                  {copiedSyncCode ? (
                    <>
                      <Check className="w-4 h-4 animate-bounce" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Generate & Copy Sync Code</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-2 border-t border-indigo-100/50 pt-3 text-xs">
                <label className="text-[11px] font-semibold text-slate-600 block leading-normal">
                  <strong>2. Import Code:</strong> On the other device (e.g. your mobile browser), open this menu and paste the Sync Code below to restore.
                </label>
                <textarea
                  placeholder="Paste the sync code here..."
                  value={syncInputText}
                  onChange={(e) => setSyncInputText(e.target.value)}
                  className="w-full h-20 px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs outline-none focus:border-indigo-500 font-mono text-slate-700 font-medium placeholder-slate-400"
                />
                <button
                  type="button"
                  onClick={() => handleApplySyncCode(syncInputText)}
                  disabled={isSyncing || !syncInputText.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold uppercase py-2.5 rounded-xl text-xs cursor-pointer select-none transition-all shadow-xs"
                >
                  {isSyncing ? 'Restoring Ledger data...' : 'Apply Pasted Sync Code'}
                </button>
              </div>
            </div>

            {/* Sync Option 2: File Backup / Restore */}
            <div className="border border-slate-200 rounded-2xl p-4 space-y-4">
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide block">Option B: Offline File Import & Export</span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Download backup file button */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Create Safe Backup:</span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const fullDb = await appApi.getData();
                        const stringified = JSON.stringify(fullDb, null, 2);
                        const blob = new Blob([stringified], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `lv_constructions_db_backup_${new Date().toISOString().split('T')[0]}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      } catch (err: any) {
                        alert('Failed to download: ' + err.message);
                      }
                    }}
                    className="w-full py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Download className="w-4 h-4 text-slate-500" />
                    <span>Download JSON File</span>
                  </button>
                </div>

                {/* Import backup file input */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Restore JSON File:</span>
                  <label className="w-full py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-305 text-slate-705 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all border-dashed">
                    <Upload className="w-4 h-4 text-slate-500" />
                    <span>Select Backup File</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setIsSyncing(true);
                        setSyncStatus(null);
                        
                        const reader = new FileReader();
                        reader.onload = async (e) => {
                          try {
                            const text = e.target?.result as string;
                            const parsed = JSON.parse(text);
                            if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.users) || !Array.isArray(parsed.projects)) {
                              throw new Error('Malformed database schema. Missing users or projects arrays.');
                            }
                            
                            await appApi.importDatabase(parsed);
                            setSyncStatus({ type: 'success', message: 'Backup file successfully imported! Reloading containers...' });
                            setTimeout(() => {
                              setIsSyncModalOpen(false);
                              setSyncStatus(null);
                              window.location.reload();
                            }, 2000);
                          } catch (err: any) {
                            setSyncStatus({ type: 'error', message: 'File read error: ' + err.message });
                          } finally {
                            setIsSyncing(false);
                          }
                        };
                        reader.readAsText(file);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Sync Option 3: Real-Time Firestore Cloud Sync */}
            <div className="bg-emerald-50/30 border border-emerald-100/50 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-emerald-950 uppercase tracking-wide block">Option C: cloud sync (Firestore)</span>
                <span className="text-[8px] bg-emerald-100 text-emerald-805 font-extrabold px-1.5 py-0.5 rounded-full uppercase">Automatic & Real-Time</span>
              </div>
              <p className="text-[10.5px] text-slate-600 leading-normal">
                Any modifications you make are automatically backed up to Firestore in real-time. If databases on your mobile app or editor are ever out of sync, trigger a manual Cloud Pull below to align both seamlessly.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Manual Cloud Pull */}
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={async () => {
                    setIsSyncing(true);
                    setSyncStatus(null);
                    try {
                      const res = await appApi.pullDatabaseFromCloud();
                      setSyncStatus({ type: 'success', message: res.message + ' Refreshing...' });
                      setTimeout(() => {
                        setIsSyncModalOpen(false);
                        setSyncStatus(null);
                        window.location.reload();
                      }, 2000);
                    } catch (err: any) {
                      setSyncStatus({ type: 'error', message: err.message });
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4 text-emerald-100" />
                  <span>Manual Pull from Cloud</span>
                </button>

                {/* Manual Cloud Push */}
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={async () => {
                    setIsSyncing(true);
                    setSyncStatus(null);
                    try {
                      const res = await appApi.pushDatabaseToCloud();
                      setSyncStatus({ type: 'success', message: res.message });
                    } catch (err: any) {
                      setSyncStatus({ type: 'error', message: err.message });
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                  className="w-full py-2.5 px-3 bg-white hover:bg-slate-50 border border-emerald-205 text-emerald-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4 text-emerald-600" />
                  <span>Manual Push to Cloud</span>
                </button>
              </div>
            </div>

            {/* Sync Feedback messages */}
            {syncStatus && (
              <div
                id="sync-status"
                className={`p-3.5 rounded-xl text-xs font-bold leading-normal ${
                  syncStatus.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-205 text-rose-800'
                }`}
              >
                {syncStatus.message}
              </div>
            )}

            <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 select-none border-t border-slate-100 pt-3">
              <span>LV Site Control Core v1.5 • Secure Container Isolation</span>
              <span className="text-indigo-500 hover:underline cursor-pointer" onClick={() => loadDatabaseState()}>Re-fetch from server</span>
            </div>
          </div>
        </div>
      )}

      {/* Security Credentials Shield Modal */}
      {isSecurityModalOpen && (
        <div id="security-admin-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-xl w-full max-h-[92vh] overflow-y-auto p-6 md:p-8 space-y-6 animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-amber-500/10 text-amber-700 rounded-2xl">
                  <Lock className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide leading-none">Security & Password Administration</h3>
                  <p className="text-[10px] font-black text-slate-450 uppercase tracking-widest mt-1">Credentials Control Shield</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsSecurityModalOpen(false);
                  setSecurityFeedback(null);
                }}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warning advisory message */}
            <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 text-[11px] text-amber-900 space-y-2 leading-relaxed">
              <p className="font-extrabold flex items-center gap-1.5 uppercase tracking-wider text-[10px] text-amber-850">
                ⚠️ Administrative Access Warning
              </p>
              <p>
                As the <strong>Contractor (Admin)</strong>, you have the absolute authority to oversee, inspect, and reset the passwords of all platform supervisors. Updated keys synchronize with on-site devices and cloud-backups instantly.
              </p>
            </div>

            {/* List of user credentials */}
            <div className="space-y-4">
              {['u1', 'u2', 'u3'].map(uid => {
                // Find matching user from our live DB states or default back to seeded placeholders
                const u = users.find(user => user.id === uid) || (
                  uid === 'u1' ? { id: 'u1', name: 'Lalithesh N', role: UserRole.ADMIN, email: 'lalithesh@lvconstructions.com', username: 'lalithesh', password: 'admin123' } :
                  uid === 'u2' ? { id: 'u2', name: 'Varun Kashyap', role: UserRole.PROPRIETOR, email: 'varun@lvconstructions.com', username: 'varun', password: 'varun123' } :
                  { id: 'u3', name: 'Nagaraj S', role: UserRole.MESTRI, email: 'nagaraj@lvconstructions.com', username: 'nagaraj', password: 'nagaraj123' }
                );

                const currentInputVal = securityEditPasswords[uid] !== undefined 
                  ? securityEditPasswords[uid] 
                  : u.password;

                const isPassVisible = visiblePasswords[uid];

                return (
                  <div key={uid} className="p-4 rounded-2xl border border-slate-150 bg-slate-50/50 hover:bg-slate-50 space-y-3 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-xs text-slate-800">{u.name}</h4>
                        <p className="text-[10px] text-slate-450 font-bold tracking-tight">
                          Email: {u.email} • User: {u.username}
                        </p>
                      </div>
                      <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full ${
                        uid === 'u1' ? 'bg-blue-50 text-blue-650 border border-blue-200' :
                        uid === 'u2' ? 'bg-purple-50 text-purple-650 border border-purple-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {u.role}
                      </span>
                    </div>

                    {/* Password display & entry field */}
                    <div className="space-y-1.5 pt-1">
                      <label htmlFor={`edit-pass-input-${uid}`} className="text-[9px] font-black text-slate-450 uppercase tracking-widest block font-sans">Stored Secret Key</label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            id={`edit-pass-input-${uid}`}
                            type={isPassVisible ? 'text' : 'password'}
                            value={currentInputVal}
                            onChange={(e) => {
                              setSecurityEditPasswords(prev => ({
                                ...prev,
                                [uid]: e.target.value
                              }));
                            }}
                            className="w-full pl-3 pr-24 py-2.5 bg-white border border-slate-200 focus:border-amber-500 rounded-xl text-xs outline-none transition-all font-mono font-bold text-slate-700 shadow-sm"
                            placeholder="Enter new password"
                          />
                          
                          {/* Visibility Selector */}
                          <button
                            type="button"
                            onClick={() => {
                              setVisiblePasswords(prev => ({
                                ...prev,
                                [uid]: !prev[uid]
                              }));
                            }}
                            className="absolute right-2 top-1.5 px-2.5 py-1 hover:bg-slate-150 text-[9px] font-extrabold text-slate-500 hover:text-slate-700 uppercase rounded-lg cursor-pointer transition-colors select-none"
                          >
                            {isPassVisible ? 'Hide Key' : 'Reveal Key'}
                          </button>
                        </div>

                        {/* Save Action */}
                        <button
                          type="button"
                          disabled={isUpdatingPasswordId !== null || currentInputVal === u.password}
                          onClick={() => handleUpdatePassword(uid, currentInputVal)}
                          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-950 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-extrabold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-w-[75px]"
                        >
                          {isUpdatingPasswordId === uid ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                          <span>Save</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Security feedback messages banner */}
            {securityFeedback && (
              <div
                id="security-feedback-badge"
                className={`p-3.5 rounded-xl text-xs font-bold leading-normal animate-in fade-in slide-in-from-top-1 ${
                  securityFeedback.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-250 text-emerald-850'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                {securityFeedback.message}
              </div>
            )}

            {/* Bottom branding footer */}
            <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 select-none border-t border-slate-100 pt-3">
              <span>LV Secure Cryptographic Isolation Enclave</span>
              <span className="text-amber-600 font-extrabold">ACTIVE PROTOCOL</span>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
