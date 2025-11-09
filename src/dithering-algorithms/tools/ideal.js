/*
Algorithm description:

Gives a close approximation of the idealized percieved image in the color gamut created by the palette using colors that are mixes of palette colors.

This is useful as a tool for identifying regions of an image that can not be displayed by the gamut created by the palette. It's then relatively easy to adjust the Black point and White point to get those regions inside the gamut.
*/

import {
  lRGBToColorspace,
  imageDatatolRGB,
  linearDatatoImageData,
  parseCSSColorString
} from '../helper-functions/color-math.js';

import { patternFromName } from '../helper-functions/pattern-from-name.js';

export function ideal({
  imgData,
  palette,
  patternSize,
  pattern,
  callback,
  colorspace
}) {
  const paletteLRGB = palette.map(parseCSSColorString);
  const paletteInColorSpace = paletteLRGB.map(c => lRGBToColorspace(...c, colorspace));

  const width = imgData.width;
  const height = imgData.height;
  const totalPixels = width * height;

  const ditheredLRGB = new Float64Array(totalPixels * 3);

  const sourceLRGB = imageDatatolRGB(imgData);

  const patternFunction = patternFromName(pattern);

  let t = performance.now();

  for(let i = 0; i < totalPixels; i++) {
    const pixelIndex3 = i * 3;

    const candidates = patternFunction([
      sourceLRGB[pixelIndex3],
      sourceLRGB[pixelIndex3 + 1],
      sourceLRGB[pixelIndex3 + 2]
    ], paletteLRGB, paletteInColorSpace, patternSize);

    const color = candidates.reduce((a, b) => {
      return [
        a[0] + paletteLRGB[b][0],
        a[1] + paletteLRGB[b][1],
        a[2] + paletteLRGB[b][2]
      ];
    }, [0, 0, 0]);

    ditheredLRGB[pixelIndex3] = color[0] / candidates.length;
    ditheredLRGB[pixelIndex3 + 1] = color[1] / candidates.length;
    ditheredLRGB[pixelIndex3 + 2] = color[2] / candidates.length;

    if(performance.now() - t > 1000) {
      callback(linearDatatoImageData(ditheredLRGB, width, height));
      t = performance.now();
    }
  }

  callback(linearDatatoImageData(ditheredLRGB, width, height));
}
