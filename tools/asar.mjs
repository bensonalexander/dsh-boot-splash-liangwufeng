// Minimal asar reader: list entries or extract one file.
// usage: node tools/asar.mjs <asar> list [prefix]
//        node tools/asar.mjs <asar> cat <path>
import fs from 'node:fs';

const [, , asarPath, cmd, arg] = process.argv;
const fd = fs.openSync(asarPath, 'r');
const sizeBuf = Buffer.alloc(8);
fs.readSync(fd, sizeBuf, 0, 8, 0);
const headerSize = sizeBuf.readUInt32LE(4);
const headerBuf = Buffer.alloc(headerSize);
fs.readSync(fd, headerBuf, 0, headerSize, 8);
const dataOffset = 8 + headerSize;

let header;
const firstBrace = headerBuf.indexOf(0x7b);
try { header = JSON.parse(headerBuf.subarray(firstBrace).toString('utf8')); }
catch { header = JSON.parse(headerBuf.subarray(8).toString('utf8')); }

function walk(node, prefix, out) {
  for (const [name, entry] of Object.entries(node.files || {})) {
    const p = prefix ? `${prefix}/${name}` : name;
    if (entry.files) walk(entry, p, out);
    else out.push({ path: p, size: Number(entry.size), offset: Number(entry.offset) });
  }
  return out;
}

const all = walk(header, '', []);

if (cmd === 'list') {
  const filter = arg ? arg.toLowerCase() : '';
  for (const f of all) if (!filter || f.path.toLowerCase().includes(filter)) console.log(`${String(f.size).padStart(10)}  ${f.path}`);
  console.log(`# ${all.length} files`);
} else if (cmd === 'cat') {
  const f = all.find(x => x.path === arg);
  if (!f) { console.error('not found:', arg); process.exit(2); }
  const buf = Buffer.alloc(f.size);
  fs.readSync(fd, buf, 0, f.size, dataOffset + f.offset);
  process.stdout.write(buf);
} else if (cmd === 'extract') {
  const f = all.find(x => x.path === arg);
  if (!f) { console.error('not found:', arg); process.exit(2); }
  const buf = Buffer.alloc(f.size);
  fs.readSync(fd, buf, 0, f.size, dataOffset + f.offset);
  fs.writeFileSync(process.argv[5], buf);
  console.log('extracted', process.argv[5], f.size);
} else {
  console.error('unknown command');
  process.exit(2);
}
