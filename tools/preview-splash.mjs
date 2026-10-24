// Compose the real index.html with the plugin's injected rows, and write a
// standalone preview page (app scripts replaced by a mock UI).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const ROOT = path.join(DSH_HOME, 'profiles');
const OUT = path.resolve('preview');
const pluginDir = path.resolve('dsh-boot-splash');

const plugin = await import(pathToFileURL(path.join(pluginDir, 'index.js')).href);
const { renderIndexInjections } = await import(
  pathToFileURL(path.join(ROOT, 'node_modules', '@deepseek-ai', 'dsh-host-webserver', 'lib', 'index.js')).href
);

const listeners = [];
const routes = [];
const fakeCtx = {
  effect(fn) { return fn(); },
  webServer: { register(route) { routes.push(route); return () => {}; } },
  on(name, fn) { if (name === 'webserver/index-inject') listeners.push(fn); }
};

plugin.apply(fakeCtx);
const rows = [];
for (const fn of listeners) fn(rows);

console.log('routes:', routes.map(r => r.path).join(', '));
console.log('rows:', rows.map(r => r.kind + (r.placement ? ':' + r.placement : '')).join(', '));
console.log('sizes: css', rows.find(r => r.kind === 'style')?.text.length,
  'html', rows.find(r => r.kind === 'html')?.html.length,
  'js', rows.find(r => r.kind === 'script')?.text.length);

const distIndex = path.join(ROOT, 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist', 'index.html');
const raw = fs.readFileSync(distIndex, 'utf8');
let html = renderIndexInjections(raw, rows);

// preview-only adjustments
html = html.replaceAll('/x-boot-splash/portrait.webp', './portrait.webp');
html = html.replace(/<script type="module"[^>]*><\/script>/g, '');
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '');
html = html.replace(/<link rel="stylesheet"[^>]*>/g, '');
html = html.replace(
  '<div id="root"></div>',
  '<div id="root"></div>\n<script>setTimeout(function(){var r=document.getElementById("root");' +
  'r.innerHTML=\'<div style="position:fixed;inset:0;background:#0d1117;color:#9fb0d4;display:grid;place-items:center;' +
  'font:600 30px/1.2 sans-serif">APP UI</div>\'},800)</script>'
);

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.copyFileSync(path.join(pluginDir, 'portrait.webp'), path.join(OUT, 'portrait.webp'));
console.log('wrote', path.join(OUT, 'index.html'), html.length, 'bytes');

const at = html.indexOf('<body>');
console.log('--- body excerpt ---');
console.log(html.slice(at, at + 420).replace(/\s+/g, ' '));
