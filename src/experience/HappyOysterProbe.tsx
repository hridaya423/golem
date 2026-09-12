"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { AdventureCommand, HappyOysterBase, TravelSession } from "@reactor-models/happy-oyster";
import { classifyReactorConnectionError } from "../world/reactor-contract";
import { composeWorldPrompt, FIXTURE_WORLD } from "../world/prompts";

const TokenSchema = z.object({ jwt: z.string().min(1) });
const NEUTRAL: AdventureCommand = { translation: "None", rotation: "None", interaction: "None" };

type ProbeReport = {
  status: string;
  marks: Record<string, number>;
  worldPhase: string | null;
  worldId: string | null;
  sessionId: string | null;
  connectionStates: string[];
  firstFrame: boolean;
  videoSize: number[];
  error: string | null;
  disconnected: boolean;
};

export function HappyOysterProbe() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const modelRef = useRef<HappyOysterBase<"adventure"> | null>(null);
  const travelRef = useRef<TravelSession | null>(null);
  const heldRef = useRef<AdventureCommand>(NEUTRAL);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const startedRef = useRef(false);
  const reportRef = useRef<ProbeReport>({ status: "idle", marks: {}, worldPhase: null, worldId: null, sessionId: null, connectionStates: [], firstFrame: false, videoSize: [], error: null, disconnected: false });
  const [report, setReport] = useState(reportRef.current);

  const stop = async () => {
    cancelledRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    heldRef.current = NEUTRAL;
    const travel = travelRef.current;
    travelRef.current = null;
    if (travel) {
      await travel.travel.sendCommand(NEUTRAL).catch(() => {});
      await travel.travel.end().catch(() => {});
    }
    const model = modelRef.current;
    if (model) {
      const travelId = model.travelState?.encrypted_travel_id;
      if (travelId) await model.endTravel({ encryptedTravelId: travelId }).catch(() => {});
      await model.disconnect();
      modelRef.current = null;
    }
  };

  useEffect(() => () => { void stop().catch(() => {}); }, []);

  const run = async () => {
    if (startedRef.current || !videoRef.current) return;
    startedRef.current = true;
    cancelledRef.current = false;
    const started = performance.now();
    const publish = () => setReport({ ...reportRef.current, marks: { ...reportRef.current.marks } });
    const mark = (status: string) => {
      reportRef.current.status = status;
      reportRef.current.marks[status] = Math.round(performance.now() - started);
      publish();
    };
    const active = () => { if (cancelledRef.current) throw new Error("Probe cancelled"); };
    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let frameCallback: number | undefined;
    try {
      await Promise.race([
        (async () => {
          mark("loading");
          const { HappyOysterBase, startTravel } = await import("@reactor-models/happy-oyster");
          const imageResponse = await fetch("/fixtures/glide-ink-islands.webp");
          if (!imageResponse.ok) throw new Error("Fixture image unavailable");
          const image = await imageResponse.blob();
          active();
          mark("authenticating");
          const response = await fetch("/api/reactor/token?model=reactor%2Fhappy-oyster-adventure", { method: "POST", cache: "no-store" });
          if (!response.ok) throw new Error(`Token request failed (${response.status})`);
          const { jwt } = TokenSchema.parse(await response.json());
          active();
          const model = new HappyOysterBase({ mode: "adventure", readyTimeoutMs: 45_000, logLevel: "off" });
          modelRef.current = model;
          model.on("statusChanged", (status) => {
            reportRef.current.connectionStates.push(status);
            reportRef.current.sessionId = model.getSessionId() ?? reportRef.current.sessionId;
            publish();
          });
          model.onWorldState((state) => {
            reportRef.current.worldPhase = state.phase;
            reportRef.current.worldId = state.encrypted_world_id;
            publish();
          });
          mark("connecting");
          await model.connect(jwt);
          active();
          reportRef.current.sessionId = model.getSessionId() ?? null;
          mark("building");
          await model.createWorldAndWait({ firstFrameImage: image, perspective: "first_person", prompt: composeWorldPrompt(FIXTURE_WORLD.basePrompt, FIXTURE_WORLD.landmarks) });
          active();
          mark("world-ready");
          const credentials = await model.requestCredentials();
          if (credentials.mock) throw new Error("Happy Oyster returned a mock world, not a live stream");
          active();
          mark("starting-stream");
          const video = videoRef.current!;
          const firstFrame = new Promise<void>((resolve) => {
            frameCallback = video.requestVideoFrameCallback(() => {
              reportRef.current.firstFrame = true;
              reportRef.current.videoSize = [video.videoWidth, video.videoHeight];
              resolve();
            });
          });
          travelRef.current = await startTravel({ credentials, videoElement: video, logLevel: "none", streamReadyTimeout: 45_000, maxExperienceTimeSec: 60 });
          active();
          await firstFrame;
          active();
          mark("first-frame");
          await sleep(1500);
          for (const [status, rotation] of [["forward", "None"], ["turn-right", "Mouse_Right"], ["turn-left", "Mouse_Left"]] as const) {
            active();
            heldRef.current = { translation: "Front", rotation, interaction: "None" };
            await travelRef.current!.travel.sendCommand(heldRef.current);
            if (!timerRef.current) timerRef.current = setInterval(() => { void travelRef.current?.travel.sendCommand(heldRef.current).catch(() => {}); }, 300);
            mark(status);
            await sleep(3500);
          }
          active();
          mark("passed");
        })(),
        new Promise<never>((_, reject) => { deadline = setTimeout(() => { cancelledRef.current = true; reject(new Error("Probe exceeded its 180-second limit")); }, 180_000); }),
      ]);
    } catch (error) {
      const failure = classifyReactorConnectionError(error);
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      const message = reportRef.current.status === "building" ? "Happy Oyster world creation failed" : failure.message;
      reportRef.current.error = `${message}${/^[A-Z0-9_-]{1,64}$/i.test(code) ? ` (${code})` : ""}`;
      mark("failed");
    } finally {
      clearTimeout(deadline);
      if (frameCallback !== undefined) videoRef.current?.cancelVideoFrameCallback(frameCallback);
      try {
        await stop();
        reportRef.current.disconnected = true;
      } catch {
        reportRef.current.error ??= "Probe finished but disconnect did not confirm";
      }
      publish();
    }
  };

  return (
    <main className="stage">
      <h1>Happy Oyster live probe</h1>
      <p>One Reactor session, one world build, one travel. No automatic connection or travel retries.</p>
      <video ref={videoRef} autoPlay muted playsInline style={{ width: "min(960px, 100%)", aspectRatio: "16 / 9", background: "#000" }} />
      <button type="button" className="primary" disabled={report.status !== "idle"} onClick={() => void run()}>Run one paid probe</button>
      <pre id="happy-probe-report" style={{ whiteSpace: "pre-wrap", textAlign: "left", maxWidth: "100%", overflowWrap: "anywhere" }}>{JSON.stringify(report, null, 2)}</pre>
    </main>
  );
}
