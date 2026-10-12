import React, { useState } from 'react';
import { api } from '../api';
import {
  FileSpreadsheet, Download, FileText, Table2,
  Loader2, CheckCircle2, Link2, Scale, BarChart3, Timer, Bot
} from 'lucide-react';

export default function Reports() {
  const [format, setFormat] = useState('csv');
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  const handleDownload = () => {
    setGenerating(true);
    setDone(false);
    try {
      const url = api.getAuditReportUrl(format);
      const a = document.createElement('a');
      a.href = url;
      a.download = `warden_audit_report.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => {
        setGenerating(false);
        setDone(true);
        setTimeout(() => setDone(false), 3000);
      }, 800);
    } catch {
      setGenerating(false);
    }
  };

  const formats = [
    { id: 'csv', label: 'CSV', icon: Table2, desc: 'Comma-separated, Excel-compatible', color: 'text-slate-400' },
    { id: 'json', label: 'JSON', icon: FileText, desc: 'Machine-readable, full metadata', color: 'text-slate-400' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-2xl font-extrabold text-white">Audit Reports</h2>
        <p className="text-slate-500 text-sm mt-0.5">Export full cryptographic audit trail for compliance</p>
      </div>

      {/* Report info */}
      <div className="glass-panel rounded-xl p-6 space-y-4">
        <h3 className="font-bold text-white flex items-center space-x-2">
          <FileSpreadsheet className="w-5 h-5 text-slate-400" />
          <span>Comprehensive Audit Report</span>
        </h3>
        <p className="text-sm text-slate-400 leading-relaxed">
          Exports the complete governance audit trail — all agent actions, policy decisions,
          approval workflows, SLA escalations, and ledger integrity checkpoints.
          Suitable for SOC 2, ISO 27001, and internal compliance reviews.
        </p>

        <div className="grid grid-cols-3 gap-3 py-2">
          {[
            { label: 'All Ledger Events', Icon: Link2 },
            { label: 'Policy Decisions', Icon: Scale },
            { label: 'Approval Chain', Icon: CheckCircle2 },
            { label: 'Risk Scores', Icon: BarChart3 },
            { label: 'SLA Violations', Icon: Timer },
            { label: 'Agent Passports', Icon: Bot },
          ].map(({ label, Icon }) => (
            <div key={label} className="bg-slate-900/60 rounded-lg px-3 py-2.5 flex items-center space-x-2">
              <Icon className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs text-slate-400">{label}</span>
            </div>
          ))}
        </div>

        {/* Format selection */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Export Format</p>
          <div className="grid grid-cols-2 gap-3">
            {formats.map(f => {
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={`p-4 rounded-xl border text-left transition ${
                    format === f.id
                      ? 'border-slate-500/50 bg-slate-500/10'
                      : 'border-slate-700 bg-slate-900/40 hover:border-slate-600'
                  }`}
                >
                  <div className={`flex items-center space-x-2 mb-1.5 ${f.color}`}>
                    <Icon className="w-4 h-4" />
                    <span className="font-bold text-sm">{f.label}</span>
                  </div>
                  <p className="text-xs text-slate-500">{f.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Download button */}
        <button
          id="download-report-btn"
          onClick={handleDownload}
          disabled={generating}
          className="w-full py-3 flex items-center justify-center space-x-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-60 text-white font-bold rounded-xl transition"
        >
          {generating
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : done
            ? <CheckCircle2 className="w-4 h-4 text-slate-300" />
            : <Download className="w-4 h-4" />
          }
          <span>{generating ? 'Preparing...' : done ? 'Downloaded!' : `Download ${format.toUpperCase()} Report`}</span>
        </button>

        {done && (
          <p className="text-center text-xs text-slate-400">
            ✓ Report downloaded. Check your browser's downloads folder.
          </p>
        )}
      </div>

      {/* Compliance badges */}
      <div className="glass-panel rounded-xl p-5">
        <h3 className="text-sm font-bold text-white mb-4">Compliance Coverage</h3>
        <div className="flex flex-wrap gap-2">
          {['SOC 2 Type II', 'ISO 27001', 'GDPR Article 22', 'EU AI Act', 'NIST AI RMF', 'PCI DSS'].map(label => (
            <span key={label} className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-400 font-mono">
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
