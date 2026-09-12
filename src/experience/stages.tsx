"use client";

import type { ReactNode } from "react";
import type { PreparedImage } from "../seed/image";
import type { WorldStatus } from "../world/world";
import type { StagingStep } from "./state";

export function Wordmark() {
  return (
    <header className="wordmark-block">
      <h1 className="wordmark">ANYTHING//PLAY</h1>
      <p className="tagline">Give it an image. Get a world with rules.</p>
    </header>
  );
}

export function SeedWell({ seed }: { seed: PreparedImage | null }) {
  return (
    <div className="seed-well">
      {seed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={seed.previewUrl} alt="Seed image: monochrome ink islands" />
      ) : (
        <p className="muted">Reading the seed…</p>
      )}
    </div>
  );
}

export function StatusPill({ status }: { status: WorldStatus }) {
  const text = status.error
    ? `World error: ${status.error}`
    : status.connection === "connecting"
      ? "Connecting"
      : status.connection === "waiting"
        ? "Waiting for a GPU"
        : status.connection === "ready"
          ? "World ready"
          : "Disconnected";
  return (
    <p className={`pill ${status.error ? "pill-error" : ""}`} role="status">
      {text}
    </p>
  );
}

export function StagingSteps({ steps, warmingLabel }: { steps: readonly StagingStep[]; warmingLabel: string }) {
  const labels: Record<StagingStep["name"], string> = {
    reading: "Reading the seed",
    warming: warmingLabel,
  };
  return (
    <ol className="staging-steps">
      {steps.map((step) => (
        <li key={step.name} className={`step step-${step.status}`}>
          <span className="step-mark" aria-hidden="true">
            {step.status === "passed" ? "✓" : step.status === "active" ? "…" : step.status === "failed" ? "!" : "·"}
          </span>
          {labels[step.name]}
        </li>
      ))}
    </ol>
  );
}

export function PressButton({
  name,
  control,
  onHold,
  children,
}: {
  name: string;
  control: string;
  onHold: (control: string, held: boolean) => void;
  children: ReactNode;
}) {
  const release = () => onHold(control, false);
  return (
    <button
      type="button"
      aria-label={name}
      className="press"
      onPointerDown={(event) => {
        event.preventDefault();
        onHold(control, true);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </button>
  );
}

export function formatRemaining(remainingSeconds: number): string {
  const clamped = Math.max(0, remainingSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
}
