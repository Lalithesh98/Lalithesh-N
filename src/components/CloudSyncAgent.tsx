import React, { useEffect, useState, useRef } from 'react';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { appApi } from '../api';
import { Cloud, CloudOff, RefreshCw, CheckCircle, AlertTriangle, LogOut, ShieldAlert } from 'lucide-react';

interface CloudSyncAgentProps {
  currentDbState: any;       // The complete local app state (projects, advances, etc)
  onStateRestored: () => void; // Callback to reload the main state after restoral
}

export const CloudSyncAgent: React.FC<CloudSyncAgentProps> = ({ 
  currentDbState, 
  onStateRestored 
}) => {
  const [firebaseConfig, setFirebaseConfig] = useState<any>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error' | 'restoring'>('idle');
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(true);

  const authRef = useRef<any>(null);
  const firestoreRef = useRef<any>(null);
  const providerRef = useRef<any>(null);

  // Avoid backing up an empty or loading system state initially
  const prevSyncStateRef = useRef<string>('');

  // 1. Fetch Firebase config from Express backend on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const config = await appApi.getFirebaseConfig();
        if (config && config.projectId) {
          setFirebaseConfig(config);
          
          // Initialize Firebase
          const app = getApps().length === 0 
            ? initializeApp(config) 
            : getApp();
          
          const auth = getAuth(app);
          const firestore = getFirestore(app, config.firestoreDatabaseId);
          const provider = new GoogleAuthProvider();
          
          authRef.current = auth;
          firestoreRef.current = firestore;
          providerRef.current = provider;

          // Track auth state
          onAuthStateChanged(auth, (user) => {
            setFirebaseUser(user);
            setIsInitializing(false);
          });
        } else {
          setIsInitializing(false);
        }
      } catch (err: any) {
        console.warn('Silent indicator: Cloud-backup features are running in localized container mode.', err.message);
        setIsInitializing(false);
      }
    }
    loadConfig();
  }, []);

  // 2. Perform Database Auto-Restore when local database is empty but Cloud has a backup
  useEffect(() => {
    if (!firebaseUser || !firestoreRef.current || isInitializing) return;

    async function checkAndRestoreBackup() {
      // Check if local database is fresh/seeded (0 projects)
      const hasNoProjects = !currentDbState?.projects || currentDbState.projects.length === 0;
      
      if (hasNoProjects) {
        setSyncStatus('restoring');
        try {
          const docRef = doc(firestoreRef.current, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data && data.databaseState) {
              const restoredState = JSON.parse(data.databaseState);
              
              // Restore data to Express server db.json cache
              await appApi.importDatabase(restoredState);
              console.log('🌟 Cloud Restoration Complete: restored state from Firestore to server.');
              
              setSyncStatus('synced');
              setLastSyncedTime(new Date().toLocaleTimeString());
              
              // Trigger reload in the parent container
              onStateRestored();
            } else {
              setSyncStatus('idle');
            }
          } else {
            console.log('No previous user database backup found in cloud. Ready to sync local states.');
            setSyncStatus('idle');
          }
        } catch (err: any) {
          console.error('Failed to restore database from cloud backup:', err);
          setSyncStatus('error');
          setErrorMessage(err.message || 'Restoration failure');
        }
      }
    }

    checkAndRestoreBackup();
  }, [firebaseUser, isInitializing]);

  // 3. Perform Automatic Background Backup when local database state changes
  useEffect(() => {
    if (!firebaseUser || !firestoreRef.current || isInitializing || syncStatus === 'restoring') return;

    // Skip backing up if projects are completely empty (let's wait until there is at least something or they create project)
    const hasProjects = currentDbState?.projects && currentDbState.projects.length > 0;
    if (!hasProjects) return;

    // Serialize state
    const stringifiedState = JSON.stringify(currentDbState);
    
    // Prevent redundant syncs
    if (stringifiedState === prevSyncStateRef.current) return;

    // Debounce state backup
    const syncTimeout = setTimeout(async () => {
      setSyncStatus('syncing');
      try {
        const docRef = doc(firestoreRef.current, 'users', firebaseUser.uid);
        
        await setDoc(docRef, {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'LV Constructions Administrator',
          email: firebaseUser.email || '',
          role: 'ADMIN',
          databaseState: stringifiedState,
          lastSyncedAt: new Date().toISOString()
        }, { merge: true });

        prevSyncStateRef.current = stringifiedState;
        setSyncStatus('synced');
        setLastSyncedTime(new Date().toLocaleTimeString());
        setErrorMessage('');
      } catch (err: any) {
        console.error('Failed to auto-sync state to Firestore client:', err);
        setSyncStatus('error');
        setErrorMessage(err.message || 'Auto-sync failed');
      }
    }, 4000); // 4 second delay debounce to group rapid inputs

    return () => clearTimeout(syncTimeout);
  }, [currentDbState, firebaseUser, isInitializing]);

  // Authenticate button handler
  const handleAuthorize = async () => {
    if (!authRef.current || !providerRef.current) return;
    setSyncStatus('syncing');
    try {
      await signInWithPopup(authRef.current, providerRef.current);
      setSyncStatus('synced');
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      setSyncStatus('error');
      setErrorMessage(err.message || 'Google Auth Error');
    }
  };

  // Sign out button handler
  const handleDisconnect = async () => {
    if (!authRef.current) return;
    try {
      await signOut(authRef.current);
      setFirebaseUser(null);
      setSyncStatus('idle');
    } catch (err: any) {
      console.error('Disconnect failed:', err);
    }
  };

  // Manual fallback backup trigger
  const handleForceBackupNow = async () => {
    if (!firebaseUser || !firestoreRef.current || !currentDbState) return;
    setSyncStatus('syncing');
    try {
      const docRef = doc(firestoreRef.current, 'users', firebaseUser.uid);
      await setDoc(docRef, {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || 'LV Constructions Administrator',
        email: firebaseUser.email || '',
        role: 'ADMIN',
        databaseState: JSON.stringify(currentDbState),
        lastSyncedAt: new Date().toISOString()
      }, { merge: true });
      setSyncStatus('synced');
      setLastSyncedTime(new Date().toLocaleTimeString());
      setErrorMessage('');
    } catch (err: any) {
      setSyncStatus('error');
      setErrorMessage(err.message || 'Manual backup failed');
    }
  };

  // Render widget bar
  if (isInitializing) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-700/50 text-slate-400 text-xs font-medium">
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-500" />
        <span>Initializing SafeSync engine...</span>
      </div>
    );
  }

  if (!firebaseConfig) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 text-slate-500 text-xs">
        <CloudOff className="h-3.5 w-3.5 text-slate-400" />
        <span className="font-mono text-[10px]">LOCAL ENGINE ONLY</span>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <button 
        id="btn-cloud-sync-authorize"
        onClick={handleAuthorize}
        className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white text-xs font-semibold shadow-md transition-all duration-150 cursor-pointer"
        title="Connect google account to synchronize database with Google Cloud backup"
      >
        <Cloud className="h-3.5 w-3.5 animate-pulse" />
        <span>☁️ Enable Cloud Sync</span>
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 bg-slate-900/90 border border-slate-700/60 rounded-xl p-2 px-3 shadow-lg select-none">
      <div className="flex items-center gap-2">
        {syncStatus === 'syncing' && (
          <RefreshCw className="h-4 w-4 animate-spin text-orange-400" />
        )}
        {syncStatus === 'synced' && (
          <CheckCircle className="h-4 w-4 text-emerald-400" />
        )}
        {syncStatus === 'restoring' && (
          <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />
        )}
        {syncStatus === 'error' && (
          <AlertTriangle className="h-4 w-4 text-rose-400" />
        )}
        {syncStatus === 'idle' && (
          <Cloud className="h-4 w-4 text-blue-400" />
        )}

        <div className="flex flex-col text-left">
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider leading-none">
            {syncStatus === 'syncing' ? 'Syncing...' : 
             syncStatus === 'synced' ? 'Cloud Backed Up' : 
             syncStatus === 'restoring' ? 'Restoring Backup...' : 
             syncStatus === 'error' ? 'Sync Blocked' : 'Cloud Connected'}
          </span>
          <span className="text-[9px] text-slate-500 font-medium font-mono leading-tight mt-0.5" title={errorMessage || undefined}>
            {syncStatus === 'error' ? errorMessage.substring(0, 24) || 'Connection error' :
             syncStatus === 'restoring' ? 'Loading persistent state' :
             lastSyncedTime ? `Synced at ${lastSyncedTime}` : firebaseUser.email}
          </span>
        </div>
      </div>

      <div className="h-5 w-[1px] bg-slate-800 mx-1"></div>

      <div className="flex items-center gap-2">
        {syncStatus !== 'restoring' && (
          <button
            id="btn-cloud-sync-now"
            onClick={handleForceBackupNow}
            disabled={syncStatus === 'syncing'}
            className="px-2 py-1 text-[9px] font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded uppercase tracking-wider cursor-pointer transition-colors"
            title="Saves latest construction changes instantly to Firestore cloud"
          >
            Sync Now
          </button>
        )}
        <button
          id="btn-cloud-sync-disconnect"
          onClick={handleDisconnect}
          className="p-1 px-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
          title="Disconnect backup auth (Data remains preserved)"
        >
          <LogOut className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};
