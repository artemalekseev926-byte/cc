export interface AppEntry {
  id: string;
  wingetId: string;
  name: string;
  icon: string;
  homepage: string;
  category: 'look' | 'taskbar' | 'tools';
  advanced?: boolean;
}

export const APP_CATALOG: AppEntry[] = [
  { id: 'translucenttb', wingetId: 'CharlesMilette.TranslucentTB', name: 'TranslucentTB', icon: 'panel-bottom', homepage: 'https://github.com/TranslucentTB/TranslucentTB', category: 'taskbar' },
  { id: 'micaforeveryone', wingetId: 'MicaForEveryone.MicaForEveryone', name: 'Mica For Everyone', icon: 'app-window', homepage: 'https://github.com/MicaForEveryone/MicaForEveryone', category: 'look' },
  { id: 'autodarkmode', wingetId: 'Armin2208.WindowsAutoNightMode', name: 'Auto Dark Mode', icon: 'moon', homepage: 'https://github.com/AutoDarkMode/Windows-Auto-Night-Mode', category: 'look' },
  { id: 'nilesoftshell', wingetId: 'Nilesoft.Shell', name: 'Nilesoft Shell', icon: 'sliders', homepage: 'https://nilesoft.org', category: 'look' },
  { id: 'rainmeter', wingetId: 'Rainmeter.Rainmeter', name: 'Rainmeter', icon: 'gauge', homepage: 'https://www.rainmeter.net', category: 'look' },
  { id: 'eartrumpet', wingetId: 'File-New-Project.EarTrumpet', name: 'EarTrumpet', icon: 'volume', homepage: 'https://github.com/File-New-Project/EarTrumpet', category: 'taskbar' },
  { id: 'twinkletray', wingetId: 'xanderfrangos.twinkletray', name: 'Twinkle Tray', icon: 'sun', homepage: 'https://twinkletray.com', category: 'taskbar' },
  { id: 'powertoys', wingetId: 'Microsoft.PowerToys', name: 'Microsoft PowerToys', icon: 'wrench', homepage: 'https://learn.microsoft.com/windows/powertoys/', category: 'tools' },
  { id: 'files', wingetId: 'FilesCommunity.Files', name: 'Files', icon: 'folder', homepage: 'https://files.community', category: 'tools' },
  { id: 'flowlauncher', wingetId: 'Flow-Launcher.Flow-Launcher', name: 'Flow Launcher', icon: 'search', homepage: 'https://www.flowlauncher.com', category: 'tools' },
  { id: 'quicklook', wingetId: 'QL-Win.QuickLook', name: 'QuickLook', icon: 'eye', homepage: 'https://github.com/QL-Win/QuickLook', category: 'tools' },
  { id: 'windhawk', wingetId: 'RamenSoftware.Windhawk', name: 'Windhawk', icon: 'puzzle', homepage: 'https://windhawk.net', category: 'look', advanced: true },
];

export interface AppsStatus {
  wingetAvailable: boolean;
  installed: string[];
}

export interface AppActionResult {
  ok: boolean;
  error?: string;
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,99}$/;

export function findApp(id: string): AppEntry | undefined {
  const entry = APP_CATALOG.find((a) => a.id === id);
  return entry && ID_PATTERN.test(entry.wingetId) ? entry : undefined;
}

export function installedFromWingetList(output: string): string[] {
  const text = output.toLowerCase();
  return APP_CATALOG.filter((a) => text.includes(a.wingetId.toLowerCase())).map((a) => a.id);
}
