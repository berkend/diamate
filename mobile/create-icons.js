/**
 * DiaMate Icon & Splash Generator
 * Creates minimal PNG placeholder assets with DiaMate brand colors.
 * No external dependencies required.
 *
 * Usage: node create-icons.js
 *
 * IMPORTANT: Replace these with actual DiaMate logo files before store submission!
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height, r, g, b) {
  // Minimal valid PNG with solid color
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const buf = Buffer.alloc(4 + type.length + data.length + 4);
    buf.writeUInt32BE(data.length, 0);
    buf.write(type, 4);
    data.copy(buf, 4 + type.length);
    // CRC32
    const crcData = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < crcData.length; i++) {
      crc ^= crcData[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
      }
    }
    crc ^= 0xFFFFFFFF;
    buf.writeInt32BE(crc, buf.length - 4);
    return buf;
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT - raw pixel data
  const rowSize = 1 + width * 3; // filter byte + RGB
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const offset = y * rowSize;
    raw[offset] = 0; // no filter
    for (let x = 0; x < width; x++) {
      const px = offset + 1 + x * 3;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }
  const compressed = zlib.deflateSync(raw);

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', iend),
  ]);
}

const assetsDir = path.join(__dirname, 'assets');

// DiaMate brand colors
const GREEN = { r: 22, g: 163, b: 74 };   // #16A34A
const DARK = { r: 13, g: 59, b: 46 };     // #0D3B2E

// Generate assets
const assets = [
  { name: 'icon.png', w: 1024, h: 1024, ...GREEN },
  { name: 'adaptive-icon.png', w: 1024, h: 1024, ...GREEN },
  { name: 'splash.png', w: 1284, h: 2778, ...DARK },
  { name: 'favicon.png', w: 48, h: 48, ...GREEN },
];

for (const a of assets) {
  const png = createPNG(a.w, a.h, a.r, a.g, a.b);
  fs.writeFileSync(path.join(assetsDir, a.name), png);
  console.log(`Created ${a.name} (${a.w}x${a.h})`);
}

console.log('\nDone! Replace these with actual DiaMate logo assets before store submission.');
