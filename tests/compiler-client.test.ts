import test from "node:test";
import assert from "node:assert/strict";
import { compileGame, type CompileProgress } from "../src/compiler/client.ts";
import { FALLBACK_CANDIDATE } from "../src/game/fallback.ts";
import type { PreparedImage } from "../src/seed/image.ts";

const IMAGE: PreparedImage = {
  id: "73b41252fdf6f99f1af442b967ef61c480213c528fc8ebc22b284c6023c76f42",
  mimeType: "image/webp",
  width: 1664,
  height: 960,
  normalized: new Blob([new Uint8Array(8)], { type: "image/webp" }),
  original: new Blob([new Uint8Array(8)], { type: "image/webp" }),
  originalName: "fixture.webp",
  previewUrl: "blob:stub",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const ok = (candidate: unknown) => ({ ok: true, candidate, elapsedMs: 10, label: "test-model" });

const brokenCandidate = () => {
  const candidate = structuredClone(FALLBACK_CANDIDATE) as Record<string, unknown>;
  (candidate.rules as { goalEntityId: string }).goalEntityId = "cp3";
  return candidate;
};

const validCandidate = () => structuredClone(FALLBACK_CANDIDATE);

function recorder(...bodies: { body: unknown; status?: number }[]) {
  const calls: { url: string | URL | Request; init?: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url, init });
    const next = bodies[Math.min(calls.length - 1, bodies.length - 1)];
    return jsonResponse(next.body, next.status ?? 200);
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const progressLog: CompileProgress[] = [];
const onProgress = (p: CompileProgress) => {
  progressLog.push(p);
};

test("valid first response compiles live with one call", async () => {
  progressLog.length = 0;
  const { calls, fetchImpl } = recorder({ body: ok(validCandidate()) });
  const outcome = await compileGame(IMAGE, "", onProgress, undefined, fetchImpl);
  assert.equal(outcome.source, "live");
  assert.equal(calls.length, 1);
  assert.equal(outcome.attempts, 1);
  assert.equal(outcome.spec.title, "Ink Islands Glide");
  const statuses = progressLog.map((p) => `${p.step}:${p.status}`);
  assert.ok(statuses.includes("rules:passed"));
  assert.ok(statuses.includes("testing:passed"));
});

test("invalid first response triggers exactly one repair with context", async () => {
  progressLog.length = 0;
  const bad = brokenCandidate();
  const { calls, fetchImpl } = recorder({ body: ok(bad) }, { body: ok(validCandidate()) });
  const outcome = await compileGame(IMAGE, "", onProgress, undefined, fetchImpl);
  assert.equal(outcome.source, "repaired");
  assert.equal(calls.length, 2);
  const repairForm = calls[1].init?.body;
  assert.ok(repairForm instanceof FormData);
  const repair = JSON.parse(String(repairForm.get("repair")));
  assert.deepEqual(repair.priorCandidate, bad);
  assert.ok(Array.isArray(repair.issues) && repair.issues.length >= 1);
  assert.ok(
    repair.issues.some((i: { code: string }) => i.code === "missing_reference" || i.code === "out_of_bounds"),
    JSON.stringify(repair.issues),
  );
});

test("two invalid responses fall back to the prepared game", async () => {
  progressLog.length = 0;
  const { calls, fetchImpl } = recorder({ body: ok(brokenCandidate()) }, { body: ok(brokenCandidate()) });
  const outcome = await compileGame(IMAGE, "", onProgress, undefined, fetchImpl);
  assert.equal(outcome.source, "fallback");
  assert.equal(calls.length, 2);
  assert.equal(outcome.spec.title, "Ink Islands Glide");
  assert.ok(outcome.issues && outcome.issues.length > 0);
});

test("503 skips straight to fallback with one call", async () => {
  progressLog.length = 0;
  const { calls, fetchImpl } = recorder({ body: { error: "not configured" }, status: 503 });
  const outcome = await compileGame(IMAGE, "", onProgress, undefined, fetchImpl);
  assert.equal(outcome.source, "fallback");
  assert.equal(calls.length, 1);
  assert.ok(progressLog.some((p) => p.status === "fallback" && p.detail === "Compiler not configured — using the prepared game"));
});

test("fresh images get generic validated fallback after 503 or failed repair", async () => {
  const image = { ...IMAGE, id: "a".repeat(64) };
  for (const response of [{ body: { error: "not configured" }, status: 503 }, { body: ok(brokenCandidate()) }]) {
    const { calls, fetchImpl } = recorder(response);
    const outcome = await compileGame(image, "", () => {}, undefined, fetchImpl);
    assert.equal(outcome.source, "fallback");
    assert.equal(calls.length, "status" in response ? 1 : 2);
    assert.equal(outcome.spec.referenceImageId, image.id);
    assert.equal(outcome.spec.title, "Your World, In Motion");
    assert.doesNotMatch(JSON.stringify(outcome.spec), /stone|ink|water|neon|canyon|arch|moon/i);
    assert.ok(outcome.checks.every((check) => check.ok));
  }
});

test("abort signal rejects instead of falling back", async () => {
  progressLog.length = 0;
  const controller = new AbortController();
  const fetchImpl = (async () => {
    controller.abort();
    throw Object.assign(new Error("aborted"), { name: "AbortError" });
  }) as typeof fetch;
  await assert.rejects(compileGame(IMAGE, "", onProgress, controller.signal, fetchImpl));
});
