// Dependency-free PNG icon generator for Bruna.
// Renders a minimal "coffee from above" mark (Nordic, warm) at 4x supersample
// and encodes real PNGs via Node's built-in zlib. No native deps, no network.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(OUT, { recursive: true });

// ---- Palette ----
const CLAY = [180, 105, 62];       // #B4693E
const CLAY_DEEP = [150, 82, 46];   // ring behind cup
const CREAM = [241, 231, 214];     // #F1E7D6 cup
const ESPRESSO = [58, 42, 32];     // #3A2A20 coffee
const CREMA = [196, 142, 92];      // crema highlight

// ---- tiny PNG encoder ----
const CRC_TABLE = (() => {
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
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
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
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- drawing helpers (normalized 0..1 coords) ----
function mix(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}
// smooth coverage of a disc centered at (cx,cy) radius r, aa in same units
function disc(x, y, cx, cy, r) {
  const d = Math.hypot(x - cx, y - cy);
  return d - r; // signed distance; <0 inside
}
// rounded-rect signed distance, half-size (hx,hy), corner radius cr, centered 0.5
function roundedRect(x, y, hx, hy, cr) {
  const qx = Math.abs(x - 0.5) - (hx - cr);
  const qy = Math.abs(y - 0.5) - (hy - cr);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - cr;
}

// Render one icon. maskable=true → full-bleed, no rounded corners, tighter mark.
function render(size, { maskable = false } = {}) {
  const SS = 4;
  const W = size * SS;
  const px = 1 / W; // one output pixel in normalized units (for AA width)
  const buf = Buffer.alloc(W * W * 4);

  const corner = maskable ? 0 : 0.16; // rounded square unless maskable
  const cupR = maskable ? 0.30 : 0.335;
  const rimR = cupR - (maskable ? 0.035 : 0.04);
  const coffeeR = rimR - (maskable ? 0.03 : 0.035);
  const cremaR = coffeeR * 0.46;

  const aa = px * 1.5;
  const cover = (sd) => {
    // coverage from signed distance: 1 inside, 0 outside, smooth across aa band
    return Math.min(1, Math.max(0, 0.5 - sd / aa));
  };

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / W;

      // start transparent
      let r = 0, g = 0, b = 0, a = 0;

      // background rounded square (clay), subtle vertical warm gradient
      const bgCover = cover(roundedRect(nx, ny, 0.5, 0.5, corner));
      if (bgCover > 0) {
        const grad = mix(mix(CLAY, CLAY_DEEP, 0.0), CLAY_DEEP, ny * 0.55);
        r = grad[0]; g = grad[1]; b = grad[2]; a = bgCover;
      }

      const paint = (col, sd) => {
        const c = cover(sd);
        if (c <= 0) return;
        const t = c; // over existing
        r = col[0] * t + r * (1 - t);
        g = col[1] * t + g * (1 - t);
        b = col[2] * t + b * (1 - t);
        a = Math.max(a, t);
      };

      // faint deep-clay saucer ring behind the cup for depth
      paint(CLAY_DEEP, disc(nx, ny, 0.5, 0.5, cupR + 0.028));
      // cup (cream)
      paint(CREAM, disc(nx, ny, 0.5, 0.5, cupR));
      // inner clay rim gap
      paint(mix(CLAY, CLAY_DEEP, 0.3), disc(nx, ny, 0.5, 0.5, rimR));
      // coffee
      paint(ESPRESSO, disc(nx, ny, 0.5, 0.5, coffeeR));
      // crema highlight, offset up-left for a hand-poured feel
      paint(CREMA, disc(nx, ny, 0.5 - coffeeR * 0.18, 0.5 - coffeeR * 0.2, cremaR));

      const i = (y * W + x) * 4;
      buf[i] = Math.round(r);
      buf[i + 1] = Math.round(g);
      buf[i + 2] = Math.round(b);
      buf[i + 3] = Math.round(a * 255);
    }
  }

  // downsample SSxSS -> size
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * W + (x * SS + sx)) * 4;
          r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; a += buf[i + 3];
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = Math.round(a / n);
    }
  }
  return encodePNG(size, size, out);
}

const targets = [
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  ["maskable-512.png", 512, { maskable: true }],
  ["apple-touch-icon-180.png", 180, { maskable: true }],
  ["favicon-32.png", 32, {}],
];
for (const [name, size, opts] of targets) {
  writeFileSync(join(OUT, name), render(size, opts));
  console.log("wrote", name);
}

// SVG favicon (crisp at any size) mirroring the PNG mark
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="0" y="0" width="100" height="100" rx="16" fill="#B4693E"/>
  <circle cx="50" cy="50" r="35.5" fill="#96522e"/>
  <circle cx="50" cy="50" r="33.5" fill="#F1E7D6"/>
  <circle cx="50" cy="50" r="29.5" fill="#a95f38"/>
  <circle cx="50" cy="50" r="26" fill="#3A2A20"/>
  <circle cx="45.2" cy="44.8" r="11.5" fill="#C48E5C" opacity="0.9"/>
</svg>
`;
writeFileSync(join(OUT, "favicon.svg"), svg);
console.log("wrote favicon.svg");
