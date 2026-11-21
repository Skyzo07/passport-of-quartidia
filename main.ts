// passport-of-quartidia — main.ts
// "The Passport Page of a Country That Isn't There" (make.fun, free bounty).
// Draws ONE invented passport spread: the Republic of Quartidia, a country
// that exists only on 29 February, one day every four years.
// Pure Node 22 stdlib: own pixel buffer + zlib PNG writer. No network, no
// external assets, no fonts from disk. Deterministic: two runs are
// byte-identical.   node main.ts   ->   /output/entry.png (1024x1024)
import { mkdirSync, writeFileSync } from "node:fs";
import zlib from "node:zlib";

type RGB = [number, number, number];

// ---------------------------------------------------------------- canvas
class Canvas {
  w: number; h: number; px: Uint8Array;
  constructor(w: number, h: number, bg: RGB) {
    this.w = w; this.h = h; this.px = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) { this.px[i * 3] = bg[0]; this.px[i * 3 + 1] = bg[1]; this.px[i * 3 + 2] = bg[2]; }
  }
  set(x: number, y: number, c: RGB): void {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.px[i] = c[0]; this.px[i + 1] = c[1]; this.px[i + 2] = c[2];
  }
  get(x: number, y: number): RGB {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0];
    const i = (y * this.w + x) * 3;
    return [this.px[i], this.px[i + 1], this.px[i + 2]];
  }
  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.ceil(x + w)), y1 = Math.min(this.h, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.set(xx, yy, c);
  }
  vGrad(x: number, y: number, w: number, h: number, top: RGB, bot: RGB): void {
    for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(this.h, Math.ceil(y + h)); yy++) {
      const t = h <= 1 ? 0 : (yy - y) / h;
      this.fillRect(x, yy, w, 1, [
        Math.round(top[0] + (bot[0] - top[0]) * t),
        Math.round(top[1] + (bot[1] - top[1]) * t),
        Math.round(top[2] + (bot[2] - top[2]) * t),
      ]);
    }
  }
  fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      const dx = (xx - cx) / rx, dy = (yy - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.set(xx, yy, c);
    }
  }
  fillCircle(cx: number, cy: number, r: number, c: RGB): void { this.fillEllipse(cx, cy, r, r, c); }
  ellipseOutline(cx: number, cy: number, rx: number, ry: number, c: RGB, t = 1): void {
    for (let a = 0; a < 720; a++) {
      const th = (a / 720) * Math.PI * 2;
      for (let k = 0; k < t; k++) this.set(Math.round(cx + (rx - k) * Math.cos(th)), Math.round(cy + (ry - k) * Math.sin(th)), c);
    }
  }
  circleOutline(cx: number, cy: number, r: number, c: RGB, t = 1): void { this.ellipseOutline(cx, cy, r, r, c, t); }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
    const dx = x1 - x0, dy = y1 - y0, steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + (dx * i) / steps), y = Math.round(y0 + (dy * i) / steps);
      for (let a = 0; a < t; a++) for (let b = 0; b < t; b++) this.set(x + a, y + b, c);
    }
  }
  hline(x: number, y: number, w: number, c: RGB, t = 1): void { this.fillRect(x, y, w, t, c); }
  vline(x: number, y: number, h: number, c: RGB, t = 1): void { this.fillRect(x, y, t, h, c); }
  rectOutline(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
    this.fillRect(x, y, w, t, c); this.fillRect(x, y + h - t, w, t, c);
    this.fillRect(x, y, t, h, c); this.fillRect(x + w - t, y, t, h, c);
  }
  roundRectOutline(x: number, y: number, w: number, h: number, r: number, c: RGB, t = 1): void {
    this.hline(x + r, y, w - 2 * r, c, t); this.hline(x + r, y + h - t, w - 2 * r, c, t);
    this.vline(x, y + r, h - 2 * r, c, t); this.vline(x + w - t, y + r, h - 2 * r, c, t);
    const corners: [number, number, number, number][] = [[x + r, y + r, -1, -1], [x + w - r, y + r, 1, -1], [x + r, y + h - r, -1, 1], [x + w - r, y + h - r, 1, 1]];
    for (const [cx, cy, sx, sy] of corners)
      for (let a = 0; a <= 90; a++) {
        const th = (a * Math.PI) / 180;
        for (let k = 0; k < t; k++)
          this.set(Math.round(cx + sx * (r - k) * Math.cos(th)), Math.round(cy + sy * (r - k) * Math.sin(th)), c);
      }
  }
  // Blit another canvas rotated by `deg` about its centre onto (cx, cy).
  // Pixels equal to `key` in the source are transparent.
  blitRotated(src: Canvas, cx: number, cy: number, deg: number, key: RGB): void {
    const rad = (deg * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    const hw = src.w / 2, hh = src.h / 2;
    const R = Math.ceil(Math.sqrt(hw * hw + hh * hh)) + 2;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      // inverse rotation: source point = R(-deg) * (dest - centre) + centre
      const sxx = dx * cos + dy * sin + hw;
      const syy = -dx * sin + dy * cos + hh;
      const ix = Math.round(sxx), iy = Math.round(syy);
      if (ix < 0 || iy < 0 || ix >= src.w || iy >= src.h) continue;
      const p = src.get(ix, iy);
      if (p[0] === key[0] && p[1] === key[1] && p[2] === key[2]) continue;
      this.set(cx + dx, cy + dy, p);
    }
  }
}

