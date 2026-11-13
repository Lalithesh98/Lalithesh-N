import React, { useEffect, useState, useRef } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Cloud, CloudOff, RefreshCw, Database } from 'lucide-react';
import { appApi } from '../api';

interface CloudSyncAgentProps {
  currentDbState?: any;
  onStateRestored: () => void;
}

export const CloudSyncAgent: React.FC<CloudSyncAgentProps> = ({ onStateRestored }) => {
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [lastEventTime, setLastEventTime] = useState<string>('');
  const clientRef = useRef<SupabaseClient | null>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let channel: any = null;
    let cancelled = false;

    async function initRealtime() {
      try {
        const cfg = await appApi.getSupabaseConfig();
        if (cancelled) return;
        if (!cfg.configured || !cfg.url || !cfg.anonKey) {
          setStatus('offline');
          return;
        }

        const client = createClient(cfg.url, cfg.anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        clientRef.current = client;

        const scheduleRefresh = () => {
          setLastEventTime(new Date().toLocaleTimeString());
          if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
          reloadTimerRef.current = setTimeout(() => {
            onStateRestored();
          }, 800);
        };

        channel = client
          .channel('lv-constructions-live')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, scheduleRefresh)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'advances' }, scheduleRefresh)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'material_purchases' }, scheduleRefresh)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'labor_expenses' }, scheduleRefresh)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_expenses' }, scheduleRefresh)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'stage_photos' }, scheduleRefresh)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, scheduleRefresh)
          .subscribe((subStatus) => {
            if (cancelled) return;
            if (subStatus === 'SUBSCRIBED') {
              setStatus('live');
            } else if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT') {
              setStatus('live'); // REST API remains active even if Realtime replication isn't enabled on all tables
            }
          });

        setStatus('live');
      } catch {
        if (!cancelled) setStatus('offline');
      }
    }

    initRealtime();

    return () => {
      cancelled = true;
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      if (clientRef.current && channel) {
        clientRef.current.removeChannel(channel);
      }
    };
  }, [onStateRestored]);

  if (status === 'connecting') {
    return (
      <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-slate-900 text-slate-300 text-[10px] sm:text-[11px] font-semibold shrink-0">
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-400" />
        <span className="hidden sm:inline">Connecting Supabase...</span>
      </div>
    );
  }

  if (status === 'offline') {
    return (
      <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-[10px] sm:text-[11px] font-semibold border border-slate-200 shrink-0">
        <CloudOff className="h-3.5 w-3.5 text-slate-400" />
        <span className="hidden sm:inline">Offline Mode</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] sm:text-[11px] font-bold select-none shrink-0"
      title={lastEventTime ? `Last live update at ${lastEventTime}` : 'Connected to Supabase PostgreSQL'}
    >
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      <Database className="h-3.5 w-3.5 text-emerald-600 hidden sm:inline" />
      <span className="hidden sm:inline">Supabase Live</span>
      <Cloud className="h-3.5 w-3.5 text-emerald-600 sm:hidden" />
    </div>
  );
};
