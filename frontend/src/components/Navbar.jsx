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
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
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
  const match = String(user?.full_name || '').match(/\(([^()]+)\)\s*$/);
  return match?.[1]?.trim() || 'Company workspace';
}

function getAccountName(user) {
  const fullName = String(user?.full_name || '').replace(/\s+\([^()]*\)\s*$/, '').trim();
  return fullName || user?.username;
}

export default function Navbar({
  user,
  onLogout,
  activeTab,
  onSelectTab,
  pendingApprovalsCount = 0,
}) {
  const companyName = getCompanyName(user);
  const accountName = getAccountName(user);
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <>
      <aside
        className={`z-20 shrink-0 border-r border-r-[#D8E8EC] bg-white/85 backdrop-blur-xl shadow-[0_4px_18px_rgba(42,94,109,0.06)] transition-all duration-300 ${
          collapsed
            ? 'w-[72px] flex-shrink-0'
            : 'w-[260px]'
        }`}
      >
        <div className="flex min-h-[64px] items-center gap-2 px-3 py-3 border-b border-[#D8E8EC]">
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Toggle sidebar"
            className="p-1.5 rounded-md text-stone-600 transition hover:bg-stone-100"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
          {!collapsed && (
            <>
              <Logo height={26} />
              <span className="font-semibold text-[12px] text-stone-900 truncate">
                Control Console
              </span>
            </>
          )}
        </div>

        {!collapsed && (
          <div className="px-3 py-2">
            <p className="text-[10px] font-semibold text-stone-400 tracking-wider mb-3 px-1">
              Navigation
            </p>
            <nav className="space-y-0.5" aria-label="Main navigation">
              {navItems.map(({ id, label, icon: Icon }) => {
                const isActive = activeTab === id;
                const showBadge = id === 'approvals' && pendingApprovalsCount > 0;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => onSelectTab(id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] transition ${
                      isActive
                        ? 'bg-[#E2F0F3] font-semibold text-[#225C69]'
                        : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{label}</span>
                    {showBadge && (
                      <span
                        className={`min-w-[24px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold leading-4 ${
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
          </div>
        )}

        <div className="mt-auto px-3 py-3 border-t border-[#D8E8EC]">
          {!collapsed && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-1.5 rounded-lg border border-stone-100 bg-stone-50">
                <div className="h-7 w-7 flex items-center justify-center rounded-full border border-stone-200 bg-stone-100 text-stone-600">
                  <User className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <div>
                  <p className="truncate text-[11px] font-semibold text-stone-900">
                    {accountName}
                  </p>
                  <p className="truncate text-[9px] text-stone-500">
                    {humanizeRole(user?.role)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                title="Sign out"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </button>
            </div>
          )}
          {collapsed && (
            <button
              onClick={onLogout}
              title="Sign out"
              className="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {collapsed ? (
        <div
          className="fixed z-40 left-[72px] top-[64px] bg-white border border-stone-200 rounded-xl shadow-lg p-2 hidden md:block"
          onMouseLeave={() => setCollapsed(false)}
        >
          <nav className="space-y-1" aria-label="Sidebar navigation">
            {navItems.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              const showBadge = id === 'approvals' && pendingApprovalsCount > 0;
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => {
                    onSelectTab(id);
                    setCollapsed(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[12px] transition ${
                    isActive
                      ? 'bg-[#E2F0F3] font-semibold text-[#225C69]'
                      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                  {showBadge && (
                    <span
                      className={`min-w-[20px] rounded-full px-1 py-0.5 text-center text-[10px] font-semibold leading-4 ${
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
        </div>
      ) : null}
    </>
  );
}
