import React from 'react';
import {
  LayoutDashboard,
  Bot,
  CheckSquare,
  FileCheck2,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';

export default function Sidebar({ activeTab, onSelectTab, pendingApprovalsCount = 0 }) {
  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'agents', label: 'Agents', icon: Bot },
    {
      id: 'approvals',
      label: 'Approvals',
      icon: CheckSquare,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
    },
    { id: 'ledger', label: 'Activity log', icon: FileCheck2 },
    { id: 'policies', label: 'Policies', icon: ShieldCheck },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
  ];

  return (
    <aside className="w-52 border-r border-[#E6E0D3] bg-white flex flex-col justify-between py-4 px-3 shrink-0">
      <nav className="space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-[13px] transition ${
                isActive
                  ? 'bg-stone-900 text-white font-medium'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded leading-none ${
                  isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-2.5 pt-4 mt-4 border-t border-stone-200">
        <p className="text-[11px] text-stone-500 leading-relaxed">
          Fail-closed: unregistered actions are denied by default.
        </p>
      </div>
    </aside>
  );
}
