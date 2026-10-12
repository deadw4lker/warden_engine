import React, { useEffect, useState } from 'react';
import { api } from '../api';
import {
  Bot, Plus, Pause, Play, Loader2, AlertCircle,
  CheckCircle2, ShieldX, RefreshCw, X, Shield,
  DollarSign, Database, Tag, Copy, Check, Info, User
} from 'lucide-react';

const ALL_DATA_CLASSES = ['public', 'internal', 'confidential', 'restricted'];
const SUGGESTED_ACTIONS = [
  'issue_refund',
  'update_record',
  'export_customers',
  'view_order',
  'sync_records',
  'vendor_payout'
];

function formatCurrency(amount) {
  if (amount === undefined || amount === null || amount === '') return '$0';
  const num = Number(amount);
  if (isNaN(num)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(num);
}

function StatusBadge({ status }) {
  const map = {
    ACTIVE: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    active: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    PAUSED: 'bg-amber-50 text-amber-800 border-amber-200',
    paused: 'bg-amber-50 text-amber-800 border-amber-200',
    REVOKED: 'bg-red-50 text-red-800 border-red-200',
    revoked: 'bg-red-50 text-red-800 border-red-200',
  };
  const normalized = (status || '').toUpperCase();
  return (
    <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${map[status] || map[normalized] || 'bg-stone-100 text-stone-700 border-stone-300'}`}>
      {normalized}
    </span>
  );
}

function AgentCard({ agent, user, onAction }) {
  const [actionLoading, setActionLoading] = useState(null);
  const [reason, setReason] = useState('');
  const [controlError, setControlError] = useState('');
  const canControl = user?.role === 'admin' || user?.role === 'risk_officer' || user?.role === 'risk_lead';

  const isPaused = (agent.status || '').toLowerCase() === 'paused';
  const isActive = (agent.status || '').toLowerCase() === 'active';

  const handlePause = async () => {
    setControlError('');
    setActionLoading('pause');
    try {
      await api.pauseAgent(agent.agent_id || agent.id, reason || 'Kill switch activated from console');
      onAction();
      setReason('');
    } catch (e) {
      setControlError(e.message || 'Failed to pause agent');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async () => {
    setControlError('');
    setActionLoading('resume');
    try {
      await api.resumeAgent(agent.agent_id || agent.id, reason || 'Resumed from console');
      onAction();
      setReason('');
    } catch (e) {
      setControlError(e.message || 'Failed to resume agent');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className={`glass-panel rounded-md p-5 transition flex flex-col justify-between ${isPaused ? 'border-stone-200 glow-rose' : ''}`}>
      <div>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className={`p-2 rounded-md border ${isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isPaused ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-stone-100 text-stone-600 border-stone-200'}`}>
              {isActive ? <Bot className="w-5 h-5" /> : <ShieldX className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-stone-900 truncate text-sm">{agent.name}</p>
              <p className="text-[10px] text-stone-500 font-mono truncate">{agent.agent_id || agent.id}</p>
            </div>
          </div>
          <StatusBadge status={agent.status} />
        </div>

        {/* Purpose */}
        {agent.purpose && (
          <p className="text-xs text-stone-600 line-clamp-2 mb-3 leading-relaxed" title={agent.purpose}>
            {agent.purpose}
          </p>
        )}

        {/* Constraints Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-stone-50 rounded-md px-3 py-2 border border-stone-200/80">
            <p className="text-[10px] text-stone-500 uppercase font-mono tracking-wider">Max Amount</p>
            <p className="text-sm font-semibold font-mono mt-0.5 text-stone-600">
              {formatCurrency(agent.max_amount)}
            </p>
          </div>
          <div className="bg-stone-50 rounded-md px-3 py-2 border border-stone-200/80">
            <p className="text-[10px] text-stone-500 uppercase font-mono tracking-wider">Owner</p>
            <p className="text-xs font-semibold font-mono mt-1 text-stone-600 truncate flex items-center space-x-1">
              <User className="w-3 h-3 shrink-0" />
              <span className="truncate">{agent.owner || 'admin'}</span>
            </p>
          </div>
        </div>

        {/* Allowed Data Classes */}
        {agent.allowed_data_classes?.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] text-stone-500 uppercase tracking-wider mb-1 font-mono">Data Classes</p>
            <div className="flex flex-wrap gap-1">
              {agent.allowed_data_classes.map(dc => (
                <span
                  key={dc}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    dc === 'restricted'
                      ? 'bg-stone-100 text-stone-700 border-stone-300'
                      : dc === 'confidential'
                      ? 'bg-stone-100 text-stone-700 border-stone-300'
                      : 'bg-stone-100 text-stone-700 border-stone-300'
                  }`}
                >
                  {dc}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Allowed Actions */}
        {agent.allowed_actions?.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] text-stone-500 uppercase tracking-wider mb-1 font-mono">Allowed Actions</p>
            <div className="flex flex-wrap gap-1">
              {agent.allowed_actions.slice(0, 5).map(a => (
                <span key={a} className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-300">
                  {a}
                </span>
              ))}
              {agent.allowed_actions.length > 5 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">
                  +{agent.allowed_actions.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Control Actions (Pause/Resume) */}
      {canControl && (
        <div className="space-y-1.5 pt-2 border-t border-stone-200/80">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Reason for state change..."
              value={reason}
              onChange={e => {
                setReason(e.target.value);
                setControlError('');
              }}
              className="flex-1 text-xs bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-900"
            />
            {isActive ? (
              <button
                onClick={handlePause}
                disabled={actionLoading === 'pause'}
                className="flex items-center space-x-1 px-3 py-1.5 bg-white hover:bg-red-50 text-red-800 border border-red-200 rounded-md text-xs font-medium transition disabled:opacity-50 shrink-0"
              >
                {actionLoading === 'pause' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />}
                <span>Pause</span>
              </button>
            ) : isPaused ? (
              <button
                onClick={handleResume}
                disabled={actionLoading === 'resume'}
                className="flex items-center space-x-1 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-md text-xs font-medium transition disabled:opacity-50 shrink-0"
              >
                {actionLoading === 'resume' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                <span>Resume</span>
              </button>
            ) : null}
          </div>
          {controlError && (
            <p className="text-[11px] text-stone-600 flex items-center space-x-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{controlError}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CreateAgentModal({ user, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [agentId, setAgentId] = useState('');
  const [owner, setOwner] = useState(user?.username || 'admin');
  const [purpose, setPurpose] = useState('');
  const [allowedActions, setAllowedActions] = useState(['issue_refund', 'update_record']);
  const [newActionInput, setNewActionInput] = useState('');
  const [allowedDataClasses, setAllowedDataClasses] = useState(['public', 'internal']);
  const [maxAmount, setMaxAmount] = useState('10000');

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [createdApiKey, setCreatedApiKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Auto-fill agent_id when name changes if user hasn't typed a custom agent_id
  const handleNameChange = (val) => {
    setName(val);
    if (!agentId || agentId === slugify(name)) {
      setAgentId(slugify(val));
    }
    if (fieldErrors.name) {
      setFieldErrors(prev => ({ ...prev, name: null }));
    }
  };

  const slugify = (text) => {
    return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').slice(0, 32);
  };

  const addActionTag = (tag) => {
    const clean = tag.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    if (clean && !allowedActions.includes(clean)) {
      setAllowedActions([...allowedActions, clean]);
      if (fieldErrors.allowed_actions) {
        setFieldErrors(prev => ({ ...prev, allowed_actions: null }));
      }
    }
    setNewActionInput('');
  };

  const removeActionTag = (tag) => {
    setAllowedActions(allowedActions.filter(t => t !== tag));
  };

  const toggleDataClass = (dc) => {
    if (allowedDataClasses.includes(dc)) {
      setAllowedDataClasses(allowedDataClasses.filter(d => d !== dc));
    } else {
      setAllowedDataClasses([...allowedDataClasses, dc]);
    }
    if (fieldErrors.allowed_data_classes) {
      setFieldErrors(prev => ({ ...prev, allowed_data_classes: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFieldErrors({});

    // Client-side validation
    const errors = {};
    if (!name.trim()) errors.name = 'Agent name is required';
    if (!owner.trim()) errors.owner = 'Owner is required';
    if (!purpose.trim()) errors.purpose = 'Purpose description is required';
    if (allowedDataClasses.length === 0) errors.allowed_data_classes = 'Select at least one data class';
    if (isNaN(Number(maxAmount)) || Number(maxAmount) < 0) errors.max_amount = 'Max amount must be a non-negative number';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        agent_id: agentId.trim() || slugify(name),
        owner: owner.trim(),
        purpose: purpose.trim(),
        allowed_actions: allowedActions,
        allowed_data_classes: allowedDataClasses,
        max_amount: parseFloat(maxAmount) || 0.0,
        status: 'active'
      };

      const res = await api.createAgent(payload);

      // Backend returns api_key on creation!
      if (res && res.api_key) {
        setCreatedApiKey(res.api_key);
      } else {
        onCreated();
        onClose();
      }
    } catch (err) {
      if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(err.fieldErrors);
      } else {
        setFieldErrors({ general: err.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyApiKey = () => {
    if (!createdApiKey) return;
    navigator.clipboard.writeText(createdApiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // If created successfully, show the generated API key view once
  if (createdApiKey) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="glass-panel rounded-lg w-full max-w-lg p-6 space-y-5 border border-stone-300 glow-emerald">
          <div className="flex items-center space-x-3 text-stone-600">
            <div className="p-2.5 rounded-md bg-stone-100 border border-stone-300">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-stone-900">Agent Passport Registered</h3>
              <p className="text-xs text-stone-600">Credentials generated for <span className="text-stone-600 font-mono">{agentId || name}</span></p>
            </div>
          </div>

          <div className="p-4 rounded-md bg-white border border-stone-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-stone-600 uppercase font-semibold tracking-wider">
                Generated API Key
              </span>
              <span className="text-[10px] text-stone-600 font-mono">Save this now!</span>
            </div>

            <div className="flex items-center space-x-2 bg-stone-950 p-2.5 rounded-md border border-stone-200">
              <code className="text-xs font-mono text-stone-300 break-all select-all flex-1">
                {createdApiKey}
              </code>
              <button
                type="button"
                onClick={handleCopyApiKey}
                className="px-3 py-1.5 rounded-md bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition flex items-center space-x-1 shrink-0"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <p className="text-[11px] text-stone-600 leading-relaxed pt-1 flex items-start space-x-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>For security, this secret key is shown <strong>only once</strong> and cannot be retrieved later.</span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              onCreated();
              onClose();
            }}
            className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-semibold rounded-md text-sm transition"
          >
            Done & View Agents
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="glass-panel rounded-lg w-full max-w-lg p-6 my-8 max-h-[90vh] overflow-y-auto border border-stone-300 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-stone-200">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-md bg-stone-100 border border-stone-200 text-stone-600">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-stone-900">Register Agent Passport</h3>
              <p className="text-xs text-stone-600">Configure pre-execution governance bounds</p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900 transition p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* General Error Banner (if not field-specific) */}
        {fieldErrors.general && (
          <div className="mb-4 flex items-center space-x-2 text-stone-600 text-xs bg-stone-100 border border-stone-200 rounded-md px-3.5 py-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{fieldErrors.general}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Agent Name */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Agent Name <span className="text-stone-600">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="e.g. Refund Processor Bot"
              className={`w-full bg-white border border-stone-300 rounded-md px-3 py-2 text-[13px] text-stone-900 placeholder-stone-400 focus:outline-none transition ${
                fieldErrors.name ? 'border-stone-500' : 'border-stone-300 focus:border-stone-900'
              }`}
            />
            {fieldErrors.name && (
              <p className="text-xs text-stone-600 mt-1 flex items-center space-x-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fieldErrors.name}</span>
              </p>
            )}
          </div>

          {/* Agent ID & Owner */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Agent ID <span className="text-stone-500 font-normal font-mono text-[10px]">(auto or custom)</span>
              </label>
              <input
                type="text"
                value={agentId}
                onChange={e => {
                  setAgentId(e.target.value);
                  if (fieldErrors.agent_id) setFieldErrors(prev => ({ ...prev, agent_id: null }));
                }}
                placeholder="refund_processor"
                className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-mono text-stone-900 placeholder-stone-400 focus:outline-none transition ${
                  fieldErrors.agent_id ? 'border-stone-500' : 'border-stone-300 focus:border-stone-900'
                }`}
              />
              {fieldErrors.agent_id && (
                <p className="text-xs text-stone-600 mt-1 flex items-center space-x-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{fieldErrors.agent_id}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Owner <span className="text-stone-600">*</span>
              </label>
              <input
                type="text"
                value={owner}
                onChange={e => {
                  setOwner(e.target.value);
                  if (fieldErrors.owner) setFieldErrors(prev => ({ ...prev, owner: null }));
                }}
                placeholder="admin"
                className={`w-full bg-white border rounded-md px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none transition ${
                  fieldErrors.owner ? 'border-stone-500' : 'border-stone-300 focus:border-stone-900'
                }`}
              />
              {fieldErrors.owner && (
                <p className="text-xs text-stone-600 mt-1 flex items-center space-x-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{fieldErrors.owner}</span>
                </p>
              )}
            </div>
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Purpose & Role Description <span className="text-stone-600">*</span>
            </label>
            <textarea
              rows={2}
              value={purpose}
              onChange={e => {
                setPurpose(e.target.value);
                if (fieldErrors.purpose) setFieldErrors(prev => ({ ...prev, purpose: null }));
              }}
              placeholder="e.g. Handles customer refunds and billing adjustments within spending limits"
              className={`w-full bg-white border rounded-md px-3.5 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none transition resize-none ${
                fieldErrors.purpose ? 'border-stone-500' : 'border-stone-300 focus:border-stone-900'
              }`}
            />
            {fieldErrors.purpose && (
              <p className="text-xs text-stone-600 mt-1 flex items-center space-x-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fieldErrors.purpose}</span>
              </p>
            )}
          </div>

          {/* Allowed Actions Tag Input */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Allowed Actions <span className="text-stone-500 font-normal text-[10px]">(tag input)</span>
            </label>

            {/* Selected Tags */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {allowedActions.map(act => (
                <span
                  key={act}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-stone-100 text-stone-700 border border-stone-300 text-xs font-mono"
                >
                  <span>{act}</span>
                  <button
                    type="button"
                    onClick={() => removeActionTag(act)}
                    className="hover:text-stone-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Add action input */}
            <div className="flex space-x-2">
              <input
                type="text"
                value={newActionInput}
                onChange={e => setNewActionInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addActionTag(newActionInput);
                  }
                }}
                placeholder="Type action name and press Enter..."
                className="flex-1 bg-white border border-stone-300 rounded-md px-3 py-1.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-900"
              />
              <button
                type="button"
                onClick={() => addActionTag(newActionInput)}
                className="px-3 py-1.5 rounded-md border border-stone-300 text-xs text-stone-800 hover:text-stone-900 hover:bg-stone-100 transition"
              >
                + Add
              </button>
            </div>

            {/* Suggestions */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-stone-500 font-mono uppercase">Suggestions:</span>
              {SUGGESTED_ACTIONS.map(sug => {
                const isSelected = allowedActions.includes(sug);
                return (
                  <button
                    key={sug}
                    type="button"
                    disabled={isSelected}
                    onClick={() => addActionTag(sug)}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded transition ${
                      isSelected
                        ? 'bg-stone-100 text-stone-600 border border-stone-200 cursor-default'
                        : 'bg-white text-stone-600 border border-stone-300 hover:border-stone-500 hover:text-stone-700'
                    }`}
                  >
                    +{sug}
                  </button>
                );
              })}
            </div>

            {fieldErrors.allowed_actions && (
              <p className="text-xs text-stone-600 mt-1 flex items-center space-x-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fieldErrors.allowed_actions}</span>
              </p>
            )}
          </div>

          {/* Allowed Data Classes (Checkboxes) */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Allowed Data Classes <span className="text-stone-600">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_DATA_CLASSES.map(dc => {
                const checked = allowedDataClasses.includes(dc);
                return (
                  <label
                    key={dc}
                    className={`flex items-center space-x-2.5 px-3 py-2 rounded-md border text-xs cursor-pointer transition ${
                      checked
                        ? 'bg-stone-100 border-stone-300 text-stone-800'
                        : 'bg-white border-stone-300 text-stone-600 hover:border-stone-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDataClass(dc)}
                      className="rounded border-stone-300 text-stone-500 focus:ring-0 bg-white"
                    />
                    <span className="font-mono text-xs capitalize">{dc}</span>
                  </label>
                );
              })}
            </div>
            {fieldErrors.allowed_data_classes && (
              <p className="text-xs text-stone-600 mt-1 flex items-center space-x-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fieldErrors.allowed_data_classes}</span>
              </p>
            )}
          </div>

          {/* Max Amount */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Max Amount Spending Limit ($) <span className="text-stone-600">*</span>
            </label>
            <div className="relative">
              <DollarSign className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                min="0"
                step="100"
                value={maxAmount}
                onChange={e => {
                  setMaxAmount(e.target.value);
                  if (fieldErrors.max_amount) setFieldErrors(prev => ({ ...prev, max_amount: null }));
                }}
                placeholder="10000"
                className={`w-full bg-white border rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-stone-900 placeholder-stone-400 focus:outline-none transition ${
                  fieldErrors.max_amount ? 'border-stone-500' : 'border-stone-300 focus:border-stone-900'
                }`}
              />
            </div>
            <p className="text-[10px] text-stone-500 mt-1 font-mono">
              Maximum single-transaction amount before automated human review or kill switch
            </p>
            {fieldErrors.max_amount && (
              <p className="text-xs text-stone-600 mt-1 flex items-center space-x-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fieldErrors.max_amount}</span>
              </p>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex space-x-3 pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 border border-stone-300 rounded-md text-xs font-semibold text-stone-600 hover:text-stone-900 hover:border-stone-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white font-semibold rounded-md text-xs transition flex items-center justify-center space-x-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{loading ? 'Registering...' : 'Register Agent'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AgentRegistry({ user }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('ALL');

  const canCreate = user?.role === 'admin' || user?.role === 'risk_lead';

  const load = async () => {
    try {
      const data = await api.getAgents();
      setAgents(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'ALL'
    ? agents
    : agents.filter(a => (a.status || '').toUpperCase() === filter);

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-stone-900">Agent Passports</h2>
          <p className="text-stone-500 text-sm mt-0.5">Cryptographic passports, blast radius bounds & kill switches</p>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={load} className="p-2 rounded-md border border-stone-300 text-stone-600 hover:text-stone-900 hover:border-stone-300 transition">
            <RefreshCw className="w-4 h-4" />
          </button>
          {canCreate && (
            <button
              id="create-agent-btn"
              onClick={() => setShowCreate(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold rounded-md text-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Register Agent</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex space-x-2">
        {['ALL', 'ACTIVE', 'PAUSED'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md border transition ${
              filter === s
                ? 'bg-stone-900 text-white border-stone-900'
                : 'text-stone-500 border-stone-200 hover:border-stone-300 hover:text-stone-600'
            }`}
          >
            {s} {s === 'ALL' ? `(${agents.length})` : `(${agents.filter(a => (a.status || '').toUpperCase() === s).length})`}
          </button>
        ))}
      </div>

      {/* Agents Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 text-stone-600 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-500 glass-panel rounded-lg">
          <Bot className="w-10 h-10 mx-auto mb-3 opacity-40 text-stone-600" />
          <p className="text-sm font-semibold text-stone-700">No agents registered</p>
          <p className="text-xs text-stone-500 mt-1">Register a new agent passport to enable governed execution.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(agent => (
            <AgentCard key={agent.agent_id || agent.id} agent={agent} user={user} onAction={load} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateAgentModal user={user} onClose={() => setShowCreate(false)} onCreated={load} />
      )}
    </div>
  );
}
