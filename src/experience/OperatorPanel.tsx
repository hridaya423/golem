"use client";

import { FALLBACK_LEVEL_LABELS, type DebugSnapshot } from "../testing/debug";

const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);
const ms = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v)} ms`);

export function OperatorPanel({
  snapshot,
  live,
  canLoadSeed,
  cachedRules,
  onCachedRules,
  onLoadSeed,
  onProof,
  onReset,
  onDisconnect,
}: {
  snapshot: DebugSnapshot;
  live: boolean;
  canLoadSeed: boolean;
  cachedRules: boolean;
  onCachedRules: (value: boolean) => void;
  onLoadSeed: () => void;
  onProof: () => void;
  onReset: () => void;
  onDisconnect: () => void;
}) {
  const { world, metrics, spec } = snapshot;
  return (
    <details className="operator">
      <summary>Operator</summary>
      <div className="operator-body">
        <dl className="decision">
          <div><dt>LEVEL</dt><dd>{FALLBACK_LEVEL_LABELS[snapshot.fallbackLevel]}</dd></div>
          <div><dt>RULES</dt><dd>{spec ? `${spec.source} · ${spec.title} · ${spec.hash ?? "—"}` : "—"}</dd></div>
          <div><dt>WORLD</dt><dd>{world.kind} · {world.connection}{world.generating ? ` · chunk ${world.chunk}` : ""}{world.sessionId ? ` · ${world.sessionId.slice(0, 8)}` : ""}</dd></div>
          <div><dt>FRAME</dt><dd>{ms(metrics.firstFrameMs)} to first frame · cmd→chunk {ms(metrics.commandToChunkMs)}</dd></div>
          <div><dt>INPUT</dt><dd>{ms(median(metrics.inputToOverlayMs))} to overlay · compile {ms(metrics.compileMs)}</dd></div>
          {world.error && <div><dt>ERROR</dt><dd>{world.error}</dd></div>}
        </dl>
        <label className="operator-toggle">
          <input type="checkbox" checked={cachedRules} onChange={(e) => onCachedRules(e.target.checked)} />
          Use cached rules (skip compiler)
        </label>
        <div className="action-row">
          <button type="button" className="secondary" onClick={onLoadSeed} disabled={!canLoadSeed}>Load prepared seed</button>
          <button type="button" className="secondary" onClick={onProof}>Show proof (2 s)</button>
          <button type="button" className="secondary" onClick={onReset}>Reset</button>
          {live && <button type="button" className="secondary" onClick={onDisconnect}>Disconnect world</button>}
        </div>
      </div>
    </details>
  );
}

export function ProofOverlay({ snapshot }: { snapshot: DebugSnapshot }) {
  const { run, world, spec } = snapshot;
  return (
    <aside className="proof" role="status" aria-live="polite">
      <p>LEVEL {snapshot.fallbackLevel} · {FALLBACK_LEVEL_LABELS[snapshot.fallbackLevel]}</p>
      <p>SPEC {spec ? `${spec.title} · ${spec.hash ?? "—"} · ${spec.source}` : "—"}</p>
      <p>SESSION {world.kind === "fake" ? "fake world" : world.sessionId ?? "—"} · {world.generating ? `generating · chunk ${world.chunk}` : world.connection}</p>
      <p>
        RUN{" "}
        {run
          ? `${run.status} · pos ${run.position.map((v) => Math.round(v)).join(",")} · yaw ${run.yaw.toFixed(2)} · pitch ${run.pitch.toFixed(2)} · gate ${run.activeGate} · ${run.completed.join(" ") || "none"}`
          : "—"}
      </p>
      {spec && <p>ROUTE {spec.route.join(" → ")}</p>}
    </aside>
  );
}
