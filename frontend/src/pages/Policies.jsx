import React, { useState, useEffect } from 'react';
import { api, getToken, API_BASE } from '../api';
import {
  ShieldCheck, Download, FileText, Loader2, Upload,
  AlertTriangle, CheckCircle2, XCircle, FileUp
} from 'lucide-react';

export default function Policies() {
  const [status, setStatus] = useState(null);
  const [rules, setRules] = useState([]);
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState(null);

  const refresh = async () => {
    const [s, r] = await Promise.all([api.getPolicyStatus(), api.getPolicyRules()]);
    setStatus(s);
    setRules(r.policies || []);
    setDocument(r.document || s.document || null);
  };

  useEffect(() => {
    const load = async () => {
      try {
        await refresh();
      } catch (e) {
        setError(e.message || 'Failed to load policy data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const showMsg = (ok, text) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 6000);
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setWorking(true);
    try {
      const res = await api.uploadPolicyDocument(file);
      showMsg(true, res.message || 'Policy document uploaded.');
      await refresh();
    } catch (err) {
      showMsg(false, err.message || 'PDF upload failed');
    } finally {
      setWorking(false);
    }
  };

  const handleBundleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setWorking(true);
    try {
      const res = await api.uploadPolicyBundle(file);
      showMsg(true, res.message || `Now enforcing: ${(res.uploaded || []).join(', ')}`);
      await refresh();
    } catch (err) {
      showMsg(false, err.message || 'Upload failed');
    } finally {
      setWorking(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/v1/policy/pdf?token=${token || ''}`);
      if (!res.ok) throw new Error('No policy document uploaded yet');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = document?.name || 'Company_Policies.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      showMsg(false, err.message);
    } finally {
      setDownloading(false);
    }
  };

  const live = status?.engine === 'opa' && status?.reachable;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-white flex items-center space-x-2">
            <ShieldCheck className="w-6 h-6 text-slate-400" />
            <span>Company Policies &amp; OPA</span>
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Only what you upload governs — the PDF is the record, the OPA bundle enforces it
          </p>
        </div>
        {document && (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-slate-500/15 text-slate-400 border border-slate-500/30 text-sm font-semibold hover:bg-slate-500/25 transition disabled:opacity-50"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Download PDF</span>
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center space-x-2 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> <span>Loading policy engine status…</span>
        </div>
      )}
      {error && (
        <div className="flex items-center space-x-2 text-slate-400 text-sm">
          <XCircle className="w-4 h-4" /> <span>{error}</span>
        </div>
      )}

      {status && (
        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center space-x-3">
              <span className="w-3 h-3 rounded-full bg-slate-100 shrink-0" />
              <div>
                <p className="font-bold text-white text-sm">
                  {live ? 'OPA engine LIVE' : 'OPA unreachable — Python fallback active'}
                </p>
                <p className="text-xs text-slate-500 font-mono">{status.opa_url}</p>
                {(status.bundle_files || []).length > 0 && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enforcing bundle: <span className="text-slate-300 font-semibold">{status.bundle_meta?.name || 'active bundle'}</span>
                    <span className="font-mono"> ({(status.bundle_files || []).join(', ')})</span>
                  </p>
                )}
                {document && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Policy document: <span className="text-slate-300 font-semibold">{document.name}</span>
                    <span> · by {document.uploaded_by}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4 text-xs text-slate-400">
              <span><strong className="text-white">{rules.length}</strong> sections</span>
              {status.latency_ms != null && <span><strong className="text-white">{status.latency_ms} ms</strong> check</span>}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">{status.note}</p>
        </div>
      )}

      {/* Upload cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="glass-panel rounded-xl p-5">
          <h3 className="font-bold text-white text-sm flex items-center space-x-2">
            <FileUp className="w-4 h-4 text-slate-400" />
            <span>Policy document (PDF)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Upload the company policy PDF. Its sections appear below as the active record.
          </p>
          <label className={`inline-flex items-center space-x-2 px-4 py-2 mt-3 rounded-lg text-sm font-semibold cursor-pointer transition border ${
            working ? 'opacity-50 pointer-events-none' : 'hover:bg-slate-500/25'
          } bg-slate-500/15 text-slate-400 border-slate-500/30`}>
            {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>{working ? 'Working…' : 'Choose PDF & upload'}</span>
            <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} disabled={working} />
          </label>
        </div>
        <div className="glass-panel rounded-xl p-5">
          <h3 className="font-bold text-white text-sm flex items-center space-x-2">
            <Upload className="w-4 h-4 text-slate-400" />
            <span>Enforcement bundle (.zip of .rego)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Validated (<span className="font-mono">opa check</span>, <span className="font-mono">package warden</span>) and hot-swapped immediately.
          </p>
          <label className={`inline-flex items-center space-x-2 px-4 py-2 mt-3 rounded-lg text-sm font-semibold cursor-pointer transition border ${
            working ? 'opacity-50 pointer-events-none' : 'hover:bg-slate-500/25'
          } bg-slate-500/15 text-slate-300 border-slate-500/30`}>
            {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>{working ? 'Working…' : 'Choose .zip & upload'}</span>
            <input type="file" accept=".zip" className="hidden" onChange={handleBundleUpload} disabled={working} />
          </label>
        </div>
      </div>
      {msg && (
        <div className={`flex items-center space-x-2 text-xs ${msg.ok ? 'text-slate-400' : 'text-slate-400'}`}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Policy sections from the uploaded PDF */}
      <div className="space-y-3">
        {rules.length === 0 && !loading && (
          <div className="glass-panel rounded-xl p-6 text-center">
            <FileText className="w-6 h-6 text-slate-600 mx-auto" />
            <p className="text-sm text-slate-400 mt-2 font-semibold">No policy document uploaded yet</p>
            <p className="text-xs text-slate-600 mt-1">Upload the company PDF above — its sections will be listed here.</p>
          </div>
        )}
        {rules.map((p) => (
          <div key={p.id} className="glass-panel rounded-xl p-4 flex items-start space-x-3">
            <span className="text-[11px] font-mono font-bold px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
              {p.id}
            </span>
            <div className="flex-1">
              <p className="font-semibold text-white text-sm">{p.title}</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{p.text}</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-1 rounded-full border shrink-0 bg-slate-500/15 text-slate-300 border-slate-600">
              PDF
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-4 bg-slate-900/60 border border-slate-800 flex items-start space-x-3">
        <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400 leading-relaxed">
          The PDF above is the human-readable record. Enforcement happens through the uploaded OPA bundle —
          keep the two in sync. Denied requests land in the ledger, and violations pause the agent until resumed.
        </p>
      </div>
    </div>
  );
}
