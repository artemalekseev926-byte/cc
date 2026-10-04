/**
 * WebGL fragment-shader backgrounds. Each preset is a single full-screen
 * fragment shader driven by time and two theme colors. Rendering happens at a
 * reduced internal resolution (`quality`) and is upscaled by the compositor —
 * visually almost identical for these soft effects, and far cheaper on the GPU.
 */
import { hexToRgb } from '../../shared/color';
import type { ShaderLayer, ShaderPreset } from '../../shared/theme/schema';

const HEADER = `
precision mediump float;
uniform float u_time;
uniform vec2 u_res;
uniform vec3 u_a;
uniform vec3 u_b;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}
`;

const FRAGMENTS: Record<ShaderPreset, string> = {
  aurora: `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float t = u_time * 0.15;
  float a = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float y = 0.55 + 0.12 * fi + 0.08 * sin(uv.x * (3.0 + fi) + t * (1.0 + fi * 0.3)) + 0.1 * fbm(vec2(uv.x * 2.0 + t, fi));
    float band = exp(-pow((uv.y - y) * (9.0 - fi * 2.0), 2.0));
    a += band * (0.6 - fi * 0.15);
  }
  float rays = 0.6 + 0.4 * fbm(vec2(uv.x * 12.0, t * 2.0));
  vec3 col = mix(u_a, u_b, smoothstep(0.4, 0.9, uv.y)) * a * rays;
  gl_FragColor = vec4(col, clamp(a * rays, 0.0, 1.0));
}`,
  waves: `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float t = u_time * 0.4;
  float v = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float y = 0.2 + fi * 0.12 + 0.04 * sin(uv.x * (4.0 + fi * 1.7) + t * (1.0 + fi * 0.25) + fi);
    v += smoothstep(0.012, 0.0, abs(uv.y - y)) * (1.0 - fi * 0.12);
    v += 0.15 * smoothstep(0.25, 0.0, uv.y - y) * step(uv.y, y + 0.25) * 0.2;
  }
  vec3 col = mix(u_a, u_b, uv.y + 0.2 * sin(t + uv.x * 3.0)) * (0.35 + v);
  gl_FragColor = vec4(col, 1.0);
}`,
  plasma: `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res * 4.0;
  float t = u_time * 0.5;
  float v = sin(uv.x + t) + sin((uv.y + t) * 0.7) + sin((uv.x + uv.y + t) * 0.6) + sin(length(uv - 2.0) * 1.5 - t);
  float m = 0.5 + 0.5 * sin(v * 1.5);
  gl_FragColor = vec4(mix(u_a, u_b, m), 1.0);
}`,
  nebula: `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  uv.x *= u_res.x / u_res.y;
  float t = u_time * 0.03;
  vec2 q = vec2(fbm(uv * 2.0 + t), fbm(uv * 2.0 - t + 5.2));
  float f = fbm(uv * 2.5 + q * 2.0 + t);
  vec3 col = mix(vec3(0.0), u_a, smoothstep(0.2, 0.7, f));
  col = mix(col, u_b, smoothstep(0.55, 0.95, f) * q.x);
  float stars = step(0.997, hash(floor(gl_FragCoord.xy * 0.5)));
  gl_FragColor = vec4(col + stars * 0.8, 1.0);
}`,
  grid: `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float horizon = 0.42;
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  if (uv.y < horizon) {
    float depth = (horizon - uv.y);
    float z = 0.3 / depth;
    float x = (uv.x - 0.5) * z * 2.0;
    float gz = fract(z - u_time * 0.6);
    float gx = fract(x);
    float line = max(smoothstep(0.06 * z, 0.0, abs(gx - 0.5) - 0.47), smoothstep(0.06, 0.0, abs(gz - 0.5) - 0.44));
    float fade = smoothstep(0.0, 0.25, depth);
    col = u_a * line * fade;
    alpha = line * fade;
  } else {
    vec2 c = vec2(0.5, horizon + 0.18);
    float d = length((uv - c) * vec2(u_res.x / u_res.y, 1.0));
    float sun = smoothstep(0.16, 0.155, d);
    float stripes = step(0.5, fract((uv.y - horizon) * 40.0)) + step(horizon + 0.12, uv.y);
    col = mix(u_b, u_a, (uv.y - horizon) * 3.0) * sun * min(stripes, 1.0);
    alpha = sun * min(stripes, 1.0);
  }
  gl_FragColor = vec4(col, alpha);
}`,
};

const VERTEX = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

export class ShaderRenderer {
  private gl: WebGLRenderingContext | null;
  private program: WebGLProgram | null = null;
  private preset: ShaderPreset | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private cssWidth = 0;
  private cssHeight = 0;

  constructor(private readonly canvas: HTMLCanvasElement, private layer: ShaderLayer) {
    this.gl = canvas.getContext('webgl', { premultipliedAlpha: false, antialias: false, powerPreference: 'low-power' });
    this.compile();
  }

  get supported() {
    return this.gl !== null;
  }

  update(layer: ShaderLayer) {
    const qualityChanged = layer.quality !== this.layer.quality;
    this.layer = layer;
    if (layer.preset !== this.preset) this.compile();
    if (qualityChanged) this.resize(this.cssWidth, this.cssHeight);
  }

  resize(width: number, height: number) {
    this.cssWidth = width;
    this.cssHeight = height;
    const q = this.layer.quality;
    this.canvas.width = Math.max(1, Math.round(width * q));
    this.canvas.height = Math.max(1, Math.round(height * q));
    this.gl?.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  private compile() {
    const gl = this.gl;
    if (!gl) return;
    const make = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
      return s;
    };
    if (this.program) gl.deleteProgram(this.program);
    const program = gl.createProgram()!;
    gl.attachShader(program, make(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, make(gl.FRAGMENT_SHADER, HEADER + FRAGMENTS[this.layer.preset]));
    gl.linkProgram(program);
    gl.useProgram(program);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.uniforms = {
      time: gl.getUniformLocation(program, 'u_time'),
      res: gl.getUniformLocation(program, 'u_res'),
      a: gl.getUniformLocation(program, 'u_a'),
      b: gl.getUniformLocation(program, 'u_b'),
    };
    this.program = program;
    this.preset = this.layer.preset;
  }

  draw(t: number) {
    const gl = this.gl;
    if (!gl || !this.program) return;
    const a = hexToRgb(this.layer.colorA);
    const b = hexToRgb(this.layer.colorB);
    gl.uniform1f(this.uniforms.time, t * this.layer.speed);
    gl.uniform2f(this.uniforms.res, this.canvas.width, this.canvas.height);
    gl.uniform3f(this.uniforms.a, a.r / 255, a.g / 255, a.b / 255);
    gl.uniform3f(this.uniforms.b, b.r / 255, b.g / 255, b.b / 255);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose() {
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
    this.gl = null;
  }
}
