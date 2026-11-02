import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { api } from '../api';
import {
  UsersRound, CheckSquare, FileCheck2, ShieldX,
  Activity, AlertTriangle, Loader2, RefreshCw
} from 'lucide-react';
import { computeDashboardStats, formatCounterValue } from '../utils/dashboardStats';
import SubmarineScanner from '../components/SubmarineScanner';
import { humanizeAgentStatus, humanizeDecision, humanizeEvent, humanizeRole } from '../utils/userText';

function StatCard({ icon: Icon, label, value, loading, sub, tone = 'blue' }) {
  const iconTone = {
    blue: 'bg-sky-50 text-sky-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
  }[tone];

  return (
    <div className="glass-surface hover-lift rounded-lg p-4 flex items-start space-x-3">
      <div className={`p-2 rounded-md shrink-0 ${iconTone}`}>
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
      {humanizeDecision(norm)}
    </span>
  );
}

function formatActivityTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
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
        <p className="text-[12px] text-stone-500">Loading your workspace...</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full p-6 space-y-5">
      <div className="motion-enter relative overflow-hidden rounded-xl border border-[#D5E8EC] bg-gradient-to-r from-[#E8F3F6] via-white to-white px-6 py-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-[#3F899A]" />
        <div>
          <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Overview</h2>
          <p className="text-stone-500 text-[13px] mt-0.5">
            {user?.username} · {humanizeRole(user?.role)}
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
            <span className="font-medium">Ready</span>
          </div>
        </div>
      </div>

      <div className="motion-enter motion-delay-75 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={UsersRound}
          tone="blue"
          label="Active agents"
          value={stats.activeAgents}
          sub={stats.totalAgents > 0 ? `${stats.totalAgents} registered` : 'No agents'}
        />
        <StatCard
          icon={ShieldX}
          tone="amber"
          label="Paused agents"
          value={stats.pausedAgents}
          sub={stats.revokedAgents > 0 ? `${stats.revokedAgents} removed` : (stats.pausedAgents > 0 ? 'Stopped for now' : 'None paused')}
        />
        <StatCard
          icon={CheckSquare}
          tone="violet"
          label="Requests to review"
          value={stats.pendingApprovals}
          sub={stats.pendingApprovals > 0 ? 'Waiting for a decision' : 'Nothing to review'}
        />
        <StatCard
          icon={FileCheck2}
          tone="green"
          label="Activity records"
          value={stats.ledgerTotal}
          sub="Protected history"
        />
      </div>

      <div className="motion-enter motion-delay-150">
        <SubmarineScanner items={pendingList} blocked={blockedEntries} allowed={allowedEntries} onOpenQueue={() => onSelectTab('approvals')} onOpenLedger={() => onSelectTab('ledger')} />
      </div>

      {stats.pendingApprovals > 0 && (
        <div className="flex items-center space-x-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-stone-900 font-medium text-[13px]">
              {stats.pendingApprovals} request{stats.pendingApprovals > 1 ? 's' : ''} waiting for review
            </p>
            <p className="text-stone-500 text-[12px] mt-0.5">
              Requests not reviewed in time are automatically stopped.
            </p>
          </div>
          <button
            onClick={() => onSelectTab('approvals')}
            className="action-pop px-3 py-1.5 text-[12px] font-medium rounded-md bg-stone-900 text-white hover:bg-stone-800 transition shrink-0"
          >
            Review
          </button>
        </div>
      )}

      <div className="motion-enter motion-delay-225 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 bg-gradient-to-r from-[#EAF4F6] via-[#F5FAFB] to-white border-b border-[#C9D9E0]">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#D5E3E8] bg-white text-[#2F7182] shadow-sm">
                <Activity className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-stone-900">Recent activity</h3>
                  <span className="rounded-full border border-[#C9D9E0] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#426D79]">
                    {Math.min(ledgerEntries.length, 6)} recent
                  </span>
                </div>
                <p className="text-[11px] text-stone-600">Latest agent actions and decisions</p>
              </div>
            </div>
            <button
              onClick={() => onSelectTab('ledger')}
              className="shrink-0 rounded-md border border-[#C9D9E0] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#315F6B] shadow-sm transition-colors hover:border-[#8DB3BF] hover:bg-[#F7FBFC]"
            >
              View all →
            </button>
          </div>
          <div className="space-y-2 p-4">
            {ledgerEntries.slice(0, 6).map(entry => {
              const activityTime = formatActivityTime(entry.timestamp);
              const actor = entry.payload?.agent_id || entry.actor || 'WARDEN';
              return (
                <div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#D5E1E6] bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(31,72,91,0.05),0_5px_12px_rgba(31,72,91,0.045)]">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#EAF3F5] text-[#36798A]">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold leading-5 text-stone-900">
                        {humanizeEvent(entry.event_type)}
                      </p>
                      <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-[11px] text-stone-600">
                        <span className="truncate">Agent: <span className="font-medium text-stone-700">{actor}</span></span>
                        {activityTime && <>
                          <span aria-hidden="true" className="text-stone-400">·</span>
                          <time dateTime={entry.timestamp} className="shrink-0">{activityTime}</time>
                        </>}
                      </div>
                    </div>
                  </div>
                  <DecisionBadge outcome={entry.payload?.decision || entry.event_type} />
                </div>
              );
            })}
            {ledgerEntries.length === 0 && (
              <div className="flex flex-col items-center rounded-lg border border-dashed border-[#C9D9E0] bg-[#F8FBFC] px-4 py-7 text-center">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6A929D] shadow-sm">
                  <Activity className="h-5 w-5" />
                </div>
                <p className="text-[13px] font-semibold text-stone-800">No activity yet</p>
                <p className="mt-0.5 text-[11px] text-stone-600">Agent actions and decisions will appear here.</p>
              </div>
            )}
          </div>
        </div>

        <div className="glass-surface hover-lift rounded-lg p-4">
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
              const statusDisplay = humanizeAgentStatus(agent.status);
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
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${badgeColor}`}>
                    {statusDisplay}
                  </span>
                </div>
              );
            })}
            {agents.length === 0 && (
              <p className="text-[12px] text-stone-500 text-center py-6">No agents added yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
