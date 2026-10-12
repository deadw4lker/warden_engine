import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Radar, ChevronRight } from 'lucide-react';

/** deterministic position from id so contacts sit stably on the scope */
function hashStr(s) {
  const str = String(s ?? '');
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function contactPosition(id, index) {
  const h = hashStr(id ?? index);
  const angle = ((h % 360) + index * 137.5) % 360;
  const radiusPct = 20 + ((h % 2400) / 100); // 20..44% of scope
  const rad = (angle * Math.PI) / 180;
  return {
    x: 50 + radiusPct * Math.cos(rad),
    y: 50 + radiusPct * Math.sin(rad),
  };
}

function ageLabel(a) {
  const ts = a.created_at || a.requested_at || a.timestamp || a.createdAt;
  if (!ts) return '—';
  try {
    const diff = Math.max(0, Date.now() - new Date(ts).getTime());
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch {
    return '—';
  }
}

function contactLayers(a) {
  const l = a?.evidence_pack?.layers;
  return Array.isArray(l) ? l : [];
}

/** Four-layer status per contact: worst result wins per layer. */
function layerStatus(approval) {
  const layers = contactLayers(approval);
  if (layers.length === 0) return null;
  const out = {};
  for (const e of layers) {
    if (!e || !e.layer) continue;
    if (!(e.layer in out) || e.result === 'fail') out[e.layer] = e.result;
  }
  return out; // e.g. {L1:'pass', L2:'pass', L3:'pass', L4:'pass'}
}

/** Stage cap: animate L1..Ln, stopping at the first failed layer. */
function stageCap(layers) {
  if (!layers.length) return 0;
  for (let i = 0; i < layers.length; i++) {
    const e = layers[i];
    if (e && e.result === 'fail' && e.check !== 'not evaluated') return i + 1;
  }
  return layers.length;
}

function LayerChips({ approval, revealed = 99 }) {
  const st = layerStatus(approval);
  if (!st) return <span className="text-[10px] font-mono text-stone-400">layers n/a</span>;
  const layers = contactLayers(approval);
  return (
    <span className="inline-flex items-center gap-1 ml-1.5 align-middle">
      {['L1', 'L2', 'L3', 'L4'].map((l, li) => {
        const entry = (approval.evidence_pack.layers || []).find((e) => e.layer === l);
        const unevaluated = entry && entry.check === 'not evaluated';
        const r = unevaluated ? null : st[l];
        const seen = li < revealed;
        const cls = !seen
          ? 'bg-stone-100 text-stone-300 border-stone-200'
          : r === 'pass'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : r === 'fail'
          ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-stone-100 text-stone-400 border-stone-200';
        const mark = !seen ? '·' : r === 'pass' ? '✓' : r === 'fail' ? '✗' : '·';
        return (
          <span key={l} title={entry ? `${entry.check}: ${entry.detail}` : l}
            className={`text-[9px] font-mono font-bold px-1.5 py-px rounded border transition-opacity ${cls}`}
            style={{ opacity: seen ? 1 : 0.55 }}>
            {l}{mark}
          </span>
        );
      })}
    </span>
  );
}

/** Blip look for the current clearing stage. */
function blipLook(a, stage) {
  const layers = contactLayers(a);
  if (!layers.length) {
    return { dot: 'bg-stone-300 border-white', ring: null, tag: null, done: true };
  }
  const revealed = layers.slice(0, stage);
  const failed = revealed.find((l) => l && l.result === 'fail' && l.check !== 'not evaluated');
  if (failed) {
    return { dot: 'bg-red-500 border-white', ring: 'rgba(239,68,68,0.45)', tag: `${failed.layer} ✗`, done: true };
  }
  if (stage >= layers.length) {
    return { dot: 'bg-emerald-500 border-white', ring: 'rgba(16,185,129,0.4)', tag: null, done: true };
  }
  const current = layers[stage];
  return {
    dot: 'bg-amber-400 border-white',
    ring: 'rgba(245,158,11,0.5)',
    tag: current ? current.layer : null,
    done: false,
  };
}

const STEP_MS = 650;

export default function SubmarineScanner({ items = [], blocked = [], allowed = [], onOpenQueue, onOpenLedger }) {
  const [bearing, setBearing] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  // stage per contact id: how many layers have been revealed (0..n)
  const [stages, setStages] = useState({});
  // bumped to replay the detail reveal (on arrival + on select)
  const [replayKey, setReplayKey] = useState({});
  const seenRef = useRef(new Set());
  const layersByIdRef = useRef({});

  const pending = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    return list.filter((a) => {
      const s = String(a?.status || '').toUpperCase();
      return s === 'PENDING' || s === 'PENDING_APPROVAL' || s === 'ESCALATED' || s === 'APPROVAL_REQUESTED';
    });
  }, [items]);

  const denied = useMemo(() => {
    const list = Array.isArray(blocked) ? blocked : [];
    return list.filter((a) => {
      const s = String(a?.status || '').toUpperCase();
      return s === 'BLOCKED' || s === 'DENIED';
    });
  }, [blocked]);

  const allowedList = useMemo(() => {
    const list = Array.isArray(allowed) ? allowed : [];
    return list.filter((a) => String(a?.status || '').toUpperCase() === 'ALLOWED');
  }, [allowed]);

  // One unified scope: every governed request, pending first, then newest first.
  const all = useMemo(() => {
    const tagged = [
      ...pending.map((a) => ({ ...a, _kind: 'pending' })),
      ...denied.map((a) => ({ ...a, _kind: 'denied' })),
      ...allowedList.map((a) => ({ ...a, _kind: 'allowed' })),
    ];
    const rank = { pending: 0, denied: 1, allowed: 2 };
    const ts = (a) => {
      const t = Date.parse(a.created_at || a.timestamp || 0);
      return Number.isNaN(t) ? 0 : t;
    };
    tagged.sort((x, y) => (rank[x._kind] - rank[y._kind]) || (ts(y) - ts(x)));
    return tagged;
  }, [pending, denied, allowedList]);

  const scopeContacts = useMemo(() => all.slice(0, 12), [all]);

  // keep a fresh layer lookup for the stepper interval
  all.forEach((v) => {
    layersByIdRef.current[String(v.id)] = contactLayers(v);
  });

  useEffect(() => {
    const iv = setInterval(() => setBearing((b) => (b + 4) % 360), 120);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (all.length > 0 && !all.some((v) => String(v.id) === String(selectedId))) {
      setSelectedId(all[0].id);
    }
    if (all.length === 0) setSelectedId(null);
  }, [all, selectedId]);

  // detect newly arrived contacts -> start their layer sweep at stage 0
  useEffect(() => {
    const ids = all.map((v) => String(v.id));
    const fresh = ids.filter((id) => !seenRef.current.has(id));
    // prune contacts that left the scope
    Object.keys(layersByIdRef.current).forEach((id) => {
      if (!ids.includes(id)) {
        delete layersByIdRef.current[id];
        seenRef.current.delete(id);
      }
    });
    if (fresh.length === 0) {
      // still prune settled stages of departed contacts
      setStages((s) => {
        const next = {};
        ids.forEach((id) => { if (id in s) next[id] = s[id]; });
        return next;
      });
      return;
    }
    fresh.forEach((id) => seenRef.current.add(id));
    setStages((s) => {
      const next = { ...s };
      fresh.forEach((id) => { next[id] = 0; });
      ids.forEach((id) => { if (!(id in next)) next[id] = stageCap(layersByIdRef.current[id] || []); });
      return next;
    });
    setReplayKey((r) => {
      const next = { ...r };
      fresh.forEach((id) => { next[id] = (next[id] || 0) + 1; });
      return next;
    });
  }, [all]);

  // stepper: reveal one more layer per tick until each contact caps
  useEffect(() => {
    const iv = setInterval(() => {
      setStages((prev) => {
        let dirty = false;
        const next = { ...prev };
        for (const [id, st] of Object.entries(prev)) {
          const cap = stageCap(layersByIdRef.current[id] || []);
          if (st < cap) {
            next[id] = st + 1;
            dirty = true;
          }
        }
        return dirty ? next : prev;
      });
    }, STEP_MS);
    return () => clearInterval(iv);
  }, []);

  const handleSelect = (id) => {
    const key = String(id);
    setSelectedId(id);
    // replay this contact's layer sweep
    setStages((s) => ({ ...s, [key]: 0 }));
    setReplayKey((r) => ({ ...r, [key]: (r[key] || 0) + 1 }));
  };

  const selected = all.find((v) => String(v.id) === String(selectedId)) || null;
  const selStage = selected ? (stages[String(selected.id)] ?? stageCap(contactLayers(selected))) : 0;
  const selLayers = selected ? contactLayers(selected) : [];
  const selFailed = selLayers.slice(0, selStage).find((l) => l && l.result === 'fail' && l.check !== 'not evaluated');
  const selDone = selFailed ? true : selStage >= selLayers.length;

  return (
    <section className="bg-white border border-[#E6E0D3] rounded-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-stone-200">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-stone-900 text-white">
            <Radar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-[13px] text-stone-900 leading-tight">Pending approvals radar</h3>
            <p className="text-[11px] text-stone-500">Watch each request clear L1 → L2 → L3 → L4 live</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] text-stone-500">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-stone-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-stone-500" />
            </span>
            Live
          </span>
          <span className={`text-[11px] font-semibold px-2 py-1 rounded-md ${
            all.length > 0
              ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500'
          }`}>
            {all.length} on scope
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-0">
        {/* scope */}
        <div className="p-4 md:border-r border-b md:border-b-0 border-stone-200">
          <div className="relative aspect-square rounded-full bg-stone-50 border border-stone-200 overflow-hidden mx-auto max-w-[280px]">
            {/* degree ticks */}
            {Array.from({ length: 48 }).map((_, i) => (
              <span
                key={i}
                className="absolute left-1/2 top-1/2 bg-stone-300"
                style={{
                  width: 1,
                  height: i % 12 === 0 ? 8 : 4,
                  transform: `translate(-50%, -50%) rotate(${i * 7.5}deg) translateY(-118px)`,
                }}
              />
            ))}
            {/* range rings + crosshairs */}
            {[25, 50, 75, 100].map((r) => (
              <div key={r} className="absolute rounded-full border border-stone-200" style={{ inset: `${50 - r / 2}%` }} />
            ))}
            <div className="absolute left-1/2 top-[5%] bottom-[5%] w-px bg-stone-200 -translate-x-1/2" />
            <div className="absolute top-1/2 left-[5%] right-[5%] h-px bg-stone-200 -translate-y-1/2" />

            {/* sweep */}
            <div className="sonar-sweep-light absolute inset-0 rounded-full" />
            <div
              className="absolute left-1/2 top-1/2 h-[2px] bg-stone-500/70 origin-left rounded"
              style={{ width: '45%', transform: `rotate(${bearing}deg)` }}
            />

            {/* contacts: every governed request on one scope */}
            {scopeContacts.map((a, i) => {
              const pos = contactPosition(a.id, i);
              const isSel = String(a.id) === String(selectedId);
              const id = String(a.id);
              const stage = stages[id] ?? stageCap(contactLayers(a));
              const look = blipLook(a, stage);
              return (
                <button
                  key={a.id ?? i}
                  onClick={() => handleSelect(a.id)}
                  title={`${a.action || a.action_type || 'request'} · ${a.agent_id || ''}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full focus:outline-none"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                >
                  {!look.done && look.ring && (
                    <span
                      className="sonar-ping-ring absolute -inset-1.5 rounded-full border-2"
                      style={{ borderColor: look.ring }}
                    />
                  )}
                  <span
                    className={`sonar-blip-light block rounded-full border-2 transition-colors duration-500 ${look.dot}`}
                    style={{
                      width: isSel ? 14 : 11,
                      height: isSel ? 14 : 11,
                      animationDelay: `${(i % 6) * 0.4}s`,
                      boxShadow: isSel ? '0 0 0 3px rgba(28,25,23,0.12)' : undefined,
                    }}
                  />
                  {look.tag && (
                    <span className="absolute left-3.5 -top-1 whitespace-nowrap text-[9px] font-mono font-bold px-1.5 py-px rounded border bg-white/95 border-stone-300 text-stone-700">
                      {look.tag}
                    </span>
                  )}
                </button>
              );
            })}

            {/* own-ship marker */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-2.5 h-2.5 rounded-full bg-white border-2 border-stone-400" />
            </div>

            {all.length === 0 && (
              <div className="absolute inset-x-0 bottom-6 flex justify-center">
                <span className="text-[11px] text-stone-400 bg-white border border-stone-200 rounded-full px-3 py-1">
                  Nothing on scope yet — every request sweeps in here
                </span>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-stone-500 font-mono max-w-[280px] mx-auto">
            <span>Bearing {String(Math.round(bearing)).padStart(3, '0')}°</span>
            <span>{scopeContacts.length}/{all.length} on scope</span>
          </div>
          {/* legend */}
          <div className="mt-2 flex items-center justify-center gap-3 text-[10px] font-mono text-stone-400 max-w-[280px] mx-auto">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> clearing</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> cleared</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> denied</span>
          </div>
        </div>

        {/* contact list: every governed request */}
        <div className="min-w-0 flex flex-col">
          <div className="px-4 py-2 border-b border-stone-100 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-stone-500">
              All governed requests
            </span>
            <span className="text-[11px] font-mono text-stone-400">
              {pending.length} waiting · {denied.length} denied · {allowedList.length} allowed
            </span>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[320px] divide-y divide-stone-100">
            {all.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-[13px] font-medium text-stone-700">
                  No requests yet
                </p>
                <p className="text-[12px] text-stone-400 mt-1">
                  Every approval, denial and auto-approval will sweep in here with its layers.
                </p>
              </div>
            ) : (
              all.map((a, i) => {
                const isSel = String(a.id) === String(selectedId);
                const action = a.action || a.action_type || 'Unknown action';
                const st = stages[String(a.id)] ?? stageCap(contactLayers(a));
                return (
                  <button
                    key={a.id ?? i}
                    onClick={() => handleSelect(a.id)}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition ${
                      isSel ? 'bg-stone-100' : 'hover:bg-stone-50'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-semibold shrink-0 ${
                      isSel ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500'
                    }`}>
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-stone-900 truncate">
                        {action}
                        <span className={`inline-block align-middle ml-1.5 text-[9px] font-mono font-bold px-1.5 py-px rounded border ${
                          a._kind === 'pending'
                            ? 'bg-stone-900 text-white border-stone-900'
                            : a._kind === 'denied'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {a._kind === 'pending' ? 'WAITING' : a._kind === 'denied' ? 'DENIED' : 'ALLOWED'}
                        </span>
                        <LayerChips approval={a} revealed={st} />
                      </span>
                      <span className="block text-[11px] text-stone-500 font-mono truncate mt-0.5">
                        {a.agent_id || 'unknown-agent'}
                        {a.amount > 0 ? ` · $${a.amount}` : ''} · {ageLabel(a)}
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-stone-300 shrink-0" />
                  </button>
                );
              })
            )}
          </div>
          <div className="px-4 py-3 border-t border-stone-200">
            {pending.length > 0 ? (
              <button
                onClick={onOpenQueue}
                className="w-full py-2 bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-md text-[13px] transition"
              >
                {`Review ${pending.length} pending request${pending.length > 1 ? 's' : ''} →`}
              </button>
            ) : (
              <button
                onClick={() => (onOpenLedger ? onOpenLedger() : onOpenQueue())}
                disabled={all.length === 0}
                className="w-full py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 disabled:hover:bg-stone-900 text-white font-medium rounded-md text-[13px] transition"
              >
                {all.length > 0 ? 'Inspect full trail in activity log →' : 'Nothing on scope yet'}
              </button>
            )}
            {selected && (
              <div className="mt-2 rounded-md bg-stone-50 border border-stone-200 px-3 py-2">
                <p className="text-[11px] text-stone-500 font-mono truncate text-center">
                  Selected: {selected.action || selected.action_type} — {selected.agent_id}
                </p>
                {/* live sweep status */}
                <p className="text-center text-[11px] font-mono font-bold mt-1.5" key={`st-${replayKey[String(selected.id)] || 0}`}>
                  {!selLayers.length ? (
                    <span className="text-stone-400">Layer detail not recorded for this request.</span>
                  ) : selFailed ? (
                    <span className="text-red-600">■ Held at {selFailed.layer} — {selFailed.check}</span>
                  ) : !selDone ? (
                    <span className="text-amber-600">
                      ◉ Clearing {selLayers[Math.min(selStage, selLayers.length - 1)]?.layer}
                      {' — '}{selLayers[Math.min(selStage, selLayers.length - 1)]?.check}…
                    </span>
                  ) : (
                    <span className="text-emerald-600">✓ All layers cleared</span>
                  )}
                </p>
                {selLayers.length > 0 && (
                  <ul className="mt-1.5 space-y-1 text-left" key={`ul-${replayKey[String(selected.id)] || 0}`}>
                    {selLayers.map((l, i) => {
                      const revealed = i < selStage;
                      return (
                        <li key={i}
                          className="layer-reveal flex items-start gap-1.5 text-[11px] leading-snug"
                          style={{ animationDelay: `${i * 0.65}s` }}>
                          <span className={`font-mono font-bold shrink-0 ${
                            !revealed ? 'text-stone-300'
                            : l.result === 'pass' ? 'text-emerald-600'
                            : l.result === 'fail' ? 'text-red-600' : 'text-stone-400'
                          }`}>
                            {!revealed ? '○' : l.result === 'pass' ? '✓' : l.result === 'fail' ? '✗' : '·'}
                          </span>
                          <span className="font-mono font-semibold text-stone-700 shrink-0">{l.layer}</span>
                          <span className="text-stone-500 truncate" title={l.detail}>
                            {revealed ? (l.detail || l.check) : `waiting for sweep…`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
