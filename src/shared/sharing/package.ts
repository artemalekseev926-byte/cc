export const PACKAGE_EXT = 'deskforge';
export const PACKAGE_MAX_ENTRIES = 64;

const SAFE_ENTRY = /^(theme\.json|preview\.jpg|assets\/[A-Za-z0-9][A-Za-z0-9._-]{0,120})$/;

export function isSafePackageEntry(name: string): boolean {
  if (name.includes('\\') || name.includes('..') || name.startsWith('/')) return false;
  return SAFE_ENTRY.test(name);
}

export function packageFileName(themeName: string): string {
  const base = themeName.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'theme';
  return `${base}.${PACKAGE_EXT}`;
}
