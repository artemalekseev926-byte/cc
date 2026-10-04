import { promises as fs } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import type { ImportArtworkResult, ThemeSource, ThemeSummary } from '../shared/ipc';
import { themeFileUrl } from '../shared/ipc';
import { cloneTheme } from '../shared/theme/factory';
import { PRESETS, isBuiltinTheme } from '../shared/theme/presets';
import { parseTheme, slugify, type Asset, type Theme } from '../shared/theme/schema';
import { assetKeyFor, buildThemeFromArtwork, classifyFile, type ClassifiedFile } from '../shared/workshop/import';

export const PREVIEW_FILE = 'preview.jpg';

interface WorkshopEntry {
  dir: string;
  workshopId: string;
}

export class ThemeStore {
  private workshop = new Map<string, WorkshopEntry>();

  constructor(private readonly themesDir: string) {}

  async init(): Promise<void> {
    await fs.mkdir(this.themesDir, { recursive: true });
  }

  setWorkshopItems(items: Array<{ workshopId: string; folder: string }>): void {
    this.workshop.clear();
    for (const item of items) this.workshop.set(`ws-${item.workshopId}`, { dir: item.folder, workshopId: item.workshopId });
  }

  sourceOf(id: string): ThemeSource {
    if (isBuiltinTheme(id)) return 'builtin';
    if (this.workshop.has(id)) return 'workshop';
    return 'local';
  }

