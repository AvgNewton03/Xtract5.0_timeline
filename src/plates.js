/**
 * Convolve a 3x3 sharpening kernel over canvas imageData
 * High-pass filter restores building edges, cranes, and fine silhouettes
 */
function applySharpen(ctx, width, height, amount = 0.35) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const src = imgData.data;
  const output = ctx.createImageData(width, height);
  const dst = output.data;

  // 3x3 sharpening kernel:
  // [  0,  -k,   0 ]
  // [ -k, 1+4k, -k ]
  // [  0,  -k,   0 ]
  const k = amount;
  const center = 1 + 4 * k;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      for (let c = 0; c < 3; c++) {
        const top = ((y - 1) * width + x) * 4 + c;
        const bottom = ((y + 1) * width + x) * 4 + c;
        const left = (y * width + (x - 1)) * 4 + c;
        const right = (y * width + (x + 1)) * 4 + c;

        const val =
          src[idx + c] * center -
          (src[top] + src[bottom] + src[left] + src[right]) * k;

        dst[idx + c] = Math.min(255, Math.max(0, val));
      }
      dst[idx + 3] = src[idx + 3]; // Preserve original alpha
    }
  }

  ctx.putImageData(output, 0, 0);
}

export async function preparePlate(url, opts = {}) {
  const {
    exposure = 1.0,
    contrast = 1.0,
    saturation = 1.0,
    sharpen = 0.45,
  } = opts;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      // Apply CSS filter grading pass
      ctx.filter = `brightness(${exposure}) contrast(${contrast}) saturate(${saturation})`;
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';

      // Apply physical pixel-level convolution sharpening
      if (sharpen > 0 && canvas.width <= 3840) {
        applySharpen(ctx, canvas.width, canvas.height, sharpen);
      }

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(url);
            return;
          }
          resolve(URL.createObjectURL(blob));
        },
        'image/png'
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}