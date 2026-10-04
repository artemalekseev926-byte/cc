import { execFile } from 'node:child_process';

export type RegValue =
  | { type: 'REG_DWORD'; data: number }
  | { type: 'REG_BINARY'; data: Buffer }
  | { type: 'REG_SZ'; data: string };

function run(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('reg.exe', args, { windowsHide: true, timeout: 10_000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr?.toString().trim() || err.message));
      else resolve(stdout.toString());
    });
  });
}

export function parseRegQueryOutput(output: string, name: string): RegValue | null {
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trim();
    const match = /^(.+?)\s{2,}(REG_\w+)\s{2,}(.*)$/.exec(line) ?? /^(.+?)\s{2,}(REG_\w+)$/.exec(line);
    if (!match) continue;
    const [, valueName, type, data = ''] = match;
    if (valueName.toLowerCase() !== name.toLowerCase()) continue;
    if (type === 'REG_DWORD') return { type, data: parseInt(data, 16) >>> 0 };
    if (type === 'REG_BINARY') return { type, data: Buffer.from(data.trim(), 'hex') };
    if (type === 'REG_SZ' || type === 'REG_EXPAND_SZ') return { type: 'REG_SZ', data };
  }
  return null;
}

export async function regGet(key: string, name: string): Promise<RegValue | null> {
  try {
    return parseRegQueryOutput(await run(['query', key, '/v', name]), name);
  } catch {
    return null;
  }
}

export async function regSet(key: string, name: string, value: RegValue): Promise<void> {
  const data =
    value.type === 'REG_DWORD' ? String(value.data >>> 0) : value.type === 'REG_BINARY' ? value.data.toString('hex') : value.data;
  await run(['add', key, '/v', name, '/t', value.type, '/d', data, '/f']);
}

export async function regDelete(key: string, name: string): Promise<void> {
  try {
    await run(['delete', key, '/v', name, '/f']);
  } catch {
  }
}

export const dword = (data: number): RegValue => ({ type: 'REG_DWORD', data: data >>> 0 });
export const binary = (data: Buffer): RegValue => ({ type: 'REG_BINARY', data });

export const KEYS = {
  personalize: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize',
  dwm: 'HKCU\\Software\\Microsoft\\Windows\\DWM',
  accent: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent',
  advanced: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
  stuckRects3: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StuckRects3',
  desktopBag: 'HKCU\\Software\\Microsoft\\Windows\\Shell\\Bags\\1\\Desktop',
  controlDesktop: 'HKCU\\Control Panel\\Desktop',
} as const;
