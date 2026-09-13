// Prepares background plates for display without touching the source files.
// The plates are only 736–1600px wide, so on large screens the browser stretches
// them and they go soft. Each one is resampled once to the screen's real pixel
// size with high-quality smoothing, given a gentle unsharp mask, and has its
// grade baked in — so no CSS filter has to run while slides animate.

const MAX_WIDTH = 2400;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Size that covers the largest screen this device can show, at device pixels
function targetSize(iw, ih) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const sw = Math.max(window.screen?.width || 0, window.innerWidth) * dpr;
  const sh = Math.max(window.screen?.height || 0, window.innerHeight) * dpr;
  let s = Math.max(sw / iw, sh / ih);
  s = Math.min(s, MAX_WIDTH / iw);
  s = Math.max(s, 1);
  return { w: Math.round(iw * s), h: Math.round(ih * s), s };
}

// Separable box blur on RGB with running sums — O(pixels) regardless of radius
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h * 3);
  const out = new Float32Array(w * h * 3);
  const d = 2 * r + 1;

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let c = 0; c < 3; c++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[(row + Math.min(w - 1, Math.max(0, k))) * 4 + c];
      for (let x = 0; x < w; x++) {
        tmp[(row + x) * 3 + c] = acc / d;
        acc += src[(row + Math.min(w - 1, x + r + 1)) * 4 + c] - src[(row + Math.max(0, x - r)) * 4 + c];
      }
    }
  }

  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += tmp[(Math.min(h - 1, Math.max(0, k)) * w + x) * 3 + c];
      for (let y = 0; y < h; y++) {
        out[(y * w + x) * 3 + c] = acc / d;
        acc += tmp[(Math.min(h - 1, y + r + 1) * w + x) * 3 + c] - tmp[(Math.max(0, y - r) * w + x) * 3 + c];
      }
    }
  }
  return out;
}

/**
 * @param {string} url source plate
 * @param {{exposure?: number, contrast?: number, saturation?: number}} grade
 * @returns {Promise<string>} object URL of the prepared plate
 */
export async function preparePlate(url, grade = {}) {
  const { exposure = 1, contrast = 1, saturation = 1 } = grade;
  const img = await loadImage(url);
  const { w, h, s } = targetSize(img.naturalWidth, img.naturalHeight);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;

  // Heavier upscales get a wider, stronger mask
  const radius = s > 1.8 ? 2 : 1;
  const amount = 0.35 + 0.22 * Math.min(Math.max(s - 1, 0), 2);
  const blur = boxBlur(px, w, h, radius);

  for (let i = 0, j = 0; i < px.length; i += 4, j += 3) {
    let r = px[i];
    let g = px[i + 1];
    let b = px[i + 2];

    // Sharpen edges only — flat sky and JPEG noise are left alone
    const dr = r - blur[j];
    const dg = g - blur[j + 1];
    const db = b - blur[j + 2];
    if (Math.abs(dr) + Math.abs(dg) + Math.abs(db) > 6) {
      r += amount * dr;
      g += amount * dg;
      b += amount * db;
    }

    r = (r * exposure - 128) * contrast + 128;
    g = (g * exposure - 128) * contrast + 128;
    b = (b * exposure - 128) * contrast + 128;

    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    px[i] = l + (r - l) * saturation; // Uint8ClampedArray clamps + rounds
    px[i + 1] = l + (g - l) * saturation;
    px[i + 2] = l + (b - l) * saturation;
  }

  ctx.putImageData(data, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.93));
  if (!blob) throw new Error(`Could not encode ${url}`);
  return URL.createObjectURL(blob);
}
