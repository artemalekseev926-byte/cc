// Lists translation keys referenced in the source: literal t('…') calls and i18n-key string literals in shared code.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function collectKeys(root = 'src') {
  const keys = new Set();
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (!p.includes('i18n')) walk(p);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(name)) continue;
      const src = readFileSync(p, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.-]+)'/g)) keys.add(m[1]);
      // keys passed around as data: key: 'rec.x', problem: 'import.problem.x', what: 'apply.x', reason: 'apply.x', blurbKey
      for (const m of src.matchAll(/(?:key|problem|warning|what|reason|blurbKey|error):\s*'([a-z][a-zA-Z0-9]*\.[a-zA-Z0-9_.-]+)'/g)) keys.add(m[1]);
      for (const m of src.matchAll(/\b(?:step|preset)\(\s*'([a-z][a-zA-Z0-9]*\.[a-zA-Z0-9_.]+)'/g)) keys.add(m[1]);
      for (const m of src.matchAll(/'((?:apply|steam|check|rec|import)\.[a-zA-Z0-9_.]+)'/g)) keys.add(m[1]);
    }
  };
  walk(root);
  return [...keys].sort();
}

if (process.argv[1]?.endsWith('i18n-keys.mjs')) console.log(collectKeys().join('\n'));
