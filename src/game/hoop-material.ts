import { ABILITY_CALIBRATION, type EnemyKind } from "./abilities.ts";
import { forwardOf, GLIDE_CALIBRATION, type GlideState, type ProxyEntity, type Vec3 } from "./glide.ts";
import type { HoopPalette, HoopScene } from "./hoops.ts";
import type { HoopAppearance } from "./spec.ts";

export type HoopSurface = {
  readonly appearance: HoopAppearance;
  readonly albedo: ImageBitmap | null;
  readonly normal: ImageBitmap | null;
  readonly users: Set<HoopRenderer>;
  released: boolean;
};

const SIZE = 512;
const NEAR = 0.55;
const FAR = 5000;
const MAJOR = 96;
const MINOR = 16;
const renderers = new WeakMap<HTMLCanvasElement, HoopRenderer | null>();
const bitmapOptions: ImageBitmapOptions = { imageOrientation: "flipY", premultiplyAlpha: "none", colorSpaceConversion: "none", resizeWidth: SIZE, resizeHeight: SIZE, resizeQuality: "high" };
const materialNames = new Set(["metal", "stone", "wood", "fabric"]);

async function materialBitmap(material: string, channel: "color" | "normal"): Promise<ImageBitmap | null> {
  if (!materialNames.has(material)) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(`/materials/${material}-${channel}.webp`, { signal: controller.signal, redirect: "error" });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (blob.size > 4 * 1024 * 1024) return null;
    return await createImageBitmap(blob, bitmapOptions);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function referenceBitmap(image: Blob): Promise<ImageBitmap | null> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(image, { resizeWidth: SIZE, resizeHeight: SIZE, resizeQuality: "high" });
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.fillStyle = "#909090";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, SIZE, SIZE);
    const luminance = new Float32Array(SIZE * SIZE);
    for (let i = 0; i < luminance.length; i++) {
      const p = i * 4;
      luminance[i] = (pixels.data[p] * 0.2126 + pixels.data[p + 1] * 0.7152 + pixels.data[p + 2] * 0.0722) / 255;
    }
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const sx = x < SIZE / 2 ? x * 2 : (SIZE - 1 - x) * 2;
        const sy = y < SIZE / 2 ? y * 2 : (SIZE - 1 - y) * 2;
        const light = luminance[sy * SIZE + sx];
        const local = (luminance[sy * SIZE + Math.max(0, sx - 16)] + luminance[sy * SIZE + Math.min(SIZE - 1, sx + 16)] + luminance[Math.max(0, sy - 16) * SIZE + sx] + luminance[Math.min(SIZE - 1, sy + 16) * SIZE + sx]) / 4;
        const value = Math.round(Math.max(0.2, Math.min(0.85, 0.57 + (light - local) * 0.8 + (light - 0.5) * 0.22)) * 255);
        const p = (y * SIZE + x) * 4;
        pixels.data[p] = pixels.data[p + 1] = pixels.data[p + 2] = value;
        pixels.data[p + 3] = 255;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    return await createImageBitmap(canvas, bitmapOptions);
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

export async function loadHoopSurface(image: Blob, appearance: HoopAppearance): Promise<HoopSurface> {
  const [albedo, normal] = await Promise.all([materialBitmap(appearance.material, "color"), materialBitmap(appearance.material, "normal")]);
  const color = albedo ?? await referenceBitmap(image);
  if (!albedo) normal?.close();
  return { appearance: { ...appearance }, albedo: color, normal: albedo ? normal : null, users: new Set(), released: false };
}

export function releaseHoopSurface(surface: HoopSurface): void {
  if (surface.released) return;
  surface.released = true;
  for (const renderer of surface.users) renderer.reset();
  surface.users.clear();
  surface.albedo?.close();
  surface.normal?.close();
}

