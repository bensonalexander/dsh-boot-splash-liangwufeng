// Install the boot-splash plugin into the desktop dsh profile.
// - copies ./dsh-boot-splash -> <profile>/plugins/boot-splash
// - appends an `insert` entry to <profile>/cordis.patch.yml (idempotent, with backup)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const PROFILE = path.join(HOME, 'profiles', 'desktop');
const SRC = path.resolve('dsh-boot-splash');
const DEST = path.join(PROFILE, 'plugins', 'boot-splash');
const PATCH = path.join(PROFILE, 'cordis.patch.yml');

const ENTRY = `- insert:
    - id: boot-splash
      name: './plugins/boot-splash/index.js'`;

if (!fs.existsSync(path.join(PROFILE, 'package.json'))) {
  console.error('profile not found:', PROFILE);
  process.exit(1);
}

// 1. copy plugin files
fs.mkdirSync(DEST, { recursive: true });
for (const name of fs.readdirSync(SRC)) {
  const from = path.join(SRC, name);
  if (!fs.statSync(from).isFile()) continue;
  fs.copyFileSync(from, path.join(DEST, name));
}
console.log('plugin   ->', DEST);

// 2. patch the profile user layer
const current = fs.readFileSync(PATCH, 'utf8');
if (current.includes("id: boot-splash")) {
  console.log('patch    -> already present');
} else {
  const backup = `${PATCH}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(PATCH, backup);
  const next = current.replace(/\s*$/, '') + '\n\n' + ENTRY + '\n';
  fs.writeFileSync(PATCH, next);
  console.log('patch    -> appended (backup:', path.basename(backup) + ')');
}

console.log('\ndone. DSH 启动（或刷新窗口）时生效。');
