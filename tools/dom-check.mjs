// Load a URL, wait, then report DOM state for the boot splash.
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { CHROME } from './chrome.mjs';

const URL_IN = process.argv[2];
const WAIT = Number(process.argv[3] || 1500);
const PORT = 9336;

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', '--mute-audio', '--window-size=1440,900',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.resolve('preview/.domprofile')}`,
  'about:blank'
], { stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 150 && !wsUrl; i++){
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    wsUrl = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl)?.webSocketDebuggerUrl;
  } catch {}
  if (!wsUrl) await sleep(100);
}
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)){ const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
};
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pending.set(i, { res, rej })); };

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL_IN });
await sleep(WAIT);

const out = await send('Runtime.evaluate', {
  expression: `(() => {
    const el = document.getElementById('dsh-boot-splash');
    const photo = document.querySelector('#dsh-boot-splash .bs-photo');
    const cs = el ? getComputedStyle(el) : null;
    return JSON.stringify({
      exists: !!el,
      opacity: cs && cs.opacity,
      display: cs && cs.display,
      visibility: cs && cs.visibility,
      position: cs && cs.position,
      zIndex: cs && cs.zIndex,
      photoBg: photo && getComputedStyle(photo).backgroundImage.slice(0, 80),
      reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
      rootKids: document.getElementById('root') ? document.getElementById('root').childElementCount : -1,
      animProps: [...new Set(document.getAnimations().flatMap(a => {
        try { return [...a.effect.getKeyframes()].flatMap(k => Object.keys(k).filter(x => !['offset','computedOffset','easing','composite'].includes(x))) } catch (_) { return [] }
      }))].sort().join(','),
      animDetail: document.getAnimations().map(a => {
        try {
          const props = [...new Set([...a.effect.getKeyframes()].flatMap(k => Object.keys(k).filter(x => !['offset','computedOffset','easing','composite'].includes(x))))];
          return (a.animationName || a.transitionProperty || '?') + '[' + props.join(',') + ']';
        } catch (_) { return '?' }
      }).join(' '),
      animCount: document.getAnimations().length
    });
  })()`,
  returnByValue: true
});
console.log(out.result.value);
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
