// Live (real-time) playback check: wait, then screenshot the final state.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { CHROME } from './chrome.mjs';

const WAIT = Number(process.argv[2] || 6200);
const OUT = path.resolve(process.argv[3] || 'shots/live.png');
const PORT = 9334;

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', '--mute-audio', '--window-size=1920,1080',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.resolve('frames/.live-profile')}`,
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
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: pathToFileURL(path.resolve('index.html')).href });
await sleep(WAIT);

const state = await send('Runtime.evaluate', {
  expression: `JSON.stringify({
    dock: getComputedStyle(document.querySelector('.dock')).opacity,
    fill: document.querySelector('.fill').style.width,
    replay: getComputedStyle(document.querySelector('.replay')).opacity,
    letters: getComputedStyle(document.querySelector('.lockup .l')).opacity
  })`, returnByValue: true
});
console.log('state:', state.result.value);

const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
console.log('wrote', OUT);
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
