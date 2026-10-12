import React, { useState } from 'react';
import { api } from '../api';
import { Upload, Loader2, FileCode2, ChevronDown, CheckCircle2, XCircle } from 'lucide-react';

export default function Policies() {
  const [files, setFiles] = useState([]);
  const [meta, setMeta] = useState(null);
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState(null);
  const [openFile, setOpenFile] = useState(null);

  // Session-local view: starts empty on every page load.
  // We only fetch after an upload, so the list always shows
  // the zip that was just uploaded — never a past one.
  const refresh = async () => {
    const res = await api.getPolicyBundle();
    setFiles(res.files || []);
    setMeta(res.meta || null);
  };

  const showMsg = (ok, text) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 6000);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setWorking(true);
    try {
      const res = await api.uploadPolicyBundle(file);
      showMsg(true, res.message || `Now enforcing: ${(res.uploaded || []).join(', ')}`);
      await refresh();
      setOpenFile(null);
    } catch (err) {
      showMsg(false, err.message || 'Upload failed');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-stone-900">Policies</h2>
          <p className="text-stone-500 text-[13px] mt-0.5">
            {files.length > 0
              ? `${files.length} active policy file${files.length > 1 ? 's' : ''}${meta?.uploaded_by ? ` · uploaded by ${meta.uploaded_by}` : ''}`
              : 'No policies uploaded yet'}
          </p>
        </div>
        <label className={`inline-flex items-center space-x-2 px-4 py-2 rounded-md text-[13px] font-medium cursor-pointer transition border ${
          working ? 'opacity-50 pointer-events-none' : ''
        } bg-stone-900 text-white border-stone-900 hover:bg-stone-800`}>
          {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          <span>{working ? 'Uploading…' : 'Upload .zip'}</span>
          <input type="file" accept=".zip" className="hidden" onChange={handleUpload} disabled={working} />
        </label>
      </div>

      {msg && (
        <div className={`flex items-center space-x-2 text-[12px] px-3 py-2 rounded-md border ${
          msg.ok ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-red-800 bg-red-50 border-red-200'
        }`}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {files.length === 0 ? (
        <div className="bg-white border border-[#E6E0D3] rounded-lg p-8 text-center">
          <FileCode2 className="w-7 h-7 text-stone-300 mx-auto" />
          <p className="text-[13px] text-stone-700 mt-2 font-medium">No policy bundle uploaded</p>
          <p className="text-[12px] text-stone-500 mt-1">Upload a .zip containing .rego files to get started.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {files.map((f) => {
            const isOpen = openFile === f.name;
            return (
              <div key={f.name} className="bg-white border border-[#E6E0D3] rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenFile(isOpen ? null : f.name)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-stone-50 transition"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <FileCode2 className="w-4 h-4 text-stone-500 shrink-0" />
                    <span className="text-[13px] font-medium text-stone-900 font-mono truncate">{f.name}</span>
                    <span className="text-[11px] text-stone-400 shrink-0">
                      {(f.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-stone-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <pre className="text-[11px] font-mono text-stone-800 bg-stone-50 border-t border-stone-200 p-4 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre">
                    {f.content}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
