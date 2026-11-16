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
  Bell,
  HardHat,
  ChevronRight,
  LogOut,
  Sliders,
  CheckCircle,
  Lock,
  Camera,
  Menu,
  HandCoins
} from 'lucide-react';

// Custom types and API helpers
import { 
  Project, 
  Advance, 
  BorrowingRepayment,
  ProjectBorrowing,
  MaterialPurchase, 
  LaborExpense, 
  DailyExpense, 
  Notification, 
  AuditLog, 
  StagePhoto,
  TaxInvoice,
  RoleDefinition,
  AppTab,
  UserRole,
  User as AppUser
} from './types';
import appApi, { getStoredToken, setStoredToken } from './api';

// Subcomponents
import Dashboard from './components/Dashboard';
import ProjectManager from './components/ProjectManager';
import AdvanceManager from './components/AdvanceManager';
import BorrowingsTracker from './components/BorrowingsTracker';
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
import { CloudSyncAgent } from './components/CloudSyncAgent';

type AppTabs = AppTab;

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTabs>('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Core Data Lists
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [loginAccounts, setLoginAccounts] = useState<AppUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [borrowings, setBorrowings] = useState<ProjectBorrowing[]>([]);
  const [purchases, setPurchases] = useState<MaterialPurchase[]>([]);
  const [laborExpenses, setLaborExpenses] = useState<LaborExpense[]>([]);
  const [dailyExpenses, setDailyExpenses] = useState<DailyExpense[]>([]);
  const [stagePhotos, setStagePhotos] = useState<StagePhoto[]>([]);
  const [taxInvoices, setTaxInvoices] = useState<TaxInvoice[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  // Auth session states
  const [sessionUser, setSessionUser] = useState<AppUser | null>(() => {
    const cached = localStorage.getItem('cms_session_user');
    const token = getStoredToken();
    return cached && token ? JSON.parse(cached) : null;
  });

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const currentUserRole = sessionUser?.role || '';
  const activeUser: AppUser = sessionUser || { id: '', name: '', role: '', email: '' };
  const activeRoleDef = roles.find(r => r.name.toLowerCase() === currentUserRole.toLowerCase());
  const canManageRoles = Boolean(activeRoleDef?.canManageRoles);
  const canManageProjects = Boolean(activeRoleDef?.canManageProjects || activeRoleDef?.canManageRoles);
  const canWriteExpenses = Boolean(activeRoleDef?.canWriteExpenses || activeRoleDef?.canManageRoles);
  const canSimulateRoles = Boolean(localStorage.getItem('cms_admin_token')) || canManageRoles;

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [previewBillUrl, setPreviewBillUrl] = useState<string | null>(null);
  const [previewMetadata, setPreviewMetadata] = useState<any | null>(null);

  // Security Credentials Administration State
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [securityEditPasswords, setSecurityEditPasswords] = useState<Record<string, string>>({});
  const [securityFeedback, setSecurityFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isUpdatingPasswordId, setIsUpdatingPasswordId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const handleUpdatePassword = async (targetUserId: string, newPass: string) => {
    if (!newPass.trim() || newPass.trim().length < 4) {
      setSecurityFeedback({ type: 'error', message: 'Password must be at least 4 characters.' });
      return;
    }
    setIsUpdatingPasswordId(targetUserId);
    setSecurityFeedback(null);
    try {
      const res = await appApi.updateUserPassword(targetUserId, newPass.trim());
      setSecurityFeedback({ type: 'success', message: res.message });
      setSecurityEditPasswords(prev => ({ ...prev, [targetUserId]: '' }));
      await loadDatabaseState(true);
    } catch (err: any) {
      setSecurityFeedback({ type: 'error', message: err?.message || 'Failed to sync credentials configuration.' });
    } finally {
      setIsUpdatingPasswordId(null);
    }
  };

  // Dynamic tab list driven by Supabase app_roles
  const getTabsForRole = (roleName: string): AppTabs[] => {
    const matched = roles.find(r => r.name.toLowerCase() === roleName.toLowerCase());
    if (matched && matched.allowedTabs.length > 0) {
      return matched.allowedTabs;
    }
    return ['dashboard'];
  };

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    setLoginError(null);
    try {
      const res = await appApi.login(email, password);
      if (res?.user && res?.token) {
        setStoredToken(res.token);
        const roleDef = roles.find(r => r.name.toLowerCase() === res.user.role.toLowerCase());
        if (roleDef?.canManageRoles || res.user.role === UserRole.ADMIN) {
          localStorage.setItem('cms_admin_token', res.token);
        } else {
          localStorage.removeItem('cms_admin_token');
        }
        setSessionUser(res.user);
        localStorage.setItem('cms_session_user', JSON.stringify(res.user));
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
    if (!loginEmail.trim() || !loginPassword.trim()) return;
    handleLogin(loginEmail.trim(), loginPassword.trim());
  };

  const handleRoleSwitch = async (role: string, userId?: string) => {
    const adminToken = localStorage.getItem('cms_admin_token');
    if (adminToken) {
      setStoredToken(adminToken);
    }
    try {
      const res = await appApi.impersonateRole(role, userId);
      if (res?.user && res?.token) {
        setStoredToken(res.token);
        setSessionUser(res.user);
        localStorage.setItem('cms_session_user', JSON.stringify(res.user));
        setActiveTab('dashboard');
        setIsNotifOpen(false);
      }
    } catch (err: any) {
      alert(err.message || 'Failed switching simulation role');
    }
  };

  const handleLogout = () => {
    setSessionUser(null);
    setLoginPassword('');
    setStoredToken(null);
    localStorage.removeItem('cms_session_user');
    localStorage.removeItem('cms_admin_token');
  };

  // Fetch public dynamic roles & accounts for login screen
  useEffect(() => {
    if (!sessionUser) {
      appApi.getLoginOptions()
        .then(res => {
          setLoginAccounts(res.users || []);
          setRoles(res.roles || []);
        })
        .catch(() => {});
    }
  }, [sessionUser]);

  // Initial and reactive loader
  const loadDatabaseState = async (silently = false) => {
    if (!getStoredToken()) return;
    if (!silently) setLoading(true);
    try {
      const data = await appApi.getData();

      if (Array.isArray(data.roles)) setRoles(data.roles);
      const activeProjects = (data.projects || []).filter((p: Project) => !p.isDeleted);
      setProjects(activeProjects);

      setAdvances(data.advances || []);
      setBorrowings(data.borrowings || []);
      setPurchases(data.purchases || []);
      setLaborExpenses(data.laborExpenses || []);
      setDailyExpenses(data.dailyExpenses || []);
      setStagePhotos(data.stagePhotos || []);
      setTaxInvoices(data.taxInvoices || []);
      setNotifications(data.notifications || []);
      setAuditLogs(data.auditLogs || []);
      setUsers(data.users || []);

      if (activeProjects.length > 0) {
        setActiveProject(prev => {
          if (prev) {
            const currentFresh = activeProjects.find((p: Project) => p.id === prev.id);
            return currentFresh || activeProjects[0];
          }
          return activeProjects[0];
        });
      } else {
        setActiveProject(null);
      }

      setError(null);
    } catch (err: any) {
      if (err?.status === 401) {
        handleLogout();
      } else {
        setError(err.message || 'Failure loading construction budget databases.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionUser && getStoredToken()) {
      loadDatabaseState();
    }
  }, [sessionUser?.id]);

  // Callback triggers for child components
  const handleAddProject = async (projectData: Partial<Project>) => {
    try {
      await appApi.saveProject(projectData);
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Cannot save project metadata');
    }
  };

  const handleDeleteProject = async (pId: string) => {
    try {
      await appApi.deleteProject(pId);
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Cannot delete project');
    }
  };

  const handleAddAdvance = async (advanceData: Partial<Advance>) => {
    try {
      await appApi.addAdvance(advanceData);
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Disbursement failure');
    }
  };

  const handleSaveBorrowing = async (borrowingData: Partial<ProjectBorrowing>) => {
    try {
      await appApi.saveBorrowing({ ...borrowingData, userId: activeUser.id, userName: activeUser.name });
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Failed saving borrowing');
    }
  };

  const handleRepayBorrowing = async (borrowingId: string, repaymentData: Partial<BorrowingRepayment>) => {
    try {
      await appApi.repayBorrowing(borrowingId, { ...repaymentData, userId: activeUser.id, userName: activeUser.name });
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Failed recording loan repayment');
    }
  };

  const handleDeleteBorrowing = async (borrowingId: string) => {
    try {
      await appApi.deleteBorrowing(borrowingId);
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Failed deleting borrowing');
    }
  };

  const handleDeleteBorrowingRepayment = async (repaymentId: string) => {
    try {
      await appApi.deleteBorrowingRepayment(repaymentId);
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Failed deleting repayment');
    }
  };

  const handleAddPurchase = async (purchaseData: Partial<MaterialPurchase>) => {
    try {
      await appApi.addPurchase(purchaseData);
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Material entry failure');
    }
  };

  const handleDeletePurchase = async (purchaseId: string) => {
    try {
      await appApi.deletePurchase(purchaseId);
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Failed log removal');
    }
  };

  const handleSettlePurchase = async (purchaseId: string, payAmount?: number) => {
    try {
      await appApi.settlePurchaseCredit(purchaseId, payAmount);
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Failed settling purchase credit');
    }
  };

  const handleAddLabor = async (laborData: Partial<LaborExpense>) => {
    try {
      await appApi.addLabor(laborData);
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Wage registration failure');
    }
  };

  const handleSettleLabor = async (laborId: string) => {
    try {
      await appApi.settleLaborCredit(laborId);
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Failed settling labor credit');
    }
  };

  const handleAddDailyExpense = async (dailyData: Partial<DailyExpense>) => {
    try {
      await appApi.addDailyExpense(dailyData);
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Voucher logging failure');
    }
  };

  const handleSettleDaily = async (dailyId: string) => {
    try {
      await appApi.settleDailyCredit(dailyId);
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Failed settling daily expense credit');
    }
  };

  const handleAddStagePhoto = async (photo: Omit<StagePhoto, 'id' | 'uploadedBy'>) => {
    await appApi.addStagePhoto(photo);
    await loadDatabaseState(true);
  };

  const handleDeleteStagePhoto = async (photoId: string) => {
    try {
      await appApi.deleteStagePhoto(photoId);
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Failed deleting stage photo');
    }
  };

  const handleSaveTaxInvoice = async (invoice: Omit<TaxInvoice, 'id'>) => {
    await appApi.saveTaxInvoice(invoice);
    await loadDatabaseState(true);
  };

  const handleDeleteTaxInvoice = async (invoiceId: string) => {
    try {
      await appApi.deleteTaxInvoice(invoiceId);
      await loadDatabaseState(true);
    } catch (err: any) {
      alert(err.message || 'Failed deleting invoice');
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await appApi.markNotificationsRead();
      await loadDatabaseState(true);
    } catch (err) {
      console.warn('Failed clearing indicators', err);
    }
  };

  const handleOpenPreviewLightbox = (billUrl: string, metadata?: any) => {
    setPreviewBillUrl(billUrl);
    setPreviewMetadata(metadata || null);
  };

  // Derive unread alerts using per-user read tracking
  const unreadNotifs = notifications.filter(n => !n.isReadBy?.includes(activeUser.id));

  // Selectable navigation tab specs
  const getTabLabel = (key: AppTabs) => {
    switch (key) {
      case 'dashboard': return 'Dashboard Analytics';
      case 'projects': return 'Project Sites';
      case 'advances': return 'Cash Advances';
      case 'borrowings': return 'Cash Flow & Borrowings';
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
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-3 sm:p-4 pt-safe pb-safe font-sans selection:bg-emerald-100 selection:text-emerald-800">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 bg-white rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-slate-200/50">
          
          {/* Aesthetic info column with geometric/construction outline */}
          <div className="bg-slate-900 p-6 sm:p-8 md:p-12 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-600/10 rounded-full blur-2xl -ml-16 -mb-16"></div>
            
            {/* Header Branding */}
            <div className="flex items-center gap-3 relative z-10">
              <div className="p-2 sm:p-2.5 bg-emerald-600 rounded-2xl text-white shadow-lg shadow-emerald-600/20">
                <Building2 className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight uppercase">LV Constructions</h1>
                <p className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest leading-none">Budget & Expense Management</p>
              </div>
            </div>

            {/* Core Message / Mission of CMS */}
            <div className="space-y-4 sm:space-y-6 my-6 sm:my-12 relative z-10">
              <span className="px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold rounded-full text-[10px] uppercase tracking-wider inline-block">
                LV Constructions Active System
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
                Budget & Expense Management
              </h2>
              <p className="text-slate-400 text-xs leading-relaxed">
                Seamless real-time logs, on-site material deliveries, labor payouts, and executive reconciliations in one central ledger. Fully secure with credential protection.
              </p>
              
              <div className="space-y-2.5 pt-2 text-xs font-semibold text-slate-300">
                {roles.length === 0 ? (
                  <div className="flex gap-2.5 items-center text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Dynamic Role-Based Access Control Active</span>
                  </div>
                ) : (
                  roles.map((r) => (
                    <div key={r.id} className="flex gap-2.5 items-center">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>{r.name}: <span className="text-slate-400 font-normal">{r.description || `${r.allowedTabs.length} modules`}</span></span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer tags */}
            <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest relative z-10">
              LV Constructions • Budget & Expense Management
            </div>
          </div>

          {/* Actual Login Interactive Form column */}
          <div className="p-6 sm:p-8 md:p-12 flex flex-col justify-center space-y-5 sm:space-y-6 bg-white">
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">Supervisor Portal Access</h3>
              <p className="text-slate-500 text-xs leading-relaxed">Select an active account from the database below or enter your username/email and password.</p>
            </div>

            {/* Dynamic Account Select from Supabase */}
            {loginAccounts.length > 0 && (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Registered Accounts</label>
                {loginAccounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      setLoginEmail(acc.username || acc.email);
                      setLoginError(null);
                      document.getElementById('login-password-input')?.focus();
                    }}
                    className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center gap-3 group cursor-pointer ${
                      loginEmail === (acc.username || acc.email) || loginEmail === acc.email
                        ? 'border-emerald-500 bg-emerald-50/20'
                        : 'border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/10'
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-emerald-500/15 group-hover:text-emerald-700 transition-all">
                      {acc.role.toLowerCase().includes('mestri') ? (
                        <HardHat className="w-4 h-4" />
                      ) : acc.role.toLowerCase().includes('admin') ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <Building2 className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-slate-800 text-xs truncate">{acc.name}</span>
                        <span className="text-[8px] font-black bg-slate-100 text-slate-700 border border-slate-200 uppercase px-1.5 py-0.5 rounded-md shrink-0">
                          {acc.role}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                        {acc.email} {acc.username ? `• @${acc.username}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* OR text dividing line */}
            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold">
              <div className="flex-1 h-px bg-slate-100"></div>
              <span>SIGN IN WITH CREDENTIALS</span>
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
                  placeholder="Enter username or email"
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
                  placeholder="Enter your password"
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
                disabled={loading}
                className="w-full py-3 bg-slate-900 hover:bg-slate-950 disabled:bg-slate-400 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer select-none"
              >
                <span>{loading ? 'Verifying...' : 'Launch LV Console'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          </div>

        </div>
      </div>
    );
  }

  const currentDbState = {
    roles,
    users,
    projects,
    advances,
    purchases,
    laborExpenses,
    dailyExpenses,
    stagePhotos,
    taxInvoices,
    notifications,
    auditLogs
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 selection:bg-emerald-100 selection:text-emerald-800 flex flex-col font-sans">
      
      {/* Simulation Persona Bar at Top (Admin only) */}
      <div className="bg-slate-900 border-b border-slate-800 text-white pt-safe pb-2 px-3 sm:px-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 sm:gap-3 no-print">
        {canSimulateRoles ? (
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar py-0.5">
            <div className="flex items-center gap-1.5 shrink-0">
              <Sliders className="w-3.5 h-3.5 text-emerald-500 animate-spin-slow shrink-0" />
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 shrink-0">Role Preview:</span>
            </div>
            <div className="flex gap-1.5 flex-nowrap sm:flex-wrap items-center overflow-x-auto no-scrollbar">
              {roles.map(r => (
                <button
                  id={`switch-role-btn-${r.name.toLowerCase()}`}
                  key={r.id}
                  onClick={() => handleRoleSwitch(r.name)}
                  className={`px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[9px] sm:text-[10px] font-black rounded-lg uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    currentUserRole.toLowerCase() === r.name.toLowerCase()
                      ? 'border border-emerald-500 text-emerald-400 bg-emerald-500/10'
                      : 'border border-transparent text-slate-300'
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>
            {users.length > 1 && (
              <select
                aria-label="Preview specific user"
                value={activeUser.id}
                onChange={(e) => {
                  const target = users.find(u => u.id === e.target.value);
                  if (target) handleRoleSwitch(target.role, target.id);
                }}
                className="ml-auto sm:ml-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-[9px] sm:text-[10px] font-bold text-slate-200 outline-none cursor-pointer shrink-0 max-w-[150px] truncate"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-slate-400">
            <Building2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="truncate">LV Constructions • Supabase Cloud Session</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-[10px] sm:text-xs font-semibold text-slate-350 shrink-0 w-full sm:w-auto justify-between sm:justify-end border-t border-slate-800/60 sm:border-0 pt-1.5 sm:pt-0">
          <p className="flex items-center gap-1.5 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse shrink-0"></span>
            <span className="text-slate-400 font-medium">Active:</span>
            <strong className="text-white font-bold truncate">{activeUser.name} ({activeUser.role})</strong>
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
        <div className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-slate-900 text-white border-r border-slate-950 p-5 sm:p-6 flex flex-col justify-between no-print gap-6 shadow-xl transition-transform duration-300 ease-in-out lg:static lg:w-64 lg:translate-x-0 overflow-y-auto no-scrollbar pt-safe pb-safe ${
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
                if (tab === 'borrowings') icon = <HandCoins className="w-4 h-4 text-amber-400" />;
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
        {/* Right workspace core body */}
        <main className="flex-1 p-3 sm:p-5 lg:p-8 space-y-4 sm:space-y-6 max-w-full min-w-0 overflow-x-hidden">
          
          {/* Central Control bar header */}
          <header className="flex justify-between items-center bg-white p-3 sm:p-4 lg:px-6 border border-slate-200 rounded-2xl shadow-sm no-print gap-2">
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
              <button
                id="mobile-sidebar-hamburger"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="lg:hidden p-2 sm:p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-colors cursor-pointer flex items-center justify-center shrink-0"
                title="Open Navigation"
              >
                <Menu className="w-5 h-5 text-slate-700" />
              </button>

              <div className="min-w-0 space-y-0.5">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight truncate">
                  Active Terminal Panel
                </h2>
                <p className="text-xs text-slate-500 hidden md:block truncate">
                  Manage, review, print and run compliance filters on project data pipelines.
                </p>
                <p className="text-[10px] text-slate-400 font-semibold md:hidden truncate">
                  LV Site Control Center
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              
              {/* Trigger Notification icon */}
              <div className="relative">
                <button
                  id="header-notif-btn"
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="p-2 sm:p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl relative text-slate-600 border border-slate-150 transition-colors cursor-pointer flex items-center justify-center"
                >
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                  {unreadNotifs.length > 0 && (
                    <span id="unread-notifs-badge" className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 sm:w-5 sm:h-5 rounded-full text-[8px] sm:text-[9px] font-black flex items-center justify-center animate-bounce">
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

              {/* Automated Cloud Sync Widget */}
              <CloudSyncAgent 
                currentDbState={currentDbState} 
                onStateRestored={() => loadDatabaseState(true)} 
              />

              {/* Security Credentials Shield (Role Manager Only) */}
              {canManageRoles && (
                <button
                  id="header-security-btn"
                  onClick={() => setIsSecurityModalOpen(true)}
                  className="p-2 sm:px-3 sm:py-2.5 bg-amber-50 border border-amber-200 hover:border-amber-300 text-amber-800 hover:text-amber-900 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  title="🔑 Credentials Security Panel"
                >
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span className="text-[10px] font-black uppercase tracking-wider hidden md:inline">Credentials Shield</span>
                </button>
              )}

              {/* Data Refresh pipeline trigger */}
              <button
                id="header-data-refresh-btn"
                onClick={() => loadDatabaseState()}
                className="p-2 sm:p-2.5 bg-slate-50 border border-slate-150 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
                title="Synchronize Databases State"
              >
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
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
              
              {!activeProject && activeTab !== 'projects' && activeTab !== 'dashboard' && activeTab !== 'audit' ? (
                <div id="no-project-selected-fallback" className="bg-white rounded-2xl border border-slate-100 p-12 text-center max-w-xl mx-auto my-12 shadow-sm">
                  <Building2 className="w-16 h-16 mx-auto text-slate-300 stroke-[1.5] mb-4" />
                  <h3 className="text-lg font-bold text-slate-800">No Construction Sites Configured</h3>
                  <p className="text-slate-550 mt-2 text-xs leading-relaxed max-w-md mx-auto">
                    {canManageProjects 
                      ? "You need to register at least one project site before tracking site advances or daily vouchers. Let's add details for your first site now." 
                      : "No active projects are assigned or configured yet. Please contact your administrator."}
                  </p>
                  {canManageProjects && (
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
                      borrowings={borrowings}
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
                      users={users}
                      currentUserRole={currentUserRole}
                      canManage={canManageProjects}
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
                      users={users}
                      advances={advances}
                      purchases={purchases}
                      laborExpenses={laborExpenses}
                      dailyExpenses={dailyExpenses}
                      currentUserRole={currentUserRole}
                      canManage={canManageProjects}
                      currentUserName={activeUser.name}
                      onAddAdvance={handleAddAdvance}
                    />
                  )}

                  {activeTab === 'borrowings' && (
                    <BorrowingsTracker 
                      activeProject={activeProject}
                      projects={projects}
                      users={users}
                      borrowings={borrowings}
                      currentUserRole={currentUserRole}
                      canManage={canManageProjects}
                      currentUserName={activeUser.name}
                      onSaveBorrowing={handleSaveBorrowing}
                      onRepayBorrowing={handleRepayBorrowing}
                      onDeleteBorrowing={handleDeleteBorrowing}
                      onDeleteRepayment={handleDeleteBorrowingRepayment}
                      onPreviewReceipt={handleOpenPreviewLightbox}
                    />
                  )}

                  {activeTab === 'materials' && (
                    <MaterialPurchaseTracker 
                      activeProject={activeProject}
                      purchases={purchases}
                      currentUserRole={currentUserRole}
                      canWrite={canWriteExpenses}
                      currentUserName={activeUser.name}
                      onAddPurchase={handleAddPurchase}
                      onDeletePurchase={handleDeletePurchase}
                      onSettlePurchase={handleSettlePurchase}
                      onPreviewBill={handleOpenPreviewLightbox}
                    />
                  )}

                  {activeTab === 'labor' && (
                    <LaborExpenseTracker 
                      activeProject={activeProject}
                      laborExpenses={laborExpenses}
                      currentUserRole={currentUserRole}
                      canWrite={canWriteExpenses}
                      currentUserName={activeUser.name}
                      onAddLabor={handleAddLabor}
                      onSettleLabor={handleSettleLabor}
                    />
                  )}

                  {activeTab === 'daily' && (
                    <DailyExpenseTracker 
                      activeProject={activeProject}
                      dailyExpenses={dailyExpenses}
                      currentUserRole={currentUserRole}
                      canWrite={canWriteExpenses}
                      currentUserName={activeUser.name}
                      onAddDailyExpense={handleAddDailyExpense}
                      onSettleDaily={handleSettleDaily}
                      onPreviewBill={handleOpenPreviewLightbox}
                    />
                  )}

                  {activeTab === 'reconciliation' && (
                    <ExpenseReconciliation 
                      activeProject={activeProject}
                      advances={advances}
                      borrowings={borrowings}
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
                      borrowings={borrowings}
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
                      users={users}
                      roles={roles}
                      taxInvoices={taxInvoices}
                      onSaveTaxInvoice={handleSaveTaxInvoice}
                      onDeleteTaxInvoice={handleDeleteTaxInvoice}
                      onReloadData={async () => { await loadDatabaseState(true); }}
                      activeUser={activeUser}
                    />
                  )}

                  {activeTab === 'photos' && (
                    <StagePhotosManager 
                      activeProject={activeProject}
                      photos={stagePhotos}
                      currentUserRole={currentUserRole}
                      canWrite={canWriteExpenses}
                      currentUserName={activeUser.name}
                      onAddPhoto={handleAddStagePhoto}
                      onDeletePhoto={handleDeleteStagePhoto}
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

      {/* Security Credentials Shield Modal */}
      {isSecurityModalOpen && (
        <div id="security-admin-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 max-w-xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 animate-in zoom-in-95 duration-150">
            
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
              <div className="flex items-center justify-between gap-2">
                <p className="font-extrabold flex items-center gap-1.5 uppercase tracking-wider text-[10px] text-amber-850">
                  ⚠️ Administrative Password Reset
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsSecurityModalOpen(false);
                    setActiveTab('audit');
                  }}
                  className="text-[10px] font-black uppercase text-indigo-700 hover:underline cursor-pointer"
                >
                  Manage Roles & Add Mestris →
                </button>
              </div>
              <p>
                Reset passwords for any registered user below. Passwords are stored as scrypt hashes in Supabase and never displayed in plaintext.
              </p>
            </div>

            {/* List of user credentials */}
            <div className="space-y-4">
              {users.map(u => {
                const currentInputVal = securityEditPasswords[u.id] || '';
                const isPassVisible = visiblePasswords[u.id];

                return (
                  <div key={u.id} className="p-4 rounded-2xl border border-slate-150 bg-slate-50/50 hover:bg-slate-50 space-y-3 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-xs text-slate-800">{u.name}</h4>
                        <p className="text-[10px] text-slate-450 font-bold tracking-tight">
                          Email: {u.email} • User: {u.username}
                        </p>
                      </div>
                      <span className="text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {u.role}
                      </span>
                    </div>

                    {/* New Password entry field */}
                    <div className="space-y-1.5 pt-1">
                      <label htmlFor={`edit-pass-input-${u.id}`} className="text-[9px] font-black text-slate-450 uppercase tracking-widest block font-sans">Set New Secret Key</label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            id={`edit-pass-input-${u.id}`}
                            type={isPassVisible ? 'text' : 'password'}
                            value={currentInputVal}
                            onChange={(e) => {
                              setSecurityEditPasswords(prev => ({
                                ...prev,
                                [u.id]: e.target.value
                              }));
                            }}
                            className="w-full pl-3 pr-24 py-2.5 bg-white border border-slate-200 focus:border-amber-500 rounded-xl text-xs outline-none transition-all font-mono font-bold text-slate-700 shadow-sm"
                            placeholder="Enter new password (min 4 chars)"
                          />
                          
                          {/* Visibility Selector */}
                          <button
                            type="button"
                            onClick={() => {
                              setVisiblePasswords(prev => ({
                                ...prev,
                                [u.id]: !prev[u.id]
                              }));
                            }}
                            className="absolute right-2 top-1.5 px-2.5 py-1 hover:bg-slate-150 text-[9px] font-extrabold text-slate-500 hover:text-slate-700 uppercase rounded-lg cursor-pointer transition-colors select-none"
                          >
                            {isPassVisible ? 'Hide' : 'Show'}
                          </button>
                        </div>

                        {/* Save Action */}
                        <button
                          type="button"
                          disabled={isUpdatingPasswordId !== null || currentInputVal.trim().length < 4}
                          onClick={() => handleUpdatePassword(u.id, currentInputVal)}
                          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-950 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-extrabold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-w-[75px]"
                        >
                          {isUpdatingPasswordId === u.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                          <span>Update</span>
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
