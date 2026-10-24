// Real-time screenshots: load a URL once, capture at the given elapsed times.
// usage: node tools/shoot-live.mjs <url> <outDir> <seconds,seconds,...> <width> <height>
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { CHROME } from './chrome.mjs';

const [, , url, outDir, timesArg = '0.5', wArg = '1440', hArg = '900'] = process.argv;
const times = timesArg.split(',').map(Number).filter(n => Number.isFinite(n)).sort((a, b) => a - b);
const width = Number(wArg), height = Number(hArg);
const PORT = 9335;
fs.mkdirSync(outDir, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', '--mute-audio', `--window-size=${width},${height}`,
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.resolve('preview/.profile')}`,
  'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function wsUrl(){
  for (let i = 0; i < 150; i++){
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (p) return p.webSocketDebuggerUrl;
    } catch {}
    await sleep(100);
  }
  throw new Error('no devtools');
}

const ws = new WebSocket(await wsUrl());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)){ const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
};
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pending.set(i, { res, rej })); };

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
const start = Date.now();
await send('Page.navigate', { url });

for (const t of times){
  const wait = t * 1000 - (Date.now() - start);
  if (wait > 0) await sleep(wait);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(outDir, `live_${String(t).replace('.', '_')}.png`);
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log('captured', t + 's', '->', file);
}

try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
