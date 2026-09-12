import type { AbilityState } from "./abilities.ts";
import { forwardOf, projectPoint, routeOf, type RouteCourse, type GlideState, type ProxyEntity, type Vec3 } from "./glide.ts";
import type { ParkourPlatform } from "./parkour.ts";
import { drawHoopSurface, type HoopSurface } from "./hoop-material.ts";
export { loadHoopSurface, releaseHoopSurface, type HoopSurface } from "./hoop-material.ts";

type HoopFace = {
  vertices: readonly Vec3[];
  center: Vec3;
  normal: Vec3;
  shade: number;
  major: number;
  minor: number;
};

const MAJOR_SEGMENTS = 48;
const MINOR_SEGMENTS = 8;
const NEAR = 0.55;
const meshes = new WeakMap<ProxyEntity, readonly HoopFace[]>();
type RGB = readonly [red: number, green: number, blue: number];
export type HoopPalette = { readonly shadow: RGB; readonly midtone: RGB; readonly highlight: RGB };
const DEFAULT_PALETTE: HoopPalette = { shadow: [32, 36, 35], midtone: [135, 136, 127], highlight: [239, 237, 221] };
const ramps = new WeakMap<HoopPalette, readonly string[]>();
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const luminance = (color: RGB) => (color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722) / 255;
const cssColor = (color: RGB) => `rgb(${color.map(Math.round).join(", ")})`;

export async function sampleHoopPalette(image: Blob): Promise<HoopPalette> {
  const bitmap = await createImageBitmap(image, { resizeWidth: 32, resizeHeight: 32, resizeQuality: "high" });
  try {
    const canvas = new OffscreenCanvas(32, 32);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Image palette canvas is unavailable");
    ctx.drawImage(bitmap, 0, 0, 32, 32);
    const { data } = ctx.getImageData(0, 0, 32, 32);
    const pixels: { color: RGB; alpha: number }[] = [];
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] > 0) pixels.push({ color: [data[index], data[index + 1], data[index + 2]], alpha: data[index + 3] / 255 });
    }
    if (!pixels.length) return DEFAULT_PALETTE;
    pixels.sort((a, b) => luminance(a.color) - luminance(b.color));
    const band = (index: number, low: number, high: number): RGB => {
      const start = Math.floor(pixels.length * index / 3);
      const end = Math.max(start + 1, Math.floor(pixels.length * (index + 1) / 3));
      const selected = pixels.slice(start, end);
      const weight = selected.reduce((sum, pixel) => sum + pixel.alpha, 0);
      const color = selected.reduce<[number, number, number]>((sum, pixel) => [sum[0] + pixel.color[0] * pixel.alpha / weight, sum[1] + pixel.color[1] * pixel.alpha / weight, sum[2] + pixel.color[2] * pixel.alpha / weight], [0, 0, 0]);
      const light = luminance(color);
      const target = clamp(light, low, high);
      const mix = light < target ? (target - light) / (1 - light) : 0;
      return color.map((channel) => Math.round(clamp(light > target ? channel * target / light : channel + (255 - channel) * mix, 0, 255))) as [number, number, number];
    };
    return { shadow: band(0, 0.08, 0.24), midtone: band(1, 0.38, 0.62), highlight: band(2, 0.78, 0.94) };
  } finally {
    bitmap.close();
  }
}

function paletteRamp(palette: HoopPalette): readonly string[] {
  let ramp = ramps.get(palette);
  if (!ramp) {
    ramp = Array.from({ length: 32 }, (_, index) => {
      const shade = index / 31;
      const a = shade < 0.5 ? palette.shadow : palette.midtone;
      const b = shade < 0.5 ? palette.midtone : palette.highlight;
      const mix = shade < 0.5 ? shade * 2 : (shade - 0.5) * 2;
      return cssColor([a[0] + (b[0] - a[0]) * mix, a[1] + (b[1] - a[1]) * mix, a[2] + (b[2] - a[2]) * mix]);
    });
    ramps.set(palette, ramp);
  }
  return ramp;
}

