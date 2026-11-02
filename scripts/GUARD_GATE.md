# Phase 0 Guard Gate — decision record

- Date: 2026-11-02
- Model: `Qwen/Qwen3Guard-Gen-0.6B` (GGUF Q8_0, llama.cpp llama-server, CPU, 16 threads)
- Reproduce: `scripts/guard_benchmark.py --endpoint http://127.0.0.1:8322 --json gate.json`
- Raw results: `/tmp/opencode/guardbench/gate.json` (full per-case transcripts)

## Metrics (40 cases: jailbreak/illegal/violent/PII/safe/controversial)

| Metric | Value | Threshold | Verdict |
|---|---|---|---|
| unsafe_recall | 0.812 | >= 0.70 | PASS |
| safe_false_positive_rate | 0.000 | <= 0.40 | PASS |
| jailbreak_caught_rate (Unsafe OR Controversial) | 1.000 | observed | PASS |
| jailbreak strict (Unsafe + Jailbreak label) | 0.200 | informational | 0.6B prefers `Controversial` for override attempts |
| latency p95 | 1.24 s | <= 3.0 s | PASS |

## Decision: PROCEED with Qwen3Guard-Gen-0.6B

Rationale: the strict label metric is not the operationally meaningful one —
`Controversial` routing to PENDING_APPROVAL (human review) is an approved L4
mapping, so effective catch rate for instruction-override attacks is 100%
(3/5 hard-blocked with kill-switch strike, 2/5 escalated to human review,
0/5 sailed through as Safe). PyTorch CPU serving was rejected (p95 ~3.9 s);
llama.cpp Q8_0 was adopted (p95 ~1.24 s).

## Implications for L0/L4 design

1. `Unsafe` -> hard block; `Jailbreak` category -> strike counter escalation
   (kill switch on threshold, not first offense).
2. `Controversial` -> must be surfaced to OPA as a first-class input signal so
   Rego can route it to PENDING_APPROVAL deterministically.
3. Response-side moderation uses the same two-role message shape as
   `RESPONSE_CASES` (user task + assistant reply).
