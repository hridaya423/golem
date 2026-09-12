import test from "node:test";
import assert from "node:assert/strict";
import { buildHoopMesh, drawHoops, sampleHoopPalette } from "../src/game/hoops.ts";
import { createGlideState, projectPoint, routeOf, type GlideCourse, type Vec3 } from "../src/game/glide.ts";

type Paint = { kind: "fill" | "stroke" | "rect"; color: string; points: number[][] };

function recordingCanvas(width = 1280, height = 720) {
  const paints: Paint[] = [];
  const labels: { text: string; x: number; y: number }[] = [];
  let points: number[][] = [];
  const context = {
    canvas: { width, height, clientHeight: height },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    save() {},
    restore() {},
    beginPath() { points = []; },
    moveTo(x: number, y: number) { points.push([x, y]); },
    lineTo(x: number, y: number) { points.push([x, y]); },
    closePath() {},
    fill() { paints.push({ kind: "fill", color: this.fillStyle, points: [...points] }); },
    stroke() { paints.push({ kind: "stroke", color: this.strokeStyle, points: [...points] }); },
    fillRect(x: number, y: number, w: number, h: number) {
      paints.push({ kind: "rect", color: this.fillStyle, points: [[x, y], [x + w, y + h]] });
    },
    measureText(text: string) { return { width: text.length * 7 }; },
    fillText(text: string, x: number, y: number) { labels.push({ text, x, y }); },
    clearRect() { assert.fail("drawHoops must leave canvas clearing to its caller"); },
  };
  return { ctx: context as unknown as CanvasRenderingContext2D, paints, labels };
}

const course: GlideCourse = {
  mechanic: { kind: "glide", lift: 1, drag: 1, turnRate: 1, boost: 1 },
  entities: [
    { id: "start", kind: "start", position: [0, 0, 0], radius: 4, label: "Start" },
    { id: "cp1", kind: "checkpoint", position: [-120, 0, 300], radius: 24, label: "First" },
    { id: "cp2", kind: "checkpoint", position: [360, 0, 900], radius: 24, label: "Second" },
    { id: "cp3", kind: "checkpoint", position: [0, 0, 600], radius: 24, label: "Third" },
    { id: "goal", kind: "goal", position: [170, 0, 800], radius: 28, label: "Goal" },
  ],
  rules: { durationSeconds: 60, requiredCheckpointIds: ["cp1", "cp2", "cp3"], goalEntityId: "goal", respawnBehindDistance: 12 },
};

function draw(state = createGlideState(course), targetCourse = course) {
  const canvas = recordingCanvas();
  drawHoops(canvas.ctx, state, targetCourse);
  return canvas;
}

test("mesh leaves the gameplay opening clear, has real tube depth, and stays within its face budget", () => {
  const center: Vec3 = [13, -8, 140];
  const radius = 24;
  const mesh = buildHoopMesh(center, radius);
  const vertices = mesh.flatMap((face) => face.vertices);
  const radial = vertices.map(([x, y]) => Math.hypot(x - center[0], y - center[1]));
  assert.ok(mesh.length > 0 && mesh.length <= 48 * 8);
  assert.ok(mesh.every((face) => face.vertices.length === 4));
  assert.ok(Math.abs(Math.min(...radial) - radius) < 1e-10);
  assert.ok(Math.max(...radial) > radius * 1.15);
  assert.ok(Math.min(...vertices.map((point) => point[2])) < center[2] - 1);
  assert.ok(Math.max(...vertices.map((point) => point[2])) > center[2] + 1);
  assert.ok(vertices.every((point) => point.every(Number.isFinite)));
  assert.ok(mesh.every((face) => face.shade >= 0 && face.shade <= 1));
  assert.ok(new Set(mesh.map((face) => Math.round(face.shade * 20))).size > 8);
  assert.deepEqual(buildHoopMesh(center, radius), mesh);
});

test("world-space hoop projects as a foreshortened silhouette, not a camera-facing circle", () => {
  const vertices = buildHoopMesh([0, 0, 100], 24).flatMap((face) => face.vertices);
  const aspect = (position: Vec3, yaw: number) => {
    const projected = vertices.map((point) => projectPoint(point, { position, yaw, pitch: 0 }, 1280, 720));
    assert.ok(projected.every((point) => point !== null));
    const xs = projected.map((point) => point!.x);
    const ys = projected.map((point) => point!.y);
    return (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys));
  };
  assert.ok(Math.abs(aspect([0, 0, 0], 0) - 1) < 0.01);
  assert.ok(aspect([100, 0, 0], -Math.PI / 4) < 0.8);
});

