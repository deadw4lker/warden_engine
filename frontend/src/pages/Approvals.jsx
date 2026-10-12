import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import {
  CheckSquare, XCircle, Clock, Loader2, ChevronDown,
  ChevronUp, AlertTriangle, AlertCircle, RefreshCw, FileText, User
} from 'lucide-react';

function SlaCountdown({ deadline }) {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (!deadline) return;
    const calc = () => {
      const diff = Math.floor((new Date(deadline) - Date.now()) / 1000);
      setRemaining(diff);
    };
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [deadline]);

  if (remaining === null) return null;

  const isUrgent = remaining < 60;
  const isExpired = remaining <= 0;

  const fmt = (s) => {
    if (s <= 0) return 'EXPIRED';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <span className={`flex items-center space-x-1 text-xs font-mono font-medium ${
      isExpired ? 'text-red-700' : isUrgent ? 'text-amber-700 animate-pulse' : 'text-stone-500'
    }`}>
      <Clock className="w-3 h-3" />
      <span>{fmt(remaining)}</span>
    </span>
  );
}

function OutcomeBadge({ status }) {
  const norm = (status || '').toUpperCase();
  let cls = 'bg-stone-100 text-stone-700 border-stone-300';
  if (norm === 'PENDING' || norm === 'PENDING_APPROVAL' || norm === 'ESCALATED') {
    cls = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (norm === 'APPROVED') {
    cls = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else if (norm === 'REJECTED') {
    cls = 'bg-red-50 text-red-800 border-red-200';
  }
  return (
    <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${cls}`}>
      {norm === 'PENDING' ? 'PENDING' : norm}
    </span>
  );
}

function ApprovalCard({ approval, user, onAction }) {
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(null);
  const [actionError, setActionError] = useState('');

  const canAct = user?.role !== 'auditor';
  const normStatus = (approval.status || '').toUpperCase();
  const isPending = normStatus === 'PENDING' || normStatus === 'PENDING_APPROVAL' || normStatus === 'ESCALATED';

  const actionName = approval.action || approval.action_type || 'Unknown action';
  const level = approval.escalation_level || approval.tier || null;
  const deadline = approval.sla_deadline || approval.expires_at || null;

  const handleApprove = async () => {
    setActionError('');
    setLoading('approve');
    try {
      await api.approve(approval.id, reason || 'Approved from console');
      onAction();
    } catch (e) {
      setActionError(e.message || 'Failed to approve request');
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    setActionError('');
    if (!reason.trim()) {
      setActionError('Rejection reason is required');
      return;
    }
    setLoading('reject');
    try {
      await api.reject(approval.id, reason.trim());
      onAction();
    } catch (e) {
      setActionError(e.message || 'Failed to reject request');
    } finally {
      setLoading(null);
    }
  };

  const evidence = approval.evidence_pack || {};
  const riskScore = approval.risk_score ?? evidence.risk_score;

  return (
    <div className={`glass-panel rounded-lg overflow-hidden transition ${isPending ? '' : 'opacity-70'}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2 flex-wrap gap-1">
              <OutcomeBadge status={approval.status} />
              {isPending && <SlaCountdown deadline={deadline} />}
              {level && (
                <span className="text-[10px] font-mono text-stone-600 bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded">
                  {level}
                </span>
              )}
            </div>
            <p className="font-semibold text-stone-900 mt-1.5 truncate">{actionName}</p>
            <p className="text-xs text-stone-500 font-mono mt-0.5 truncate">
              Agent: {approval.agent_id}
              {approval.amount > 0 ? ` · $${approval.amount}` : ''}
            </p>
          </div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-stone-500 hover:text-stone-700 transition mt-1"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Risk bar */}
        {riskScore !== undefined && riskScore !== null && (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-stone-500 mb-1">
              <span>Blast Radius Score</span>
              <span className="font-semibold font-mono text-stone-700">
                {(Number(riskScore) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all bg-stone-900"
                style={{ width: `${Math.min(100, Number(riskScore) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Evidence pack expansion */}
      {expanded && (
        <div className="px-5 pb-5 space-y-3 border-t border-stone-200 pt-4">
          <div className="flex items-center space-x-2 text-xs text-stone-600 font-semibold">
            <FileText className="w-3.5 h-3.5" />
            <span>Evidence Pack</span>
          </div>
          <pre className="text-[10px] font-mono text-stone-200 bg-stone-950 rounded-md p-3 overflow-x-auto max-h-48">
            {JSON.stringify(evidence, null, 2)}
          </pre>
          {approval.resolved_by && (
            <div className="flex items-center space-x-2 text-xs text-stone-500">
              <User className="w-3 h-3" />
              <span>Reviewed by: <span className="text-stone-700 font-mono">{approval.resolved_by}</span></span>
              {approval.resolution_reason && <span>— {approval.resolution_reason}</span>}
            </div>
          )}
          {(approval.reviewer_id && !approval.resolved_by) && (
            <div className="flex items-center space-x-2 text-xs text-stone-500">
              <User className="w-3 h-3" />
              <span>Reviewed by: <span className="text-stone-700 font-mono">{approval.reviewer_id}</span></span>
              {approval.reviewer_reason && <span>— {approval.reviewer_reason}</span>}
            </div>
          )}
        </div>
      )}

      {/* Action bar for pending */}
      {isPending && canAct && (
        <div className="px-5 pb-5 space-y-2">
          <div>
            <input
              type="text"
              placeholder="Reason for decision..."
              value={reason}
              onChange={e => {
                setReason(e.target.value);
                setActionError('');
              }}
              className={`w-full text-xs bg-white border rounded-md px-3 py-2 text-stone-800 placeholder-stone-400 focus:outline-none transition ${
                actionError ? 'border-red-400' : 'border-stone-300 focus:border-stone-900'
              }`}
            />
            {actionError && (
              <p className="text-[11px] text-red-700 mt-1 flex items-center space-x-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{actionError}</span>
              </p>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              id={`reject-${approval.id}`}
              onClick={handleReject}
              disabled={!!loading}
              className="flex-1 flex items-center justify-center space-x-1.5 py-2 bg-white hover:bg-red-50 text-red-800 border border-red-200 rounded-md text-xs font-semibold transition disabled:opacity-50"
            >
              {loading === 'reject' ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
              <span>Disapprove</span>
            </button>
            <button
              id={`approve-${approval.id}`}
              onClick={handleApprove}
              disabled={!!loading}
              className="flex-1 flex items-center justify-center space-x-1.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-md text-xs font-semibold transition disabled:opacity-50"
            >
              {loading === 'approve' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckSquare className="w-3 h-3" />}
              <span>Approve</span>
            </button>
          </div>
        </div>
      )}
      {isPending && !canAct && (
        <div className="px-5 pb-4">
          <p className="text-[11px] text-stone-500">Auditors have read-only access — approval requires an admin or reviewer role.</p>
        </div>
      )}
    </div>
  );
}

const FILTERS = ['PENDING', 'APPROVED', 'REJECTED', 'TIMED_OUT', 'ALL'];

export default function Approvals({ user }) {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');

  const load = useCallback(async () => {
    try {
      const data = await api.getApprovals(filter !== 'ALL' ? { status: filter } : {});
      const items = Array.isArray(data) ? data : (data.items ?? []);
      // Client-side guard: backend stores PENDING, but tolerate legacy labels
      const norm = (s) => (s || '').toUpperCase();
      const wanted = filter.toUpperCase();
      setApprovals(wanted === 'ALL' ? items : items.filter(a => {
        const st = norm(a.status);
        if (wanted === 'PENDING') return st === 'PENDING' || st === 'PENDING_APPROVAL' || st === 'ESCALATED';
        return st === wanted;
      }));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [load]);

  const pendingCount = approvals.filter(a => {
    const st = (a.status || '').toUpperCase();
    return st === 'PENDING' || st === 'PENDING_APPROVAL' || st === 'ESCALATED';
  }).length;

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-stone-900">Approvals Queue</h2>
          <p className="text-stone-500 text-sm mt-0.5">Human-in-the-loop review with SLA countdowns</p>
        </div>
        <div className="flex items-center space-x-2">
          {pendingCount > 0 && (
            <div className="flex items-center space-x-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-md font-medium">
              <AlertTriangle className="w-3 h-3" />
              <span>{pendingCount} pending</span>
            </div>
          )}
          <button onClick={load} className="p-2 rounded-md border border-stone-300 text-stone-600 hover:text-stone-900 transition">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md border transition ${
              filter === s
                ? 'bg-stone-900 text-white border-stone-900'
                : 'text-stone-500 border-stone-200 hover:border-stone-300 hover:text-stone-600'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 text-stone-400 animate-spin" />
        </div>
      ) : approvals.length === 0 ? (
        <div className="text-center py-16 text-stone-500">
          <CheckSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No approvals in this queue</p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map(a => (
            <ApprovalCard key={a.id} approval={a} user={user} onAction={load} />
          ))}
        </div>
      )}
    </div>
  );
}
