/*
Algorithm description:

*/

import {
  lRGBToColorspace,
  imageDatatolRGB,
  linearDatatoColorspace,
  linearDatatoImageData,
  parseCSSColorString,
  imageDelta,
  gaussianBlur,
  ditheredPixelOrder,
  colorDelta,
  findClosestPaletteColor
} from '../helper-functions/color-math.js';

export function leastErrorScan({
  imgData,
  palette,
  kernel,
  kernelSize,
  callback,
  colorspace,
  viewingCondition
}) {
  const paletteLRGB = palette.map(parseCSSColorString);
  const paletteInColorspace = paletteLRGB.map(c => lRGBToColorspace(...c, colorspace, viewingCondition));
  const paletteLength = palette.length;

  const width = imgData.width;
  const height = imgData.height;
  const totalPixels = width * height;

  const ditheredLRGB = new Float64Array(totalPixels * 3);

  const sourceLRGB = imageDatatolRGB(imgData);
  const blurredSourceLRGB = gaussianBlur(sourceLRGB, width, height, kernel, kernelSize);
  const blurredDitheredLRGB = gaussianBlur(sourceLRGB, width, height, kernel, kernelSize);
  const errorMap = new Float64Array(totalPixels);

  const blurredSourceInColorspace = linearDatatoColorspace(blurredSourceLRGB);

  /*
  const pixelOrder = ditheredPixelOrder(width, height);
  /*/
  const pixelOrder = new Float64Array(totalPixels);
  for(let y = 0; y < height; y++) {
    for(let x = 0; x < width; x++) {
      let px = x + y * width;
      pixelOrder[px] = y % 2 ? px : (y + 1) * width - x;
      pixelOrder[px] = px;
    }
  }//*/

  const halfKernel = Math.floor(kernelSize / 2);

  const scorePixel = (i, paletteColor) => {
    const i3 = i * 3;
    let errorDelta = 0;

    const x = i % width;
    const y = Math.floor(i / width);

    const c = paletteLRGB[paletteColor];

    for(let kernelY = 0; kernelY < kernelSize; kernelY++) {
      for(let kernelX = 0; kernelX < kernelSize; kernelX++) {
        const weight = kernel[kernelX + kernelY * kernelSize];
        if (weight === 0) continue;
        const pointX = x + kernelX - halfKernel;
        const pointY = y + kernelY - halfKernel;

        // skip pixel if outside of image
        if (
          pointX < 0 ||
          pointY < 0 ||
          pointX >= width ||
          pointY >= height
        ) continue;

        const p = pointX + pointY * width;
        const p3 = p * 3;

        errorDelta += colorDelta(
          [
            blurredSourceInColorspace[p3],
            blurredSourceInColorspace[p3 + 1],
            blurredSourceInColorspace[p3 + 2]
          ],
          lRGBToColorspace(
            blurredDitheredLRGB[p3 + 0] + (c[0] - sourceLRGB[i3 + 0]) * weight,
            blurredDitheredLRGB[p3 + 1] + (c[1] - sourceLRGB[i3 + 1]) * weight,
            blurredDitheredLRGB[p3 + 2] + (c[2] - sourceLRGB[i3 + 2]) * weight,
          )
        ) - errorMap[p];
      }
    }

    return errorDelta;
  };

  let t = performance.now();
  callback(linearDatatoImageData(ditheredLRGB, width, height));

  let changed = false;
  do {
    changed = false;
    for(let i = 0; i < totalPixels; i++) {
      if(performance.now() - t > 1000) {
        callback(linearDatatoImageData(ditheredLRGB, width, height));
        t = performance.now();
      }

      let best = pixelOrder[i];

      const i3 = best * 3;

      const x = best % width;
      const y = Math.floor(best / width);

      let c = 0;
      let bestScore = Infinity;
      for(let p = 0; p < paletteLength; p++) {
        const score = scorePixel(best, p);
        if(score < bestScore) {
          bestScore = score;
          c = p;
        }
      }

      c = paletteLRGB[c];

      ditheredLRGB[i3 + 0] = c[0];
      ditheredLRGB[i3 + 1] = c[1];
      ditheredLRGB[i3 + 2] = c[2];

      if(bestScore === 0) continue;

      changed = true;

      for(let kernelY = 0; kernelY < kernelSize; kernelY++) {
        for(let kernelX = 0; kernelX < kernelSize; kernelX++) {
          const weight = kernel[kernelX + kernelY * kernelSize];
          if (weight === 0) continue;
          const pointX = x + kernelX - halfKernel;
          const pointY = y + kernelY - halfKernel;

          // skip pixel if outside of image
          if (
            pointX < 0 ||
            pointY < 0 ||
            pointX >= width ||
            pointY >= height
          ) continue;

          const p3 = (pointX + pointY * width) * 3;

          blurredDitheredLRGB[p3] += (c[0] - sourceLRGB[i3 + 0]) * weight;
          blurredDitheredLRGB[p3 + 1] += (c[1] - sourceLRGB[i3 + 1]) * weight;
          blurredDitheredLRGB[p3 + 2] += (c[2] - sourceLRGB[i3 + 2]) * weight;

          errorMap[pointX + pointY * width] = colorDelta(
            [
              blurredSourceInColorspace[p3],
              blurredSourceInColorspace[p3 + 1],
              blurredSourceInColorspace[p3 + 2]
            ],
            lRGBToColorspace(
              blurredDitheredLRGB[p3],
              blurredDitheredLRGB[p3 + 1],
              blurredDitheredLRGB[p3 + 2]
            )
          );
        }
      }

      sourceLRGB[i3 + 0] = c[0];
      sourceLRGB[i3 + 1] = c[1];
      sourceLRGB[i3 + 2] = c[2];
    }
  } while(changed);

  callback(linearDatatoImageData(ditheredLRGB, width, height));
}
