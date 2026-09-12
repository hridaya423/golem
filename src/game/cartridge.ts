import { routeOf, type GlideState, type Vec3 } from "./glide.ts";
import { courseOf, type ValidatedGameSpec } from "./spec.ts";

export type CartridgeData = {
  title: string;
  mechanic: "GLIDE";
  seedId: string;
  cartridgeLine: string;
  ruleLabel: string;
  completionSeconds: number;
  path: readonly Vec3[];
  gates: readonly Vec3[];
  originalTurnRate: number;
  patchedTurnRate: number;
};

export function deriveCartridge(input: {
  spec: ValidatedGameSpec;
  originalSpec: ValidatedGameSpec;
  run: GlideState;
  runKind: "original" | "patched";
}): CartridgeData {
  if (input.runKind !== "patched" || input.run.status !== "won") {
    throw new Error("A cartridge needs a completed patched run");
  }
  const factor = input.spec.mechanic.turnRate / input.originalSpec.mechanic.turnRate;
  return {
    title: input.spec.title,
    mechanic: "GLIDE",
    seedId: input.spec.referenceImageId,
    cartridgeLine: input.spec.cartridgeLine,
    ruleLabel: `TURN RATE ×${factor}`,
    completionSeconds: input.run.elapsed,
    path: input.run.path,
    gates: routeOf(courseOf(input.spec)).map((entity) => entity.position),
    originalTurnRate: input.originalSpec.mechanic.turnRate,
    patchedTurnRate: input.spec.mechanic.turnRate,
  };
}

export function cartridgeFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return `anything-play-${slug || "game"}.png`;
}

const W = 1600;
const H = 1000;

function drawCover(
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const scale = Math.max(w / bitmap.width, h / bitmap.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, x, y, w, h);
}

function mmss(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, "0")}`;
}

export async function renderCartridge(
  data: CartridgeData,
  seed: Blob,
  frame: Blob,
): Promise<Blob> {
  const [seedBitmap, frameBitmap] = await Promise.all([
    createImageBitmap(seed),
    createImageBitmap(frame),
  ]);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");

    ctx.fillStyle = "#070909";
    ctx.fillRect(0, 0, W, H);

    const mono = '12px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    ctx.font = mono;
    ctx.fillStyle = "#97a39d";
    ctx.fillText("ORIGINAL SEED", 64, 44);
    ctx.fillText("YOUR WORLD", 816, 44);
    drawCover(ctx, seedBitmap, 64, 64, 720, 405);
    drawCover(ctx, frameBitmap, 816, 64, 720, 405);

    ctx.beginPath();
    ctx.moveTo(0, 520);
    ctx.lineTo(W, 520);
    ctx.lineTo(W, 908);
    ctx.lineTo(W - 28, 936);
    ctx.lineTo(28, 936);
    ctx.lineTo(0, 908);
    ctx.closePath();
    ctx.fillStyle = "#111514";
    ctx.fill();

    ctx.fillStyle = "#f4f7f5";
    ctx.font = '600 56px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillText(data.title, 64, 608);

    ctx.font = mono;
    ctx.fillStyle = "#97a39d";
    ctx.fillText(data.mechanic, 64, 656);
    ctx.fillText(mmss(data.completionSeconds), 64, 690);

    ctx.font = '700 40px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    ctx.fillStyle = "#c7ff4a";
    ctx.fillText(data.ruleLabel, 64, 748);

    ctx.font = '18px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = "#f4f7f5";
    ctx.fillText(data.cartridgeLine, 64, 792);

    const box = { x: 1100, y: 560, w: 360, h: 200 };
    const points = [...data.path, ...data.gates];
    const xs = points.map((p) => p[0]);
    const zs = points.map((p) => p[2]);
    const pad = 12;
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const px = (x: number) =>
      box.x + pad + ((x - minX) / Math.max(1, maxX - minX)) * (box.w - pad * 2);
    const pz = (z: number) =>
      box.y + box.h - pad - ((z - minZ) / Math.max(1, maxZ - minZ)) * (box.h - pad * 2);

    ctx.strokeStyle = "rgba(151, 163, 157, 0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(box.x, box.y, box.w, box.h);

    if (data.path.length > 1) {
      ctx.beginPath();
      ctx.moveTo(px(data.path[0][0]), pz(data.path[0][2]));
      for (const p of data.path.slice(1)) ctx.lineTo(px(p[0]), pz(p[2]));
      ctx.strokeStyle = "#f4f7f5";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.fillStyle = "#c7ff4a";
    for (const g of data.gates) {
      ctx.beginPath();
      ctx.arc(px(g[0]), pz(g[2]), 5, 0, Math.PI * 2);
      ctx.fill();
    }

    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) throw new Error("Cartridge render produced no image");
    return png;
  } finally {
    seedBitmap.close();
    frameBitmap.close();
  }
}
