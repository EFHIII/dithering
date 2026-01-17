/*
Algorithm description:

create a blurred-image from blurred-source

create list-of-pixels

for each pixel in list-of-pixels:
  find the palette-color that would result in the lowest delta-error in blurred-image after replacing the target pixel-color with the palette-color;
  save palette-color and delta-error

while list-of-pixels is not empty:
  choose list-of-pixels pixel with the lowest delta-error (void-and cluster tie-breaker)
  apply palette-color to blurred-image
  update all pixels in list-of-pixels that are within the update kernel

*/

import {
  sRGBtolRGB,
  lRGBToColorspace,
  imageDatatolRGB,
  linearDatatoColorspace,
  linearDatatoImageData,
  parseCSSColorString,
  imageDelta,
  gaussianBlur,
  recursiveMatrix,
  colorDelta,
  findClosestPaletteColor
} from '../../src/dithering-algorithms/helper-functions/color-math.js';

import { colorRamp } from '../../src/helpers/color-ramp.js';

export function leastErrorFirst({
  imgData,
  palette,
  kernel,
  kernelSize,
  callback,
  colorspace,
  viewingCondition,
  // sprites
  spriteData,
  linearSpriteData,
  widthProcessSprite,
  heightProcessSprite,
  spriteCountWidth,
  spriteCountHeight
}) {
  //const paletteLRGB = palette.map(parseCSSColorString);
  //const paletteInColorspace = paletteLRGB.map(c => lRGBToColorspace(...c, colorspace, viewingCondition));
  //const paletteLength = palette.length;

  const paletteLength = spriteCountWidth * spriteCountHeight;
  const paletteWidth = widthProcessSprite * spriteCountWidth;

  const width = imgData.width;
  const height = imgData.height;
  const totalPixels = width * height;

  const ditheredLRGB = new Float64Array(totalPixels * 3);

  const sourceLRGB = imageDatatolRGB(imgData);
  const blurredSourceLRGB = gaussianBlur(sourceLRGB, width, height, kernel, kernelSize);
  const blurredDitheredLRGB = gaussianBlur(sourceLRGB, width, height, kernel, kernelSize);
  const errorMap = new Float64Array(totalPixels);

  const blurredSourceInColorspace = linearDatatoColorspace(blurredSourceLRGB);

  const tiebreaker = (a, b) => {
    const ax = a % width;
    const ay = Math.floor(a / width);
    const bx = b % width;
    const by = Math.floor(b / width);

    return recursiveMatrix(ax, ay) - recursiveMatrix(bx, by);
  };

  // create list of pixels
  const hitPixel = new Uint8Array(totalPixels);
  const pixelScore = new Float64Array(totalPixels);
  const ditheredIndexes = paletteLength <= 256 ? new Uint8Array(totalPixels) : new Int32Array(totalPixels);

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

  for(let i = 0; i < totalPixels; i++) {
    if(performance.now() - t > 1000) {
      callback(linearDatatoImageData(ditheredLRGB, width, height));
      t = performance.now();
    }
    let bestScore = Infinity;
    let best = 0;
    for(let p = 0; p < paletteLength; p++) {
      const score = scorePixel(i, p);
      if(score < bestScore) {
        bestScore = score;
        best = p;
      }
    }

    ditheredIndexes[i] = best;
    pixelScore[i] = bestScore;

    let col = colorRamp(Math.sqrt(Math.min(1, Math.max(0, bestScore / 100))));
    col = sRGBtolRGB(col[0] / 255, col[1] / 255, col[2] / 255);
    ditheredLRGB[i * 3 + 0] = col[0];
    ditheredLRGB[i * 3 + 1] = col[1];
    ditheredLRGB[i * 3 + 2] = col[2];

    for(let j = 0; j < 3; j++) {
      //ditheredLRGB[i * 3 + j] = sourceLRGB[i * 3 + j] > 0.5 ? 0 : 1;
      //ditheredLRGB[i * 3 + j] = sourceLRGB[i * 3 + j];
    }
  }

  let changed = false;
  do {
    changed = true;
    for(let i = 0; i < totalPixels; i++) {
      if(performance.now() - t > 1000) {
        callback(linearDatatoImageData(ditheredLRGB, width, height));
        t = performance.now();
      }

      let bestScore = Infinity;
      let best = 0;
      for(let px = 0; px < totalPixels; px++) {
        //if(hitPixel[px]) continue;

        if(pixelScore[px] < bestScore || (pixelScore[px] === bestScore && tiebreaker(best, px) < 0) || (hitPixel[px] && !hitPixel[best] && pixelScore[px] < 0)) {
          bestScore = pixelScore[px];
          best = px;
        }
      }

      const i3 = best * 3;

      const x = best % width;
      const y = Math.floor(best / width);

      const c = paletteLRGB[ditheredIndexes[best]];

      hitPixel[best] = 1;

      ditheredLRGB[i3 + 0] = c[0];
      ditheredLRGB[i3 + 1] = c[1];
      ditheredLRGB[i3 + 2] = c[2];

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

          const px = pointX + pointY * width;
          //if(hitPixel[px]) continue;

          const p3 = px * 3;

          let bestScore = Infinity;
          let best = 0;
          for(let p = 0; p < paletteLength; p++) {
            const score = scorePixel(px, p);
            if(score < bestScore) {
              bestScore = score;
              best = p;
            }
          }

          ditheredIndexes[px] = best;
          pixelScore[px] = bestScore;

          if(!hitPixel[px]) {
            let col = colorRamp(Math.sqrt(Math.min(1, Math.max(0, bestScore / 100))));
            col = sRGBtolRGB(col[0] / 255, col[1] / 255, col[2] / 255);
            ditheredLRGB[p3 + 0] = col[0];
            ditheredLRGB[p3 + 1] = col[1];
            ditheredLRGB[p3 + 2] = col[2];
          }

          const col = paletteLRGB[best];
          if(hitPixel[px] && bestScore >= 0) {
            // col[0] === sourceLRGB[px*3] && col[1] === sourceLRGB[px*3+1] && col[2] === sourceLRGB[px*3+2]
            pixelScore[px] = Infinity;
          }
        }
      }
    }
  } while (changed);

  callback(linearDatatoImageData(ditheredLRGB, width, height));
}
