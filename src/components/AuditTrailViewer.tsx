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
  AlertTriangle 
} from 'lucide-react';
import { AuditLog, UserRole } from '../types';

interface AuditTrailViewerProps {
  auditLogs: AuditLog[];
  currentUserRole: UserRole;
}

export default function AuditTrailViewer({
  auditLogs,
  currentUserRole,
}: AuditTrailViewerProps) {

  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = auditLogs.filter(
    log =>
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.tableAffected.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.newValue.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                <span className="text-slate-400 font-bold uppercase text-[8px]">{k}:</span>
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 border border-slate-100 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-amber-500 animate-spin-slow" /> Immutable System Audit Ledger
          </h2>
          <p className="text-xs text-slate-400">Complete append-only log recording site transactions, budget modifications and manual entries. No action is deleted.</p>
        </div>

        <div className="p-1.5 px-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-black flex items-center gap-1">
          <Activity className="w-4 h-4 animate-pulse" /> Append-Only Compliance
        </div>
      </div>

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
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-50 pb-3 text-xs">
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
                    <div className="space-y-1.5Col">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Previous state parameter:</span>
                      {renderValueDiff(log.previousValue, '-')}
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-slate-405 text-xs font-semibold italic flex items-center justify-center">
                      ★ Newly Created Entity Record / System seed (No previous state)
                    </div>
                  )}

                  {/* New State */}
                  {log.newValue ? (
                    <div className="space-y-1.5Val">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                        New state parameters <ArrowRight className="w-3.5 h-3.5 text-slate-350" />
                      </span>
                      {renderValueDiff(log.newValue, '+')}
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-650 text-xs font-semibold italic flex items-center justify-center">
                      🎯 Entity Record Nullified / Deletion commit
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
