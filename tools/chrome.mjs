// Resolve a Chromium executable across platforms (env override first).
import fs from 'node:fs';

const candidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

export const CHROME = candidates.find((p) => {
  try { return fs.existsSync(p); } catch { return false; }
}) || candidates[0];

if (!CHROME) {
  throw new Error('找不到 Chrome/Edge，请设置环境变量 CHROME_PATH 指向浏览器可执行文件');
}
