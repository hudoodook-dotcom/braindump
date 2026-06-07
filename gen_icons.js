const fs = require('fs');
const zlib = require('zlib');

// --- CRC32 ---
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      raw[p++] = rgba[i]; raw[p++] = rgba[i + 1]; raw[p++] = rgba[i + 2]; raw[p++] = rgba[i + 3];
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// --- Draw icon ---
function make(S, path) {
  const rgba = new Uint8Array(S * S * 4);
  const cx0 = S / 2, cy0 = S / 2;
  const theta = (18 * Math.PI) / 180;
  const cosT = Math.cos(theta), sinT = Math.sin(theta);
  const r = S * 0.22;                // corner radius
  const cx = S * 0.5, top = S * 0.18, height = S * 0.64, A = S * 0.24;
  const lw = Math.max(2, S * 0.02);  // vein width
  const SS = 2;                      // supersample

  const inRoundRect = (x, y) => {
    if (x < 0 || y < 0 || x > S || y > S) return false;
    const rx = Math.min(x, S - x), ry = Math.min(y, S - y);
    if (rx >= r && ry >= r) return true;
    if (rx >= r || ry >= r) return true;
    const dx = r - rx, dy = r - ry;
    return dx * dx + dy * dy <= r * r;
  };
  // returns 0=outside, 1=cream leaf, 2=vein
  const leafAt = (x, y) => {
    const dx = x - cx0, dy = y - cy0;
    const lx = cx0 + (dx * cosT + dy * sinT);
    const ly = cy0 + (-dx * sinT + dy * cosT);
    const t = (ly - top) / height;
    if (t < 0 || t > 1) return 0;
    const w = A * Math.sin(Math.PI * t);
    if (Math.abs(lx - cx) > w) return 0;
    if (Math.abs(lx - cx) <= lw / 2 && t > 0.04 && t < 0.96) return 2;
    return 1;
  };

  const BG = [164, 117, 81], CREAM = [255, 250, 243];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let rs = 0, gs = 0, bs = 0, as = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
          let col = null;
          if (inRoundRect(px, py)) {
            const lf = leafAt(px, py);
            col = lf === 1 ? CREAM : BG; // vein(2) and bg both brown
          }
          if (col) { rs += col[0]; gs += col[1]; bs += col[2]; as += 255; }
        }
      }
      const n = SS * SS, i = (y * S + x) * 4;
      rgba[i] = Math.round(rs / n); rgba[i + 1] = Math.round(gs / n);
      rgba[i + 2] = Math.round(bs / n); rgba[i + 3] = Math.round(as / n);
    }
  }
  fs.writeFileSync(path, encodePNG(S, S, rgba));
  console.log('saved', path);
}

make(192, 'icon-192.png');
make(512, 'icon-512.png');