const vertexSource = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;
uniform vec3 uCenter;
uniform vec3 uScale;
uniform mat3 uRotation;
uniform vec3 uEye;
uniform mat3 uView;
uniform vec2 uFocal;
out vec3 vPosition;
out vec3 vNormal;
out vec2 vUv;
void main() {
  vPosition = uCenter + uRotation * (aPosition * uScale);
  vNormal = normalize(uRotation * (aNormal / uScale));
  vUv = aUv;
  vec3 camera = uView * (vPosition - uEye);
  gl_Position = vec4(camera.xy * uFocal, ${((FAR + NEAR) / (FAR - NEAR)).toFixed(10)} * camera.z - ${((2 * FAR * NEAR) / (FAR - NEAR)).toFixed(10)}, camera.z);
}`;

const fragmentSource = `#version 300 es
precision highp float;
in vec3 vPosition;
in vec3 vNormal;
in vec2 vUv;
uniform sampler2D uAlbedo;
uniform sampler2D uNormal;
uniform vec3 uEye;
uniform vec3 uTint;
uniform vec3 uAccent;
uniform vec3 uSky;
uniform vec3 uGround;
uniform float uTintStrength;
uniform float uRoughness;
uniform float uMetalness;
uniform float uTextureScale;
uniform float uEmissive;
uniform float uActive;
uniform float uRole;
uniform float uFlash;
uniform float uShape;
uniform vec2 uRepeat;
out vec4 outColor;
const float PI = 3.14159265359;
vec3 fresnel(float cosine, vec3 f0) {
  return f0 + (1.0 - f0) * pow(1.0 - cosine, 5.0);
}
vec3 illuminate(vec3 n, vec3 v, vec3 l, vec3 base, vec3 f0, float roughness, vec3 radiance) {
  vec3 h = normalize(v + l);
  float nl = max(dot(n, l), 0.0);
  float nv = max(dot(n, v), 0.001);
  float nh = max(dot(n, h), 0.0);
  float vh = max(dot(v, h), 0.0);
  float a = roughness * roughness;
  float a2 = a * a;
  float d = nh * nh * (a2 - 1.0) + 1.0;
  float distribution = a2 / max(PI * d * d, 0.00001);
  float k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
  float visibility = (nv / (nv * (1.0 - k) + k)) * (nl / (nl * (1.0 - k) + k));
  vec3 f = fresnel(vh, f0);
  vec3 specular = distribution * visibility * f / max(4.0 * nv * nl, 0.001);
  return ((1.0 - f) * (1.0 - uMetalness) * base / PI + specular) * radiance * nl;
}
void main() {
  vec3 n0 = normalize(vNormal);
  vec2 uv = vUv * max(vec2(1.0), round(uRepeat * uTextureScale));
  vec3 dp1 = dFdx(vPosition), dp2 = dFdy(vPosition);
  vec2 duv1 = dFdx(uv), duv2 = dFdy(uv);
  vec3 p2 = cross(dp2, n0), p1 = cross(n0, dp1);
  vec3 tangent = p2 * duv1.x + p1 * duv2.x;
  vec3 bitangent = p2 * duv1.y + p1 * duv2.y;
  float basisScale = inversesqrt(max(max(dot(tangent, tangent), dot(bitangent, bitangent)), 0.00000001));
  vec3 detail = texture(uNormal, uv).xyz * 2.0 - 1.0;
  detail.xy *= uRole > 1.5 ? 0.15 : 0.72;
  vec3 n = normalize(mat3(tangent * basisScale, bitangent * basisScale, n0) * normalize(detail));
  vec3 v = normalize(uEye - vPosition);
  vec3 texel = texture(uAlbedo, uv).rgb;
  float grain = dot(texel, vec3(0.2126, 0.7152, 0.0722));
  vec3 base = mix(texel, uTint * (0.35 + 2.0 * grain), uTintStrength);
  base = clamp(base, vec3(0.015), vec3(0.92));
  float roughness = clamp(uRoughness + (grain - 0.3) * 0.14, 0.08, 1.0);
  vec3 f0 = mix(vec3(0.04), base, uMetalness);
  vec3 color = illuminate(n, v, normalize(vec3(-0.42, 0.58, -0.70)), base, f0, roughness, vec3(3.3));
  color += illuminate(n, v, normalize(vec3(0.75, 0.20, 0.50)), base, f0, roughness, uSky * 1.3 + 0.25);
  vec3 hemisphere = mix(uGround * 0.35 + 0.06, uSky * 0.65 + 0.22, n.y * 0.5 + 0.5);
  color += base * hemisphere * (1.0 - uMetalness) * 0.75;
  vec3 reflection = reflect(-v, n);
  vec3 environment = mix(uGround * 0.4 + 0.045, uSky * 0.9 + 0.16, smoothstep(-0.55, 0.8, reflection.y));
  float softbox = pow(max(dot(reflection, normalize(vec3(-0.4, 0.65, -0.65))), 0.0), mix(90.0, 3.0, roughness));
  environment += (uSky + 0.5) * softbox * (1.0 - roughness * 0.6);
  color += environment * fresnel(max(dot(n, v), 0.0), f0) * (1.0 - roughness * 0.45);
  float rimDistance = abs(vUv.y - 0.61);
  float rimAA = max(fwidth(vUv.y), 0.001);
  float rim = 1.0 - smoothstep(0.013 - rimAA, 0.013 + rimAA, rimDistance);
  float arc = abs(fract(vUv.x * 4.0 + 0.125) - 0.5);
  float arcAA = max(fwidth(vUv.x) * 4.0, 0.001);
  float accent = rim * (1.0 - smoothstep(0.14 - arcAA, 0.14 + arcAA, arc)) * uActive;
  color = mix(color, uAccent * (0.6 + max(dot(n, normalize(vec3(-0.42, 0.58, -0.7))), 0.0)), accent * 0.75);
  color += uAccent * accent * uEmissive * 1.8;
  color = color / (color + vec3(0.65));
  outColor = vec4(pow(max(color, vec3(0.0)), vec3(1.0 / 2.2)), 1.0);
}`;

function unitMesh(): { vertices: Float32Array; indices: Uint16Array } {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let u = 0; u <= MAJOR; u++) {
    const angle = u / MAJOR * Math.PI * 2;
    const c = Math.cos(angle), s = Math.sin(angle);
    for (let v = 0; v <= MINOR; v++) {
      const cross = v / MINOR * Math.PI * 2;
      const cv = Math.cos(cross), sv = Math.sin(cross);
      const radial = 1.12 + 0.12 * cv;
      vertices.push(radial * c, radial * s, 0.12 * sv, c * cv, s * cv, sv, u / MAJOR, v / MINOR);
      if (u < MAJOR && v < MINOR) {
        const a = u * (MINOR + 1) + v, b = a + MINOR + 1;
        indices.push(a, b, b + 1, a, b + 1, a + 1);
      }
    }
  }
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
}

function linearColor(hex: string | null, fallback: readonly number[]): [number, number, number] {
  const channels = hex && /^#[0-9a-f]{6}$/i.test(hex) ? [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) : fallback;
  return channels.map((channel) => Math.pow(channel / 255, 2.2)) as [number, number, number];
}

class HoopRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buffers: WebGLBuffer[] = [];
  private textures: WebGLTexture[] = [];
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private surface: HoopSurface | null = null;
  private failed = false;

  constructor(target: HTMLCanvasElement) {
    this.canvas = document.createElement("canvas");
    const gl = this.canvas.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: true, depth: true });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl = gl;
    this.canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.reset();
    });
    this.canvas.addEventListener("webglcontextrestored", () => { this.failed = false; });
    target.addEventListener("dispose", () => {
      this.reset();
      this.canvas.width = this.canvas.height = 1;
    });
  }

  reset(): void {
    const gl = this.gl;
    gl.useProgram(null);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    this.textures.forEach((texture, unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.deleteTexture(texture);
    });
    for (const buffer of this.buffers) gl.deleteBuffer(buffer);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
    this.textures = [];
    this.buffers = [];
    this.vao = null;
    this.program = null;
    this.uniforms = {};
    this.surface?.users.delete(this);
    this.surface = null;
  }

  private initialize(): void {
    const gl = this.gl;
    const shaders: WebGLShader[] = [];
    try {
      this.program = gl.createProgram();
      if (!this.program) throw new Error("Hoop program unavailable");
      for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]] as const) {
        const shader = gl.createShader(type);
        if (!shader) throw new Error("Hoop shader unavailable");
        shaders.push(shader);
        gl.attachShader(this.program, shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error("Hoop shader compilation failed");
      }
      gl.linkProgram(this.program);
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error("Hoop program link failed");
    } finally {
      for (const shader of shaders) {
        if (this.program) gl.detachShader(this.program, shader);
        gl.deleteShader(shader);
      }
    }
    this.vao = gl.createVertexArray();
    if (!this.vao) throw new Error("Hoop geometry unavailable");
    gl.bindVertexArray(this.vao);
    const mesh = unitMesh();
    for (const [target, data] of [[gl.ARRAY_BUFFER, mesh.vertices], [gl.ELEMENT_ARRAY_BUFFER, mesh.indices]] as const) {
      const buffer = gl.createBuffer();
      if (!buffer) throw new Error("Hoop buffer unavailable");
      this.buffers.push(buffer);
      gl.bindBuffer(target, buffer);
      gl.bufferData(target, data, gl.STATIC_DRAW);
    }
    for (const [location, size, offset] of [[0, 3, 0], [1, 3, 12], [2, 2, 24]]) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 32, offset);
    }
    for (const name of ["uCenter", "uRadius", "uEye", "uView", "uFocal", "uAlbedo", "uNormal", "uTint", "uAccent", "uSky", "uGround", "uTintStrength", "uRoughness", "uMetalness", "uTextureScale", "uEmissive", "uActive"]) {
      this.uniforms[name] = gl.getUniformLocation(this.program!, name);
    }
  }

  private upload(surface: HoopSurface): void {
    const gl = this.gl;
    for (const texture of this.textures) gl.deleteTexture(texture);
    this.textures = [];
    this.surface?.users.delete(this);
    this.surface = surface;
    surface.users.add(this);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    const anisotropy = gl.getExtension("EXT_texture_filter_anisotropic");
    for (const [unit, bitmap] of [surface.albedo, surface.normal].entries()) {
      const texture = gl.createTexture();
      if (!texture) throw new Error("Hoop texture unavailable");
      this.textures.push(texture);
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      const format = unit === 0 ? gl.SRGB8_ALPHA8 : gl.RGBA8;
      if (bitmap) gl.texImage2D(gl.TEXTURE_2D, 0, format, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
      else gl.texImage2D(gl.TEXTURE_2D, 0, format, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(unit === 0 ? [150, 150, 150, 255] : [128, 128, 255, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (anisotropy) gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    if (gl.getError() !== gl.NO_ERROR) throw new Error("Hoop texture upload failed");
  }

  draw(ctx: CanvasRenderingContext2D, state: GlideState, route: readonly ProxyEntity[], palette: HoopPalette, surface: HoopSurface): boolean {
    const gl = this.gl;
    if (surface.released || this.failed || gl.isContextLost()) return false;
    try {
      if (!this.program) this.initialize();
      if (this.surface !== surface) this.upload(surface);
      const width = ctx.canvas.width, height = ctx.canvas.height;
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clearDepth(1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.CULL_FACE);
      gl.frontFace(gl.CW);
      gl.cullFace(gl.BACK);
      gl.disable(gl.BLEND);
      gl.useProgram(this.program);
      gl.bindVertexArray(this.vao);
      this.textures.forEach((texture, unit) => {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
      });
      const u = this.uniforms;
      const appearance = surface.appearance;
      const cy = Math.cos(state.yaw), sy = Math.sin(state.yaw), cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
      const forward = forwardOf(state.yaw, state.pitch);
      const focal = 1 / Math.tan(GLIDE_CALIBRATION.verticalFovRad / 2);
      gl.uniformMatrix3fv(u.uView, false, [cy, -sy * sp, forward[0], 0, cp, forward[1], -sy, -cy * sp, forward[2]]);
      gl.uniform2f(u.uFocal, focal * height / width, focal);
      gl.uniform3f(u.uEye, ...state.position);
      gl.uniform1i(u.uAlbedo, 0);
      gl.uniform1i(u.uNormal, 1);
      gl.uniform3fv(u.uTint, linearColor(appearance.color, palette.midtone));
      gl.uniform3fv(u.uAccent, linearColor(appearance.accentColor, palette.highlight));
      gl.uniform3fv(u.uSky, linearColor(null, palette.highlight));
      gl.uniform3fv(u.uGround, linearColor(null, palette.shadow));
      gl.uniform1f(u.uTintStrength, appearance.color ? 0.8 : appearance.material === "reference" ? 0.85 : 0.45);
      gl.uniform1f(u.uRoughness, appearance.roughness);
      gl.uniform1f(u.uMetalness, appearance.metalness);
      gl.uniform1f(u.uTextureScale, appearance.textureScale);
      gl.uniform1f(u.uEmissive, appearance.emissive);
      for (let index = state.activeGate; index < route.length; index++) {
        const gate = route[index];
        const depth = (gate.position[0] - state.position[0]) * forward[0] + (gate.position[1] - state.position[1]) * forward[1] + (gate.position[2] - state.position[2]) * forward[2];
        if (depth + gate.radius * 1.24 <= NEAR || depth - gate.radius * 1.24 >= FAR) continue;
        gl.uniform3f(u.uCenter, ...gate.position);
        gl.uniform1f(u.uRadius, gate.radius);
        gl.uniform1f(u.uActive, index === state.activeGate ? 1 : 0);
        gl.drawElements(gl.TRIANGLES, MAJOR * MINOR * 6, gl.UNSIGNED_SHORT, 0);
      }
      if (gl.isContextLost()) return false;
      if (gl.getError() !== gl.NO_ERROR) throw new Error("Hoop rendering unavailable");
      ctx.drawImage(this.canvas, 0, 0, width, height);
      return true;
    } catch {
      this.reset();
      this.failed = true;
      return false;
    }
  }
}

export function drawHoopSurface(ctx: CanvasRenderingContext2D, state: GlideState, route: readonly ProxyEntity[], palette: HoopPalette, surface: HoopSurface): boolean {
  if (surface.released || typeof document === "undefined") return false;
  let renderer = renderers.get(ctx.canvas);
  if (renderer === undefined) {
    try {
      renderer = new HoopRenderer(ctx.canvas);
    } catch {
      renderer = null;
    }
    renderers.set(ctx.canvas, renderer);
  }
  return renderer?.draw(ctx, state, route, palette, surface) ?? false;
}