test("upcoming hoops are painted by camera depth, far to near, including a route not sorted by z", () => {
  const state = createGlideState(course);
  const centers = routeOf(course).map((gate) => projectPoint(gate.position, state, 1280, 720)!.x);
  const gateOf = (paint: Paint) => {
    const x = paint.points.reduce((sum, point) => sum + point[0], 0) / paint.points.length;
    return centers.reduce((best, center, index) => Math.abs(center - x) < Math.abs(centers[best] - x) ? index : best, 0);
  };
  const groups = draw(state).paints.filter((paint) => paint.kind === "fill").map(gateOf);
  assert.deepEqual(groups.filter((gate, index) => index === 0 || groups[index - 1] !== gate), [1, 3, 2, 0]);
  const later = draw({ ...state, activeGate: 1, completed: ["cp1"] });
  assert.ok(later.paints.filter((paint) => paint.kind === "fill").every((paint) => gateOf(paint) !== 0));
});

test("lime is a short active inner-rim stroke, never a filled disk or an inactive hoop", () => {
  const state = createGlideState(course);
  const active = routeOf(course)[0];
  const center = projectPoint(active.position, state, 1280, 720)!;
  const paints = draw(state).paints;
  const lime = paints.filter((paint) => paint.color === "#c5d88b");
  assert.ok(lime.length > 0 && lime.length <= 48);
  for (const paint of lime) {
    assert.equal(paint.kind, "stroke");
    assert.equal(paint.points.length, 2);
    for (const [x, y] of paint.points) {
      const distance = Math.hypot(x - center.x, y - center.y) / center.scale;
      assert.ok(distance >= active.radius - 1 && distance <= active.radius * 1.12);
    }
  }
  const neutralFaces = paints.filter((paint) => paint.kind === "fill");
  assert.ok(new Set(neutralFaces.map((paint) => paint.color)).size > 8);
});

test("near-plane crossings, camera inside the opening or tube, and yaw/pitch send only bounded finite drawing coordinates", () => {
  const base = createGlideState(course);
  const gate = routeOf(course)[0];
  let surfaces = 0;
  for (const offset of [[0, 0, -35], [0, 0, -0.5], [0, 0, 0], [26.5, 0, -0.5], [0, 24, 1]] as const) {
    for (const yaw of [-1, 0, 1]) {
      for (const pitch of [-0.45, 0, 0.45]) {
        const position: Vec3 = [gate.position[0] + offset[0], gate.position[1] + offset[1], gate.position[2] + offset[2]];
        const { paints, labels } = draw({ ...base, position, yaw, pitch });
        surfaces += paints.filter((paint) => paint.kind === "fill").length;
        for (const paint of paints.filter((paint) => paint.kind === "stroke" && paint.points.length === 2)) {
          assert.ok(Math.hypot(paint.points[0][0] - paint.points[1][0], paint.points[0][1] - paint.points[1][1]) > 1e-8, "clipped rim/seam must remain a segment, not collapse to a dot");
        }
        for (const point of [...paints.flatMap((paint) => paint.points), ...labels.map(({ x, y }) => [x, y])]) {
          assert.ok(point.every(Number.isFinite));
          assert.ok(point[0] >= -2 && point[0] <= 1282, `x=${point[0]}`);
          assert.ok(point[1] >= -2 && point[1] <= 722, `y=${point[1]}`);
        }
      }
    }
  }
  assert.ok(surfaces > 0);
});

test("active goal remains navigable offscreen and behind the camera without drawing a fake ring", () => {
  const base = createGlideState(course);
  for (const yaw of [1.5, Math.PI]) {
    const { labels } = draw({ ...base, activeGate: 3, yaw });
    assert.equal(labels.length, 1);
    assert.match(labels[0].text, /GOAL.*\d+\s*m/);
    assert.ok(labels[0].x >= 12 && labels[0].x <= 1268);
    assert.ok(labels[0].y >= 12 && labels[0].y <= 708);
  }
});

test("drawing is state-deterministic, does not clear or mutate gameplay, and adds no event flash", () => {
  const state = createGlideState(course);
  const before = structuredClone(state);
  const first = draw(state);
  const second = draw({ ...state, elapsed: 123, event: "gate" });
  assert.deepEqual(first.paints, second.paints);
  assert.deepEqual(first.labels, second.labels);
  assert.deepEqual(state, before);
  assert.equal(first.paints.filter((paint) => paint.kind === "rect").length, 1);
  const finished = draw({ ...state, activeGate: 4, status: "won" });
  assert.equal(finished.paints.length, 0);
  assert.equal(finished.labels.length, 0);
});

