// Gate 4.1 compiler qualification. Run: node --env-file=.env.local scripts/probe-compiler.ts [fixture.webp ...]
// Prints model label, elapsed ms, and schema/validation results only — never tokens or reasoning content.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildGameRequest, buildPatchRequest, callCompiler, compilerConfig, COMPILER_TIMEOUTS_MS } from "../src/compiler/request.ts";
import { GameSpecCandidateSchema, GlideTurnPatchSchema } from "../src/game/spec.ts";

const config = compilerConfig(process.env);
if (!config) {
  console.error("GAME_COMPILER_* is not configured");
  process.exit(2);
}
const fixtures = process.argv.slice(2);
if (fixtures.length === 0) fixtures.push("public/fixtures/glide-ink-islands.webp");
const evidenceDir = "docs/evidence/gate-4";
mkdirSync(evidenceDir, { recursive: true });

let validate: ((c: unknown, image: { id: string }) => { ok: boolean; issues?: readonly unknown[]; checks: unknown[] }) | null = null;
try {
  validate = (await import("../src/game/validate.ts")).validateGameSpecCandidate;
} catch {
  console.log("validate.ts not available yet; schema-only probe");
}

const sha256 = async (bytes: Buffer) =>
  Buffer.from(await crypto.subtle.digest("SHA-256", bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)).toString("hex");

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const gameTimes: number[] = [];
for (const fixture of fixtures) {
  const bytes = readFileSync(fixture);
  const id = await sha256(bytes);
  const dataUrl = `data:image/webp;base64,${bytes.toString("base64")}`;
  const body = buildGameRequest({ model: config.model, imageDataUrl: dataUrl });
  const result = await callCompiler(config, body, COMPILER_TIMEOUTS_MS.game);
  gameTimes.push(result.elapsedMs);
  const name = path.basename(fixture, path.extname(fixture));
  if (!result.ok) {
    console.log(`[game] ${name}: FAIL ${result.failure.kind} ${result.failure.message} in ${result.elapsedMs.toFixed(0)} ms`);
    continue;
  }
  const schema = GameSpecCandidateSchema.safeParse(result.value);
  const validated = validate ? validate(result.value, { id }) : null;
  console.log(
    `[game] ${name}: ${result.elapsedMs.toFixed(0)} ms · schema ${schema.success ? "ok" : "FAIL"}` +
      (validated ? ` · validate ${validated.ok ? "ok" : "FAIL " + JSON.stringify(validated.issues)}` : ""),
  );
  if (!schema.success) console.log(schema.error.issues.slice(0, 8));
  writeFileSync(
    path.join(evidenceDir, `${name}.candidate.json`),
    JSON.stringify({ label: config.label, elapsedMs: result.elapsedMs, imageId: id, schemaOk: schema.success, validated, candidate: result.value }, null, 2),
  );
}

const patchTimes: number[] = [];
const patchResults: unknown[] = [];
for (const transcript of ["Double the turn rate", "make it turn way slower and smoother", "twice as sharp turns please"]) {
  const body = buildPatchRequest({ model: config.model, transcript, currentCartridgeLine: "Three arches, one moon gate.", currentTurnRate: 1 });
  const result = await callCompiler(config, body, COMPILER_TIMEOUTS_MS.patch);
  patchTimes.push(result.elapsedMs);
  if (!result.ok) {
    console.log(`[patch] "${transcript}": FAIL ${result.failure.kind} ${result.failure.message} in ${result.elapsedMs.toFixed(0)} ms`);
    patchResults.push({ transcript, failure: result.failure, elapsedMs: result.elapsedMs });
    continue;
  }
  const parsed = GlideTurnPatchSchema.safeParse(result.value);
  console.log(`[patch] "${transcript}": ${result.elapsedMs.toFixed(0)} ms · schema ${parsed.success ? "ok" : "FAIL"} · ${JSON.stringify(result.value)}`);
  patchResults.push({ transcript, elapsedMs: result.elapsedMs, schemaOk: parsed.success, value: result.value });
}
writeFileSync(path.join(evidenceDir, "patch-probes.json"), JSON.stringify({ label: config.label, patchResults }, null, 2));

console.log(
  `\n${config.label}: game median ${median(gameTimes).toFixed(0)} ms (max ${Math.max(...gameTimes).toFixed(0)}), ` +
    `patch median ${median(patchTimes).toFixed(0)} ms (max ${Math.max(...patchTimes).toFixed(0)})`,
);
console.log(`qualifies: game ${median(gameTimes) <= 20_000 && Math.max(...gameTimes) <= 30_000}, patch ${median(patchTimes) <= 8_000 && Math.max(...patchTimes) <= 12_000}`);
