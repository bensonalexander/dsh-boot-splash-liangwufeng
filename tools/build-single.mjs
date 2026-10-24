// Inline the portrait into a single portable HTML file.
import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve('index.html');
const img = path.resolve('梁武峰.png');
const out = path.resolve('DeepSeek-Harness-开屏.html');

const html = fs.readFileSync(src, 'utf8');
const b64 = fs.readFileSync(img).toString('base64');
const needle = 'url("梁武峰.png")';
if (!html.includes(needle)) throw new Error('image reference not found in index.html');

fs.writeFileSync(out, html.replace(needle, `url("data:image/png;base64,${b64}")`), 'utf8');
console.log(`wrote ${out} (${(fs.statSync(out).size / 1048576).toFixed(2)} MB)`);
