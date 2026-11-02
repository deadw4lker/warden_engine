import React, { useEffect, useState } from 'react';
import { api } from '../api';
import {
  UserRound, Plug, Copy, Check, KeyRound, RefreshCw, Play,
  Pause, Trash2, FlaskConical, Loader2, FileText,
} from 'lucide-react';
import { humanizeAction, humanizeConnectionStatus, humanizeDataClass, humanizeDecision } from '../utils/userText';

const COMMON_ACTIONS = [
  'book_ticket', 'cancel_ticket', 'issue_refund', 'issue_replacement',
  'update_record', 'create_ticket', 'view_order', 'view_schedule',
];

const inputCls =
  'w-full bg-white border border-stone-300 rounded-md px-3 py-2 text-[13px] text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-900 transition';
const labelCls = 'block text-[12px] font-medium text-stone-700 mb-1';
const btnPrimary =
  'bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white font-medium py-2 px-4 rounded-md transition flex items-center justify-center gap-2 text-[13px]';
const btnSecondary =
  'bg-white border border-stone-300 hover:border-stone-500 text-stone-900 font-medium py-2 px-4 rounded-md transition flex items-center justify-center gap-2 text-[13px]';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text || '');
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-md transition"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <div className="text-[12px] text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2">
      {error}
    </div>
  );
}

function sdkSnippet(agentId, apiKey) {
  return `from warden_sdk import WardenClient

warden = WardenClient(
    api_url="https://YOUR-WARDEN-URL",  # e.g. http://10.14.164.80:8000
    agent_id="${agentId || '<agent_id>'}",
    api_key="${apiKey || '<paste-key-here>'}",
)

@warden.guard(action="book_ticket", data_class="internal",
              reversibility="partially", amount_param="total_fare")
def book_ticket(customer_id, show_id, seats, total_fare):
    ...  # your existing booking code runs only on ALLOW
`;
}

