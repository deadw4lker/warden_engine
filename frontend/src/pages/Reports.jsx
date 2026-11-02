import React, { useState } from 'react';
import { api } from '../api';
import {
  FileSpreadsheet, Download, FileText, Table2,
  Loader2, CheckCircle2, Link2, Scale, BarChart3, Timer, UsersRound
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
    { id: 'csv', label: 'Spreadsheet (CSV)', icon: Table2, desc: 'Open with Excel or another spreadsheet app', color: 'text-stone-600' },
    { id: 'json', label: 'Developer file (JSON)', icon: FileText, desc: 'Includes detailed information for technical tools', color: 'text-stone-600' },
  ];

  return (
    <div className="w-full min-h-full p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-stone-900">Activity reports</h2>
        <p className="text-stone-500 text-sm mt-0.5">Download a record of agent activity and review decisions.</p>
      </div>

      {/* Report info */}
      <div className="glass-panel rounded-md p-6 space-y-4">
        <h3 className="font-bold text-stone-900 flex items-center space-x-2">
          <FileSpreadsheet className="w-5 h-5 text-stone-600" />
          <span>Complete activity report</span>
        </h3>
        <p className="text-sm text-stone-600 leading-relaxed">
          Download a record of actions, company rule checks, requests for review, and changes to agent access.
          You can share it with your team or use it during an internal review.
        </p>

        <div className="grid grid-cols-3 gap-3 py-2">
          {[
            { label: 'Activity history', Icon: Link2 },
            { label: 'Company rule checks', Icon: Scale },
            { label: 'Review decisions', Icon: CheckCircle2 },
            { label: 'Possible impact', Icon: BarChart3 },
            { label: 'Overdue reviews', Icon: Timer },
            { label: 'Agent changes', Icon: UsersRound },
          ].map(({ label, Icon }) => (
            <div key={label} className="bg-stone-50 rounded-md px-3 py-2.5 flex items-center space-x-2">
              <Icon className="w-4 h-4 text-stone-600 shrink-0" />
              <span className="text-xs text-stone-600">{label}</span>
            </div>
          ))}
        </div>

        {/* Format selection */}
        <div>
          <p className="text-xs font-semibold text-stone-600 uppercase tracking-wider mb-3">Choose a file type</p>
          <div className="grid grid-cols-2 gap-3">
            {formats.map(f => {
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={`p-4 rounded-md border text-left transition ${
                    format === f.id
                      ? 'border-stone-500/50 bg-stone-100'
                      : 'border-stone-300 bg-white hover:border-stone-300'
                  }`}
                >
                  <div className={`flex items-center space-x-2 mb-1.5 ${f.color}`}>
                    <Icon className="w-4 h-4" />
                    <span className="font-bold text-sm">{f.label}</span>
                  </div>
                  <p className="text-xs text-stone-500">{f.desc}</p>
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
          className="w-full py-3 flex items-center justify-center space-x-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white font-bold rounded-lg transition"
        >
          {generating
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : done
            ? <CheckCircle2 className="w-4 h-4 text-stone-700" />
            : <Download className="w-4 h-4" />
          }
          <span>{generating ? 'Preparing...' : done ? 'Downloaded!' : `Download ${format.toUpperCase()} Report`}</span>
        </button>

        {done && (
          <p className="text-center text-xs text-stone-600">
            ✓ Report downloaded. Check your browser's downloads folder.
          </p>
        )}
      </div>

      <div className="glass-panel rounded-md p-5">
        <h3 className="text-sm font-bold text-stone-900 mb-2">Helpful for reviews</h3>
        <p className="text-xs text-stone-500 mb-4">These standards may come up in security and privacy reviews. This report supports your review; it does not certify compliance.</p>
        <div className="flex flex-wrap gap-2">
          {['SOC 2 Type II', 'ISO 27001', 'GDPR Article 22', 'EU AI Act', 'NIST AI RMF', 'PCI DSS'].map(label => (
            <span key={label} className="px-3 py-1.5 rounded-md bg-white border border-stone-300 text-xs text-stone-600 font-mono">
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
