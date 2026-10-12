import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { api } from '../api';
import {
  Bot, CheckSquare, FileCheck2, ShieldX,
  Activity, AlertTriangle, Loader2, RefreshCw
} from 'lucide-react';
import { computeDashboardStats, formatCounterValue } from '../utils/dashboardStats';
import SubmarineScanner from '../components/SubmarineScanner';

function StatCard({ icon: Icon, label, value, loading, sub }) {
  return (
    <div className="bg-white border border-[#E6E0D3] rounded-lg p-4 flex items-start space-x-3">
      <div className="p-2 rounded-md bg-stone-100 text-stone-700 shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-stone-500 font-medium truncate">{label}</p>
        <p className="text-xl font-bold mt-0.5 tracking-tight text-stone-900 tabular-nums">
          {loading ? (
            <span className="inline-block w-10 h-6 bg-stone-100 rounded animate-pulse" />
          ) : (
            formatCounterValue(value)
          )}
        </p>
        {sub && <p className="text-[11px] text-stone-500 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function DecisionBadge({ outcome }) {
  const norm = (outcome || '').toUpperCase();
  let cls = 'bg-stone-100 text-stone-700 border-stone-200';
  if (['ALLOW', 'ACTION_ALLOWED', 'APPROVED', 'ACTION_APPROVED', 'AGENT_REGISTERED', 'AGENT_RESUMED'].includes(norm)) {
    cls = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else if (['PENDING_APPROVAL', 'APPROVAL_REQUESTED', 'ESCALATED', 'AGENT_PAUSED'].includes(norm)) {
    cls = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (['DENY', 'BLOCKED', 'ACTION_BLOCKED', 'REJECTED', 'ACTION_REJECTED', 'KILL_SWITCH_TRIGGERED', 'HUMAN_ONLY'].includes(norm)) {
    cls = 'bg-red-50 text-red-800 border-red-200';
  }
  return (
    <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${cls}`}>
      {norm}
    </span>
  );
}

export default function Dashboard({ user, onSelectTab }) {
  const [agents, setAgents] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [approvals, setApprovals] = useState([]);
  const [blockedEntries, setBlockedEntries] = useState([]);
  const [allowedEntries, setAllowedEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

  const isMountedRef = useRef(true);

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [agentsRes, ledgerRes, approvalsRes, blockedRes, allowedRes] = await Promise.all([
        api.getAgents(),
        api.getLedger(10),
        api.getApprovals(),
        api.getLedger({ event_type: 'ACTION_BLOCKED', limit: 20 }).catch(() => ({ items: [] })),
        api.getLedger({ event_type: 'ACTION_ALLOWED', limit: 20 }).catch(() => ({ items: [] })),
      ]);

      if (!isMountedRef.current) return;

      const safeAgents = Array.isArray(agentsRes) ? agentsRes : (agentsRes?.items ?? []);
      const safeLedgerItems = Array.isArray(ledgerRes) ? ledgerRes : (ledgerRes?.items ?? []);
      const safeLedgerTotal = typeof ledgerRes?.total === 'number'
        ? ledgerRes.total
        : (Array.isArray(ledgerRes) ? ledgerRes.length : safeLedgerItems.length);
      const safeApprovals = Array.isArray(approvalsRes) ? approvalsRes : (approvalsRes?.items ?? []);
      const safeBlocked = Array.isArray(blockedRes) ? blockedRes : (blockedRes?.items ?? []);
      const safeAllowed = Array.isArray(allowedRes) ? allowedRes : (allowedRes?.items ?? []);

      const toContact = (prefix, status) => (e) => {
        const p = e.payload || {};
        return {
          id: `${prefix}-${e.id}`,
          action: p.action || e.event_type,
          agent_id: p.agent_id || e.actor,
          amount: p.amount || 0,
          created_at: e.timestamp,
          status,
          decision_id: p.decision_id,
          evidence_pack: { layers: Array.isArray(p.layers) ? p.layers : [] },
        };
      };

      setAgents(safeAgents);
      setLedgerEntries(safeLedgerItems);
      setLedgerTotal(safeLedgerTotal);
      setApprovals(safeApprovals);
      // Normalize denials + auto-approvals into scanner contacts.
      setBlockedEntries(safeBlocked.map(toContact('denied', 'BLOCKED')));
      setAllowedEntries(safeAllowed.map(toContact('allowed', 'ALLOWED')));
      setLastRefreshedAt(new Date());
    } catch (e) {
      console.error('[WARDEN Dashboard] Error loading dashboard data:', e);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadData();
    const intervalId = setInterval(() => {
      loadData();
    }, 10000);

    const handleDataChanged = () => {
      loadData();
    };

    window.addEventListener('warden_data_changed', handleDataChanged);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    });

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
      window.removeEventListener('warden_data_changed', handleDataChanged);
    };
  }, [loadData]);

  const stats = computeDashboardStats(agents, { total: ledgerTotal, items: ledgerEntries }, approvals);

  const pendingList = useMemo(() => approvals.filter((a) => {
    const s = String(a?.status || '').toUpperCase();
    return s === 'PENDING' || s === 'PENDING_APPROVAL' || s === 'ESCALATED' || s === 'APPROVAL_REQUESTED';
  }), [approvals]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3">
        <Loader2 className="w-6 h-6 text-stone-400 animate-spin" />
        <p className="text-[12px] text-stone-500">Loading metrics...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Overview</h2>
          <p className="text-stone-500 text-[13px] mt-0.5">
            {user?.username} · {user?.role}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center space-x-1.5 text-[12px] text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-50 border border-stone-300 px-3 py-1.5 rounded-md transition"
            title="Refresh metrics now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
          <div className="flex items-center space-x-1.5 text-[12px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-md">
            <Activity className="w-3 h-3" />
            <span className="font-medium">Operational</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Bot}
          label="Active agents"
          value={stats.activeAgents}
          sub={stats.totalAgents > 0 ? `${stats.totalAgents} registered` : 'No agents'}
        />
        <StatCard
          icon={ShieldX}
          label="Paused agents"
          value={stats.pausedAgents}
          sub={stats.revokedAgents > 0 ? `${stats.revokedAgents} revoked` : (stats.pausedAgents > 0 ? 'Enforced' : 'None paused')}
        />
        <StatCard
          icon={CheckSquare}
          label="Pending approvals"
          value={stats.pendingApprovals}
          sub={stats.pendingApprovals > 0 ? 'Needs review' : 'Queue clear'}
        />
        <StatCard
          icon={FileCheck2}
          label="Ledger entries"
          value={stats.ledgerTotal}
          sub="Hash-chained"
        />
      </div>

      <SubmarineScanner items={pendingList} blocked={blockedEntries} allowed={allowedEntries} onOpenQueue={() => onSelectTab('approvals')} onOpenLedger={() => onSelectTab('ledger')} />

      {stats.pendingApprovals > 0 && (
        <div className="flex items-center space-x-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-stone-900 font-medium text-[13px]">
              {stats.pendingApprovals} approval{stats.pendingApprovals > 1 ? 's' : ''} waiting for review
            </p>
            <p className="text-stone-500 text-[12px] mt-0.5">
              Unreviewed actions are denied when the SLA expires.
            </p>
          </div>
          <button
            onClick={() => onSelectTab('approvals')}
            className="px-3 py-1.5 text-[12px] font-medium rounded-md bg-stone-900 text-white hover:bg-stone-800 transition shrink-0"
          >
            Review
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-[#E6E0D3] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-[13px] text-stone-900">Recent ledger events</h3>
              <p className="text-[11px] text-stone-500">Latest audit entries</p>
            </div>
            <button
              onClick={() => onSelectTab('ledger')}
              className="text-[12px] text-stone-600 hover:text-stone-900 font-medium"
            >
              View all →
            </button>
          </div>
          <div className="divide-y divide-stone-100">
            {ledgerEntries.slice(0, 6).map(entry => (
              <div key={entry.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0 flex-1 pr-3">
                  <p className="text-[12px] text-stone-800 font-mono truncate">{entry.event_type}</p>
                  <p className="text-[11px] text-stone-500 truncate font-mono">
                    {entry.actor || entry.payload?.agent_id || 'system'}
                  </p>
                </div>
                <DecisionBadge outcome={entry.payload?.decision || entry.event_type} />
              </div>
            ))}
            {ledgerEntries.length === 0 && (
              <p className="text-[12px] text-stone-500 text-center py-6">No ledger entries yet</p>
            )}
          </div>
        </div>

        <div className="bg-white border border-[#E6E0D3] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-[13px] text-stone-900">Agents</h3>
              <p className="text-[11px] text-stone-500">{agents.length} registered</p>
            </div>
            <button
              onClick={() => onSelectTab('agents')}
              className="text-[12px] text-stone-600 hover:text-stone-900 font-medium"
            >
              Manage →
            </button>
          </div>
          <div className="divide-y divide-stone-100">
            {agents.slice(0, 6).map(agent => {
              const statusLower = String(agent.status || '').trim().toLowerCase();
              const statusDisplay = (agent.status || 'UNKNOWN').toUpperCase();
              const badgeColor =
                statusLower === 'active'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : statusLower === 'paused'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-stone-100 text-stone-600 border-stone-200';
              return (
                <div key={agent.id || agent.agent_id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="text-[12px] text-stone-900 font-medium truncate">{agent.name}</p>
                    <p className="text-[11px] text-stone-500 font-mono truncate">{agent.agent_id || agent.id}</p>
                  </div>
                  <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${badgeColor}`}>
                    {statusDisplay}
                  </span>
                </div>
              );
            })}
            {agents.length === 0 && (
              <p className="text-[12px] text-stone-500 text-center py-6">No agents registered</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
