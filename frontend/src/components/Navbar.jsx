import React from 'react';
import {
  CheckSquare,
  FileCheck2,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Plug,
  ShieldCheck,
  User,
  UsersRound,
} from 'lucide-react';
import Logo from './Logo';
import { humanizeRole } from '../utils/userText';

const navItems = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'agents', label: 'Agents', icon: UsersRound },
  { id: 'connect', label: 'Connect', icon: Plug },
  { id: 'approvals', label: 'Approvals', icon: CheckSquare },
  { id: 'ledger', label: 'Activity log', icon: FileCheck2 },
  { id: 'policies', label: 'Policies', icon: ShieldCheck },
  { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
];

function getCompanyName(user) {
  const directName = user?.company || user?.company_name || user?.organization;
  if (directName) return directName;

  // Signup currently stores the company after the user's name: "Name (Company)".
  const match = String(user?.full_name || '').match(/\(([^()]+)\)\s*$/);
  return match?.[1]?.trim() || 'Company workspace';
}

function getAccountName(user) {
  const fullName = String(user?.full_name || '').replace(/\s+\([^()]*\)\s*$/, '').trim();
  return fullName || user?.username;
}

function Navigation({ activeTab, onSelectTab, pendingApprovalsCount, mobile = false }) {
  return (
    <nav
      aria-label="Main navigation"
      className={`flex items-center gap-1 ${mobile ? 'w-max min-w-full px-4 py-2' : ''}`}
    >
      {navItems.map(({ id, label, icon: Icon }) => {
        const isActive = activeTab === id;
        const showBadge = id === 'approvals' && pendingApprovalsCount > 0;

        return (
          <button
            key={id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelectTab(id)}
            className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-[12px] transition sm:px-3 ${
              isActive
                ? 'bg-[#E2F0F3] font-semibold text-[#225C69]'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{label}</span>
            {showBadge && (
              <span
                className={`min-w-4 rounded-full px-1 text-center text-[10px] font-semibold leading-4 ${
                  isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {pendingApprovalsCount > 99 ? '99+' : pendingApprovalsCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

export default function Navbar({
  user,
  onLogout,
  activeTab,
  onSelectTab,
  pendingApprovalsCount = 0,
}) {
  const companyName = getCompanyName(user);

  return (
    <header className="z-20 shrink-0 border-t-4 border-t-[#367F92] border-b border-[#D8E8EC] bg-white/85 backdrop-blur-xl shadow-[0_4px_18px_rgba(42,94,109,0.06)]">
      <div className="flex min-h-[72px] items-center gap-3 px-4 sm:px-6">
        <div className="flex shrink-0 items-center gap-2.5">
          <Logo height={30} />
          <span className="hidden text-[11px] text-stone-500 sm:inline">Control Console</span>
        </div>

        <span className="hidden h-7 border-l border-stone-200 sm:block" aria-hidden="true" />

        <div className="min-w-0 max-w-[180px] sm:max-w-[240px]" title={companyName}>
          <p className="truncate text-[12px] font-semibold text-stone-900">{companyName}</p>
          <p className="text-[10px] text-stone-500">Workspace</p>
        </div>

        <div className="hidden min-w-0 flex-1 justify-center xl:flex">
          <Navigation
            activeTab={activeTab}
            onSelectTab={onSelectTab}
            pendingApprovalsCount={pendingApprovalsCount}
          />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3 xl:ml-0">
          <div className="hidden items-center gap-2 border-l border-stone-200 pl-3 sm:flex">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-stone-100 text-stone-600">
              <User className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
            <div className="max-w-[150px] leading-tight">
              <p className="truncate text-[11px] font-semibold text-stone-900">
                {getAccountName(user)}
              </p>
              <p className="text-[10px] text-stone-500">{humanizeRole(user?.role)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-md p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-900"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

      </div>

      <div className="overflow-x-auto border-t border-stone-100 xl:hidden">
        <Navigation
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          pendingApprovalsCount={pendingApprovalsCount}
          mobile
        />
      </div>
    </header>
  );
}
