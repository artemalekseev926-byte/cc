/**
 * Canvas 2D particle systems. Sprites are pre-rendered once per color/size so
 * each frame is just a batch of drawImage calls.
 */
import type { ParticlesLayer } from '../../shared/theme/schema';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  rot: number;
  vr: number;
  alpha: number;
}

function sprite(preset: ParticlesLayer['preset'], color: string, radius: number): HTMLCanvasElement {
  const pad = preset === 'fireflies' ? radius * 4 : radius;
  const size = Math.ceil((radius + pad) * 2);
  const c = document.createElement('canvas');
  c.width = c.height = Math.max(2, size);
  const g = c.getContext('2d')!;
  const mid = size / 2;
  switch (preset) {
    case 'fireflies': {
      const grad = g.createRadialGradient(mid, mid, 0, mid, mid, mid);
      grad.addColorStop(0, color);
      grad.addColorStop(0.15, color);
      grad.addColorStop(1, 'transparent');
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      break;
    }
    case 'bubbles': {
      g.strokeStyle = color;
      g.lineWidth = Math.max(1, radius * 0.12);
      g.globalAlpha = 0.8;
      g.beginPath();
      g.arc(mid, mid, radius * 0.9, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 0.5;
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(mid - radius * 0.35, mid - radius * 0.35, radius * 0.18, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'sakura': {
      g.fillStyle = color;
      g.beginPath();
      g.ellipse(mid, mid, radius, radius * 0.55, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 0.35;
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(mid - radius * 0.2, mid, radius * 0.5, radius * 0.18, 0, 0, Math.PI * 2);
      g.fill();
      break;
    }
    default: {
      const grad = g.createRadialGradient(mid, mid, 0, mid, mid, mid);
      grad.addColorStop(0, color);
      grad.addColorStop(0.6, color);
      grad.addColorStop(1, 'transparent');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(mid, mid, mid, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private sprite: HTMLCanvasElement | null = null;
  private spriteKey = '';
  private width = 0;
  private height = 0;
  private cursor: { x: number; y: number } | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private layer: ParticlesLayer,
    /** Visual scale relative to the target display (the editor preview is a miniature). */
    private scale: number,
  ) {}

  update(layer: ParticlesLayer, scale: number) {
    const countChanged = layer.count !== this.layer.count || layer.preset !== this.layer.preset;
    this.layer = layer;
    this.scale = scale;
    if (countChanged) this.reset();
  }

  setCursor(pos: { x: number; y: number } | null) {
    this.cursor = pos;
  }

  resize(width: number, height: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    this.canvas.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
    const first = this.width === 0;
    this.width = width;
    this.height = height;
    if (first || this.particles.length === 0) this.reset();
  }

  private ensureSprite() {
    const radius = Math.max(1, 2.2 * this.layer.size * Math.max(this.scale, 0.35));
    const key = `${this.layer.preset}|${this.layer.color}|${radius.toFixed(1)}`;
    if (key !== this.spriteKey) {
      this.sprite = sprite(this.layer.preset, this.layer.color, radius);
      this.spriteKey = key;
    }
  }

  private spawn(randomY: boolean): Particle {
    const { preset } = this.layer;
    const w = this.width;
    const h = this.height;
    const p: Particle = {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : -10,
      vx: 0,
      vy: 0,
      size: 0.5 + Math.random(),
      phase: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 2,
      alpha: 0.4 + Math.random() * 0.6,
    };
    switch (preset) {
      case 'snow':
        p.vy = 20 + Math.random() * 40;
        p.vx = (Math.random() - 0.5) * 10;
        break;
      case 'rain':
        p.vy = 500 + Math.random() * 300;
        p.vx = 60;
        break;
      case 'fireflies':
        p.vx = (Math.random() - 0.5) * 20;
        p.vy = (Math.random() - 0.5) * 20;
        break;
      case 'stars':
        p.vx = 2 + Math.random() * 3;
        break;
      case 'bubbles':
        p.y = randomY ? Math.random() * h : h + 20;
        p.vy = -(20 + Math.random() * 40);
        break;
      case 'sakura':
        p.vy = 25 + Math.random() * 35;
        p.vx = 20 + Math.random() * 30;
        break;
    }
    return p;
  }

  reset() {
    if (!this.width) return;
    this.particles = Array.from({ length: this.layer.count }, () => this.spawn(true));
  }

  step(t: number, dt: number) {
    const ctx = this.canvas.getContext('2d');
    if (!ctx || !this.width) return;
    this.ensureSprite();
    const sprite = this.sprite!;
    const { preset, speed, interactive } = this.layer;
    const w = this.width;
    const h = this.height;
    const s = Math.max(this.scale, 0.2);
    const k = dt * speed * s;
    ctx.clearRect(0, 0, w, h);

    const cursor = interactive && this.cursor ? { x: this.cursor.x * w, y: this.cursor.y * h } : null;
    const repelR = 140 * s;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      let dx = p.vx * k;
      let dy = p.vy * k;
      if (preset === 'snow' || preset === 'sakura') dx += Math.sin(t * 1.2 + p.phase) * 15 * k;
      if (preset === 'fireflies') {
        dx += Math.sin(t * 0.7 + p.phase) * 12 * k;
        dy += Math.cos(t * 0.5 + p.phase * 1.3) * 12 * k;
      }
      if (cursor) {
        const ox = p.x - cursor.x;
        const oy = p.y - cursor.y;
        const d2 = ox * ox + oy * oy;
        if (d2 < repelR * repelR && d2 > 1) {
          const f = (1 - Math.sqrt(d2) / repelR) * 180 * dt;
          const d = Math.sqrt(d2);
          dx += (ox / d) * f;
          dy += (oy / d) * f;
        }
      }
      p.x += dx;
      p.y += dy;
      p.rot += p.vr * dt;

      // Wrap / respawn
      if (preset === 'bubbles') {
        if (p.y < -30) Object.assign(p, this.spawn(false));
      } else if (preset === 'fireflies' || preset === 'stars') {
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;
      } else if (p.y > h + 20 || p.x > w + 40) {
        Object.assign(p, this.spawn(false));
        p.x = Math.random() * (w + 200) - 200;
      }

      let alpha = p.alpha;
      if (preset === 'stars') alpha *= 0.55 + 0.45 * Math.sin(t * 2 + p.phase * 5);
      if (preset === 'fireflies') alpha *= 0.4 + 0.6 * Math.max(0, Math.sin(t * 1.5 + p.phase));
      ctx.globalAlpha = alpha;

      if (preset === 'rain') {
        ctx.strokeStyle = this.layer.color;
        ctx.lineWidth = Math.max(0.5, this.layer.size * s);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03 * s, p.y - p.vy * 0.03 * s);
        ctx.stroke();
        continue;
      }

      const size = sprite.width * p.size;
      if (preset === 'sakura') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
        ctx.restore();
      } else {
        ctx.drawImage(sprite, p.x - size / 2, p.y - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }
}
