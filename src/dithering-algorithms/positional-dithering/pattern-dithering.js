/*
Algorithm description:


*/

import {
  lRGBToColorspace,
  imageDatatolRGB,
  linearDatatoImageData,
  parseCSSColorString,
  matrixByName
} from '../helper-functions/color-math.js';

import { patternFromName } from '../helper-functions/pattern-from-name.js';


export function patternDithering({
  imgData,
  palette,
  patternSize,
  ditherMatrix,
  pattern,
  callback,
  colorspace,
  viewingCondition
}) {
  const paletteLRGB = palette.map(parseCSSColorString);
  const paletteInColorSpace = paletteLRGB.map(c => lRGBToColorspace(...c, colorspace, viewingCondition));

  const width = imgData.width;
  const height = imgData.height;

  const ditheredLRGB = new Float64Array(width * height * 3);

  const sourceLRGB = imageDatatolRGB(imgData);

  const patternFunction = patternFromName(pattern);

  const matrix = matrixByName(ditherMatrix);

  const matrixHeight = matrix.length;
  const matrixWidth = matrix[0].length;

  let t = performance.now();

  for(let y = 0; y < height; y++) {
    for(let x = 0; x < width; x++) {
      const pixelIndex3 = (x + y * width) * 3;

      const candidates = patternFunction([
        sourceLRGB[pixelIndex3],
        sourceLRGB[pixelIndex3 + 1],
        sourceLRGB[pixelIndex3 + 2]
      ], paletteLRGB, paletteInColorSpace, patternSize);

      candidates.sort((a, b) => paletteInColorSpace[a][2] - paletteInColorSpace[b][2]);

      const threshold = matrix[y % matrixHeight][x % matrixWidth];

      const color = paletteLRGB[candidates[Math.floor(threshold * candidates.length)]];

      ditheredLRGB[pixelIndex3] = color[0];
      ditheredLRGB[pixelIndex3 + 1] = color[1];
      ditheredLRGB[pixelIndex3 + 2] = color[2];
    }

    if(performance.now() - t > 1000) {
      callback(linearDatatoImageData(ditheredLRGB, width, height));
      t = performance.now();
    }
  }
  callback(linearDatatoImageData(ditheredLRGB, width, height));
}
