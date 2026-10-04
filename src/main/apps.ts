import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findApp, installedFromWingetList, type AppActionResult, type AppsStatus } from '../shared/system/apps';

interface RunResult {
  code: number;
  output: string;
}

function winget(args: string[], timeoutMs: number): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile('winget', args, { windowsHide: true, timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      const raw = (err as { code?: unknown } | null)?.code;
      const code = err ? (typeof raw === 'number' ? raw : -1) : 0;
      resolve({ code, output: `${stdout ?? ''}\n${stderr ?? ''}` });
    });
  });
}

let busy = false;

export async function appsStatus(): Promise<AppsStatus> {
  if (process.platform !== 'win32') return { wingetAvailable: false, installed: [] };
  const version = await winget(['--version'], 15_000);
  if (version.code !== 0) return { wingetAvailable: false, installed: [] };
  const file = join(tmpdir(), `deskforge-winget-${process.pid}.json`);
  await winget(['export', '-o', file, '--accept-source-agreements', '--disable-interactivity'], 120_000);
  let installed: string[] = [];
  try {
    installed = installedFromWingetList(await fs.readFile(file, 'utf8'));
  } catch {
    const listed = await winget(['list', '--accept-source-agreements', '--disable-interactivity'], 120_000);
    installed = installedFromWingetList(listed.output);
  } finally {
    await fs.rm(file, { force: true }).catch(() => undefined);
  }
  return { wingetAvailable: true, installed };
}

function lastMeaningfulLine(output: string): string {
  const lines = output
    .split(/\r?\n/)
    .map((l) => l.replace(/[▀-▟█▒░\\|/-]{3,}/g, '').trim())
    .filter((l) => l.length > 3);
  return lines[lines.length - 1] ?? '';
}

async function runAction(id: string, action: 'install' | 'uninstall'): Promise<AppActionResult> {
  if (process.platform !== 'win32') return { ok: false, error: 'apply.windowsOnly' };
  const app = findApp(id);
  if (!app) return { ok: false, error: 'apps.unknown' };
  if (busy) return { ok: false, error: 'apps.busy' };
  busy = true;
  try {
    const args =
      action === 'install'
        ? ['install', '--id', app.wingetId, '-e', '--source', 'winget', '--silent', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity']
        : ['uninstall', '--id', app.wingetId, '-e', '--silent', '--accept-source-agreements', '--disable-interactivity'];
    const res = await winget(args, 20 * 60_000);
    if (res.code === 0) return { ok: true };
    return { ok: false, error: lastMeaningfulLine(res.output) || `winget exit code ${res.code}` };
  } finally {
    busy = false;
  }
}

export const installApp = (id: string) => runAction(id, 'install');
export const uninstallApp = (id: string) => runAction(id, 'uninstall');
