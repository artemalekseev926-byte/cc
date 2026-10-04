import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('node_modules/koffi/package.json', 'utf8'));
const pkg = `@koromix/koffi-win32-x64@${version}`;
if (!existsSync('node_modules/@koromix/koffi-win32-x64')) {
  console.log(`Installing ${pkg} for the Windows build`);
  execSync(`npm install --no-save --force ${pkg}`, { stdio: 'inherit' });
}
