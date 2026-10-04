import { GenericPlatform } from './generic';
import type { PlatformAdapter } from './types';
import { WindowsPlatform } from './windows';

export function createPlatform(userDataDir: string): PlatformAdapter {
  return process.platform === 'win32' ? new WindowsPlatform(userDataDir) : new GenericPlatform();
}

export type { PlatformAdapter } from './types';
