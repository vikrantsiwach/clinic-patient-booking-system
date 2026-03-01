#!/usr/bin/env node
/**
 * Generates minimal valid PNG icons for the PWA and a favicon.ico.
 * Run once from project root: node generate-icons.js
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// Build CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBytes = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([len, typeBytes, data, crcBuf]);
}

function createPNG(w, h, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB

  // Each row: filter byte (0) + w*3 RGB pixels
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }
  const raw = Buffer.concat(Array(h).fill(row));
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function createICO(pngBuf) {
  // ICO with a single embedded PNG (modern ICO format)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);  // reserved
  header.writeUInt16LE(1, 2);  // type=1 (icon)
  header.writeUInt16LE(1, 4);  // count=1

  const dirEntry = Buffer.alloc(16);
  dirEntry[0] = 16;           // width (16 means 16px; 0 means 256)
  dirEntry[1] = 16;           // height
  dirEntry[2] = 0;            // color count
  dirEntry[3] = 0;            // reserved
  dirEntry.writeUInt16LE(1, 4); // planes
  dirEntry.writeUInt16LE(32, 6); // bit count
  dirEntry.writeUInt32LE(pngBuf.length, 8); // size of image
  dirEntry.writeUInt32LE(22, 12); // offset = 6 (header) + 16 (dirEntry) = 22

  return Buffer.concat([header, dirEntry, pngBuf]);
}

// Brand teal: #0A7B6C
const [R, G, B] = [0x0A, 0x7B, 0x6C];

const publicDir = path.join(__dirname, 'frontend', 'public');
const iconsDir = path.join(publicDir, 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

const png16 = createPNG(16, 16, R, G, B);
const png192 = createPNG(192, 192, R, G, B);
const png512 = createPNG(512, 512, R, G, B);

fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createICO(png16));
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), png192);
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), png512);

console.log('✓ favicon.ico');
console.log('✓ icons/icon-192.png');
console.log('✓ icons/icon-512.png');