export function buildHoopMesh(center: Vec3, radius: number): readonly HoopFace[] {
  const tube = radius * 0.12;
  const majorRadius = radius + tube;
  const vertices = Array.from({ length: MAJOR_SEGMENTS }, (_, major) => {
    const angle = major / MAJOR_SEGMENTS * Math.PI * 2;
    return Array.from({ length: MINOR_SEGMENTS }, (_, minor): Vec3 => {
      const cross = minor / MINOR_SEGMENTS * Math.PI * 2;
      const radial = majorRadius + tube * Math.cos(cross);
      return [center[0] + radial * Math.cos(angle), center[1] + radial * Math.sin(angle), center[2] + tube * Math.sin(cross)];
    });
  });
  const faces: HoopFace[] = [];
  for (let major = 0; major < MAJOR_SEGMENTS; major++) {
    for (let minor = 0; minor < MINOR_SEGMENTS; minor++) {
      const angle = (major + 0.5) / MAJOR_SEGMENTS * Math.PI * 2;
      const cross = (minor + 0.5) / MINOR_SEGMENTS * Math.PI * 2;
      const normal: Vec3 = [Math.cos(angle) * Math.cos(cross), Math.sin(angle) * Math.cos(cross), Math.sin(cross)];
      const corners = [vertices[major][minor], vertices[(major + 1) % MAJOR_SEGMENTS][minor], vertices[(major + 1) % MAJOR_SEGMENTS][(minor + 1) % MINOR_SEGMENTS], vertices[major][(minor + 1) % MINOR_SEGMENTS]];
      const light = Math.max(0, normal[0] * -0.42 + normal[1] * 0.58 - normal[2] * 0.7);
      faces.push({
        vertices: corners,
        center: corners.reduce<Vec3>((sum, point) => [sum[0] + point[0] / 4, sum[1] + point[1] / 4, sum[2] + point[2] / 4], [0, 0, 0]),
        normal,
        shade: clamp(0.18 + light * 0.8 + ((major * 7) % 11 - 5) * 0.006, 0, 1),
        major,
        minor,
      });
    }
  }
  return faces;
}

function clipPolygon(vertices: readonly Vec3[], distance: (point: Vec3) => number): readonly Vec3[] {
  const distances = vertices.map(distance);
  if (distances.every((value) => value >= 0)) return vertices;
  if (distances.every((value) => value < 0)) return [];
  const clipped: Vec3[] = [];
  for (let index = 0; index < vertices.length; index++) {
    const previous = (index + vertices.length - 1) % vertices.length;
    const a = vertices[previous], b = vertices[index];
    const da = distances[previous], db = distances[index];
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      const intersection: Vec3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      if (vertices.length === 2) return da >= 0 ? [a, intersection] : [intersection, b];
      clipped.push(intersection);
    }
    if (db >= 0) clipped.push(b);
  }
  return clipped;
}

