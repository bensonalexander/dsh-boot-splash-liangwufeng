// Remove the boot-splash plugin from the desktop dsh profile.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const PROFILE = path.join(HOME, 'profiles', 'desktop');
const DEST = path.join(PROFILE, 'plugins', 'boot-splash');
const PATCH = path.join(PROFILE, 'cordis.patch.yml');

if (fs.existsSync(PATCH)) {
  const text = fs.readFileSync(PATCH, 'utf8');
  if (text.includes('id: boot-splash')) {
    const backup = `${PATCH}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.copyFileSync(PATCH, backup);
    const next = text.replace(/\n*- insert:\n    - id: boot-splash\n      name: '\.\/plugins\/boot-splash\/index\.js'\n?/g, '\n').replace(/\s*$/, '\n');
    fs.writeFileSync(PATCH, next);
    console.log('patch    -> entry removed (backup:', path.basename(backup) + ')');
  } else {
    console.log('patch    -> no entry');
  }
}

if (fs.existsSync(DEST)) {
  fs.rmSync(DEST, { recursive: true, force: true });
  console.log('plugin   -> removed', DEST);
}
console.log('\ndone. 下次启动/刷新后不再显示开屏。');