/* ---------------- Tab 1: register your own agent ---------------- */
function RegisterTab() {
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [agentId, setAgentId] = useState('');
  const [actions, setActions] = useState('book_ticket, cancel_ticket, issue_refund, view_schedule');
  const [dataClasses, setDataClasses] = useState(['public', 'internal']);
  const [maxAmount, setMaxAmount] = useState('50000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // Key management
  const [kmId, setKmId] = useState('');
  const [kmInfo, setKmInfo] = useState(null);
  const [rotated, setRotated] = useState(null);
  const [kmError, setKmError] = useState('');
  const [kmLoading, setKmLoading] = useState(false);

  const toggleDc = (dc) =>
    setDataClasses((prev) => (prev.includes(dc) ? prev.filter((d) => d !== dc) : [...prev, dc]));

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setRotated(null);
    if (!name.trim()) return setError('Give your agent a name.');
    if (!purpose.trim()) return setError('Describe what the agent does.');
    setLoading(true);
    try {
      const data = await api.selfRegisterAgent({
        name: name.trim(),
        purpose: purpose.trim(),
        agent_id: agentId.trim() || undefined,
        allowed_actions: actions.split(',').map((a) => a.trim()).filter(Boolean),
        allowed_data_classes: dataClasses,
        max_amount: parseFloat(maxAmount) || 0,
      });
      setResult(data);
      setKmId(data.agent_id);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyInfo = async () => {
    setKmError('');
    setKmInfo(null);
    if (!kmId.trim()) return setKmError('Enter the agent connection name.');
    setKmLoading(true);
    try {
      setKmInfo(await api.getAgentKeyInfo(kmId.trim()));
    } catch (err) {
      setKmError(err.message || 'Lookup failed');
    } finally {
      setKmLoading(false);
    }
  };

  const handleRotate = async () => {
    setKmError('');
    setRotated(null);
    if (!kmId.trim()) return setKmError('Enter the agent connection name.');
    if (!window.confirm(`Replace the access key for '${kmId.trim()}'? The old key will stop working immediately.`)) return;
    setKmLoading(true);
    try {
      const data = await api.rotateAgentKey(kmId.trim());
      setRotated(data);
      setKmInfo((prev) => (prev ? { ...prev, api_key_prefix: data.api_key_prefix } : prev));
    } catch (err) {
      setKmError(err.message || 'Rotation failed');
    } finally {
      setKmLoading(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="bg-white border border-[#E6E0D3] rounded-lg p-5">
        <h3 className="text-[14px] font-semibold text-stone-900 flex items-center gap-2">
          <UserRound className="w-4 h-4" /> Add your agent
        </h3>
        <p className="text-[12px] text-stone-500 mt-1 mb-4">
          Add an agent and set the tasks it can do. You will be listed as the person responsible for it.
        </p>
        <form onSubmit={handleRegister} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Agent name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Ticket booking assistant" />
            </div>
            <div>
              <label className={labelCls}>Connection name (optional)</label>
              <input value={agentId} onChange={(e) => setAgentId(e.target.value)} className={inputCls} placeholder="Filled in from the name" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Purpose</label>
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className={inputCls} placeholder="Books, cancels and refunds event tickets" />
          </div>
          <div>
            <label className={labelCls}>What tasks can it do? (separate with commas)</label>
            <input value={actions} onChange={(e) => setActions(e.target.value)} className={inputCls} placeholder="book_ticket, issue_refund" />
            <div className="flex gap-1.5 flex-wrap mt-2">
              {COMMON_ACTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setActions((prev) => (prev.split(',').map((x) => x.trim()).includes(a) ? prev : (prev ? prev + ', ' + a : a)))}
                  className="text-[11px] px-2 py-0.5 rounded-md border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-600 transition font-mono"
                >
                  {humanizeAction(a)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Information it can use</label>
              <div className="flex gap-2">
                {['public', 'internal'].map((dc) => (
                  <label key={dc} className="flex items-center gap-1.5 text-[12px] text-stone-700">
                    <input type="checkbox" checked={dataClasses.includes(dc)} onChange={() => toggleDc(dc)} />
                    {humanizeDataClass(dc)}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Max amount (Rs)</label>
              <input value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} className={inputCls} placeholder="50000" inputMode="decimal" />
            </div>
          </div>
          <ErrorBox error={error} />
          <button type="submit" disabled={loading} className={btnPrimary}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Adding agent...' : 'Add agent and create access key'}
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {result && (
          <div className="bg-white border border-emerald-200 rounded-lg p-5">
            <h3 className="text-[14px] font-semibold text-emerald-800 flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> Agent added — copy this key now
            </h3>
            <p className="text-[12px] text-stone-500 mt-1 mb-3">This key is shown once. Save it now; if you lose it, create a replacement.</p>
            <div className="flex items-center gap-2 bg-stone-900 text-white font-mono text-[12px] rounded-md px-3 py-2.5 break-all">
              <span className="flex-1">{result.api_key}</span>
              <CopyButton text={result.api_key} />
            </div>
            <div className="text-[12px] text-stone-600 mt-2 font-mono">
              Connection name: {result.agent_id} · Responsible person: {result.owner}
            </div>
            <div className="mt-3">
              <div className="text-[12px] font-medium text-stone-700 mb-1">Setup code for your developer</div>
              <div className="relative bg-stone-50 border border-stone-200 rounded-md p-3">
                <pre className="text-[11px] font-mono text-stone-800 whitespace-pre-wrap">{sdkSnippet(result.agent_id, result.api_key)}</pre>
                <div className="absolute top-2 right-2"><CopyButton text={sdkSnippet(result.agent_id, result.api_key)} /></div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white border border-[#E6E0D3] rounded-lg p-5">
          <h3 className="text-[14px] font-semibold text-stone-900 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Access key help
          </h3>
          <p className="text-[12px] text-stone-500 mt-1 mb-3">Check an agent’s key or replace one that may have been shared. Available to the owner or an administrator.</p>
          <div className="flex gap-2">
            <input value={kmId} onChange={(e) => setKmId(e.target.value)} className={inputCls} placeholder="Agent connection name" />
            <button onClick={handleKeyInfo} disabled={kmLoading} className={btnSecondary}>Check key</button>
            <button onClick={handleRotate} disabled={kmLoading} className={btnSecondary}>Replace key</button>
          </div>
          <div className="mt-3 space-y-2">
            <ErrorBox error={kmError} />
            {kmInfo && (
              <div className="text-[12px] text-stone-700 font-mono bg-stone-50 border border-stone-200 rounded-md px-3 py-2">
                {kmInfo.agent_id} · {humanizeConnectionStatus(kmInfo.status)} · Responsible person: {kmInfo.owner}
              </div>
            )}
            {rotated && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-stone-900 font-mono text-[12px] rounded-md px-3 py-2.5 break-all">
                <span className="flex-1">{rotated.api_key}</span>
                <CopyButton text={rotated.api_key} />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-[#E6E0D3] rounded-lg p-5">
          <h3 className="text-[14px] font-semibold text-stone-900 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Business onboarding guide
          </h3>
          <p className="text-[12px] text-stone-500 mt-1">
            Send businesses the 3-step ticket-agent walkthrough: register → wrap tools → runtime behavior.
          </p>
          <p className="text-[12px] text-stone-700 mt-2 font-mono">ONBOARDING.md (repo root of CODEX-3.0-main)</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Tab 2: connect an AI service ---------------- */
function statusBadge(s) {
  const map = {
    valid: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    invalid_key: 'bg-red-50 text-red-800 border-red-200',
    unreachable: 'bg-amber-50 text-amber-800 border-amber-200',
    active: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    paused: 'bg-stone-100 text-stone-600 border-stone-200',
    revoked: 'bg-red-50 text-red-800 border-red-200',
  };
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${map[s] || 'bg-stone-100 text-stone-600 border-stone-200'}`}>
      {humanizeConnectionStatus(s)}
    </span>
  );
}

function ConnectionsTab() {
  const [providers, setProviders] = useState([]);
  const [conns, setConns] = useState([]);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('custom_openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('http://10.14.164.80:8502');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [runTask, setRunTask] = useState({});
  const [runRes, setRunRes] = useState({});
  const [busy, setBusy] = useState({});

  const selected = providers.find((p) => p.provider === provider);

  const refresh = async () => {
    try {
      setConns(await api.getConnections());
    } catch {
      /* backend unreachable: keep old list */
    }
  };

  useEffect(() => {
    api.getProviders().then(setProviders).catch(() => setProviders([]));
    refresh();
  }, []);

  const setBusyFor = (id, v) => setBusy((p) => ({ ...p, [id]: v }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Name the connection.');
    if (!apiKey.trim()) return setError('Paste the API key.');
    setLoading(true);
    try {
      await api.createConnection({
        name: name.trim(),
        provider,
        api_key: apiKey.trim(),
        model: model.trim() || 'default',
        base_url: selected?.editable_base_url ? baseUrl.trim() || undefined : undefined,
        allowed_actions: ['issue_refund', 'update_record'],
        allowed_data_classes: ['public', 'internal'],
        max_amount: 5000.0,
      });
      setName('');
      setApiKey('');
      setModel('');
      await refresh();
    } catch (err) {
      setError(err.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const act = async (id, fn, okMsg) => {
    setBusyFor(id, true);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setRunRes((p) => ({ ...p, [id]: { error: err.message } }));
    } finally {
      setBusyFor(id, false);
    }
  };

  const handleRun = async (id) => {
    const task = (runTask[id] || '').trim();
    if (!task) return;
    setBusyFor(id, true);
    try {
      const res = await api.runConnection(id, task);
      setRunRes((p) => ({ ...p, [id]: res }));
      await refresh();
    } catch (err) {
      setRunRes((p) => ({ ...p, [id]: { error: err.message } }));
    } finally {
      setBusyFor(id, false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="bg-white border border-[#E6E0D3] rounded-lg p-5">
        <h3 className="text-[14px] font-semibold text-stone-900 flex items-center gap-2">
          <Plug className="w-4 h-4" /> Connect an AI service
        </h3>
        <p className="text-[12px] text-stone-500 mt-1 mb-4">
          Connect the service your company uses. WARDEN protects the access key and checks that the connection works.
        </p>
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className={labelCls}>AI service</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className={inputCls}>
              {providers.map((p) => (
                <option key={p.provider} value={p.provider}>{p.display_name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="ShopAssist" />
            </div>
            <div>
              <label className={labelCls}>Model name</label>
              <input value={model} onChange={(e) => setModel(e.target.value)} className={inputCls} placeholder={selected?.provider === 'custom_openai' ? 'shopassist' : 'gpt-4o'} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Service access key</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className={`${inputCls} font-mono`} placeholder="Paste the key from your service" />
            <p className="text-[11px] text-stone-400 mt-1">If you don’t have this key, ask the person who manages your AI service.</p>
          </div>
          {selected?.editable_base_url && (
            <div>
              <label className={labelCls}>Service address (for custom setup)</label>
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className={`${inputCls} font-mono`} placeholder="http://10.14.164.80:8502" />
              <p className="text-[11px] text-stone-400 mt-1">Use the service address provided by your developer.</p>
            </div>
          )}
          <ErrorBox error={error} />
          <button type="submit" disabled={loading} className={btnPrimary}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Testing connection...' : 'Connect'}
          </button>
        </form>
      </div>

      <div className="space-y-3">
        {conns.length === 0 && (
          <div className="bg-white border border-[#E6E0D3] rounded-lg p-5 text-[13px] text-stone-500">
            No services connected yet. Add a service above to get started.
          </div>
        )}
        {conns.map((c) => (
          <div key={c.id} className="bg-white border border-[#E6E0D3] rounded-lg p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="text-[13px] font-semibold text-stone-900">{c.name}</div>
                <div className="text-[11px] text-stone-500">{c.provider} · {c.model} · {c.request_count} requests · {c.blocked_count} stopped</div>
              </div>
              <div className="flex items-center gap-1.5">
                {statusBadge(c.last_test_status)} {statusBadge(c.status)}
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <input
                value={runTask[c.id] || ''}
                onChange={(e) => setRunTask((p) => ({ ...p, [c.id]: e.target.value }))}
                className={inputCls}
                placeholder="Describe a task to try…"
              />
              <button onClick={() => handleRun(c.id)} disabled={busy[c.id]} className={btnPrimary} title="Run governed task">
                {busy[c.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              </button>
            </div>
            {runRes[c.id] && (
              <div className="mt-2 text-[12px] bg-stone-50 border border-stone-200 rounded-md px-3 py-2">
                {runRes[c.id].error
                  ? <span className="text-red-800">{runRes[c.id].error}</span>
                  : <>
                    <div className="text-stone-900">{runRes[c.id].model_text || runRes[c.id].summary}</div>
                    {(runRes[c.id].decisions || []).map((d, i) => (
                      <div key={i} className="text-stone-500 mt-1">• {humanizeAction(d.action)}: {humanizeDecision(d.decision)}</div>
                    ))}
                  </>}
              </div>
            )}
            <div className="flex gap-1.5 mt-3 flex-wrap">
              <button onClick={() => act(c.id, () => api.testConnection(c.id))} disabled={busy[c.id]} className="text-[12px] px-2.5 py-1 rounded-md border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 transition flex items-center gap-1">
                <FlaskConical className="w-3.5 h-3.5" /> Test
              </button>
              {c.status === 'active' ? (
                <button onClick={() => act(c.id, () => api.pauseConnection(c.id))} disabled={busy[c.id]} className="text-[12px] px-2.5 py-1 rounded-md border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 transition flex items-center gap-1">
                  <Pause className="w-3.5 h-3.5" /> Pause
                </button>
              ) : c.status === 'paused' ? (
                <button onClick={() => act(c.id, () => api.resumeConnection(c.id))} disabled={busy[c.id]} className="text-[12px] px-2.5 py-1 rounded-md border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 transition flex items-center gap-1">
                  <Play className="w-3.5 h-3.5" /> Resume
                </button>
              ) : null}
              {c.status !== 'revoked' && (
                <button
                  onClick={() => { if (window.confirm(`Revoke '${c.name}'? This cannot be undone.`)) act(c.id, () => api.revokeConnection(c.id)); }}
                  disabled={busy[c.id]}
                  className="text-[12px] px-2.5 py-1 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 transition flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Revoke
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Connect() {
  const [tab, setTab] = useState('register');
  return (
    <div className="w-full min-h-full p-5">
      <h2 className="text-[16px] font-bold tracking-tight text-stone-900">Connect your agent</h2>
      <p className="text-[12px] text-stone-500 mt-0.5 mb-4">
        Add an agent or connect the AI service your company uses.
      </p>
      <div className="flex gap-1.5 mb-4">
        {[
          { id: 'register', label: 'Add agent', icon: UserRound },
          { id: 'bot', label: 'Connect AI service', icon: Plug },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-md border transition ${
              tab === id
                ? 'bg-stone-900 text-white border-stone-900 font-medium'
                : 'bg-white text-stone-600 border-stone-300 hover:border-stone-500'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>
      {tab === 'register' ? <RegisterTab /> : <ConnectionsTab />}
    </div>
  );
}
