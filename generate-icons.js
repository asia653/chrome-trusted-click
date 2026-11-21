const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(width, height, drawFn) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function createChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const body = Buffer.concat([typeBuf, data]);
    const crc = crc32(body);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, body, crcBuf]);
  }

  function crc32(buf) {
    let table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const ihdrChunk = createChunk('IHDR', ihdr);

  const rawData = Buffer.alloc(height * (width * 4 + 1));
  let p = 0;
  for (let y = 0; y < height; y++) {
    rawData[p++] = 0; // Filter byte none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[p++] = r;
      rawData[p++] = g;
      rawData[p++] = b;
      rawData[p++] = a;
    }
  }

  const idatChunk = createChunk('IDAT', zlib.deflateSync(rawData));
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function drawIcon(x, y, w, h) {
  // Coordinates normalized to 0..1
  const nx = x / w;
  const ny = y / h;
  const cx = 0.5;
  const cy = 0.5;
  const dist = Math.sqrt((nx - cx) ** 2 + (ny - cy) ** 2);

  // Background rounded squircle / circle: vibrant indigo to purple gradient
  const bgRadius = 0.46;
  if (dist > bgRadius) {
    return [0, 0, 0, 0]; // Transparent outer
  }

  // Gradient background: indigo #4f46e5 to emerald #10b981
  const gradT = (nx + ny) / 2;
  let bgR = Math.round(79 * (1 - gradT) + 16 * gradT);
  let bgG = Math.round(70 * (1 - gradT) + 185 * gradT);
  let bgB = Math.round(229 * (1 - gradT) + 129 * gradT);

  // Cursor or Crosshair pattern
  // Target rings:
  const ring1 = Math.abs(dist - 0.28) < 0.04;
  const ring2 = Math.abs(dist - 0.12) < 0.035;
  const crosshair = (Math.abs(nx - cx) < 0.035 && Math.abs(ny - cy) < 0.35) ||
                    (Math.abs(ny - cy) < 0.035 && Math.abs(nx - cx) < 0.35);
  const centerDot = dist < 0.055;

  if (ring1 || ring2 || crosshair || centerDot) {
    return [255, 255, 255, 255]; // White crosshair
  }

  return [bgR, bgG, bgB, 255];
}

const sizes = [16, 48, 128];
sizes.forEach(size => {
  const pngBuf = createPng(size, size, drawIcon);
  fs.writeFileSync(path.join(__dirname, 'icons', `icon-${size}.png`), pngBuf);
  console.log(`Generated icon-${size}.png (${size}x${size})`);
});