test("image sampling handles black, white, transparency, and multicolor surfaces with palette-driven accents", async (t) => {
  const image = new Blob(["mock image"], { type: "image/png" });
  let data = new Uint8ClampedArray(32 * 32 * 4);
  let closed = 0;
  const bitmap = { close() { closed++; } };
  for (const key of ["createImageBitmap", "OffscreenCanvas"] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  Object.defineProperties(globalThis, {
    createImageBitmap: { configurable: true, value: async (blob: Blob, options: ImageBitmapOptions) => {
      assert.equal(blob, image);
      assert.deepEqual(options, { resizeWidth: 32, resizeHeight: 32, resizeQuality: "high" });
      return bitmap;
    } },
    OffscreenCanvas: { configurable: true, value: class {
      constructor(width: number, height: number) { assert.deepEqual([width, height], [32, 32]); }
      getContext(kind: string, options: object) {
        assert.equal(kind, "2d");
        assert.deepEqual(options, { willReadFrequently: true });
        return {
          drawImage(source: object, ...bounds: number[]) {
            assert.equal(source, bitmap);
            assert.deepEqual(bounds, [0, 0, 32, 32]);
          },
          getImageData(...bounds: number[]) {
            assert.deepEqual(bounds, [0, 0, 32, 32]);
            return { data };
          },
        };
      }
    } },
  });
  const fixtures = [
    { name: "black", pixels: [[0, 0, 0, 255]], expected: { shadow: [20, 20, 20], midtone: [97, 97, 97], highlight: [199, 199, 199] } },
    { name: "white", pixels: [[255, 255, 255, 255]], expected: { shadow: [61, 61, 61], midtone: [158, 158, 158], highlight: [240, 240, 240] } },
    { name: "transparent", pixels: [[255, 0, 255, 0]], expected: { shadow: [32, 36, 35], midtone: [135, 136, 127], highlight: [239, 237, 221] } },
    { name: "multicolor", pixels: [[255, 205, 180, 255], [64, 20, 96, 255], [200, 90, 30, 255], [0, 255, 0, 0]], expected: { shadow: [64, 20, 96], midtone: [200, 90, 30], highlight: [255, 205, 180] } },
    { name: "alpha-weighted", pixels: [[32, 32, 32, 255], [64, 64, 64, 85], [120, 120, 120, 255], [160, 160, 160, 85], [210, 210, 210, 255], [250, 250, 250, 85], [255, 0, 255, 0], [0, 255, 0, 0]], expected: { shadow: [40, 40, 40], midtone: [130, 130, 130], highlight: [220, 220, 220] } },
  ];
  const state = createGlideState(course);
  const neutral = draw(state);
  for (const { name, pixels, expected } of fixtures) {
    await t.test(name, async () => {
      data = new Uint8ClampedArray(32 * 32 * 4);
      for (let index = 0; index < 32 * 32; index++) data.set(pixels[index % pixels.length], index * 4);
      const before = closed;
      const palette = await sampleHoopPalette(image);
      assert.equal(closed, before + 1);
      assert.deepEqual(palette, expected);
      const colored = recordingCanvas();
      drawHoops(colored.ctx, state, course, palette);
      assert.deepEqual(colored.paints.map(({ points }) => points), neutral.paints.map(({ points }) => points));
      assert.ok(colored.paints.every(({ color }) => color !== "#c5d88b"));
      const faces = colored.paints.filter(({ kind }) => kind === "fill").map(({ color }) => color);
      assert.ok(new Set(faces).size > 8);
      const neutralFaces = neutral.paints.filter(({ kind }) => kind === "fill").map(({ color }) => color);
      if (name === "transparent") assert.deepEqual(faces, neutralFaces);
      else assert.notDeepEqual(faces, neutralFaces);
      const accent = `rgb(${palette.highlight.join(", ")})`;
      for (const [index, paint] of neutral.paints.entries()) {
        if (paint.color === "#c5d88b") assert.equal(colored.paints[index].color, accent);
      }
    });
  }
});

test("supplied palette blends actual surface colors without changing geometry or retaining a fixed green accent", () => {
  const palette = { shadow: [35, 10, 5], midtone: [160, 60, 25], highlight: [255, 215, 170] } as const;
  const state = createGlideState(course);
  const neutral = draw(state);
  const colored = recordingCanvas();
  drawHoops(colored.ctx, state, course, palette);
  assert.deepEqual(colored.paints.map(({ points }) => points), neutral.paints.map(({ points }) => points));
  assert.ok(colored.paints.every((paint) => paint.color !== "#c5d88b"));
  const faces = colored.paints.filter((paint) => paint.kind === "fill");
  assert.ok(new Set(faces.map(({ color }) => color)).size > 8);
  for (const { color } of faces) {
    const channels = color.match(/\d+/g)!.map(Number);
    assert.ok(channels[0] > channels[1] && channels[1] > channels[2]);
  }
  const accents = colored.paints.filter((paint) => paint.color === "rgb(255, 215, 170)");
  assert.ok(accents.length > 0 && accents.length <= 48);
  assert.ok(accents.every((paint) => paint.kind === "stroke" && paint.points.length === 2));
});
