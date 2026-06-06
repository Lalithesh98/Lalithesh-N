import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bell, AlertOctagon, Info, Wallet, DollarSign, Archive } from 'lucide-react';
import { Notification, User } from '../types';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  currentUser: User;
  onMarkRead: () => void;
}

export default function NotificationDrawer({
  isOpen,
  onClose,
  notifications,
  currentUser,
  onMarkRead,
}: NotificationDrawerProps) {
  
  const unreadCount = notifications.filter(n => !n.isReadBy.includes(currentUser.id)).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            id="notif-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-50 cursor-pointer"
          />

          {/* Sliding Panel */}
          <motion.div
            id="notif-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200"
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-lg">System Notifications</h3>
                {unreadCount > 0 && (
                  <span className="bg-amber-500 text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full">
                    {unreadCount} New
                  </span>
                )}
              </div>
              <button
                id="close-notif-btn"
                onClick={onClose}
                className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Read All Button */}
            {unreadCount > 0 && (
              <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex justify-between items-center text-xs">
                <span className="text-slate-500">You have alerts needing attention.</span>
                <button
                  id="mark-all-read-btn"
                  onClick={onMarkRead}
                  className="text-amber-600 hover:text-amber-700 font-semibold uppercase tracking-wider hover:underline"
                >
                  Mark All as Read
                </button>
              </div>
            )}

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {notifications.length === 0 ? (
                <div id="no-notif-state" className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <Bell className="w-12 h-12 stroke-[1.5] mb-2 text-slate-300" />
                  <p className="text-sm">All clear! No notifications found.</p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const isRead = notif.isReadBy.includes(currentUser.id);
                  const isBudgetAlert = notif.type === 'budget_exceeded';
                  const isLargeExpense = notif.type === 'large_expense';
                  const isLowBalance = notif.type === 'low_advance_balance';
                  const isAdvance = notif.type === 'advance_issued';

                  let bgClass = "bg-slate-50 border-slate-100";
                  let icon = <Info className="w-5 h-5 text-slate-500" />;

                  if (isBudgetAlert) {
                    bgClass = isRead ? "bg-red-50/50 border-red-100" : "bg-red-50 border-red-200 ring-2 ring-red-500/10";
                    icon = <AlertOctagon className="w-5 h-5 text-red-600" />;
                  } else if (isLargeExpense) {
                    bgClass = isRead ? "bg-orange-50/50 border-orange-100" : "bg-orange-50 border-orange-200 ring-2 ring-orange-500/10";
                    icon = <DollarSign className="w-5 h-5 text-orange-600" />;
                  } else if (isLowBalance) {
                    bgClass = isRead ? "bg-amber-50/50 border-amber-100" : "bg-amber-50 border-amber-200 ring-2 ring-amber-500/10";
                    icon = <Wallet className="w-5 h-5 text-amber-600" />;
                  } else if (isAdvance) {
                    bgClass = isRead ? "bg-emerald-50/50 border-emerald-100" : "bg-emerald-50 border-emerald-200 ring-2 ring-emerald-500/10";
                    icon = <Wallet className="w-5 h-5 text-emerald-600" />;
                  }

                  return (
                    <div
                      id={`notif-card-${notif.id}`}
                      key={notif.id}
                      className={`p-4 rounded-xl border flex gap-3 transition-all relative overflow-hidden ${bgClass}`}
                    >
                      {/* Unread indicator dot */}
                      {!isRead && (
                        <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                      )}

                      <div className="flex-shrink-0 mt-0.5">
                        <div className="p-2 rounded-lg bg-white shadow-sm">
                          {icon}
                        </div>
                      </div>

                      <div className="flex-1 space-y-1 pr-4">
                        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                          <span className="text-slate-600 font-semibold">{notif.projectName}</span>
                          <span>{new Date(notif.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-800 leading-relaxed">
                          {notif.message}
                        </p>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {new Date(notif.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 text-center text-xs text-slate-400">
              Contractor Budget Pro Real-time Alert Sync
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
