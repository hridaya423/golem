import { ABILITY_CALIBRATION, type AbilityState } from "./abilities.ts";
import { forwardOf, projectPoint, type GlideState, type Vec3 } from "./glide.ts";
import type { HoopPalette } from "./hoops.ts";

const NEUTRAL_PALETTE: HoopPalette = { shadow: [28, 28, 28], midtone: [120, 120, 120], highlight: [238, 238, 238] };

export function drawAbilities(ctx: CanvasRenderingContext2D, state: AbilityState, player: GlideState, palette: HoopPalette = NEUTRAL_PALETTE): void {
  const { width, height } = ctx.canvas;
  const [shadow, midtone, highlight] = [palette.shadow, palette.midtone, palette.highlight].map((color) => `rgb(${color.map(Math.round).join(", ")})`);
  const unit = Math.max(1, height / 900);
  ctx.save();
  const targets = state.targets
    .filter((target) => target.hp > 0)
    .map((target) => ({ target, p: projectPoint(target.position, player, width, height) }))
    .filter(({ p }) => p !== null && p.depth < ABILITY_CALIBRATION.fireRange * 2)
    .sort((a, b) => b.p!.depth - a.p!.depth);
  for (const { target, p } of targets) {
    if (!p) continue;
    const size = Math.min(target.radius * p.scale, height * 0.15);
    if (p.x < -size * 2 || p.x > width + size * 2 || p.y < -size * 2 || p.y > height + size * 2) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = Math.min(1, ABILITY_CALIBRATION.fireRange / p.depth);
    const face = (points: readonly (readonly [number, number])[], fill: string) => {
      ctx.beginPath();
      points.forEach(([x, y], index) => index === 0 ? ctx.moveTo(x * size, y * size) : ctx.lineTo(x * size, y * size));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = shadow;
      ctx.lineWidth = unit;
      ctx.stroke();
    };
    face([[-0.45, -0.12], [-1, -0.42], [-0.9, 0.35], [-0.35, 0.2]], midtone);
    face([[0.45, -0.12], [1, -0.42], [0.9, 0.35], [0.35, 0.2]], shadow);
    face([[0, -0.75], [-0.55, -0.15], [0, 0.12], [0.55, -0.15]], highlight);
    face([[-0.55, -0.15], [0, 0.12], [0, 0.65], [-0.48, 0.3]], midtone);
    face([[0.55, -0.15], [0, 0.12], [0, 0.65], [0.48, 0.3]], shadow);
    ctx.fillStyle = target.hp === 1 ? highlight : midtone;
    ctx.fillRect(-size * 0.24, -size * 0.09, size * 0.48, size * 0.14);
    if (p.depth <= ABILITY_CALIBRATION.fireRange) {
      ctx.fillStyle = highlight;
      ctx.font = `600 ${12 * unit}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.shadowColor = shadow;
      ctx.shadowBlur = 4 * unit;
      ctx.fillText(target.id.replace("sentinel-", "SENTINEL "), 0, -size - 12 * unit);
      ctx.shadowBlur = 0;
      for (let hp = 0; hp < ABILITY_CALIBRATION.targetHp; hp++) {
        ctx.fillStyle = hp < target.hp ? highlight : shadow;
        ctx.fillRect((hp - 1) * 9 * unit + unit, size + 5 * unit, 7 * unit, 3 * unit);
      }
    }
    ctx.restore();
  }

  const active = player.status === "running" && state.lastRespawns === player.respawns;
  if (active && state.grappleAnchor && state.lastActiveGate === player.activeGate) {
    const anchor = projectPoint(state.grappleAnchor, player, width, height);
    if (anchor) {
      const x = width * 0.31, y = height * 0.92;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo((x + anchor.x) / 2, (y + anchor.y) / 2 + height * 0.025, anchor.x, anchor.y);
      ctx.strokeStyle = shadow;
      ctx.lineWidth = 5 * unit;
      ctx.stroke();
      ctx.strokeStyle = highlight;
      ctx.lineWidth = 2 * unit;
      ctx.stroke();
      ctx.fillStyle = highlight;
      ctx.strokeStyle = shadow;
      ctx.fillRect(anchor.x - 4 * unit, anchor.y - 4 * unit, 8 * unit, 8 * unit);
      ctx.strokeRect(anchor.x - 4 * unit, anchor.y - 4 * unit, 8 * unit, 8 * unit);
    }
  }

  if (active && state.shotTrace) {
    const trace = state.shotTrace;
    const endpoint = projectPoint(trace.to, player, width, height);
    const forward = forwardOf(player.yaw, player.pitch);
    const muzzle: Vec3 = [player.position[0] + forward[0] * 2, player.position[1] + forward[1] * 2 - 0.6, player.position[2] + forward[2] * 2];
    const origin = projectPoint(trace.from, player, width, height) ?? projectPoint(muzzle, player, width, height);
    if (endpoint && origin) {
      ctx.globalAlpha = trace.remaining / ABILITY_CALIBRATION.traceDuration;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(endpoint.x, endpoint.y);
      ctx.strokeStyle = midtone;
      ctx.lineWidth = 4 * unit;
      ctx.stroke();
      ctx.strokeStyle = highlight;
      ctx.lineWidth = unit;
      ctx.stroke();
      if (trace.hitTargetId) {
        const radius = (trace.destroyed ? 23 : 12) * unit;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI / 3;
          ctx.moveTo(endpoint.x + Math.cos(angle) * radius * 0.4, endpoint.y + Math.sin(angle) * radius * 0.4);
          ctx.lineTo(endpoint.x + Math.cos(angle) * radius, endpoint.y + Math.sin(angle) * radius);
        }
        ctx.strokeStyle = highlight;
        ctx.lineWidth = 2 * unit;
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}
