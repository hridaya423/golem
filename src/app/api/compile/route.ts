import { NextResponse } from "next/server";
import sharp from "sharp";
import {
  buildGameRequest,
  callCompiler,
  compilerConfig,
  COMPILER_TIMEOUTS_MS,
  type CompilerFailure,
} from "@/compiler/request";
import type { ValidationIssue } from "@/game/spec";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IMAGE_MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const config = compilerConfig(process.env);
  if (!config) {
    return NextResponse.json(
      { error: "Compiler is not configured on the server (.env.local GAME_COMPILER_*)" },
      { status: 503 },
    );
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }
  const image = form.get("image");
  if (!(image instanceof Blob) || image.size === 0 || image.size > IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: "Image must be a 1664×960 WebP" }, { status: 400 });
  }
  const directionField = form.get("direction");
  const direction = typeof directionField === "string" ? directionField : undefined;
  let repair: { priorCandidate: unknown; issues: readonly ValidationIssue[] } | undefined;
  const repairField = form.get("repair");
  if (typeof repairField === "string" && repairField.length > 0) {
    try {
      const parsed: unknown = JSON.parse(repairField);
      if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as { issues?: unknown }).issues)) {
        throw new Error("bad repair shape");
      }
      repair = parsed as { priorCandidate: unknown; issues: readonly ValidationIssue[] };
    } catch {
      return NextResponse.json({ error: "Invalid repair payload" }, { status: 400 });
    }
  }

  const buffer = Buffer.from(await image.arrayBuffer());
  const metadata = await sharp(buffer).metadata().catch(() => null);
  if (!metadata || metadata.format !== "webp" || metadata.width !== 1664 || metadata.height !== 960) {
    return NextResponse.json({ error: "Image must be a 1664×960 WebP" }, { status: 400 });
  }

  const body = buildGameRequest({
    model: config.model,
    imageDataUrl: `data:image/webp;base64,${buffer.toString("base64")}`,
    direction,
    repair,
  });
  const result = await callCompiler(config, body, COMPILER_TIMEOUTS_MS.game);
  if (result.ok) {
    return NextResponse.json({
      ok: true,
      candidate: result.value,
      elapsedMs: result.elapsedMs,
      label: config.label,
    });
  }
  const failure: CompilerFailure = result.failure;
  return NextResponse.json({
    ok: false,
    failure,
    elapsedMs: result.elapsedMs,
    label: config.label,
  });
}
