/**
 * Steamworks integration (Workshop upload + subscribed items) via steamworks.js.
 * When Steam is not running — e.g. during development — the app keeps working
 * and the Workshop page explains what is missing.
 */
import { createRequire } from 'node:module';
import { shell } from 'electron';
import type { PublishProgress, PublishRequest, PublishResult, SteamStatus, SubscribedItem } from '../shared/ipc';

/* eslint-disable @typescript-eslint/no-explicit-any */
type SteamClient = any;

const VISIBILITY: Record<PublishRequest['visibility'], number> = { public: 0, friends: 1, private: 2, unlisted: 3 };
// workshop.UpdateStatus
const STAGE: Record<number, PublishProgress['stage']> = {
  0: 'preparing',
  1: 'preparing',
  2: 'preparing',
  3: 'uploading',
  4: 'preview',
  5: 'committing',
};

export class SteamService {
  private client: SteamClient | null = null;
  private reason: string | undefined;

  constructor(private readonly appId: number) {}

  init(): void {
    try {
      const require = createRequire(__filename);
      const steamworks = require('steamworks.js');
      this.client = steamworks.init(this.appId);
    } catch (err) {
      this.client = null;
      const message = err instanceof Error ? err.message : String(err);
      this.reason = /steam/i.test(message) ? 'steam.notRunning' : 'steam.unavailable';
      console.warn('[steam] not available:', message);
    }
  }

  status(): SteamStatus {
    if (!this.client) return { available: false, appId: this.appId, reason: this.reason ?? 'steam.notRunning' };
    let userName: string | undefined;
    try {
      userName = this.client.localplayer.getName();
    } catch {
      /* ignore */
    }
    return { available: true, appId: this.appId, userName };
  }

  /**
   * Creates the Workshop item on first publish (returns its id via `onCreated`
   * so it can be stored in theme.json), then uploads content + preview.
   */
  async publish(
    req: PublishRequest,
    existingId: string | undefined,
    contentDir: string,
    previewPath: string,
    description: string,
    onCreated: (workshopId: string) => Promise<void>,
    onProgress: (p: PublishProgress) => void,
  ): Promise<PublishResult> {
    const client = this.client;
    if (!client) return { ok: false, error: 'steam.notRunning' };
    try {
      let itemId: bigint;
      let needsAgreement = false;
      if (existingId) {
        itemId = BigInt(existingId);
      } else {
        onProgress({ stage: 'creating', progress: 0 });
        const created = await client.workshop.createItem(this.appId);
        itemId = created.itemId;
        needsAgreement = created.needsToAcceptAgreement;
        await onCreated(itemId.toString());
      }

      const result = await new Promise<{ itemId: bigint; needsToAcceptAgreement: boolean }>((resolve, reject) => {
        client.workshop.updateItemWithCallback(
          itemId,
          {
            title: req.title.trim(),
            description,
            changeNote: req.changeNote.trim() || undefined,
            previewPath,
            contentPath: contentDir,
            tags: req.tags,
            visibility: VISIBILITY[req.visibility],
          },
          this.appId,
          resolve,
          reject,
          (p: { status: number; progress: bigint; total: bigint }) => {
            const total = Number(p.total);
            onProgress({ stage: STAGE[p.status] ?? 'uploading', progress: total > 0 ? Number(p.progress) / total : 0 });
          },
          250,
        );
      });
      onProgress({ stage: 'done', progress: 1 });
      return {
        ok: true,
        workshopId: result.itemId.toString(),
        needsToAcceptAgreement: needsAgreement || result.needsToAcceptAgreement,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      onProgress({ stage: 'error', progress: 0, message: error });
      return { ok: false, error };
    }
  }

  /** Installed Workshop items (folder on disk) for the library. */
  installedItems(): Array<{ workshopId: string; folder: string }> {
    if (!this.client) return [];
    const out: Array<{ workshopId: string; folder: string }> = [];
    for (const id of this.client.workshop.getSubscribedItems() as bigint[]) {
      const info = this.client.workshop.installInfo(id);
      if (info?.folder) out.push({ workshopId: id.toString(), folder: info.folder });
    }
    return out;
  }

  async subscribed(): Promise<SubscribedItem[]> {
    if (!this.client) return [];
    const ids = this.client.workshop.getSubscribedItems() as bigint[];
    if (ids.length === 0) return [];
    const titles = new Map<string, string>();
    try {
      const res = await this.client.workshop.getItems(ids);
      for (const item of res.items) if (item) titles.set(item.publishedFileId.toString(), item.title);
    } catch {
      /* titles are optional */
    }
    return ids.map((id) => {
      const workshopId = id.toString();
      const installed = !!this.client.workshop.installInfo(id)?.folder;
      return { workshopId, title: titles.get(workshopId) ?? `#${workshopId}`, installed, themeId: installed ? `ws-${workshopId}` : undefined };
    });
  }

  async openItem(workshopId: string): Promise<void> {
    if (!/^\d+$/.test(workshopId)) return;
    await shell.openExternal(`steam://url/CommunityFilePage/${workshopId}`);
  }

  async openWorkshopAgreement(): Promise<void> {
    await shell.openExternal('https://steamcommunity.com/sharedfiles/workshoplegalagreement');
  }
}
