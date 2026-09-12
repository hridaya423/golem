"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PreparedImage } from "../seed/image";
import type { WorldStatus } from "../world/world";
import type { StagingStep } from "./state";
import { REACTOR_MAX_RETRIES } from "../world/reactor-contract";

export function Wordmark() {
  return (
    <header className="wordmark-block">
      <h1 className="wordmark">GOLEM</h1>
      <p className="tagline">Give it an image. Get a world with rules.</p>
    </header>
  );
}

export function SeedWell({ seed }: { seed: PreparedImage | null }) {
  return (
    <div className="seed-well">
      {seed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={seed.previewUrl} alt={`Seed image: ${seed.originalName}`} />
      ) : (
        <div className="seed-empty">
          <strong>Your world starts here</strong>
          <p className="muted">Bring a photo, a sketch, or a view from your camera.</p>
        </div>
      )}
    </div>
  );
}

export function StatusPill({ status, onRetry }: { status: WorldStatus; onRetry: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status.retryAt === undefined) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [status.retryAt]);
  const retrying = status.retryAt !== undefined;
  const ready = status.connection === "ready";
  const text = status.error
    ? retrying ? "Reconnecting to the live world" : "Live world unavailable"
    : status.connection === "connecting"
      ? "Requesting a live session"
      : status.connection === "waiting"
        ? "Connecting the live stream"
        : ready
          ? status.generating && status.firstFrameAt !== undefined ? "Live stream ready" : "Live connection ready"
          : "World disconnected";
  const detail = status.error
    ? `${status.error}${retrying ? " Keep this tab open; retry is automatic." : ""}`
    : status.connection === "connecting"
      ? "Reactor is connecting while you prepare your game."
      : status.connection === "waiting"
        ? "Session created. Establishing the media connection. No need to refresh."
        : ready
          ? status.generating ? "This session stays connected for your rule change and replay." : "Your session is connected. Generation begins once the image and rules are ready."
          : "Reconnect to continue with live generation.";
  return (
    <div className="connection-status" data-state={retrying ? "retry" : status.error ? "error" : ready ? "ready" : status.connection === "disconnected" ? "idle" : "busy"} role="status">
      <div className="connection-heading">
        <strong>{text}</strong>
        {status.retryAt !== undefined && (
          <span className="connection-countdown" aria-live="off">
            Retry in {Math.max(0, Math.ceil((status.retryAt - now) / 1000))}s · {status.retryAttempt}/{REACTOR_MAX_RETRIES}
          </span>
        )}
      </div>
      <p className="connection-detail">{detail}</p>
      {status.connection === "disconnected" && !retrying && (
        <button type="button" className="secondary" onClick={onRetry}>Retry connection</button>
      )}
    </div>
  );
}

export function StagingSteps({ steps, warmingLabel }: { steps: readonly StagingStep[]; warmingLabel: string }) {
  const labels: Record<StagingStep["name"], string> = {
    reading: "Reading the seed",
    rules: "Compiling the rules",
    testing: "Testing the course",
    warming: warmingLabel,
  };
  return (
    <ol className="staging-steps">
      {steps.map((step) => (
        <li key={step.name} className={`step step-${step.status}`}>
          <span className="step-mark" aria-hidden="true">
            {step.status === "passed"
              ? "✓"
              : step.status === "active"
                ? "…"
                : step.status === "failed"
                  ? "!"
                  : step.status === "fallback"
                    ? "◦"
                    : "·"}
          </span>
          <span className="step-copy">
            <span>{labels[step.name]}</span>
            {step.detail && <small className="muted">{step.detail}</small>}
          </span>
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
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) onHold(control, true);
      }}
      onKeyUp={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        release();
      }}
      onBlur={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </button>
  );
}

export function CameraCapture({
  onCapture,
  onCancel,
}: {
  onCapture: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(() =>
    typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia
      ? "Camera is not available in this browser. You can still upload an image."
      : null,
  );
  const [ready, setReady] = useState(false);

  const stop = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    let cancelled = false;
    const media = navigator.mediaDevices;
    if (!media?.getUserMedia) return;
    media
      .getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error && err.name === "NotAllowedError"
            ? "Camera access was declined. You can still upload an image."
            : "Camera is unavailable. You can still upload an image.",
        );
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      stop();
      onCapture(blob);
    }, "image/png");
  };

  return (
    <div className="camera-capture">
      <div className="seed-well">
        {error ? (
          <p className="error-text camera-error">{error}</p>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted onLoadedData={() => setReady(true)} />
        )}
      </div>
      {!error && (
        <p className="muted">
          Point the camera at anything — a sketch, a poster, a view. That becomes the world.
        </p>
      )}
      <div className="action-row">
        {!error && (
          <button type="button" className="primary" onClick={capture} disabled={!ready}>
            Capture frame
          </button>
        )}
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function formatRemaining(remainingSeconds: number): string {
  const clamped = Math.max(0, remainingSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
}
