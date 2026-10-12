import React from 'react';
import { Shield, ShieldAlert, LogOut, User, RefreshCw } from 'lucide-react';

export default function Navbar({ user, onLogout }) {
  const roleBadge = 'bg-slate-800 text-slate-200 border-slate-600';

  return (
    <header className="h-16 border-b border-slate-800 bg-[#0b1324]/90 backdrop-blur sticky top-0 z-40 px-6 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-lg tracking-wider text-white">
              WARDEN
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold uppercase tracking-wider border border-slate-700">
              Control OS
            </span>
          </div>
          <p className="text-xs text-slate-400 -mt-0.5">AI Agent Pre-Execution Control & Accountability</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Backend Status indicator */}
        <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-slate-100"></span>
          <span>PRE-EXECUTION ACTIVE</span>
        </div>

        {/* User Badge */}
        {user && (
          <div className="flex items-center space-x-3 pl-2 border-l border-slate-800">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                <User className="w-4 h-4" />
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-semibold text-slate-200">{user.full_name || user.username}</div>
                <div className="text-[10px] text-slate-400 font-mono">@{user.username}</div>
              </div>
            </div>

            <span className={`text-[11px] font-mono uppercase font-bold px-2 py-0.5 rounded border ${roleBadge}`}>
              {user.role}
            </span>

            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
