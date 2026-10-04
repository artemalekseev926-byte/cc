import { execSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const out = `release/DeskForge-${version}-win-x64.zip`;
rmSync(out, { force: true });
if (process.platform === 'win32') {
  execSync(`powershell -NoProfile -Command "Compress-Archive -Path 'release/win-unpacked/*' -DestinationPath '${out}'"`, { stdio: 'inherit' });
} else {
  execSync(`cd release/win-unpacked && zip -qr ../${out.split('/').pop()} .`, { stdio: 'inherit' });
}
console.log(`Created ${out}`);
