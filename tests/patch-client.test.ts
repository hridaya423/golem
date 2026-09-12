import assert from "node:assert/strict";
import test from "node:test";
import { offlinePatchCandidate, requestPatch } from "../src/compiler/patch.ts";
import { fallbackSpec } from "../src/game/fallback.ts";
import { GlideTurnPatchSchema } from "../src/game/spec.ts";

const spec = fallbackSpec({ id: "a".repeat(64) });

const factorOf = (candidate: unknown) =>
  GlideTurnPatchSchema.parse(candidate).factor;

test("offlinePatchCandidate maps faster phrases to 2, slower to 0.5, else null", () => {
  for (const phrase of ["double the turn rate", "make it twice as fast", "tighter steering"]) {
    assert.equal(factorOf(offlinePatchCandidate(phrase)), 2, phrase);
  }
  for (const phrase of ["make it slower", "calm it down"]) {
    assert.equal(factorOf(offlinePatchCandidate(phrase)), 0.5, phrase);
  }
  assert.equal(offlinePatchCandidate("turn the sky purple"), null);
});

const ok = (candidate: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify({ ok: true, candidate, elapsedMs: 1, label: "test" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );

test("requestPatch applies a live candidate without mutating the caller spec", async () => {
  const outcome = await requestPatch(
    "double it",
    spec,
    "on",
    undefined,
    (() =>
      ok({
        version: 1,
        mechanic: "glide",
        operation: "multiply_turn_rate",
        factor: 2,
        cartridgeLine: "Sharper turns.",
      })) as typeof fetch,
  );
  assert.equal(outcome.source, "live");
  assert.equal(outcome.spec.mechanic.turnRate, 2);
  assert.equal(outcome.spec.cartridgeLine, "Sharper turns.");
  assert.equal(spec.mechanic.turnRate, 1);
});

test("requestPatch falls back offline when the route fails", async () => {
  const throwing = (() => Promise.reject(new Error("network down"))) as typeof fetch;
  const outcome = await requestPatch("double it", spec, "on", undefined, throwing);
  assert.equal(outcome.source, "offline");
  assert.equal(outcome.spec.mechanic.turnRate, 2);
});

test("requestPatch rejects an unmappable rule with the compiler off", async () => {
  const throwing = (() => Promise.reject(new Error("must not be called"))) as typeof fetch;
  await assert.rejects(
    () => requestPatch("make the water gold", spec, "off", undefined, throwing),
    /rule isn't one this game can take/,
  );
});
