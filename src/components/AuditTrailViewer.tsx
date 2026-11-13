import React, { useState } from 'react';
import {
  History,
  User,
  Clock,
  Activity,
  Database,
  ArrowRight,
  Search,
  Trash2,
  FileText,
  Lock,
  ShieldAlert,
  Save,
  Edit2,
  Settings,
  PlusCircle,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { AppTab, AuditLog, Project, RoleDefinition, TaxInvoice, User as AppUser } from '../types';
import TaxInvoiceGenerator from './TaxInvoiceGenerator';
import appApi from '../api';

const ALL_TABS: { key: AppTab; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard Analytics' },
  { key: 'projects', label: 'Project Sites' },
  { key: 'advances', label: 'Cash Advances' },
  { key: 'materials', label: 'Material Bills' },
  { key: 'labor', label: 'Labor Wages' },
  { key: 'daily', label: 'Site Vouchers' },
  { key: 'reconciliation', label: 'Ledger Reconciliation' },
  { key: 'documents', label: 'Invoices & Files' },
  { key: 'reports', label: 'Financial Reports' },
  { key: 'audit', label: 'Audit, Roles & Invoices' },
  { key: 'photos', label: 'Stage Progress Photos' },
];

interface AuditTrailViewerProps {
  auditLogs: AuditLog[];
  currentUserRole: string;
  activeProject: Project | null;
  projects?: Project[];
  users?: AppUser[];
  roles?: RoleDefinition[];
  taxInvoices?: TaxInvoice[];
  onSaveTaxInvoice?: (invoice: Omit<TaxInvoice, 'id'>) => Promise<void>;
  onDeleteTaxInvoice?: (id: string) => Promise<void>;
  onReloadData?: () => Promise<void>;
  activeUser?: { id: string; name: string; role: string; email: string };
}

export default function AuditTrailViewer({
  auditLogs,
  currentUserRole,
  activeProject,
  projects = [],
  users = [],
  roles = [],
  taxInvoices = [],
  onSaveTaxInvoice,
  onDeleteTaxInvoice,
  onReloadData,
  activeUser,
}: AuditTrailViewerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [subTab, setSubTab] = useState<'profile_log' | 'audit_trail' | 'raise_invoice'>('profile_log');

  // Role Editor / Creator state
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [roleForm, setRoleForm] = useState<{
    name: string;
    description: string;
    allowedTabs: AppTab[];
    canWriteExpenses: boolean;
    canManageProjects: boolean;
    canManageRoles: boolean;
  }>({
    name: '',
    description: '',
    allowedTabs: ['dashboard'],
    canWriteExpenses: false,
    canManageProjects: false,
    canManageRoles: false,
  });
  const [roleFeedback, setRoleFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSavingRole, setIsSavingRole] = useState(false);

  // User Editor / Creator state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: roles[0]?.name || 'Mestri',
    assignedProjectIds: [] as string[],
  });
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);

  const profileChangesLogs = auditLogs.filter(
    (log) => log.tableAffected === 'users' || log.tableAffected === 'app_roles'
  );

  const filteredLogs = auditLogs.filter(
    (log) =>
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.tableAffected.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.newValue.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Role handlers
  const startCreatingRole = () => {
    setIsCreatingRole(true);
    setEditingRoleId(null);
    setRoleForm({
      name: '',
      description: '',
      allowedTabs: ['dashboard', 'materials', 'labor', 'daily', 'photos'],
      canWriteExpenses: true,
      canManageProjects: false,
      canManageRoles: false,
    });
    setRoleFeedback(null);
  };

  const startEditingRole = (r: RoleDefinition) => {
    setIsCreatingRole(false);
    setEditingRoleId(r.id);
    setRoleForm({
      name: r.name,
      description: r.description,
      allowedTabs: [...r.allowedTabs],
      canWriteExpenses: r.canWriteExpenses,
      canManageProjects: r.canManageProjects,
      canManageRoles: r.canManageRoles,
    });
    setRoleFeedback(null);
  };

  const toggleRoleTab = (tab: AppTab) => {
    setRoleForm((prev) => {
      const exists = prev.allowedTabs.includes(tab);
      const nextTabs = exists ? prev.allowedTabs.filter((t) => t !== tab) : [...prev.allowedTabs, tab];
      return { ...prev, allowedTabs: nextTabs.length > 0 ? nextTabs : ['dashboard'] };
    });
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.name.trim()) {
      setRoleFeedback({ type: 'error', text: 'Role name is required.' });
      return;
    }
    setIsSavingRole(true);
    setRoleFeedback(null);
    try {
      await appApi.saveRole({
        id: editingRoleId || undefined,
        ...roleForm,
      });
      setRoleFeedback({
        type: 'success',
        text: editingRoleId ? `Updated role access for "${roleForm.name}".` : `Created new role "${roleForm.name}".`,
      });
      setIsCreatingRole(false);
      setEditingRoleId(null);
      if (onReloadData) await onReloadData();
    } catch (err: any) {
      setRoleFeedback({ type: 'error', text: err?.message || 'Failed saving role.' });
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleDeleteRole = async (r: RoleDefinition) => {
    if (!window.confirm(`Delete role "${r.name}"?`)) return;
    setRoleFeedback(null);
    try {
      await appApi.deleteRole(r.id);
      setRoleFeedback({ type: 'success', text: `Deleted role "${r.name}".` });
      if (editingRoleId === r.id) setEditingRoleId(null);
      if (onReloadData) await onReloadData();
    } catch (err: any) {
      setRoleFeedback({ type: 'error', text: err?.message || 'Could not delete role.' });
    }
  };

  // User handlers
  const startCreatingUser = () => {
    setIsCreatingUser(true);
    setEditingUserId(null);
    const defaultRole = roles.find((r) => r.name.toLowerCase() === 'mestri')?.name || roles[0]?.name || 'Mestri';
    setUserForm({
      name: '',
      email: '',
      username: '',
      password: '',
      role: defaultRole,
      assignedProjectIds: [],
    });
    setActionFeedback(null);
  };

  const startEditingUser = (u: AppUser) => {
    setIsCreatingUser(false);
    setEditingUserId(u.id);
    setUserForm({
      name: u.name || '',
      email: u.email || '',
      username: u.username || '',
      password: '',
      role: u.role || roles[0]?.name || 'Mestri',
      assignedProjectIds: Array.isArray(u.assignedProjectIds) ? u.assignedProjectIds : [],
    });
    setActionFeedback(null);
  };

  const toggleUserProject = (projectId: string) => {
    setUserForm((prev) => {
      const exists = prev.assignedProjectIds.includes(projectId);
      return {
        ...prev,
        assignedProjectIds: exists
          ? prev.assignedProjectIds.filter((id) => id !== projectId)
          : [...prev.assignedProjectIds, projectId],
      };
    });
  };

  const handleUserFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name.trim() || !userForm.email.trim() || !userForm.username.trim()) {
      setActionFeedback({ type: 'error', text: 'Name, email, and username are mandatory.' });
      return;
    }
    if (isCreatingUser && userForm.password.trim().length < 4) {
      setActionFeedback({ type: 'error', text: 'Initial password must be at least 4 characters.' });
      return;
    }

    setIsSavingUser(true);
    setActionFeedback(null);
    try {
      if (isCreatingUser) {
        await appApi.createUser({
          name: userForm.name.trim(),
          email: userForm.email.trim(),
          username: userForm.username.trim(),
          password: userForm.password.trim(),
          role: userForm.role,
          assignedProjectIds: userForm.assignedProjectIds,
        });
        setActionFeedback({ type: 'success', text: `Created user account for ${userForm.name.trim()}.` });
        setIsCreatingUser(false);
      } else if (editingUserId) {
        const res = await appApi.updateUserProfile(editingUserId, {
          name: userForm.name.trim(),
          email: userForm.email.trim(),
          username: userForm.username.trim(),
          password: userForm.password.trim() || undefined,
          role: userForm.role,
          assignedProjectIds: userForm.assignedProjectIds,
        });
        setActionFeedback({ type: 'success', text: res.message || 'User profile updated successfully.' });
        setEditingUserId(null);
      }
      if (onReloadData) await onReloadData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: err?.message || 'Failed saving user account.' });
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = async (u: AppUser) => {
    if (!window.confirm(`Remove user "${u.name}" (${u.role})?`)) return;
    setActionFeedback(null);
    try {
      await appApi.deleteUser(u.id);
      setActionFeedback({ type: 'success', text: `Deleted user "${u.name}".` });
      if (editingUserId === u.id) setEditingUserId(null);
      if (onReloadData) await onReloadData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: err?.message || 'Failed deleting user.' });
    }
  };

  const renderValueDiff = (val: string, prefix: '+' | '-') => {
    if (!val) return null;
    try {
      const parsed = JSON.parse(val);
      return (
        <div
          className={`p-3 rounded-lg text-[10px] font-mono leading-relaxed max-h-36 overflow-y-auto ${
            prefix === '+'
              ? 'bg-emerald-50/70 border border-emerald-100 text-emerald-800'
              : 'bg-rose-50/70 border border-rose-100 text-rose-800'
          }`}
        >
          <div className="font-bold border-b border-current/10 pb-1 mb-1">
            {prefix === '+' ? 'Added/Updated parameter specs:' : 'Overwritten parameter specs:'}
          </div>
          {Object.entries(parsed).map(([k, v]) => {
            if (typeof v === 'object' || k === 'billUrl') return null;
            return (
              <div key={k} className="flex justify-between gap-2 border-b border-current/5 py-0.5">
                <span className="text-slate-400 font-bold uppercase text-[8px]">{k}</span>
                <span className="font-extrabold truncate max-w-[200px]">{String(v)}</span>
              </div>
            );
          })}
        </div>
      );
    } catch {
      return (
        <p
          className={`p-2.5 rounded-lg text-xs leading-relaxed ${
            prefix === '+' ? 'bg-emerald-50/50 text-emerald-800' : 'bg-rose-50/50 text-rose-800'
          }`}
        >
          {val}
        </p>
      );
    }
  };

  return (
    <div id="audit-trail-container" className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-5 border border-slate-100 rounded-2xl shadow-sm print:hidden">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-500 animate-spin-slow shrink-0" /> Dynamic Roles, Users & Audit Control
          </h2>
          <p className="text-xs text-slate-400">
            Configure custom roles, tab permissions, site-specific Mestris, user credentials, and audit histories.
          </p>
        </div>

        <div className="p-1.5 px-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl text-xs font-black flex items-center gap-1 self-start sm:self-auto shrink-0">
          <Activity className="w-4 h-4 animate-pulse" /> {currentUserRole} Enclave
        </div>
      </div>

      {/* Subtab Segment Selector */}
      <div className="flex border-b border-slate-200 gap-1 print:hidden overflow-x-auto no-scrollbar">
        <button
          id="tab-profile-log-btn"
          onClick={() => setSubTab('profile_log')}
          className={`px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            subTab === 'profile_log'
              ? 'border-indigo-600 text-indigo-700 bg-slate-50'
              : 'border-transparent text-slate-400 hover:text-slate-750'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-indigo-500" />
          Roles & Users Access
        </button>
        <button
          id="tab-audit-trail-btn"
          onClick={() => setSubTab('audit_trail')}
          className={`px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            subTab === 'audit_trail'
              ? 'border-slate-800 text-slate-950 bg-slate-50'
              : 'border-transparent text-slate-400 hover:text-slate-750'
          }`}
        >
          System Immutable Logs
        </button>
        <button
          id="tab-raise-invoice-btn"
          onClick={() => setSubTab('raise_invoice')}
          className={`px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            subTab === 'raise_invoice'
              ? 'border-emerald-600 text-emerald-700 bg-slate-50'
              : 'border-transparent text-slate-400 hover:text-slate-755'
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Raise Tax Invoice (LV Format)
        </button>
      </div>

      {subTab === 'raise_invoice' && (
        <TaxInvoiceGenerator
          activeProject={activeProject}
          projects={projects}
          savedInvoices={taxInvoices}
          onSaveInvoice={onSaveTaxInvoice}
          onDeleteInvoice={onDeleteTaxInvoice}
        />
      )}

      {subTab === 'profile_log' && (
        <div className="space-y-6">
          {/* SECTION 1: DYNAMIC ROLE ACCESS MATRIX */}
          <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Role Access Matrix ({roles.length} Roles)
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">
                  Add custom roles (e.g. Site Engineer, Junior Mestri, Accountant) or edit tab & write permissions.
                </p>
              </div>
              <button
                type="button"
                id="add-role-btn"
                onClick={startCreatingRole}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                <PlusCircle className="w-4 h-4" /> Add Role
              </button>
            </div>

            {roleFeedback && (
              <div
                className={`p-3 rounded-xl text-xs font-bold ${
                  roleFeedback.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                {roleFeedback.text}
              </div>
            )}

            {(isCreatingRole || editingRoleId) && (
              <form
                onSubmit={handleSaveRole}
                className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/30 space-y-4"
              >
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black uppercase text-indigo-900">
                    {isCreatingRole ? 'Create New Role' : `Edit Role Access: ${roleForm.name}`}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingRole(false);
                      setEditingRoleId(null);
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
                      Role Name *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={roles.find((r) => r.id === editingRoleId)?.isSystem}
                      value={roleForm.name}
                      onChange={(e) => setRoleForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Site Engineer, Billing Clerk"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 disabled:bg-slate-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
                      Description
                    </label>
                    <input
                      type="text"
                      value={roleForm.description}
                      onChange={(e) => setRoleForm((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="What this role can access on site or in office"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
                    Action Capabilities
                  </span>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={roleForm.canWriteExpenses}
                        onChange={(e) =>
                          setRoleForm((prev) => ({ ...prev, canWriteExpenses: e.target.checked }))
                        }
                      />
                      <span>Log / Edit Expenses & Photos</span>
                    </label>
                    <label className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={roleForm.canManageProjects}
                        onChange={(e) =>
                          setRoleForm((prev) => ({ ...prev, canManageProjects: e.target.checked }))
                        }
                      />
                      <span>Manage Sites & Issue Advances</span>
                    </label>
                    <label className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={roles.find((r) => r.id === editingRoleId)?.isSystem}
                        checked={roleForm.canManageRoles}
                        onChange={(e) =>
                          setRoleForm((prev) => ({ ...prev, canManageRoles: e.target.checked }))
                        }
                      />
                      <span>Manage Roles, Users & Credentials</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
                    Allowed Pages / Tabs
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {ALL_TABS.map((tab) => {
                      const checked = roleForm.allowedTabs.includes(tab.key);
                      return (
                        <label
                          key={tab.key}
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-[11px] font-bold cursor-pointer transition-colors ${
                            checked
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                              : 'bg-white border-slate-200 text-slate-500'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRoleTab(tab.key)}
                          />
                          <span className="truncate">{tab.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingRole}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingRole ? 'Saving...' : 'Save Role Access'}</span>
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {roles.map((r) => (
                <div
                  key={r.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/40 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-sm text-slate-900">{r.name}</span>
                      {r.isSystem && (
                        <span className="text-[8px] font-black uppercase px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                          System
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">{r.description || 'Custom role access'}</p>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {r.allowedTabs.map((t) => (
                      <span
                        key={t}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                    <div className="text-[9px] font-bold text-slate-500 space-x-2">
                      {r.canWriteExpenses && <span className="text-emerald-700">• Write</span>}
                      {r.canManageProjects && <span className="text-indigo-700">• Sites</span>}
                      {r.canManageRoles && <span className="text-amber-700">• Admin</span>}
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEditingRole(r)}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[9px] font-black uppercase cursor-pointer"
                      >
                        Edit Access
                      </button>
                      {!r.isSystem && (
                        <button
                          type="button"
                          onClick={() => handleDeleteRole(r)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Delete role"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 2: SITE USERS & MESTRI MANAGEMENT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Users & Site Mestris ({users.length})
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold">
                      Add site-specific Mestris, assign roles, and restrict accounts to specific project sites.
                    </p>
                  </div>
                  <button
                    type="button"
                    id="add-user-btn"
                    onClick={startCreatingUser}
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Add User / Mestri
                  </button>
                </div>

                <div className="space-y-3">
                  {users.map((u) => {
                    const assignedNames = (u.assignedProjectIds || [])
                      .map((pid) => projects.find((p) => p.id === pid)?.projectName)
                      .filter(Boolean);

                    return (
                      <div
                        key={u.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          editingUserId === u.id
                            ? 'border-indigo-300 bg-indigo-50/20'
                            : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <h4 className="font-extrabold text-sm text-slate-800 leading-none">{u.name}</h4>
                            <p className="text-[10px] text-slate-500 mt-1.5 font-semibold">
                              Username: <strong className="font-mono text-slate-700">{u.username || u.email.split('@')[0]}</strong> • Email: <strong className="font-mono text-slate-700">{u.email}</strong>
                            </p>
                            <p className="text-[10px] text-slate-500 mt-1 font-semibold flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              Sites:{' '}
                              <span className="text-slate-700">
                                {assignedNames.length > 0 ? assignedNames.join(', ') : 'All Active Sites'}
                              </span>
                            </p>
                          </div>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 border rounded-md bg-white text-slate-700 border-slate-200 whitespace-nowrap">
                            {u.role}
                          </span>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-200/50 flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-[10px] font-bold text-emerald-700">
                            ••••••••• (Scrypt Protected)
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditingUser(u)}
                              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-950 text-white text-[9px] font-black uppercase tracking-wider rounded-lg cursor-pointer flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3 text-indigo-400" />
                              <span>Edit / Assign Sites</span>
                            </button>
                            {u.id !== activeUser?.id && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                                title="Delete user"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* User Create / Edit Panel */}
            <div className="lg:col-span-5">
              <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Settings className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    {isCreatingUser ? 'Add New User / Site Mestri' : 'Edit User & Site Access'}
                  </h3>
                </div>

                {isCreatingUser || editingUserId ? (
                  <form onSubmit={handleUserFormSubmit} className="space-y-3.5">
                    {editingUserId && (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-[10px] text-amber-900 flex gap-2">
                        <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          Updating account for <strong>{users.find((u) => u.id === editingUserId)?.name}</strong>.
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={userForm.name}
                        onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. Suresh K (Site Mestri)"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-bold outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={userForm.email}
                        onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder="suresh@lvconstructions.com"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-mono font-bold outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                          Username *
                        </label>
                        <input
                          type="text"
                          required
                          value={userForm.username}
                          onChange={(e) => setUserForm((prev) => ({ ...prev, username: e.target.value }))}
                          placeholder="suresh"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-mono font-bold outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                          Role *
                        </label>
                        <select
                          value={userForm.role}
                          onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value }))}
                          className="w-full px-2 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-bold outline-none"
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.name}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                        {isCreatingUser ? 'Initial Password *' : 'New Password (optional)'}
                      </label>
                      <input
                        type="password"
                        required={isCreatingUser}
                        value={userForm.password}
                        onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
                        placeholder={isCreatingUser ? 'Min 4 characters' : 'Leave blank to keep current'}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-mono font-bold outline-none"
                      />
                    </div>

                    {projects.length > 0 && (
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                          Assigned Sites (Leave empty for all sites)
                        </label>
                        <div className="max-h-32 overflow-y-auto space-y-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                          {projects.map((p) => (
                            <label key={p.id} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={userForm.assignedProjectIds.includes(p.id)}
                                onChange={() => toggleUserProject(p.id)}
                              />
                              <span className="truncate">{p.projectName}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingUser(false);
                          setEditingUserId(null);
                        }}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase rounded-xl cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingUser}
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {isSavingUser ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>{isCreatingUser ? 'Create User' : 'Save Changes'}</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="py-10 px-4 text-center text-slate-400 space-y-3 flex flex-col items-center">
                    <User className="w-10 h-10 stroke-[1.2] text-indigo-300" />
                    <p className="text-xs font-medium leading-relaxed">
                      Click <strong>&ldquo;Add User / Mestri&rdquo;</strong> to create a supervisor for a specific site, or click <strong>&ldquo;Edit / Assign Sites&rdquo;</strong> on any account.
                    </p>
                  </div>
                )}

                {actionFeedback && (
                  <div
                    className={`p-3 rounded-xl text-xs font-bold ${
                      actionFeedback.type === 'success'
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border border-rose-200 text-rose-800'
                    }`}
                  >
                    {actionFeedback.text}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 3: ROLE & PROFILE AUDIT HISTORY */}
          <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-emerald-500" /> Role & Credentials Audit Log
                </h3>
                <p className="text-[10px] text-slate-400 mt-1 font-semibold uppercase tracking-tight">
                  Timeline capturing edits to role permissions, supervisor accounts, and site assignments
                </p>
              </div>
              <span className="text-[10px] font-bold text-slate-400">{profileChangesLogs.length} Entries</span>
            </div>

            {profileChangesLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs italic">
                No role or credential modifications recorded yet.
              </div>
            ) : (
              <div className="space-y-3.5">
                {profileChangesLogs.map((log) => (
                  <div key={log.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/20 space-y-2">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 bg-white p-2 rounded-lg border border-slate-100 text-[10px] font-bold">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded uppercase text-[8.5px]">
                          {log.action}
                        </span>
                        <span className="text-slate-400 font-mono text-[9px]">{log.id.toUpperCase()}</span>
                      </div>
                      <div className="text-slate-500 uppercase text-[9px] flex items-center gap-1">
                        <User className="w-3 h-3" /> Changed by: <span className="text-slate-700 font-extrabold">{log.userName}</span> • <Clock className="w-3 h-3" /> {new Date(log.date).toLocaleString()}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px]">
                      <div>
                        <span className="text-slate-400 uppercase font-black tracking-wider text-[8px] block mb-1">
                          Previous State:
                        </span>
                        {renderValueDiff(log.previousValue, '-')}
                      </div>
                      <div>
                        <span className="text-slate-400 uppercase font-black tracking-wider text-[8px] block mb-1">
                          New State:
                        </span>
                        {renderValueDiff(log.newValue, '+')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'audit_trail' && (
        <>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
            <input
              id="audit-search-input"
              type="text"
              placeholder="Lookup logs matching team members, specific transactions, fields or entities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm shadow-xs outline-none focus:border-amber-500 placeholder-slate-400"
            />
          </div>

          {filteredLogs.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center text-slate-400">
              <Database className="w-12 h-12 mx-auto stroke-[1.2] text-slate-300 mb-2" />
              No system logs match this lookup.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLogs.map((log) => {
                const isDelete = log.action.toLowerCase().includes('delete') || log.action.toLowerCase().includes('archive');
                const isProject = log.tableAffected === 'projects';
                const isAdvance = log.tableAffected === 'advances';

                let pillBg = 'bg-sky-50 text-sky-600 border-sky-100';
                if (isDelete) pillBg = 'bg-rose-50 text-rose-600 border-rose-100 animate-pulse';
                if (isAdvance) pillBg = 'bg-emerald-50 text-emerald-600 border-emerald-100';
                if (isProject) pillBg = 'bg-purple-50 text-purple-600 border-purple-100';

                return (
                  <div
                    id={`audit-card-${log.id}`}
                    key={log.id}
                    className="bg-white border border-slate-100 hover:border-slate-200 transition-colors rounded-2xl p-5 shadow-xs hover:shadow-sm space-y-4 relative overflow-hidden"
                  >
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-100 pb-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 border rounded-md ${pillBg}`}>
                          {log.action}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold font-mono">{log.id.toUpperCase()}</span>
                        <span className="text-slate-300">|</span>
                        <span className="font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 text-slate-400">
                          <Database className="w-3.5 h-3.5" /> Entity: {log.tableAffected}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-slate-400 font-semibold text-[10px] uppercase">
                        <span className="flex items-center gap-1 text-slate-600">
                          <User className="w-3.5 h-3.5 text-slate-400" /> {log.userName} ({log.userId})
                        </span>
                        <span>|</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {new Date(log.date).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {log.previousValue ? (
                        <div className="space-y-1.5 flex flex-col">
                          <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                            Previous state parameter:
                          </span>
                          {renderValueDiff(log.previousValue, '-')}
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-slate-400 text-xs font-semibold italic flex items-center justify-center">
                          ★ Newly Created Entity Record
                        </div>
                      )}

                      {log.newValue ? (
                        <div className="space-y-1.5 flex flex-col">
                          <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                            New state parameters <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          </span>
                          {renderValueDiff(log.newValue, '+')}
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-500 text-xs font-semibold italic flex items-center justify-center text-center">
                          🎯 Entity Record Deleted
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const RefreshCw = ({ className }: { className?: string }) => (
  <svg
    className={`${className}`}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
);
