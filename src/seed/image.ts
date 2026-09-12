export type PreparedImage = {
  id: string;
  mimeType: "image/webp";
  width: 1664;
  height: 960;
  normalized: Blob;
  original: Blob;
  originalName: string;
  previewUrl: string;
};

export const SOURCE_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  types: ["image/png", "image/jpeg", "image/webp"] as const,
  normalizedMaxBytes: 4 * 1024 * 1024,
};

export class PrepareImageError extends Error {
  code: "type" | "size" | "decode" | "encode";
  constructor(code: "type" | "size" | "decode" | "encode", message: string) {
    super(message);
    this.name = "PrepareImageError";
    this.code = code;
  }
}

const FIXTURE_URL = "/fixtures/glide-ink-islands.webp";
const NORMALIZED_WIDTH = 1664;
const NORMALIZED_HEIGHT = 960;

export async function sha256Hex(data: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function prepareImage(source: Blob, originalName: string): Promise<PreparedImage> {
  if (!(SOURCE_LIMITS.types as readonly string[]).includes(source.type)) {
    throw new PrepareImageError("type", "Please choose a PNG, JPEG or WebP image.");
  }
  if (source.size > SOURCE_LIMITS.maxBytes) {
    throw new PrepareImageError("size", "That image is over 10 MB.");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  } catch {
    throw new PrepareImageError("decode", "That file could not be decoded as an image.");
  }
  try {
    const targetAspect = NORMALIZED_WIDTH / NORMALIZED_HEIGHT;
    const sourceAspect = bitmap.width / bitmap.height;
    let sw = bitmap.width;
    let sh = bitmap.height;
    if (sourceAspect > targetAspect) sw = Math.round(bitmap.height * targetAspect);
    else sh = Math.round(bitmap.width / targetAspect);
    const sx = Math.round((bitmap.width - sw) / 2);
    const sy = Math.round((bitmap.height - sh) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = NORMALIZED_WIDTH;
    canvas.height = NORMALIZED_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new PrepareImageError("encode", "Could not prepare that image.");
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, NORMALIZED_WIDTH, NORMALIZED_HEIGHT);
    const normalized = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.9),
    );
    if (!normalized || normalized.size > SOURCE_LIMITS.normalizedMaxBytes) {
      throw new PrepareImageError("encode", "Could not prepare that image.");
    }
    return {
      id: await sha256Hex(await source.arrayBuffer()),
      mimeType: "image/webp",
      width: NORMALIZED_WIDTH,
      height: NORMALIZED_HEIGHT,
      normalized,
      original: source,
      originalName,
      previewUrl: URL.createObjectURL(source),
    };
  } finally {
    bitmap.close();
  }
}

export async function loadFixtureImage(url: string = FIXTURE_URL): Promise<PreparedImage> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Seed image fetch failed (${response.status})`);
  const blob = await response.blob();
  if (blob.type !== "image/webp") {
    throw new Error(`Seed image must be WebP, got ${blob.type || "unknown"}`);
  }
  const id = await sha256Hex(await blob.arrayBuffer());
  return {
    id,
    mimeType: "image/webp",
    width: 1664,
    height: 960,
    normalized: blob,
    original: blob,
    originalName: url.split("/").pop() ?? "seed.webp",
    previewUrl: URL.createObjectURL(blob),
  };
}

export function releasePreparedImage(image: PreparedImage): void {
  URL.revokeObjectURL(image.previewUrl);
}

export function seedFromImageId(id: string): number {
  return parseInt(id.slice(0, 8), 16);
}