function drawLabel(ctx: CanvasRenderingContext2D, state: GlideState, gate: ProxyEntity, forward: Vec3, ui: number): void {
  const { width, height } = ctx.canvas;
  const delta: Vec3 = [gate.position[0] - state.position[0], gate.position[1] - state.position[1], gate.position[2] - state.position[2]];
  const distance = Math.hypot(...delta);
  const depth = delta[0] * forward[0] + delta[1] * forward[1] + delta[2] * forward[2];
  const center = projectPoint(gate.position, state, width, height);
  const margin = 24 * ui;
  const offscreen = !center || center.x < margin || center.x > width - margin || center.y < margin || center.y > height - margin;
  let x: number, y: number;
  let ux = 0, uy = 0;
  if (offscreen) {
    const shift = Math.max(0, 1 - depth);
    const bearing = center ?? projectPoint([gate.position[0] + forward[0] * shift, gate.position[1] + forward[1] * shift, gate.position[2] + forward[2] * shift], state, width, height);
    let dx = (bearing?.x ?? width) - width / 2;
    const dy = (bearing?.y ?? height / 2) - height / 2;
    if (Math.hypot(dx, dy) < 0.001) dx = 1;
    const length = Math.hypot(dx, dy);
    ux = dx / length;
    uy = dy / length;
    const reach = Math.min((width / 2 - margin) / Math.max(Math.abs(ux), 0.001), (height / 2 - margin) / Math.max(Math.abs(uy), 0.001));
    x = width / 2 + ux * reach;
    y = height / 2 + uy * reach;
    ctx.beginPath();
    ctx.moveTo(x - ux * 8 * ui - uy * 5 * ui, y - uy * 8 * ui + ux * 5 * ui);
    ctx.lineTo(x, y);
    ctx.lineTo(x - ux * 8 * ui + uy * 5 * ui, y - uy * 8 * ui - ux * 5 * ui);
    ctx.strokeStyle = "#ececdf";
    ctx.lineWidth = 1.5 * ui;
    ctx.stroke();
  } else {
    const top = projectPoint([gate.position[0], gate.position[1] + gate.radius * 1.24, gate.position[2]], state, width, height);
    x = top?.x ?? center.x;
    y = (top?.y ?? center.y) - 18 * ui;
  }
  const text = `${gate.kind === "goal" ? "GOAL" : String(state.activeGate + 1).padStart(2, "0")} · ${Math.round(distance)} m`;
  ctx.font = `500 ${12 * ui}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const half = ctx.measureText(text).width / 2 + 9 * ui;
  x = clamp(x - ux * (half + 18 * ui), half + 12 * ui, width - half - 12 * ui);
  y = clamp(y - uy * 24 * ui, 24 * ui, height - 24 * ui);
  ctx.fillStyle = "rgba(24, 29, 27, 0.86)";
  ctx.fillRect(x - half, y - 12 * ui, half * 2, 24 * ui);
  ctx.fillStyle = "#ececdf";
  ctx.fillText(text, x, y);
}

export function drawHoops(ctx: CanvasRenderingContext2D, state: GlideState, course: GlideCourse, palette?: HoopPalette, surface?: HoopSurface): void {
  const { width, height } = ctx.canvas;
  if (width <= 0 || height <= 0) return;
  const route = routeOf(course);
  const active = route[state.activeGate];
  if (!active) return;
  const shades = paletteRamp(palette ?? DEFAULT_PALETTE);
  const accentColor = palette ? cssColor(palette.highlight) : "#c5d88b";
  const rimColor = palette ? shades[24] : "#dddccd";
  const ui = height / (ctx.canvas.clientHeight || height);
  const forward = forwardOf(state.yaw, state.pitch);
  if (surface) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    const rendered = drawHoopSurface(ctx, state, route, palette ?? DEFAULT_PALETTE, surface);
    if (rendered) drawLabel(ctx, state, active, forward, ui);
    ctx.restore();
    if (rendered) return;
  }
  const depthOf = (point: Vec3) => (point[0] - state.position[0]) * forward[0] + (point[1] - state.position[1]) * forward[1] + (point[2] - state.position[2]) * forward[2];
  const project = (vertices: readonly Vec3[]) => {
    const near = clipPolygon(vertices, (point) => depthOf(point) - NEAR);
    const points: Vec3[] = [];
    for (const vertex of near) {
      const point = projectPoint(vertex, state, width, height);
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return [];
      points.push([point.x, point.y, point.depth]);
    }
    let clipped: readonly Vec3[] = points;
    for (const plane of [(point: Vec3) => point[0], (point: Vec3) => width - point[0], (point: Vec3) => point[1], (point: Vec3) => height - point[1]]) {
      clipped = clipPolygon(clipped, plane);
    }
    return clipped;
  };
  const line = (a: Vec3, b: Vec3, color: string, lineWidth: number) => {
    const points = project([a, b]);
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    ctx.lineTo(points[1][0], points[1][1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  };
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.lineJoin = "round";
  for (const gate of route.slice(state.activeGate).sort((a, b) => depthOf(b.position) - depthOf(a.position))) {
    if (depthOf(gate.position) + gate.radius * 1.24 <= NEAR) continue;
    let mesh = meshes.get(gate);
    if (!mesh) {
      mesh = buildHoopMesh(gate.position, gate.radius);
      meshes.set(gate, mesh);
    }
    const visible = mesh.filter((face) => face.normal[0] * (state.position[0] - face.center[0]) + face.normal[1] * (state.position[1] - face.center[1]) + face.normal[2] * (state.position[2] - face.center[2]) > 0);
    visible.sort((a, b) => depthOf(b.center) - depthOf(a.center));
    for (const face of visible) {
      const points = project(face.vertices);
      if (points.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let index = 1; index < points.length; index++) ctx.lineTo(points[index][0], points[index][1]);
      ctx.closePath();
      ctx.fillStyle = shades[Math.round(face.shade * 31)];
      ctx.fill();
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 0.6 * ui;
      ctx.stroke();
      const scale = projectPoint(face.center, state, width, height)?.scale ?? 0;
      if (face.major % 6 === 0) line(face.vertices[0], face.vertices[3], shades[3], clamp(gate.radius * 0.003 * scale, 0.3 * ui, 1.1 * ui));
      if (face.minor === 2 || face.minor === 5) {
        const accent = gate === active && face.major % 12 < 4;
        const start = face.minor === 2 ? 3 : 0;
        const end = face.minor === 2 ? 2 : 1;
        line(face.vertices[start], face.vertices[end], accent ? accentColor : rimColor, clamp(gate.radius * 0.006 * scale, (accent ? 0.8 : 0.4) * ui, (accent ? 2.2 : 1.3) * ui));
      }
    }
  }
  drawLabel(ctx, state, active, forward, ui);
  ctx.restore();
}
