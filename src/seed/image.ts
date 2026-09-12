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

const FIXTURE_URL = "/fixtures/glide-ink-islands.webp";

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
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
