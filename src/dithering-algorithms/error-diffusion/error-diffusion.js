import {
  parseCSSColorString,
  lRGBtosRGB,
  lRGBToColorspace,
  imageDatatolRGB,
  findClosestPaletteColor
} from '../helper-functions/color-math.js';

export function errorDiffusion(imgData, palette, matrix, colorspace) {
  const paletteLRGB = palette.map(parseCSSColorString);
  const paletteSRGB = paletteLRGB.map(c => lRGBtosRGB(...c));
  const paletteInColorSpace = paletteLRGB.map(c => lRGBToColorspace(...c, colorspace));

  const width = imgData.width;
  const height = imgData.height;

  const sourceLRGB = imageDatatolRGB(imgData);

  const ditheredData = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;

      const r = sourceLRGB[i];
      const g= sourceLRGB[i + 1];
      const b = sourceLRGB[i + 2];

      const pixelInColorSpace = lRGBToColorspace(r, g, b);
      const bestMatchIndex = findClosestPaletteColor(pixelInColorSpace, paletteInColorSpace);
      const bestMatchColor = paletteLRGB[bestMatchIndex];

      const srgb = paletteSRGB[bestMatchIndex];
      const ditheredI = (y * width + x) * 4;
      ditheredData[ditheredI] = srgb[0] * 255;
      ditheredData[ditheredI + 1] = srgb[1] * 255;
      ditheredData[ditheredI + 2] = srgb[2] * 255;
      ditheredData[ditheredI + 3] = 255;

      const errR = r - bestMatchColor[0];
      const errG = g - bestMatchColor[1];
      const errB = b - bestMatchColor[2];

      for (const {
          x: dx,
          y: dy,
          w
        }
        of matrix) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const ni = (ny * width + nx) * 3;
          sourceLRGB[ni + 0] = Math.min(1, Math.max(0, sourceLRGB[ni + 0] + errR * w));
          sourceLRGB[ni + 1] = Math.min(1, Math.max(0, sourceLRGB[ni + 1] + errG * w));
          sourceLRGB[ni + 2] = Math.min(1, Math.max(0, sourceLRGB[ni + 2] + errB * w));
        }
      }
    }
  }

  return new ImageData(ditheredData, width, height);
}
