import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ChevronRight } from 'lucide-react';
import { describeLayer, humanizeAction, humanizeIdentifier, humanizeLayer } from '../utils/userText';

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
  if (!st) return <span className="text-[10px] text-stone-400">No check details</span>;
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
          <span key={l} title={entry ? `${humanizeLayer(l)}: ${describeLayer(entry)}` : humanizeLayer(l)}
            className={`text-[9px] font-semibold px-1.5 py-px rounded border transition-opacity ${cls}`}
            style={{ opacity: seen ? 1 : 0.55 }}>
            {humanizeLayer(l).replace(' check', '')}{mark}
          </span>
        );
      })}
    </span>
  );
}

const STEP_MS = 650;
const WEB_RAY_COUNT = 8;
const WEB_CENTER = 150;
const WEB_OUTER_RADIUS = 138;
const WEB_RINGS = [34, 60, 86, 112, WEB_OUTER_RADIUS];

function webPoint(radius, angle) {
  return {
    x: WEB_CENTER + Math.cos(angle) * radius,
    y: WEB_CENTER + Math.sin(angle) * radius,
  };
}

function webRingPath(radius) {
  const angleStep = (Math.PI * 2) / WEB_RAY_COUNT;
  return Array.from({ length: WEB_RAY_COUNT }, (_, i) => {
    const startAngle = -Math.PI / 2 + i * angleStep;
    const endAngle = startAngle + angleStep;
    const start = webPoint(radius, startAngle);
    const control = webPoint(radius * 0.78, (startAngle + endAngle) / 2);
    const end = webPoint(radius, endAngle);
    return `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
  }).join(' ');
}

function webDotPosition(kind, slot) {
  const radius = { pending: 60, denied: 112, allowed: 86 }[kind] || 86;
  const angleOffset = { pending: -90, denied: -67.5, allowed: -45 }[kind] || -90;
  const angle = ((angleOffset + slot * (360 / 8)) * Math.PI) / 180;
  const point = webPoint(radius, angle);
  return { left: `${(point.x / 300) * 100}%`, top: `${(point.y / 300) * 100}%` };
}

export default function SubmarineScanner({ items = [], blocked = [], allowed = [], onOpenQueue, onOpenLedger }) {
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

  // One unified activity list: pending first, then stopped and allowed requests.
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

  const webDots = useMemo(() => ([
    ...pending.slice(0, 8).map((request, slot) => ({ ...request, _kind: 'pending', _webSlot: slot })),
    ...denied.slice(0, 8).map((request, slot) => ({ ...request, _kind: 'denied', _webSlot: slot })),
    ...allowedList.slice(0, 8).map((request, slot) => ({ ...request, _kind: 'allowed', _webSlot: slot })),
  ]), [pending, denied, allowedList]);

  // keep a fresh layer lookup for the stepper interval
  all.forEach((v) => {
    layersByIdRef.current[String(v.id)] = contactLayers(v);
  });

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
    <section className="glass-surface rounded-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-stone-200">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-stone-900 text-white">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-[13px] text-stone-900 leading-tight">Agent activity</h3>
            <p className="text-[11px] text-stone-500">See what agents request and how WARDEN responds.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] text-stone-500">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-stone-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-stone-500" />
            </span>
            Updating
          </span>
          <span className={`text-[11px] font-semibold px-2 py-1 rounded-md ${
            all.length > 0
              ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500'
          }`}>
            {all.length} requests
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-0">
        <div className="p-4 md:border-r border-b md:border-b-0 border-stone-200">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h4 className="text-sm font-semibold text-stone-900">Request map</h4>
              <p className="text-[11px] text-stone-500 mt-0.5">Select a dot to inspect a request</p>
            </div>
            <span className="shrink-0 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-stone-600">
              {webDots.length} shown
            </span>
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-[300px] overflow-hidden rounded-xl border border-[#D5E3E8] bg-gradient-to-br from-[#F8FBFC] via-white to-[#F2F7F9]">
            <svg aria-hidden="true" viewBox="0 0 300 300" className="absolute inset-0 h-full w-full">
              <g fill="none" stroke="#8DAEB8" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" opacity="0.64">
                {Array.from({ length: WEB_RAY_COUNT }).map((_, i) => {
                  const point = webPoint(WEB_OUTER_RADIUS, -Math.PI / 2 + i * ((Math.PI * 2) / WEB_RAY_COUNT));
                  return <line key={`ray-${i}`} x1={WEB_CENTER} y1={WEB_CENTER} x2={point.x} y2={point.y} />;
                })}
                {WEB_RINGS.map((radius) => <path key={`ring-${radius}`} d={webRingPath(radius)} />)}
              </g>
              <circle cx={WEB_CENTER} cy={WEB_CENTER} r="2.5" fill="#6D9BA8" opacity="0.7" />
            </svg>

            {webDots.map((request) => {
              const dotPosition = webDotPosition(request._kind, request._webSlot);
              const isSelected = String(request.id) === String(selectedId);
              const dotTone = request._kind === 'pending'
                ? 'bg-amber-400'
                : request._kind === 'denied'
                ? 'bg-red-500'
                : 'bg-emerald-500';
              const statusLabel = request._kind === 'pending'
                ? 'Needs review'
                : request._kind === 'denied' ? 'Rejected' : 'Approved';
              return (
                <button
                  key={`web-${request._kind}-${request.id ?? request._webSlot}`}
                  type="button"
                  onClick={() => handleSelect(request.id)}
                  aria-label={`${statusLabel}: ${humanizeAction(request.action || request.action_type)} by ${humanizeIdentifier(request.agent_id || 'Unknown agent')}`}
                  className="absolute z-10 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#367F92] focus-visible:ring-offset-1"
                  style={dotPosition}
                >
                  <span aria-hidden="true" className={`h-3.5 w-3.5 rounded-full border-2 border-white shadow-[0_1px_4px_rgba(22,52,65,0.35)] transition-transform ${dotTone} ${isSelected ? 'scale-125 ring-2 ring-[#367F92] ring-offset-2 ring-offset-white' : ''}`} />
                </button>
              );
            })}

            {webDots.length === 0 && (
              <div className="absolute inset-x-5 bottom-4 rounded-md bg-white/90 px-3 py-2 text-center text-[11px] text-stone-500 shadow-sm">
                No requests to show yet
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center gap-1 rounded-md border border-amber-200 bg-amber-50 py-2">
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-amber-800"><span className="h-2 w-2 rounded-full bg-amber-400" />Review</span>
              <span className="text-sm font-bold tabular-nums text-amber-800">{pending.length}</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 py-2">
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-800"><span className="h-2 w-2 rounded-full bg-emerald-500" />Approve</span>
              <span className="text-sm font-bold tabular-nums text-emerald-800">{allowedList.length}</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-md border border-red-200 bg-red-50 py-2">
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-red-800"><span className="h-2 w-2 rounded-full bg-red-500" />Reject</span>
              <span className="text-sm font-bold tabular-nums text-red-800">{denied.length}</span>
            </div>
          </div>
        </div>

        {/* contact list: every governed request */}
        <div className="min-w-0 flex flex-col">
          <div className="px-4 py-2 border-b border-stone-100 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-stone-500">
              Recent agent requests
            </span>
            <span className="text-[11px] font-mono text-stone-400">
              {pending.length} need review · {denied.length} stopped · {allowedList.length} allowed
            </span>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[320px] divide-y divide-stone-100">
            {all.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-[13px] font-medium text-stone-700">
                  No requests yet
                </p>
                <p className="text-[12px] text-stone-400 mt-1">
                  Requests waiting for review, allowed, or stopped will appear here.
                </p>
              </div>
            ) : (
              all.map((a, i) => {
                const isSel = String(a.id) === String(selectedId);
                const action = humanizeAction(a.action || a.action_type);
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
                          {a._kind === 'pending' ? 'Needs review' : a._kind === 'denied' ? 'Stopped' : 'Allowed'}
                        </span>
                        <LayerChips approval={a} revealed={st} />
                      </span>
                      <span className="block text-[11px] text-stone-500 font-mono truncate mt-0.5">
                        {humanizeIdentifier(a.agent_id || 'Unknown agent')}
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
                {`Review ${pending.length} request${pending.length > 1 ? 's' : ''} →`}
              </button>
            ) : (
              <button
                onClick={() => (onOpenLedger ? onOpenLedger() : onOpenQueue())}
                disabled={all.length === 0}
                className="w-full py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 disabled:hover:bg-stone-900 text-white font-medium rounded-md text-[13px] transition"
              >
                {all.length > 0 ? 'View all activity →' : 'No activity yet'}
              </button>
            )}
            {selected && (
              <div className="mt-2 rounded-md bg-stone-50 border border-stone-200 px-3 py-2">
                <p className="text-[11px] text-stone-500 font-mono truncate text-center">
                  Request: {humanizeAction(selected.action || selected.action_type)} · {humanizeIdentifier(selected.agent_id)}
                </p>
                {/* live check status */}
                <p className="text-center text-[11px] font-mono font-bold mt-1.5" key={`st-${replayKey[String(selected.id)] || 0}`}>
                  {!selLayers.length ? (
                    <span className="text-stone-400">No extra check details were saved for this request.</span>
                  ) : selFailed ? (
                    <span className="text-red-600">■ Stopped · {describeLayer(selFailed)}</span>
                  ) : !selDone ? (
                    <span className="text-amber-600">
                      ◉ Checking {humanizeLayer(selLayers[Math.min(selStage, selLayers.length - 1)]?.layer)}…
                    </span>
                  ) : (
                    <span className="text-emerald-600">✓ All checks passed</span>
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
                          <span className="font-semibold text-stone-700 shrink-0">{humanizeLayer(l.layer).replace(' check', '')}</span>
                          <span className="text-stone-500 truncate">
                            {revealed ? describeLayer(l) : 'Checking next…'}
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
