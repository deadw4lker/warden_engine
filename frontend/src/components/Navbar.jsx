import React from 'react';
import { LogOut, User } from 'lucide-react';
import Logo from './Logo';

export default function Navbar({ user, onLogout }) {
  return (
    <header className="h-14 border-b border-[#E6E0D3] bg-white px-5 flex items-center justify-between shrink-0">
      <div className="flex items-center space-x-2.5">
        <Logo height={26} />
        <span className="text-[11px] text-stone-500 hidden sm:inline">
          Agent governance
        </span>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-1.5 text-[11px] text-stone-600">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
          <span className="font-medium">Operational</span>
        </div>

        {user && (
          <div className="flex items-center space-x-2.5 pl-4 border-l border-stone-200">
            <div className="w-7 h-7 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="text-left hidden sm:block leading-tight">
              <div className="text-[12px] font-semibold text-stone-900">{user.full_name || user.username}</div>
              <div className="text-[11px] text-stone-500">{user.role}</div>
            </div>
            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-md transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
