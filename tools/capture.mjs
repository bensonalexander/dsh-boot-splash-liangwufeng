// Frame-by-frame capture of index.html via Chrome DevTools Protocol.
// usage: node tools/capture.mjs <outDir> <fps> <durationSeconds>
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { CHROME } from './chrome.mjs';

const OUT = path.resolve(process.argv[2] || 'frames');
const FPS = Number(process.argv[3] || 60);
const DUR = Number(process.argv[4] || 8.4);
const PAGE = path.resolve('index.html');
const URL = pathToFileURL(PAGE).href + '?shot=1&t=0';

const PORT = 9333;

fs.mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--mute-audio',
  '--window-size=1920,1080',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(OUT, '.chrome-profile')}`,
  'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function wsUrl(){
  for (let i = 0; i < 150; i++){
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(100);
  }
  throw new Error('devtools endpoint not ready');
}

class CDP {
  constructor(ws){
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = new Map();
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)){
        const { res, rej } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      } else if (m.method && this.handlers.has(m.method)){
        this.handlers.get(m.method).forEach(fn => fn(m.params));
      }
    };
  }
  send(method, params = {}){
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { res, rej }));
  }
  on(name, fn){
    if (!this.handlers.has(name)) this.handlers.set(name, []);
    this.handlers.get(name).push(fn);
  }
  once(name){
    return new Promise(res => this.on(name, res));
  }
}

const ws = new WebSocket(await wsUrl());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
const cdp = new CDP(ws);

await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false
});

const loaded = cdp.once('Page.loadEventFired');
await cdp.send('Page.navigate', { url: URL });
await loaded;
await sleep(1200); // fonts + image decode

const hasSeek = await cdp.send('Runtime.evaluate', {
  expression: 'typeof window.__seek === "function"',
  returnByValue: true
});
if (!hasSeek.result.value) throw new Error('window.__seek missing on page');
const imgOk = await cdp.send('Runtime.evaluate', {
  expression: 'getComputedStyle(document.querySelector(".photo")).backgroundImage.length > 10',
  returnByValue: true
});
if (!imgOk.result.value) throw new Error('photo background missing');

const total = Math.round(FPS * DUR);
console.log(`capturing ${total} frames at ${FPS}fps -> ${OUT}`);
const t0 = Date.now();
for (let i = 0; i < total; i++){
  const t = i / FPS;
  await cdp.send('Runtime.evaluate', {
    expression: `window.__seek(${(t * 1000).toFixed(3)})`,
    returnByValue: true
  });
  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: false, optimizeForSpeed: true
  });
  fs.writeFileSync(path.join(OUT, `f_${String(i).padStart(5, '0')}.png`),
    Buffer.from(shot.data, 'base64'));
  if (i % 60 === 0 || i === total - 1){
    const el = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`frame ${i + 1}/${total}  t=${t.toFixed(2)}s  elapsed=${el}s`);
  }
}

console.log('capture complete');
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
