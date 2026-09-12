"use client";

import {
  LingbotWorld2Provider,
  useLingbotWorld2,
  useLingbotWorld2Message,
  useLingbotWorld2Track,
} from "@reactor-models/lingbot-world-2/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  createStatusStore,
  IDLE_CONTROLS,
  waitForStatus,
  type StageInput,
  type WorldControls,
  type WorldDriver,
  type WorldStatus,
} from "./world";
import {
  classifyReactorConnectionError,
  reactorRetryDelayMs,
  EMPTY_CAMERA_POSE,
  RELEASE_CONTROLS,
} from "./reactor-contract";

let cachedToken: { jwt: string; expiresAtMs: number } | null = null;
let inflightToken: Promise<string> | null = null;

async function fetchToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAtMs - Date.now() > 60_000) {
    return cachedToken.jwt;
  }
  if (!inflightToken) {
    inflightToken = (async () => {
      const response = await fetch("/api/reactor/token", { method: "POST", cache: "no-store" });
      const body: { jwt?: string; expires_at?: string | number; error?: string } = await response
        .json()
        .catch(() => ({}));
      if (!response.ok || typeof body.jwt !== "string") {
        throw new Error(body.error ?? `Token request failed (${response.status})`);
      }
      // Reactor returns expires_at as a Unix epoch in seconds.
      const expiresAtMs =
        typeof body.expires_at === "number" ? body.expires_at * 1000 : Date.parse(String(body.expires_at));
      cachedToken = { jwt: body.jwt, expiresAtMs };
      return body.jwt;
    })().finally(() => {
      inflightToken = null;
    });
  }
  return inflightToken;
}

const CONNECTION_OPTIONS = { autoConnect: false };

export function LiveWorldProvider({ children }: { children: ReactNode }) {
  return (
    <LingbotWorld2Provider jwtToken={fetchToken} connectOptions={CONNECTION_OPTIONS}>
      {children}
    </LingbotWorld2Provider>
  );
}

const INITIAL_STATUS: WorldStatus = {
  kind: "live",
  connection: "disconnected",
  hasImage: false,
  hasPrompt: false,
  generating: false,
  chunk: 0,
};

type Hook = ReturnType<typeof useLingbotWorld2>;

