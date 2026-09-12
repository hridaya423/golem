import { ABILITY_CALIBRATION, ENEMY_LABELS, type AbilityState } from "./abilities.ts";
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
    const disc = (x: number, y: number, rx: number, ry: number, fill: string, stroke: string) => {
      ctx.beginPath();
      ctx.ellipse(x * size, y * size, rx * size, ry * size, 0, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = unit;
      ctx.stroke();
    };
    if (target.kind === "scout") {
      face([[-1.05, -0.36], [-0.4, -0.2], [-0.4, 0], [-0.95, -0.12]], midtone);
      face([[1.05, -0.36], [0.4, -0.2], [0.4, 0], [0.95, -0.12]], shadow);
      for (const side of [-1, 1]) disc(side * 1.05, -0.4, 0.36, 0.11, shadow, highlight);
      face([[0, -0.52], [-0.44, -0.16], [-0.34, 0.3], [0.34, 0.3], [0.44, -0.16]], midtone);
      face([[0, -0.52], [0.44, -0.16], [0.34, 0.3], [0, 0.16]], shadow);
      disc(0, -0.08, 0.14, 0.14, highlight, shadow);
    } else if (target.kind === "striker") {
      face([[-0.14, -0.26], [-1.02, 0.16], [-0.96, 0.5], [-0.18, 0.32]], midtone);
      face([[0.14, -0.26], [1.02, 0.16], [0.96, 0.5], [0.18, 0.32]], shadow);
      face([[-0.12, 0.38], [-0.4, 0.76], [-0.08, 0.68]], midtone);
      face([[0.12, 0.38], [0.4, 0.76], [0.08, 0.68]], shadow);
      face([[0, -0.95], [-0.16, -0.2], [-0.12, 0.45], [0, 0.58], [0.12, 0.45], [0.16, -0.2]], highlight);
      ctx.fillStyle = shadow;
      ctx.fillRect(-size * 0.05, -size * 0.44, size * 0.1, size * 0.3);
    } else {
      face([[0, -0.9], [-0.78, -0.46], [-0.9, 0.18], [-0.46, 0.78], [0.46, 0.78], [0.9, 0.18], [0.78, -0.46]], midtone);
      face([[0, -0.9], [0.78, -0.46], [0.9, 0.18], [0.46, 0.78], [0, 0.58]], shadow);
      face([[0, -0.6], [-0.4, -0.3], [-0.44, 0.14], [0, 0.42], [0.44, 0.14], [0.4, -0.3]], highlight);
      for (const [rx, ry] of [[-0.52, -0.1], [0.52, -0.1], [-0.26, 0.5], [0.26, 0.5]] as const) disc(rx, ry, 0.08, 0.08, shadow, midtone);
    }
    if (target.hitFlash > 0) {
      ctx.globalAlpha *= 0.35 + 0.65 * (target.hitFlash / ABILITY_CALIBRATION.hitFlashDuration);
      disc(0, 0, 1.1, 1.1, highlight, highlight);
      ctx.globalAlpha = Math.min(1, ABILITY_CALIBRATION.fireRange / p.depth);
    }
    if (p.depth <= ABILITY_CALIBRATION.fireRange) {
      ctx.fillStyle = highlight;
      ctx.font = `600 ${12 * unit}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.shadowColor = shadow;
      ctx.shadowBlur = 4 * unit;
      ctx.fillText(ENEMY_LABELS[target.kind].toUpperCase(), 0, -size - 12 * unit);
      ctx.shadowBlur = 0;
      const pips = target.maxHp;
      for (let hp = 0; hp < pips; hp++) {
        ctx.fillStyle = hp < target.hp ? highlight : shadow;
        ctx.fillRect((hp - (pips - 1) / 2) * 9 * unit - 3.5 * unit, size + 5 * unit, 7 * unit, 3 * unit);
      }
    }
    ctx.restore();
  }

  const active = player.status === "running" && state.lastRespawns === player.respawns;
  if (active && state.grappleAnchor && state.lastActiveGate === player.activeGate) {
    const anchor = projectPoint(state.grappleAnchor, player, width, height);
    if (anchor) {
      const x = width * 0.31, y = height * 0.92;
      const length = Math.hypot(anchor.x - x, anchor.y - y);
      const sag = Math.min(length * 0.05, height * 0.045) + 2 * unit;
      const cx = (x + anchor.x) / 2, cy = (y + anchor.y) / 2 + sag;
      const rope = (lineWidth: number, color: string, dash?: number[]) => {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(cx, cy, anchor.x, anchor.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        if (dash) ctx.setLineDash(dash);
        ctx.stroke();
        ctx.setLineDash([]);
      };
      rope(6 * unit, shadow);
      rope(3.4 * unit, midtone);
      rope(1.3 * unit, highlight, [5 * unit, 4 * unit]);
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, 5.5 * unit, 0, Math.PI * 2);
      ctx.strokeStyle = highlight;
      ctx.lineWidth = 2.2 * unit;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, 2.2 * unit, 0, Math.PI * 2);
      ctx.strokeStyle = midtone;
      ctx.lineWidth = 1.2 * unit;
      ctx.stroke();
      const handAngle = Math.atan2(cy - y, cx - x);
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(handAngle) * 9 * unit, y - Math.sin(handAngle) * 9 * unit);
      ctx.lineTo(x, y);
      ctx.strokeStyle = shadow;
      ctx.lineWidth = 7 * unit;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.lineCap = "butt";
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