// ---------------------------------------------------------------- PNG out
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function toPNG(cv: Canvas): Buffer {
  const raw = Buffer.alloc(cv.h * (1 + cv.w * 3));
  for (let y = 0; y < cv.h; y++) {
    raw[y * (1 + cv.w * 3)] = 0;
    raw.set(cv.px.subarray(y * cv.w * 3, (y + 1) * cv.w * 3), y * (1 + cv.w * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cv.w, 0); ihdr.writeUInt32BE(cv.h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows of 5 bits, '#' = ink.
const FONT: Record<string, string[]> = {
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  "B": ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  "C": [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  "D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  "E": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  "F": ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  "G": [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  "H": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  "I": [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "J": ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  "K": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  "L": ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  "M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  "N": ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  "O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  "P": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  "Q": [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  "S": [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  "T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  "U": ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  "V": ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  "W": ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
  "X": ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  "Z": ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  "/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", "..#..", ".#..."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
  "<": ["...#.", "..#..", ".#...", "#....", ".#...", "..#..", "...#."],
  ">": [".#...", "..#..", "...#.", "....#", "...#.", "..#..", ".#..."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  "%": ["##..#", "##.#.", "....#", "...#.", "..#..", ".#.#.", "#..##"],
  "*": [".....", "#.#.#", ".###.", "#####", ".###.", "#.#.#", "....."],
};
function textWidth(s: string, scale: number): number {
  if (s.length === 0) return 0;
  return s.length * 6 * scale - scale;
}
function drawText(cv: Canvas, x: number, y: number, s: string, scale: number, c: RGB, align: "left" | "center" | "right" = "left"): void {
  let ox = x;
  if (align === "center") ox = x - Math.floor(textWidth(s, scale) / 2);
  if (align === "right") ox = x - textWidth(s, scale);
  for (let i = 0; i < s.length; i++) {
    const g = FONT[s[i]] ?? FONT["?"];
    for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++)
      if (g[r][col] === "#") cv.fillRect(ox + i * 6 * scale + col * scale, y + r * scale, scale, scale, c);
  }
}
// Word-wrap `s` to lines of at most maxChars, drawn left-aligned.
function drawWrapped(cv: Canvas, x: number, y: number, s: string, scale: number, c: RGB, maxChars: number, lineH: number): number {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur.length === 0) cur = w;
    else if (cur.length + 1 + w.length <= maxChars) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur.length > 0) lines.push(cur);
  lines.forEach((ln, i) => drawText(cv, x, y + i * lineH, ln, scale, c));
  return lines.length;
}

// ---------------------------------------------------------------- ICAO MRZ
const MRZ_VAL: Record<string, number> = {};
for (let i = 0; i < 10; i++) MRZ_VAL[String(i)] = i;
for (let i = 0; i < 26; i++) MRZ_VAL[String.fromCharCode(65 + i)] = 10 + i;
MRZ_VAL["<"] = 0;
function mrzCheck(s: string): number {
  const w = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += (MRZ_VAL[s[i]] ?? 0) * w[i % 3];
  return sum % 10;
}
function buildMRZ(): [string, string] {
  // TD3. Holder: SELIN, ANA MARA. Doc Q29022401. DOB 29 FEB 1996 -> 960229.
  // Expiry 29 FEB 2028 -> 280229. Nationality QTA (Quartidia).
  const line1 = ("P<QTA" + "SELIN" + "<<" + "ANA" + "<" + "MARA").padEnd(44, "<");
  const doc = "Q29022401";
  const dob = "960229";
  const exp = "280229";
  const personal = "290229290229<<";
  const body =
    doc + mrzCheck(doc) + "QTA" + dob + mrzCheck(dob) + "F" + exp + mrzCheck(exp) + personal + mrzCheck(personal);
  const line2 = body + mrzCheck(body);
  return [line1, line2];
}

// ---------------------------------------------------------------- palette
const CREAM: RGB = [246, 241, 227];
const CREAM2: RGB = [240, 234, 214];
const INK: RGB = [31, 42, 68];
const BLUE: RGB = [44, 74, 122];
const GOLD: RGB = [168, 132, 44];
const GOLD_LT: RGB = [196, 164, 84];
const RED: RGB = [138, 47, 47];
const GREEN: RGB = [46, 107, 52];
const PURPLE: RGB = [107, 58, 125];
const GREY: RGB = [110, 108, 96];
const GUILLOCHE: RGB = [214, 205, 178];
const WATERMARK: RGB = [232, 224, 198];
const SKIN: RGB = [233, 196, 156];
const SKIN_DK: RGB = [214, 172, 128];
const HAIR: RGB = [51, 36, 29];
const JACKET: RGB = [38, 48, 74];
const LIP: RGB = [176, 106, 94];

// ---------------------------------------------------------------- portrait
// Code-drawn head-and-shoulders passport photo of Ana Mara Selin:
// a woman in her late 20s, dark hair parted in the middle, simple dark jacket.
function drawPortrait(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.vGrad(x, y, w, h, [203, 214, 220], [178, 192, 200]);
  const cx = x + w / 2;
  // shoulders / jacket — everything stays inside the photo rect
  cv.fillEllipse(cx, y + h - 42, Math.round(w * 0.5), 42, JACKET);
  cv.fillRect(x, y + h - 30, w, 30, JACKET);
  // blouse V at the neck
  cv.line(cx - 16, y + h - 30, cx, y + h - 10, [238, 232, 218], 3);
  cv.line(cx + 16, y + h - 30, cx, y + h - 10, [238, 232, 218], 3);
  // lapels
  cv.line(cx - 14, y + h - 28, cx - 30, y + h - 4, [24, 32, 54], 2);
  cv.line(cx + 14, y + h - 28, cx + 30, y + h - 4, [24, 32, 54], 2);
  // neck + shadow under chin
  cv.fillRect(cx - 12, y + 112, 24, 34, SKIN);
  cv.fillRect(cx - 12, y + 112, 24, 7, SKIN_DK);
  // hair: back mass, then face, then fringe and side strands (long hair
  // covers the ears, as in a real passport photo)
  cv.fillEllipse(cx, y + 64, 46, 54, HAIR);
  cv.fillEllipse(cx, y + 80, 37, 45, SKIN);
  // fringe: centre part, sweeping to both sides, clear of the brows
  cv.fillEllipse(cx, y + 46, 38, 15, HAIR);
  cv.fillEllipse(cx - 22, y + 54, 15, 11, HAIR);
  cv.fillEllipse(cx + 22, y + 54, 15, 11, HAIR);
  // side strands down past the jaw to the shoulders
  cv.fillRect(x + 22, y + 58, 16, 86, HAIR);
  cv.fillRect(x + w - 38, y + 58, 16, 86, HAIR);
  cv.fillEllipse(x + 30, y + 144, 8, 9, HAIR);
  cv.fillEllipse(x + w - 30, y + 144, 8, 9, HAIR);
  // brows
  cv.line(cx - 24, y + 68, cx - 9, y + 66, HAIR, 2);
  cv.line(cx + 9, y + 66, cx + 24, y + 68, HAIR, 2);
  // eyes
  for (const ex of [cx - 16, cx + 16]) {
    cv.fillEllipse(ex, y + 75, 7, 4, [250, 250, 248]);
    cv.fillCircle(ex, y + 75, 3, [32, 26, 22]);
    cv.fillCircle(ex + 1, y + 74, 1, [240, 240, 235]);
  }
  // nose
  cv.line(cx, y + 77, cx - 1, y + 92, SKIN_DK, 2);
  cv.line(cx - 3, y + 93, cx + 3, y + 93, SKIN_DK, 2);
  // lips
  cv.fillEllipse(cx, y + 104, 10, 3, LIP);
  cv.line(cx - 9, y + 104, cx + 9, y + 104, [140, 74, 66], 1);
  // soft cheek shading on the light side
  cv.fillEllipse(cx + 26, y + 90, 7, 5, [226, 182, 140]);
}

// ---------------------------------------------------------------- coat of arms
// Shield in four quarters around "29", crescent above: Quartidia's emblem.
function drawArms(cv: Canvas, cx: number, top: number): void {
  // crescent
  cv.fillCircle(cx, top + 8, 9, GOLD);
  cv.fillCircle(cx + 4, top + 6, 8, CREAM);
  // shield outline (polygon)
  const pts: [number, number][] = [[cx - 28, top + 22], [cx + 28, top + 22], [cx + 28, top + 52], [cx, top + 74], [cx - 28, top + 52]];
  // fill quarters
  cv.fillRect(cx - 28, top + 22, 28, 15, BLUE);
  cv.fillRect(cx, top + 22, 28, 15, GOLD_LT);
  cv.fillRect(cx - 28, top + 37, 28, 15, GOLD_LT);
  cv.fillRect(cx, top + 37, 28, 15, BLUE);
  // shield border: top, sides, diagonals to the point
  cv.hline(cx - 28, top + 22, 57, INK, 2);
  cv.vline(cx - 28, top + 22, 31, INK, 2);
  cv.vline(cx + 27, top + 22, 31, INK, 2);
  cv.line(cx - 28, top + 52, cx, top + 74, INK, 2);
  cv.line(cx + 28, top + 52, cx, top + 74, INK, 2);
  cv.vline(cx - 1, top + 22, 30, INK, 1);
  cv.hline(cx - 28, top + 37, 56, INK, 1);
  void pts;
  // "29" on a small cream plaque across the shield, clear of the point
  cv.fillRect(cx - 15, top + 34, 30, 18, CREAM);
  cv.rectOutline(cx - 15, top + 34, 30, 18, INK, 1);
  drawText(cv, cx, top + 37, "29", 2, INK, "center");
}

// ---------------------------------------------------------------- stamps
const KEY: RGB = [255, 0, 255];
function stampCanvas(w: number, h: number): Canvas {
  const c = new Canvas(w, h, KEY);
  return c;
}
function drawRectStamp(cv: Canvas, cx: number, cy: number, w: number, h: number, deg: number, color: RGB, lines: { s: string; scale: number }[], sub?: string): void {
  const t = stampCanvas(w, h);
  t.roundRectOutline(3, 3, w - 6, h - 6, 10, color, 3);
  t.roundRectOutline(8, 8, w - 16, h - 16, 7, color, 1);
  let y = 16;
  for (const ln of lines) { drawText(t, w / 2, y, ln.s, ln.scale, color, "center"); y += 7 * ln.scale + 6; }
  if (sub) drawText(t, w / 2, h - 24, sub, 1, color, "center");
  cv.blitRotated(t, cx, cy, deg, KEY);
}
function drawCircleStamp(cv: Canvas, cx: number, cy: number, r: number, deg: number, color: RGB, top: string, mid: string, bot: string): void {
  const d = r * 2 + 8;
  const t = stampCanvas(d, d);
  t.circleOutline(d / 2, d / 2, r, color, 3);
  t.circleOutline(d / 2, d / 2, r - 7, color, 1);
  drawText(t, d / 2, d / 2 - 26, top, 1, color, "center");
  drawText(t, d / 2, d / 2 - 8, mid, 2, color, "center");
  drawText(t, d / 2, d / 2 + 12, bot, 1, color, "center");
  cv.blitRotated(t, cx, cy, deg, KEY);
}

// ---------------------------------------------------------------- guilloche
function guilloche(cv: Canvas, x: number, y: number, w: number, h: number, color: RGB): void {
  for (let row = 0; row < 4; row++) {
    const yy0 = y + row * Math.max(6, Math.floor(h / 4));
    for (let xx = x; xx < x + w; xx++) {
      const yy = yy0 + Math.round(2.5 * Math.sin((xx - x) / 14) + 1.5 * Math.sin((xx - x) / 5));
      cv.set(xx, yy, color);
    }
  }
}
// Faint crescent-island map with Quartidia City marked.
function drawMap(cv: Canvas, x: number, y: number, w: number, h: number): void {
  const cx = x + w / 2, cy = y + h / 2;
  // graticule
  cv.hline(x, cy - 26, w, [226, 230, 222], 1);
  cv.hline(x, cy + 26, w, [226, 230, 222], 1);
  cv.vline(cx - 120, y, h, [226, 230, 222], 1);
  cv.vline(cx + 120, y, h, [226, 230, 222], 1);
  // crescent island: filled ellipse, outline, then a cream bite taken out
  cv.fillEllipse(cx - 8, cy, 108, 42, [203, 216, 208]);
  cv.ellipseOutline(cx - 8, cy, 108, 42, [140, 160, 152], 1);
  cv.fillEllipse(cx + 66, cy - 10, 88, 40, CREAM);
  // small islet to the east
  cv.fillEllipse(cx + 128, cy + 16, 16, 8, [203, 216, 208]);
  cv.ellipseOutline(cx + 128, cy + 16, 16, 8, [140, 160, 152], 1);
  // city dot + label
  cv.fillCircle(cx - 40, cy - 4, 4, RED);
  cv.circleOutline(cx - 40, cy - 4, 7, RED, 1);
  drawText(cv, cx - 28, cy - 8, "QUARTIDIA CITY", 1, INK);
  drawText(cv, cx - 8, cy + 40, "THE ISLE OF QUARTIDIA", 1, GREY, "center");
  drawText(cv, cx - 8, cy + 52, "CHARTED ONLY ON 29 FEBRUARY", 1, GREY, "center");
  // compass
  cv.circleOutline(x + w - 34, y + 22, 12, GREY, 1);
  drawText(cv, x + w - 34, y + 16, "N", 1, INK, "center");
  cv.line(x + w - 34, y + 30, x + w - 34, y + 38, INK, 1);
}
// MRZ is monospace with no inter-glyph gap: 5*scale per char.
function drawMRZLine(cv: Canvas, x: number, y: number, s: string, scale: number, c: RGB): void {
  for (let i = 0; i < s.length; i++) {
    const g = FONT[s[i]] ?? FONT["?"];
    for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++)
      if (g[r][col] === "#") cv.fillRect(x + i * 5 * scale + col * scale, y + r * scale, scale, scale, c);
  }
}
function field(cv: Canvas, x: number, y: number, label: string, value: string): void {
  drawText(cv, x, y, label, 1, GREY);
  drawText(cv, x, y + 10, value, 2, INK);
}
// Signature squiggle in blue ink.
function drawSignature(cv: Canvas, x: number, y: number, w: number): void {
  for (let xx = 0; xx < w; xx += 2) {
    const yy = y + Math.round(4 * Math.sin(xx / 11) + 2 * Math.sin(xx / 4));
    cv.set(x + xx, yy, BLUE);
    cv.set(x + xx, yy + 1, BLUE);
  }
  cv.ellipseOutline(x + 34, y - 2, 7, 5, BLUE, 1);
  cv.ellipseOutline(x + 120, y + 2, 9, 5, BLUE, 1);
  cv.line(x + 150, y - 6, x + 190, y + 6, BLUE, 1);
}

// ---------------------------------------------------------------- build
function build(): Canvas {
  const W = 1024, H = 1024;
  const cv = new Canvas(W, H, CREAM);
  // page tint + centre fold
  cv.fillRect(512, 0, 2, H, [228, 221, 200]);
  cv.fillRect(0, 0, W, 6, CREAM2);
  cv.rectOutline(8, 8, W - 16, H - 16, INK, 2);
  cv.rectOutline(14, 14, W - 28, H - 28, GREY, 1);
  // guilloche bands (behind content)
  guilloche(cv, 24, 640, 464, 24, GUILLOCHE);
  guilloche(cv, 24, 900, 464, 24, GUILLOCHE);
  guilloche(cv, 536, 470, 464, 24, GUILLOCHE);
  guilloche(cv, 536, 940, 464, 24, GUILLOCHE);

  // ================= LEFT PAGE: data page =================
  drawArms(cv, 256, 26);
  drawText(cv, 256, 108, "REPUBLIC OF QUARTIDIA", 3, INK, "center");
  drawText(cv, 256, 138, "PASSPORT", 4, BLUE, "center");
  cv.hline(56, 170, 400, INK, 2);
  cv.hline(56, 174, 400, GOLD, 1);
  drawText(cv, 256, 184, "PASSPORT NO. Q-290224-01", 2, INK, "center");

  // photo
  cv.fillRect(36, 208, 140, 200, [255, 255, 255]);
  drawPortrait(cv, 38, 210, 136, 196);
  cv.rectOutline(36, 208, 140, 200, INK, 2);
  drawText(cv, 106, 414, "PHOTO TAKEN 29 FEB 2024", 1, GREY);
  // small round seal overlapping the photo corner, clear of the caption
  drawCircleStamp(cv, 170, 388, 17, -12, GOLD, "QTA", "29", "FEB");

  // data fields
  const fx = 196, fy = 208, fh = 44;
  field(cv, fx, fy + 0 * fh, "SURNAME", "SELIN");
  field(cv, fx, fy + 1 * fh, "GIVEN NAMES", "ANA MARA");
  field(cv, fx, fy + 2 * fh, "NATIONALITY", "QUARTIDIAN");
  field(cv, fx, fy + 3 * fh, "DATE OF BIRTH", "29 FEB 1996");
  field(cv, fx, fy + 4 * fh, "PLACE OF BIRTH", "QUARTIDIA CITY");
  field(cv, fx, fy + 5 * fh, "SEX", "F");
  field(cv, fx, fy + 6 * fh, "DATE OF ISSUE", "29 FEB 2024");
  field(cv, fx, fy + 7 * fh, "DATE OF EXPIRY", "29 FEB 2028");
  field(cv, fx, fy + 8 * fh, "AGE IN LEAP YEARS", "7");

  // authority + signature (full width of the data page)
  drawText(cv, 36, 636, "AUTHORITY", 1, GREY);
  drawText(cv, 36, 650, "MINISTRY OF QUARTERLY AFFAIRS", 2, INK);
  drawText(cv, 36, 700, "HOLDER'S SIGNATURE", 1, GREY);
  drawSignature(cv, 40, 722, 240);
  cv.hline(36, 736, 250, GREY, 1);
  drawText(cv, 330, 700, "ISSUED AT", 1, GREY);
  drawText(cv, 330, 714, "QUARTIDIA CITY", 2, INK);
  drawText(cv, 330, 736, "29 FEB 2024", 1, BLUE);

  // MRZ
  drawText(cv, 256, 800, "VALID ONLY ON 29 FEBRUARY - SEE CONDITIONS OVERLEAF", 1, RED, "center");
  cv.hline(24, 820, 464, INK, 1);
  const [mrz1, mrz2] = buildMRZ();
  drawMRZLine(cv, 36, 836, mrz1, 2, INK);
  drawMRZLine(cv, 36, 860, mrz2, 2, INK);
  drawText(cv, 256, 922, "THIS PASSPORT REMAINS THE PROPERTY OF THE REPUBLIC OF QUARTIDIA", 1, GREY, "center");
  drawText(cv, 256, 984, "Q-290224-01", 1, GREY, "center");

  // ================= RIGHT PAGE: visas / stamps =================
  drawText(cv, 768, 30, "VISAS", 3, INK, "center");
  cv.hline(548, 62, 440, INK, 2);
  cv.hline(548, 66, 440, GOLD, 1);

  // visa box
  cv.rectOutline(548, 78, 440, 112, BLUE, 2);
  cv.rectOutline(553, 83, 430, 102, BLUE, 1);
  drawText(cv, 568, 92, "VISA - AURELIA", 2, BLUE);
  drawText(cv, 968, 94, "NO. AV-290224-77", 1, GREY, "right");
  drawText(cv, 568, 118, "VISITOR - ONE DAY ONLY", 2, INK);
  drawText(cv, 568, 144, "SINGLE ENTRY - 29 FEB 2024", 2, INK);
  drawText(cv, 568, 170, "VALID ONLY ON 29 FEBRUARY", 1, RED);

  // stamps: one-day trip out on 29 FEB 2024, home again on 29 FEB 2028
  drawRectStamp(cv, 660, 272, 200, 104, -8, RED, [{ s: "EXIT", scale: 2 }, { s: "QUARTIDIA", scale: 2 }], "29 FEB 2024");
  drawRectStamp(cv, 880, 272, 200, 104, 7, GREEN, [{ s: "ENTRY", scale: 2 }, { s: "AURELIA", scale: 2 }], "29 FEB 2024");
  drawRectStamp(cv, 660, 404, 200, 104, 9, RED, [{ s: "EXIT", scale: 2 }, { s: "AURELIA", scale: 2 }], "29 FEB 2024");
  drawRectStamp(cv, 880, 404, 200, 104, -6, GREEN, [{ s: "ENTRY", scale: 2 }, { s: "QUARTIDIA", scale: 2 }], "29 FEB 2028");
  drawCircleStamp(cv, 768, 338, 38, 14, PURPLE, "DEPARTED", "29 FEB", "2024");

  // conditions box — the telling detail
  cv.rectOutline(548, 486, 440, 118, PURPLE, 2);
  cv.rectOutline(553, 491, 430, 108, PURPLE, 1);
  drawText(cv, 568, 500, "CONDITIONS", 2, PURPLE);
  drawWrapped(cv, 568, 526, "HOLDER MUST ENTER AND LEAVE ON 29 FEBRUARY. THIS PASSPORT CEASES TO EXIST AT MIDNIGHT.", 2, INK, 33, 20);

  // leap-fee stamp
  drawRectStamp(cv, 768, 664, 300, 64, -6, GREEN, [{ s: "LEAP FEE PAID", scale: 2 }], "29 COINS - RECEIPT NO. 29-0229");

  // island map (the faint "29" watermark read as smudges — dropped)
  drawMap(cv, 548, 736, 440, 200);

  drawText(cv, 768, 984, "PAGE 29", 1, GREY, "center");
  return cv;
}

// ---------------------------------------------------------------- main
function main(): void {
  const [mrz1, mrz2] = buildMRZ();
  console.log("MRZ line 1 (" + mrz1.length + "): " + mrz1);
  console.log("MRZ line 2 (" + mrz2.length + "): " + mrz2);
  const cv = build();
  const png = toPNG(cv);
  mkdirSync("/output", { recursive: true });
  writeFileSync("/output/entry.png", png);
  console.log("wrote /output/entry.png " + png.length + " bytes, " + cv.w + "x" + cv.h);
}
main();