  dirOf(id: string): string | null {
    if (isBuiltinTheme(id)) return null;
    const ws = this.workshop.get(id);
    if (ws) return ws.dir;
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(id)) return null;
    return join(this.themesDir, id);
  }

  resolveThemeFile(id: string, relativePath: string): string | null {
    const dir = this.dirOf(id);
    if (!dir) return null;
    const full = resolve(dir, relativePath);
    const rel = relative(dir, full);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null;
    return full;
  }

  async list(): Promise<ThemeSummary[]> {
    const out: ThemeSummary[] = PRESETS.map(({ theme }) => this.summary(theme, 'builtin', false));

    const entries = await fs.readdir(this.themesDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const theme = await this.readThemeFile(join(this.themesDir, entry.name)).catch(() => null);
      if (theme && theme.id === entry.name) out.push(this.summary(theme, 'local', await this.hasPreview(theme.id)));
    }

    for (const [id, ws] of this.workshop) {
      const theme = await this.readThemeFile(ws.dir).catch(() => null);
      if (!theme) continue;
      theme.id = id;
      theme.workshopId = ws.workshopId;
      out.push(this.summary(theme, 'workshop', await this.hasPreview(id)));
    }
    return out;
  }

  private summary(theme: Theme, source: ThemeSource, preview: boolean): ThemeSummary {
    return {
      id: theme.id,
      name: theme.name,
      author: theme.author,
      tags: theme.tags,
      source,
      workshopId: theme.workshopId,
      updatedAt: theme.updatedAt,
      previewUrl: preview ? `${themeFileUrl(theme.id, PREVIEW_FILE)}?v=${encodeURIComponent(theme.updatedAt ?? '')}` : undefined,
      theme,
    };
  }

  private async hasPreview(id: string): Promise<boolean> {
    const file = this.resolveThemeFile(id, PREVIEW_FILE);
    return !!file && (await fs.stat(file).then((s) => s.isFile()).catch(() => false));
  }

  private async readThemeFile(dir: string): Promise<Theme> {
    const raw = JSON.parse(await fs.readFile(join(dir, 'theme.json'), 'utf8'));
    const parsed = parseTheme(raw);
    if (!parsed.ok) throw new Error(`Invalid theme in ${dir}: ${parsed.errors.join('; ')}`);
    return parsed.theme;
  }

  async load(id: string): Promise<Theme> {
    const preset = PRESETS.find((p) => p.theme.id === id);
    if (preset) return JSON.parse(JSON.stringify(preset.theme));
    const dir = this.dirOf(id);
    if (!dir) throw new Error(`Unknown theme ${id}`);
    const theme = await this.readThemeFile(dir);
    const ws = this.workshop.get(id);
    if (ws) {
      theme.id = id;
      theme.workshopId = ws.workshopId;
    }
    return theme;
  }

  async save(theme: Theme): Promise<void> {
    if (this.sourceOf(theme.id) !== 'local') throw new Error('Built-in and Workshop themes are read-only; duplicate first.');
    const parsed = parseTheme({ ...theme, updatedAt: new Date().toISOString() });
    if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
    const dir = this.dirOf(theme.id)!;
    await fs.mkdir(join(dir, 'assets'), { recursive: true });
    const tmp = join(dir, `theme.json.${process.pid}.tmp`);
    await fs.writeFile(tmp, JSON.stringify(parsed.theme, null, 2), 'utf8');
    await fs.rename(tmp, join(dir, 'theme.json'));
  }

  async remove(id: string): Promise<void> {
    if (this.sourceOf(id) !== 'local') throw new Error('Only local themes can be deleted.');
    const dir = this.dirOf(id);
    if (dir) await fs.rm(dir, { recursive: true, force: true });
  }

  async uniqueId(name: string): Promise<string> {
    const base = slugify(name).slice(0, 56);
    let id = base;
    let n = 2;
    while (await fs.stat(join(this.themesDir, id)).then(() => true, () => false)) id = `${base}-${n++}`;
    return id;
  }

  async duplicate(id: string, name: string): Promise<Theme> {
    const source = await this.load(id);
    const newId = await this.uniqueId(name);
    const copy = cloneTheme(source, newId, name);
    const srcDir = this.dirOf(id);
    const dstDir = join(this.themesDir, newId);
    await fs.mkdir(join(dstDir, 'assets'), { recursive: true });
    if (srcDir) {
      await fs.cp(join(srcDir, 'assets'), join(dstDir, 'assets'), { recursive: true }).catch(() => undefined);
      await fs.copyFile(join(srcDir, PREVIEW_FILE), join(dstDir, PREVIEW_FILE)).catch(() => undefined);
    }
    await this.save(copy);
    return copy;
  }

  async addAsset(themeId: string, sourcePath: string): Promise<{ key: string; asset: Asset }> {
    const theme = await this.load(themeId);
    const stat = await fs.stat(sourcePath);
    const file = classifyFile({ path: sourcePath, name: basename(sourcePath), bytes: stat.size });
    if (file.problem || (file.kind !== 'image' && file.kind !== 'video')) throw new Error(file.problem ?? 'import.problem.unknown');
    const { key, asset } = await this.copyAsset(themeId, file, theme.assets);
    theme.assets[key] = asset;
    await this.save(theme);
    return { key, asset };
  }

  private async copyAsset(themeId: string, file: ClassifiedFile, existing: Record<string, Asset>) {
    const key = assetKeyFor(file.name, existing);
    const relativeFile = `assets/${key}${extname(file.name).toLowerCase()}`;
    const dir = this.dirOf(themeId)!;
    await fs.mkdir(join(dir, 'assets'), { recursive: true });
    await fs.copyFile(file.path, join(dir, relativeFile));
    const asset: Asset = { file: relativeFile, kind: file.kind as 'image' | 'video', bytes: file.bytes };
    return { key, asset };
  }

  async importArtwork(paths: string[], title: string | undefined, author: string): Promise<ImportArtworkResult> {
    const files: ClassifiedFile[] = [];
    for (const path of paths) {
      const stat = await fs.stat(path).catch(() => null);
      if (!stat?.isFile()) continue;
      files.push(classifyFile({ path, name: basename(path), bytes: stat.size }));
    }

    const themeJson = files.find((f) => f.kind === 'theme');
    if (themeJson) {
      const srcDir = dirname(themeJson.path);
      const source = await this.readThemeFile(srcDir);
      const id = await this.uniqueId(source.name);
      const dstDir = join(this.themesDir, id);
      await fs.cp(srcDir, dstDir, { recursive: true });
      source.id = id;
      source.workshopId = undefined;
      await this.save(source);
      return { theme: source, files };
    }

    const usable = files.filter((f) => !f.problem && (f.kind === 'image' || f.kind === 'video'));
    if (usable.length === 0) return { theme: null, files };

    const name = title?.trim() || basename(usable[0].name, extname(usable[0].name));
    const id = await this.uniqueId(name);
    const assets: Record<string, Asset> = {};
    const imported: Array<{ key: string; asset: Asset }> = [];
    await fs.mkdir(join(this.themesDir, id, 'assets'), { recursive: true });
    for (const file of usable) {
      const { key, asset } = await this.copyAsset(id, file, assets);
      assets[key] = asset;
      imported.push({ key, asset });
    }
    const theme = buildThemeFromArtwork(id, name, author, imported);
    await this.save(theme);
    return { theme, files };
  }

  async writePreview(themeId: string, jpeg: Buffer): Promise<{ bytes: number; url: string }> {
    const file = this.resolveThemeFile(themeId, PREVIEW_FILE);
    if (!file || this.sourceOf(themeId) !== 'local') throw new Error('Cannot write preview for this theme');
    await fs.writeFile(file, jpeg);
    return { bytes: jpeg.length, url: `${themeFileUrl(themeId, PREVIEW_FILE)}?v=${Date.now()}` };
  }

  async previewBytes(themeId: string): Promise<number | null> {
    const file = this.resolveThemeFile(themeId, PREVIEW_FILE);
    if (!file) return null;
    return fs.stat(file).then((s) => s.size, () => null);
  }

  async folderSize(themeId: string): Promise<number> {
    const dir = this.dirOf(themeId);
    if (!dir) return 0;
    const walk = async (d: string): Promise<number> => {
      let total = 0;
      for (const entry of await fs.readdir(d, { withFileTypes: true }).catch(() => [])) {
        const p = join(d, entry.name);
        total += entry.isDirectory() ? await walk(p) : (await fs.stat(p).catch(() => ({ size: 0 }))).size;
      }
      return total;
    };
    return walk(dir);
  }
}
