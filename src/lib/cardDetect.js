// Decides, from a small grayscale picture of the camera area, whether a business card is sitting inside the guide
// frame and is being held still. No libraries: a Sobel edge map, then three questions:
//   1. Do the card's edges run along all four sides of the guide?   (the card "fits" the frame)
//   2. (Writing inside is NOT required: the back of many cards is blank.)
//   3. Is the picture the same as a moment ago?                       (the phone is steady, so the photo is sharp)

const EDGE = 16;        // gradient strength (about 0-255 brightness steps) that counts as an edge
const SIDE_NEED = 0.4;  // share of each guide side that must have an edge on it
const INNER_NEED = 0;   // not required: the back of many cards is blank
const CONTRAST = 14;    // how much lighter or darker the card is than what is just outside it, on every side
const STEADY = 12;       // average change (blocks of the inside, 0-255) since the last look that still counts as held still

function gradient(gray, W, H) {
  const g = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const gx = (gray[i - W + 1] + 2 * gray[i + 1] + gray[i + W + 1] - gray[i - W - 1] - 2 * gray[i - 1] - gray[i + W - 1]) / 4;
      const gy = (gray[i + W - 1] + 2 * gray[i + W] + gray[i + W + 1] - gray[i - W - 1] - 2 * gray[i - W] - gray[i - W + 1]) / 4;
      g[i] = Math.abs(gx) + Math.abs(gy);
    }
  }
  return g;
}

/**
 * gray: Uint8 brightness, W x H. rect: the guide frame inside it { x, y, w, h } in the same pixels.
 * Returns { fits, sides: [top,right,bottom,left], inner, patch } where `patch` is a tiny copy of the inside, used to
 * compare with the next sample for steadiness.
 */
export function analyzeGray(gray, W, H, rect, g = gradient(gray, W, H)) {
  const reach = Math.max(3, Math.round(Math.min(rect.w, rect.h) * 0.08)); // how far the card edge may sit from the frame line
  const trim = 0.12; // ignore the rounded corners
  // nx, ny point from the frame line towards the inside of the card. At each point along the side we look a few pixels
  // either way for the strongest edge (so a card held a little off the line still counts), then compare the brightness
  // just inside that edge with just outside it.
  const OFF = 3;
  const px = (xx, yy) => gray[Math.min(H - 1, Math.max(0, Math.round(yy))) * W + Math.min(W - 1, Math.max(0, Math.round(xx)))];
  const side = (x0, y0, x1, y1, nx, ny) => {
    const n = Math.max(8, Math.round(Math.hypot(x1 - x0, y1 - y0)));
    let hit = 0, tot = 0, diff = 0;
    for (let i = Math.round(n * trim); i < n - Math.round(n * trim); i++) {
      const t = i / n;
      const bx = x0 + (x1 - x0) * t, by = y0 + (y1 - y0) * t;
      tot++;
      let best = 0, bk = 0;
      for (let k = -reach; k <= reach; k++) {
        const qx = Math.round(bx + nx * k), qy = Math.round(by + ny * k);
        if (qx < 1 || qy < 1 || qx >= W - 1 || qy >= H - 1) continue;
        const v = g[qy * W + qx];
        if (v > best) { best = v; bk = k; }
      }
      if (best >= EDGE) {
        hit++;
        diff += px(bx + nx * (bk + OFF), by + ny * (bk + OFF)) - px(bx + nx * (bk - OFF), by + ny * (bk - OFF));
      }
    }
    return { share: tot ? hit / tot : 0, diff: hit ? diff / hit : 0 };
  };
  const { x, y, w, h } = rect;
  const parts = [
    side(x, y, x + w, y, 0, 1),
    side(x + w, y, x + w, y + h, -1, 0),
    side(x, y + h, x + w, y + h, 0, -1),
    side(x, y, x, y + h, 1, 0),
  ];
  const sides = parts.map((p) => p.share);
  // The card must stand out from its surroundings the same way on all four sides (all lighter, or all darker).
  const lighter = parts.every((p) => p.diff >= CONTRAST);
  const darker = parts.every((p) => p.diff <= -CONTRAST);

  // Writing inside the card (kept clear of the border band).
  const ix0 = Math.round(x + w * 0.1), ix1 = Math.round(x + w * 0.9);
  const iy0 = Math.round(y + h * 0.15), iy1 = Math.round(y + h * 0.85);
  let sum = 0, cnt = 0;
  for (let yy = iy0; yy < iy1; yy++) for (let xx = ix0; xx < ix1; xx++) { sum += g[yy * W + xx]; cnt++; }
  const inner = cnt ? sum / cnt : 0;

  // 8 x 5 grid of average brightness over the inside. Averaging blocks means a small hand tremor barely changes it.
  const PW = 8, PH = 5, patch = new Uint8Array(PW * PH);
  for (let py = 0; py < PH; py++) {
    for (let px = 0; px < PW; px++) {
      const bx0 = ix0 + Math.floor(((ix1 - ix0) * px) / PW), bx1 = ix0 + Math.floor(((ix1 - ix0) * (px + 1)) / PW);
      const by0 = iy0 + Math.floor(((iy1 - iy0) * py) / PH), by1 = iy0 + Math.floor(((iy1 - iy0) * (py + 1)) / PH);
      let t = 0, c = 0;
      for (let yy = by0; yy < Math.max(by1, by0 + 1); yy++) for (let xx = bx0; xx < Math.max(bx1, bx0 + 1); xx++) { t += gray[Math.min(H - 1, yy) * W + Math.min(W - 1, xx)]; c++; }
      patch[py * PW + px] = c ? t / c : 0;
    }
  }
  const fits = sides.every((s) => s >= SIDE_NEED) && (lighter || darker) && inner >= INNER_NEED;
  return { fits, sides, inner, patch, contrast: parts.map((p) => p.diff) };
}

