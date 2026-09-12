"use client";

import { useEffect, useRef } from "react";
import {
  createStatusStore,
  IDLE_CONTROLS,
  type StageInput,
  type WorldControls,
  type WorldDriver,
  type WorldStatus,
} from "./world";

const INITIAL_STATUS: WorldStatus = {
  kind: "fake",
  connection: "ready",
  hasImage: false,
  hasPrompt: false,
  generating: false,
  chunk: 0,
};

export function FakeWorld({ onDriver }: { onDriver: (driver: WorldDriver) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onDriverRef = useRef(onDriver);
  useEffect(() => {
    onDriverRef.current = onDriver;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const store = createStatusStore(INITIAL_STATUS);
    let bitmap: ImageBitmap | null = null;
    let controls: WorldControls = IDLE_CONTROLS;
    let turnDeg = 6;
    let yawDeg = 0;
    let pitchDeg = 0;
    let scroll = 0;
    let raf = 0;
    let chunkTimer: ReturnType<typeof setInterval> | null = null;
    let stageTimer: ReturnType<typeof setTimeout> | null = null;
    let last = performance.now();
    let disposed = false;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    const draw = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(draw);
      const dtMs = Math.min(now - last, 100);
      last = now;
      resize();
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { width: w, height: h } = canvas;

      const look = controls.lookHorizontal === "right" ? 1 : controls.lookHorizontal === "left" ? -1 : 0;
      const tilt = controls.lookVertical === "up" ? 1 : controls.lookVertical === "down" ? -1 : 0;
      yawDeg += look * turnDeg * ((dtMs * 16) / 1000);
      pitchDeg += tilt * turnDeg * ((dtMs * 16) / 1000);
      if (controls.longitudinal === "forward" && store.get().generating) scroll += dtMs / 1000;

      ctx.fillStyle = "#070909";
      ctx.fillRect(0, 0, w, h);

      const ox = Math.max(-w * 0.12, Math.min(w * 0.12, -yawDeg * (w / 400)));
      const oy = Math.max(-h * 0.12, Math.min(h * 0.12, pitchDeg * (h / 400)));
      if (bitmap) {
        const scale = Math.max(w / bitmap.width, h / bitmap.height) * 1.15;
        const dw = bitmap.width * scale;
        const dh = bitmap.height * scale;
        ctx.drawImage(bitmap, (w - dw) / 2 + ox, (h - dh) / 2 + oy, dw, dh);
      }

      const horizon = h * 0.55 + oy;
      ctx.strokeStyle = "rgba(151, 163, 157, 0.28)";
      ctx.lineWidth = Math.max(1, h / 720);
      for (let i = 0; i < 10; i++) {
        const depth = ((i / 10 + scroll * 0.6) % 1 + 1) % 1;
        const y = horizon + Math.pow(depth, 1.8) * (h - horizon);
        const alpha = 0.08 + depth * 0.3;
        ctx.strokeStyle = `rgba(151, 163, 157, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    };
    raf = requestAnimationFrame(draw);

    const driver: WorldDriver = {
      kind: "fake",
      getStatus: () => store.get(),
      subscribe: (listener) => store.subscribe(listener),
      stage(input: StageInput) {
        return createImageBitmap(input.image.normalized).then((bmp) => {
          bitmap = bmp;
          store.set({ connection: "connecting" });
          return new Promise<void>((resolve, reject) => {
            stageTimer = setTimeout(() => {
              if (disposed) {
                reject(new Error("Fake world disposed during staging"));
                return;
              }
              store.set({
                connection: "ready",
                hasImage: true,
                hasPrompt: true,
                generating: true,
                chunk: 0,
                firstFrameAt: performance.now(),
              });
              chunkTimer = setInterval(() => {
                const s = store.get();
                if (s.generating) {
                  store.set({ chunk: s.chunk + 1, lastChunkAt: performance.now() });
                }
              }, 500);
              resolve();
            }, 300);
          });
        });
      },
      setControls(next: WorldControls) {
        controls = next;
        store.set({ lastCommandAt: performance.now() });
      },
      setTurnRate(deg: number) {
        turnDeg = Math.min(30, Math.max(0, deg));
      },
      stopControls() {
        controls = IDLE_CONTROLS;
        store.set({ lastCommandAt: performance.now() });
      },
      reset() {
        if (chunkTimer) clearInterval(chunkTimer);
        chunkTimer = null;
        controls = IDLE_CONTROLS;
        store.set({
          hasImage: false,
          hasPrompt: false,
          generating: false,
          chunk: 0,
          firstFrameAt: undefined,
          error: undefined,
        });
        return Promise.resolve();
      },
      captureFrame() {
        return new Promise<Blob | null>((resolve) => {
          canvas.toBlob((blob) => resolve(blob), "image/webp");
        });
      },
    };

    onDriverRef.current?.(driver);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (chunkTimer) clearInterval(chunkTimer);
      if (stageTimer) clearTimeout(stageTimer);
      bitmap?.close();
    };
  }, []);

  return <canvas ref={canvasRef} className="world-surface" aria-hidden="true" />;
}
