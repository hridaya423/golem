import { NextResponse } from "next/server";
import {
  buildPatchRequest,
  callCompiler,
  clampCodePoints,
  compilerConfig,
  COMPILER_TIMEOUTS_MS,
  TRANSCRIPT_MAX_CODE_POINTS,
} from "@/compiler/request";
import { GameSpecSchema } from "@/game/spec";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const config = compilerConfig(process.env);
  if (!config) {
    return NextResponse.json(
      { error: "Compiler is not configured on the server (.env.local GAME_COMPILER_*)" },
      { status: 503 },
    );
  }

  const body: { transcript?: unknown; spec?: unknown } | null = await request
    .json()
    .catch(() => null);
  if (!body || typeof body.transcript !== "string") {
    return NextResponse.json({ error: "Expected JSON { transcript, spec }" }, { status: 400 });
  }
  const transcript = clampCodePoints(body.transcript, TRANSCRIPT_MAX_CODE_POINTS);
  if (transcript.length === 0) {
    return NextResponse.json({ error: "Transcript is empty" }, { status: 400 });
  }
  const spec = GameSpecSchema.safeParse(body.spec);
  if (!spec.success) {
    return NextResponse.json({ error: "Invalid spec" }, { status: 400 });
  }

  const compiled = buildPatchRequest({
    model: config.model,
    transcript,
    currentCartridgeLine: spec.data.cartridgeLine,
    currentTurnRate: spec.data.mechanic.turnRate,
  });
  const result = await callCompiler(config, compiled, COMPILER_TIMEOUTS_MS.patch);
  if (result.ok) {
    return NextResponse.json({
      ok: true,
      candidate: result.value,
      elapsedMs: result.elapsedMs,
      label: config.label,
    });
  }
  return NextResponse.json({
    ok: false,
    failure: result.failure,
    elapsedMs: result.elapsedMs,
    label: config.label,
  });
}