export function patchChange(a, b) {
  if (!a || !b || a.length !== b.length) return 255;
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]);
  return d / a.length;
}

export const isSteady = (change) => change <= STEADY;

/**
 * Feed it one analysis per sample. It says how far along the "hold still" countdown we are (0..1) and when to shoot.
 * `needed` steady, fitting samples in a row trigger the capture.
 */
export function createAutoShutter(needed = 3) {
  let prev = null, streak = 0, recent = [];
  const WINDOW = 10, LOOSE_NEED = 8, LOOSE_LIMIT = 18;
  return {
    reset() { prev = null; streak = 0; recent = []; },
    push(result) {
      const change = prev ? patchChange(prev, result.patch) : 0;
      prev = result.patch;
      const steady = change <= STEADY;
      // Fast path: fitting and still for a few looks in a row.
      // A fitting-but-moving look neither adds nor loses progress; losing the card loses it quickly.
      if (result.fits) { if (steady) streak++; } else streak = Math.max(0, streak - 2);
      // Slow path for a shaky hand: the card has fitted in most of the last ten looks and nothing is flying around.
      recent.push(result.fits && change <= LOOSE_LIMIT); if (recent.length > WINDOW) recent.shift();
      const loose = recent.length >= WINDOW && recent.filter(Boolean).length >= LOOSE_NEED;
      const progress = Math.min(1, Math.max(streak / needed, loose ? 0.9 : recent.filter(Boolean).length / WINDOW / 0.8 * 0.9));
      return { progress: result.fits ? progress : Math.min(progress, 0.5), fits: result.fits, fire: streak >= needed || loose };
    },
  };
}

/**
 * When the card does not fit the frame, say what to do about it. The same four-sides test is tried on copies of the
 * frame that are smaller (card is small in the picture: move closer) and larger (card is big: move farther), and
 * on the frame turned on its side (card is the other way round).
 * Returns 'closer' | 'farther' | 'rotate' | null.
 */
export function adviseFrame(gray, W, H, rect) {
  const g = gradient(gray, W, H);
  if (analyzeGray(gray, W, H, rect, g).fits) return null;
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const at = (k, flip = false) => {
    const w = (flip ? rect.h : rect.w) * k, h = (flip ? rect.w : rect.h) * k;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  };
  const inside = (r) => r.x > 3 && r.y > 3 && r.x + r.w < W - 3 && r.y + r.h < H - 3;
  const fitsAt = (r) => inside(r) && r.w > 12 && r.h > 8 && analyzeGray(gray, W, H, r, g).fits;
  // Steps are wider than the tolerance of the test (a card may sit a little off the line and still fit).
  for (const k of [0.78, 0.66, 0.54, 0.44]) if (fitsAt(at(k))) return 'closer';
  for (const k of [1.2, 1.34, 1.5]) if (fitsAt(at(k))) return 'farther';
  for (const k of [1, 0.8, 0.64]) if (fitsAt(at(k, true))) return 'rotate';
  return null;
}