export function LingbotWorld({ onDriver }: { onDriver: (driver: WorldDriver) => void }) {
  const world = useLingbotWorld2();
  const track = useLingbotWorld2Track("main_video");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const worldRef = useRef<Hook>(world);
  const onDriverRef = useRef(onDriver);
  useEffect(() => {
    worldRef.current = world;
    onDriverRef.current = onDriver;
  });
  const [store] = useState(() => createStatusStore(INITIAL_STATUS));
  const lastSentRef = useRef<WorldControls>(IDLE_CONTROLS);
  const firstFrameSeenRef = useRef(false);
  const stagedRef = useRef(false);

  useLingbotWorld2Message(
    useCallback(
      (message) => {
        switch (message.type) {
          case "state":
            store.set({
              hasImage: message.has_image,
              hasPrompt: message.has_prompt,
              generating: message.running && message.started,
              chunk: message.current_chunk,
            });
            break;
          case "image_accepted":
            store.set({ hasImage: true });
            break;
          case "prompt_accepted":
            store.set({ hasPrompt: true });
            break;
          case "conditions_ready":
            store.set({ hasImage: message.has_image, hasPrompt: message.has_prompt });
            break;
          case "chunk_complete":
            store.set({
              chunk: message.chunk_index + 1,
              lastChunkAt: performance.now(),
              framesPerChunk: message.frames_emitted,
              lastChunkAction: message.active_action,
            });
            break;
          case "command_error":
            store.set({ error: `${message.command}: ${message.reason}` });
            break;
          case "generation_started":
            store.set({ generating: true });
            break;
          case "generation_reset":
            store.set({ generating: false });
            break;
        }
      },
      [store],
    ),
  );

  useEffect(() => {
    store.set({
      connection: world.status,
      sessionId: world.sessionId,
      // lastError persists in the SDK store; only a disconnected world should still show it.
      ...(world.status === "ready" ? { error: undefined, retryAt: undefined, retryAttempt: undefined } : {}),
    });
  }, [store, world.status, world.sessionId]);

  // The shared LingBot pool refuses sessions with 429 "no available capacity" while full; the
  // SDK's own retries give up within seconds, so keep asking at a slow cadence until a GPU frees up.
  const connectionRef = useRef<{
    reconnect: () => Promise<void>;
    disconnect: () => Promise<void>;
  } | null>(null);
  useEffect(() => {
    const connect = world.connect;
    const disconnect = world.disconnect;
    let disposed = false;
    let stopped = false;
    let retries = 0;
    let retryAt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let connecting: Promise<void> | null = null;
    let disconnecting: Promise<void> | null = null;

    const clearTimer = () => {
      clearTimeout(timer);
      timer = undefined;
    };
    const schedule = (delay: number) => {
      clearTimer();
      timer = setTimeout(() => {
        timer = undefined;
        void attempt();
      }, Math.min(delay, 2_147_483_647));
    };
    const attempt = (): Promise<void> => {
      if (disposed || stopped || disconnecting) return Promise.resolve();
      if (connecting) return connecting;
      if (worldRef.current.status !== "disconnected") return Promise.resolve();
      if (Date.now() < retryAt) {
        store.set({ retryAt, retryAttempt: retries });
        schedule(retryAt - Date.now());
        return Promise.resolve();
      }
      clearTimer();
      store.set({ error: undefined, retryAt: undefined, retryAttempt: undefined });
      connecting = connect(fetchToken)
        .then(() => {
          if (disposed || stopped) return;
          retries = 0;
          retryAt = 0;
          store.set({ error: undefined, retryAt: undefined, retryAttempt: undefined });
        })
        .catch((error: unknown) => {
          if (disposed || stopped) return;
          const failure = classifyReactorConnectionError(error);
          const delay = reactorRetryDelayMs(failure, ++retries);
          retryAt = Date.now() + (delay ?? 0);
          store.set({
            error: failure.message,
            retryAt: delay === null ? undefined : retryAt,
            retryAttempt: delay === null ? undefined : retries,
          });
          if (delay !== null) schedule(delay);
        })
        .finally(() => {
          connecting = null;
        });
      return connecting;
    };
    const connection = {
      reconnect() {
        if (disposed || connecting || disconnecting || timer !== undefined) return connecting ?? disconnecting ?? Promise.resolve();
        stopped = false;
        if (Date.now() >= retryAt) retries = 0;
        return attempt();
      },
      disconnect() {
        stopped = true;
        clearTimer();
        store.set({ error: undefined, retryAt: undefined, retryAttempt: undefined });
        if (!disconnecting) {
          disconnecting = disconnect()
            .catch((error: unknown) => {
              if (!disposed) store.set({ error: classifyReactorConnectionError(error).message });
            })
            .finally(() => {
              disconnecting = null;
            });
        }
        return disconnecting;
      },
    };
    connectionRef.current = connection;
    schedule(0);
    return () => {
      disposed = true;
      stopped = true;
      clearTimer();
      if (connectionRef.current === connection) connectionRef.current = null;
    };
  }, [store, world.connect, world.disconnect]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !track) return;
    video.srcObject = new MediaStream([track]);
    void video.play().catch(() => {});
    const markFrame = () => {
      if (!firstFrameSeenRef.current) {
        firstFrameSeenRef.current = true;
        store.set({ firstFrameAt: performance.now() });
      }
    };
    let handled = false;
    if (typeof video.requestVideoFrameCallback === "function") {
      video.requestVideoFrameCallback(() => {
        handled = true;
        markFrame();
      });
    }
    const onLoaded = () => {
      if (!handled) markFrame();
    };
    video.addEventListener("loadeddata", onLoaded);
    return () => {
      video.removeEventListener("loadeddata", onLoaded);
      video.srcObject = null;
    };
  }, [store, track]);

  const [driver] = useState<WorldDriver>(() => {
    const reportError = (promise: Promise<unknown>) => {
      void promise.catch((error: unknown) => {
        store.set({ error: error instanceof Error ? error.message : String(error) });
      });
    };
    return {
      kind: "live",
      getStatus: () => store.get(),
      subscribe: (listener) => store.subscribe(listener),
      async stage(input: StageInput) {
        const w = () => worldRef.current;
        await waitForStatus(
          store,
          (s) => s.connection === "ready" || (s.connection === "disconnected" && Boolean(s.error) && s.retryAt === undefined),
          180_000,
          "World connection timed out. Retry the connection.",
        );
        if (store.get().connection !== "ready") throw new Error(store.get().error ?? "World is disconnected");
        if (store.get().generating || stagedRef.current) {
          reportError(w().reset());
          await waitForStatus(store, (s) => !s.generating, 30_000, "World reset did not complete");
          stagedRef.current = false;
          firstFrameSeenRef.current = false;
        }
        const ref = await w().uploadFile(input.image.normalized, { name: `${input.image.id}.webp` });
        await w().setImage({ image: ref });
        await w().setSeed({ seed: input.seed });
        await w().setPrompt({ prompt: input.prompt });
        await waitForStatus(
          store,
          (s) => s.hasImage && s.hasPrompt,
          30_000,
          "World did not accept image and prompt",
        );
        stagedRef.current = true;
        reportError(w().start());
        await waitForStatus(store, (s) => s.generating, 30_000, "Generation did not start");
        await waitForStatus(store, (s) => s.firstFrameAt !== undefined, 60_000, "No video frame received");
      },
      setControls(next: WorldControls) {
        const w = worldRef.current;
        const prev = lastSentRef.current;
        if (next.longitudinal !== prev.longitudinal) {
          reportError(w.setMoveLongitudinal({ move_longitudinal: next.longitudinal }));
        }
        if (next.lateral !== prev.lateral) {
          reportError(w.setMoveLateral({ move_lateral: next.lateral }));
        }
        if (next.lookHorizontal !== prev.lookHorizontal) {
          reportError(w.setLookHorizontal({ look_horizontal: next.lookHorizontal }));
        }
        if (next.lookVertical !== prev.lookVertical) {
          reportError(w.setLookVertical({ look_vertical: next.lookVertical }));
        }
        lastSentRef.current = next;
        store.set({ lastCommandAt: performance.now() });
      },
      setTurnRate(deg: number) {
        reportError(
          worldRef.current.setRotationSpeedDeg({
            rotation_speed_deg: Math.min(30, Math.max(0, deg)),
          }),
        );
        store.set({ lastCommandAt: performance.now() });
      },
      stopControls() {
        const w = worldRef.current;
        const prev = lastSentRef.current;
        if (prev.longitudinal !== "idle") reportError(w.setMoveLongitudinal({ move_longitudinal: "idle" }));
        if (prev.lateral !== "idle") reportError(w.setMoveLateral({ move_lateral: "idle" }));
        if (prev.lookHorizontal !== "idle") reportError(w.setLookHorizontal({ look_horizontal: "idle" }));
        if (prev.lookVertical !== "idle") reportError(w.setLookVertical({ look_vertical: "idle" }));
        lastSentRef.current = RELEASE_CONTROLS;
        reportError(w.setCameraPose({ camera_pose: EMPTY_CAMERA_POSE }));
        store.set({ lastCommandAt: performance.now() });
      },
      reconnect() {
        return connectionRef.current?.reconnect() ?? Promise.resolve();
      },
      disconnect() {
        return connectionRef.current?.disconnect() ?? Promise.resolve();
      },
      async reset() {
        reportError(worldRef.current.reset());
        lastSentRef.current = IDLE_CONTROLS;
        stagedRef.current = false;
        firstFrameSeenRef.current = false;
        store.set({
          hasImage: false,
          hasPrompt: false,
          generating: false,
          chunk: 0,
          firstFrameAt: undefined,
          error: undefined,
        });
      },
      captureFrame() {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return Promise.resolve(null);
        const offscreen = document.createElement("canvas");
        offscreen.width = 1664;
        offscreen.height = 960;
        const ctx = offscreen.getContext("2d");
        if (!ctx) return Promise.resolve(null);
        ctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
        return new Promise<Blob | null>((resolve) => {
          offscreen.toBlob((blob) => resolve(blob), "image/webp");
        });
      },
    };
  });

  useEffect(() => {
    onDriverRef.current?.(driver);
  }, [driver]);

  return <video ref={videoRef} className="world-surface" autoPlay playsInline muted />;
}
