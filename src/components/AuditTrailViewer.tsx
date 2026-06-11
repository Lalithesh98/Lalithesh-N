import React, { useState } from 'react';
import { 
  History, 
  User, 
  Clock, 
  Activity, 
  Database, 
  ArrowRight, 
  RefreshCcw, 
  Search,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  FileText,
  Lock,
  ShieldAlert,
  Eye,
  EyeOff,
  Save,
  Edit2,
  Settings
} from 'lucide-react';
import { AuditLog, UserRole, Project } from '../types';
import TaxInvoiceGenerator from './TaxInvoiceGenerator';
import appApi from '../api';

interface AuditTrailViewerProps {
  auditLogs: AuditLog[];
  currentUserRole: UserRole;
  activeProject: Project | null;
  projects?: Project[];
  users?: any[];
  onReloadData?: () => Promise<void>;
  activeUser?: { id: string; name: string; role: UserRole; email: string };
}

export default function AuditTrailViewer({
  auditLogs,
  currentUserRole,
  activeProject,
  projects = [],
  users = [],
  onReloadData,
  activeUser,
}: AuditTrailViewerProps) {

  const [searchTerm, setSearchTerm] = useState('');
  const [subTab, setSubTab] = useState<'profile_log' | 'audit_trail' | 'raise_invoice'>('profile_log');

  // Credentials management state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', username: '', password: '', role: '' });
  const [revealPassMap, setRevealPassMap] = useState<Record<string, boolean>>({});
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Live supervisors list with fallback seeds in case database state isn't finished loading
  const liveUsers = users.length > 0 ? users : [
    { id: 'u1', name: 'Lalithesh N', email: 'lalithesh@lvconstructions.com', role: UserRole.ADMIN, password: 'admin123', username: 'lalithesh' },
    { id: 'u2', name: 'Varun Kashyap', email: 'varun@lvconstructions.com', role: UserRole.PROPRIETOR, password: 'varun123', username: 'varun' },
    { id: 'u3', name: 'Nagaraj S', email: 'nagaraj@lvconstructions.com', role: UserRole.MESTRI, password: 'nagaraj123', username: 'nagaraj' }
  ];

  // Specific audit history for the "Profile Log" (logs affecting user attributes)
  const profileChangesLogs = auditLogs.filter(log => log.tableAffected === 'users');

  const filteredLogs = auditLogs.filter(
    log =>
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.tableAffected.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.newValue.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const startEditing = (u: any) => {
    setEditingUserId(u.id);
    setEditForm({
      name: u.name || '',
      email: u.email || '',
      username: u.username || '',
      password: u.password || '',
      role: u.role || UserRole.MESTRI
    });
    setActionFeedback(null);
  };

  const handleProfileFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;
    if (!editForm.name.trim() || !editForm.email.trim() || !editForm.username.trim() || !editForm.password.trim()) {
      setActionFeedback({ type: 'error', text: 'All credentials fields are mandatory.' });
      return;
    }

    setIsSaving(true);
    setActionFeedback(null);
    try {
      const res = await appApi.updateUserProfile(
        editingUserId,
        {
          name: editForm.name.trim(),
          email: editForm.email.trim(),
          username: editForm.username.trim(),
          password: editForm.password.trim(),
          role: editForm.role as any
        },
        activeUser?.id || 'u1',
        activeUser?.name || 'Admin'
      );
      setActionFeedback({ type: 'success', text: res.message || 'Supervisor credentials altered successfully.' });
      if (onReloadData) {
        await onReloadData();
      }
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: err?.message || 'Failed to sync credentials configuration with server.' });
    } finally {
      setIsSaving(false);
    }
  };

  const togglePasswordReveal = (uid: string) => {
    setRevealPassMap(prev => ({
      ...prev,
      [uid]: !prev[uid]
    }));
  };

  // Parse custom old vs new values to render. If they are JSON, let's pretty-print them.
  const renderValueDiff = (val: string, prefix: '+' | '-') => {
    if (!val) return null;
    try {
      const parsed = JSON.parse(val);
      // If it parsed successfully, let's build visual details!
      return (
        <div className={`p-3 rounded-lg text-[10px] font-mono leading-relaxed max-h-36 overflow-y-auto ${
          prefix === '+' ? 'bg-emerald-50/70 border border-emerald-100 text-emerald-800' : 'bg-rose-50/70 border border-rose-100 text-rose-800'
        }`}>
          <div className="font-bold border-b border-current/10 pb-1 mb-1">
            {prefix === '+' ? 'Added/Updated parameter specs:' : 'Overwritten parameter specs:'}
          </div>
          {Object.entries(parsed).map(([k, v]) => {
            if (typeof v === 'object' || k === 'billUrl') return null; // Avoid heavy details
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
      // Return plain text
      return (
        <p className={`p-2.5 rounded-lg text-xs leading-relaxed ${
          prefix === '+' ? 'bg-emerald-50/50 text-emerald-800' : 'bg-rose-50/50 text-rose-800'
        }`}>
          {val}
        </p>
      );
    }
  };

  return (
    <div id="audit-trail-container" className="space-y-6">
      
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 border border-slate-100 rounded-2xl shadow-sm print:hidden">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-500 animate-spin-slow" /> Administrative Credentials & Profile Audit
          </h2>
          <p className="text-xs text-slate-400">Complete control grid supervising regional supervisor credentials, passwords, permissions, and security audit histories.</p>
        </div>

        <div className="p-1.5 px-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl text-xs font-black flex items-center gap-1">
          <Activity className="w-4 h-4 animate-pulse" /> Supervisor Enclave Control
        </div>
      </div>

      {/* Subtab Segment Selector - hidden during printing */}
      <div className="flex border-b border-slate-200 gap-1 print:hidden">
        <button
          id="tab-profile-log-btn"
          onClick={() => setSubTab('profile_log')}
          className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            subTab === 'profile_log'
              ? 'border-indigo-600 text-indigo-700 bg-slate-50'
              : 'border-transparent text-slate-400 hover:text-slate-750'
          }`}
        >
          <User className="w-4 h-4 text-slate-500" />
          Profiles & Credentials
        </button>
        <button
          id="tab-audit-trail-btn"
          onClick={() => setSubTab('audit_trail')}
          className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            subTab === 'audit_trail'
              ? 'border-slate-800 text-slate-905 bg-slate-50'
              : 'border-transparent text-slate-400 hover:text-slate-750'
          }`}
        >
          System Immutable Logs
        </button>
        <button
          id="tab-raise-invoice-btn"
          onClick={() => setSubTab('raise_invoice')}
          className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            subTab === 'raise_invoice'
              ? 'border-emerald-600 text-emerald-700 bg-slate-50'
              : 'border-transparent text-slate-400 hover:text-slate-755'
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Raise Tax Invoice (LV Format)
        </button>
      </div>

      {subTab === 'raise_invoice' && (
        <TaxInvoiceGenerator activeProject={activeProject} projects={projects} />
      )}

      {subTab === 'profile_log' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Grid of Supervisors and passwords */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-55 pb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">supervisor console credentials</h3>
                  <span className="text-[10px] font-bold text-slate-400">{liveUsers.length} Active Accounts</span>
                </div>

                <div className="space-y-3">
                  {liveUsers.map(u => {
                    const passVisible = revealPassMap[u.id] || false;
                    return (
                      <div 
                        key={u.id} 
                        className={`p-4 rounded-2xl border transition-all ${
                          editingUserId === u.id 
                            ? 'border-indigo-350 bg-indigo-50/20' 
                            : 'border-slate-150 bg-slate-50/50 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 block mb-0.5">UID: {u.id}</span>
                            <h4 className="font-extrabold text-sm text-slate-805 leading-none">{u.name}</h4>
                            <p className="text-[10px] text-slate-450 mt-1.5 font-semibold">
                              Console Username: <strong className="text-slate-705 font-mono">{u.username || u.email.split('@')[0]}</strong>
                            </p>
                            <p className="text-[10px] text-slate-450 font-semibold">
                              Registered Email: <strong className="text-slate-705 font-mono">{u.email}</strong>
                            </p>
                          </div>
                          <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 border rounded-md whitespace-nowrap ${
                            u.role === UserRole.ADMIN ? 'bg-blue-50 text-blue-655 border-blue-205' :
                            u.role === UserRole.PROPRIETOR ? 'bg-purple-50 text-purple-655 border-purple-205' :
                            'bg-amber-50 text-amber-700 border-amber-205'
                          }`}>
                            {u.role}
                          </span>
                        </div>

                        {/* Stored Credentials view with quick reveal and adjust capabilities */}
                        <div className="mt-4 pt-3 border-t border-slate-200/50 flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Access Key:</span>
                            <span className="font-mono text-xs font-black text-slate-700 tracking-wide">
                              {passVisible ? u.password : '•••••••••'}
                            </span>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => togglePasswordReveal(u.id)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-205 text-[9px] font-black uppercase tracking-wider text-slate-600 rounded-lg cursor-pointer transition-colors flex items-center gap-1 select-none"
                              title={passVisible ? 'Hide credential' : 'Reveal credential'}
                            >
                              {passVisible ? <EyeOff className="w-3.5 h-3.5 text-slate-500" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
                              <span>{passVisible ? 'Hide' : 'Reveal'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => startEditing(u)}
                              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-950 text-white text-[9px] font-black uppercase tracking-wider rounded-lg cursor-pointer transition-colors flex items-center gap-1 select-none"
                            >
                              <Edit2 className="w-3 h-3 text-indigo-400" />
                              <span>Alter Details</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Profile Modification Workspace Panel */}
            <div className="lg:col-span-5">
              <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-sm space-y-4 stick-top">
                <div className="flex items-center gap-2 border-b border-slate-55 pb-3">
                  <Settings className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">alter credentials panel</h3>
                </div>

                {editingUserId ? (
                  <form onSubmit={handleProfileFormSubmit} className="space-y-4">
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-[10px] text-amber-900 leading-normal flex gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <strong>Credentials Override Protocol:</strong> You are altered details for supervisor <strong className="underline">{liveUsers.find(u => u.id === editingUserId)?.name}</strong>. Ensure synchronization with their on-site terminal profile immediately.
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="edit-name-field" className="text-[9px] font-black uppercase tracking-widest text-slate-400 block font-sans">Full Display Name</label>
                      <input
                        id="edit-name-field"
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full pl-3 pr-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs outline-none font-bold text-slate-700 transition-all"
                        placeholder="John Doe"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="edit-email-field" className="text-[9px] font-black uppercase tracking-widest text-slate-400 block font-sans">Electronic Email Address</label>
                      <input
                        id="edit-email-field"
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full pl-3 pr-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs outline-none font-mono font-bold text-slate-700 transition-all"
                        placeholder="john@construction.com"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label htmlFor="edit-username-field" className="text-[9px] font-black uppercase tracking-widest text-slate-400 block font-sans">Console Username</label>
                        <input
                          id="edit-username-field"
                          type="text"
                          value={editForm.username}
                          onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                          className="w-full pl-3 pr-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs outline-none font-mono font-bold text-slate-700 transition-all"
                          placeholder="johndoe"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="edit-role-select" className="text-[9px] font-black uppercase tracking-widest text-slate-400 block font-sans">Access Level / Role</label>
                        <select
                          id="edit-role-select"
                          value={editForm.role}
                          onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                          className="w-full px-2 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-[11px] outline-none font-bold text-slate-700 transition-all"
                        >
                          <option value={UserRole.ADMIN}>Contractor (Admin)</option>
                          <option value={UserRole.PROPRIETOR}>Proprietor (Audit Only)</option>
                          <option value={UserRole.MESTRI}>Mestri (Supervisor)</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="edit-password-field" className="text-[9px] font-black uppercase tracking-widest text-slate-400 block font-sans">Access Key Secret (Password)</label>
                      <input
                        id="edit-password-field"
                        type="text"
                        value={editForm.password}
                        onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full pl-3 pr-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs outline-none font-mono font-black tracking-wider text-indigo-700 transition-all"
                        placeholder="secret123"
                        required
                      />
                    </div>

                    <div className="flex gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingUserId(null)}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase rounded-xl transition-all cursor-pointer text-center"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={isSaving}
                        className="flex-1 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-sm disabled:bg-slate-200 disabled:text-slate-450"
                      >
                        {isSaving ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5 text-white" />
                        )}
                        <span>Save Profile</span>
                      </button>
                    </div>

                    {actionFeedback && (
                      <div className={`p-3 rounded-xl text-xs font-bold ${
                        actionFeedback.type === 'success' 
                          ? 'bg-emerald-50 border border-emerald-200 text-emerald-805' 
                          : 'bg-rose-50 border border-rose-200 text-rose-800'
                      }`}>
                        {actionFeedback.text}
                      </div>
                    )}
                  </form>
                ) : (
                  <div className="py-12 px-6 text-center text-slate-400 space-y-3 flex flex-col items-center">
                    <User className="w-12 h-12 stroke-[1.1] text-indigo-300" />
                    <p className="text-xs font-medium leading-relaxed">
                      Select any supervisor account on the left and select <strong>"Alter Details"</strong> to overwrite display names,emails, registered usernames, and security access keys instantly.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Profile Log Audit Activity Log */}
          <div className="bg-white p-5 border border-slate-100 rounded-3xl shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-55 pb-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-emerald-500" /> Credentials History Log
                </h3>
                <p className="text-[10px] text-slate-400 mt-1 font-semibold block uppercase tracking-tight">Timeline logs capturing edits made to supervisor accounts & access privileges</p>
              </div>
              <span className="text-[10px] font-bold text-slate-400">{profileChangesLogs.length} Security Entries</span>
            </div>

            {profileChangesLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs italic">
                No credential modifications recorded yet. All accounts currently remain on seed specifications.
              </div>
            ) : (
              <div className="space-y-3.5">
                {profileChangesLogs.map(log => (
                  <div key={log.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/20 space-y-2">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 bg-white p-2 rounded-lg border border-slate-100 text-[10px] font-bold">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-705 px-2 py-0.5 rounded uppercase text-[8.5px]">
                          {log.action}
                        </span>
                        <span className="text-slate-400 font-mono text-[9px]">{log.id.toUpperCase()}</span>
                      </div>
                      <div className="text-slate-450 uppercase text-[9px] flex items-center gap-1">
                        <User className="w-3 h-3" /> Changed by: <span className="text-slate-700 font-extrabold">{log.userName}</span> • <Clock className="w-3 h-3" /> {new Date(log.date).toLocaleString()}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px]">
                      <div>
                        <span className="text-slate-400 uppercase font-black tracking-wider text-[8px] block mb-1">Previous Credentials State:</span>
                        {renderValueDiff(log.previousValue, '-')}
                      </div>
                      <div>
                        <span className="text-slate-400 uppercase font-black tracking-wider text-[8px] block mb-1">New Sync Credentials State:</span>
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
          {/* Lookup search bar */}
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
              No system log logs match this spec lookup.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLogs.map((log) => {
                const isDelete = log.action.toLowerCase().includes('delete') || log.action.toLowerCase().includes('archive');
                const isProject = log.tableAffected === 'projects';
                const isAdvance = log.tableAffected === 'advances';

                let pillBg = "bg-sky-50 text-sky-600 border-sky-100";
                if (isDelete) pillBg = "bg-rose-50 text-rose-600 border-rose-100 animate-pulse";
                if (isAdvance) pillBg = "bg-emerald-50 text-emerald-600 border-emerald-100";
                if (isProject) pillBg = "bg-purple-50 text-purple-600 border-purple-100";

                return (
                  <div
                    id={`audit-card-${log.id}`}
                    key={log.id}
                    className="bg-white border border-slate-100 hover:border-slate-200 transition-colors rounded-2xl p-5 shadow-xs hover:shadow-sm space-y-4 relative overflow-hidden"
                  >
                    {/* Meta details header bar */}
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-55 pb-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 border rounded-md ${pillBg}`}>
                          {log.action}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold font-mono">{log.id.toUpperCase()}</span>
                        <span className="text-slate-300">|</span>
                        <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1 text-slate-400">
                          <Database className="w-3.5 h-3.5" /> Entity: {log.tableAffected}
                        </span>
                      </div>

                      {/* Timestamp & User */}
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

                    {/* Diff content visualizations */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Previous State */}
                      {log.previousValue ? (
                        <div className="space-y-1.5 flex flex-col">
                          <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Previous state parameter:</span>
                          {renderValueDiff(log.previousValue, '-')}
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-slate-400 text-xs font-semibold italic flex items-center justify-center">
                          ★ Newly Created Entity Record / System seed (No previous state)
                        </div>
                      )}

                      {/* New State */}
                      {log.newValue ? (
                        <div className="space-y-1.5 flex flex-col">
                          <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                            New state parameters <ArrowRight className="w-3.5 h-3.5 text-slate-350" />
                          </span>
                          {renderValueDiff(log.newValue, '+')}
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-500 text-xs font-semibold italic flex items-center justify-center text-center">
                          🎯 Entity Record Nullified / Deletion commit
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

// Add small animation helper
const RefreshCw = ({ className }: { className?: string }) => (
  <svg className={`${className}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
    <path d="M16 16h5v5"/>
  </svg>
);
