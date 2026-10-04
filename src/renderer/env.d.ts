import type { DeskforgeApi } from '../shared/ipc';

declare global {
  interface Window {
    deskforge: DeskforgeApi;
  }
}

export {};
