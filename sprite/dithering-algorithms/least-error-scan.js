/*
Algorithm description:

*/

import {
  lRGBToColorspace,
  imageDatatolRGB,
  linearDatatoColorspace,
  linearDatatoImageData,
  imageDelta,
  gaussianBlur,
  ditheredPixelOrder,
  colorDelta,
  findClosestPaletteColor
} from '../../src/dithering-algorithms/helper-functions/color-math.js';

export function leastErrorScan({
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

  const widthSprites = width / widthProcessSprite;
  const heightSprites = height / heightProcessSprite;
  const totalSprites = widthSprites * heightSprites;

  const ditheredLRGB = new Float64Array(totalPixels * 3);

  const sourceLRGB = imageDatatolRGB(imgData);
  const blurredSourceLRGB = gaussianBlur(sourceLRGB, width, height, kernel, kernelSize);
  const blurredDitheredLRGB = gaussianBlur(sourceLRGB, width, height, kernel, kernelSize);
  const errorMap = new Float64Array(totalPixels);

  const blurredSourceInColorspace = linearDatatoColorspace(blurredSourceLRGB);

  const spriteOrder = new Array(totalSprites);
  for(let y = 0; y < heightSprites; y++) {
    for(let x = 0; x < widthSprites; x++) {
      spriteOrder[x + y * widthSprites] = [x, y];
    }
  }

  const halfKernel = Math.floor(kernelSize / 2);

  const scoreSprite = (x, y, spriteX, spriteY) => {
    let errorDelta = 0;

    const X = x * widthProcessSprite;
    const Y = y * heightProcessSprite;

    for(let sX = -halfKernel; sX <= widthProcessSprite + halfKernel; sX++) {
      for(let sY = -halfKernel; sY <= heightProcessSprite + halfKernel; sY++) {
        const atX = X + sX;
        const atY = Y + sY;

        if(atX < 0 || atY < 0 || atX >= width || atY >= height) continue;

        const at = atX + atY * width;
        const at3 = at * 3;

        const blurredColor = [
          blurredDitheredLRGB[at3],
          blurredDitheredLRGB[at3 + 1],
          blurredDitheredLRGB[at3 + 2]
        ];

        for(let kernelY = 0; kernelY < kernelSize; kernelY++) {
          for(let kernelX = 0; kernelX < kernelSize; kernelX++) {
            const spX = sX + kernelX - halfKernel;
            const spY = sY + kernelY - halfKernel;

            // skip pixel if outside of sprite
            if (
              spX < 0 ||
              spY < 0 ||
              spX >= widthProcessSprite ||
              spY >= heightProcessSprite
            ) continue;

            const weight = kernel[kernelX + kernelY * kernelSize];
            if (weight === 0) continue;

            const pointX = atX + kernelX - halfKernel;
            const pointY = atY + kernelY - halfKernel;

            const p = pointX + pointY * width;
            const p3 = p * 3;

            const sp = spriteX * widthProcessSprite + spX + (spriteY * heightProcessSprite + spY) * paletteWidth;
            const sp3 = sp * 3;

            blurredColor[0] += weight * (linearSpriteData[sp3] - sourceLRGB[p3]);
            blurredColor[1] += weight * (linearSpriteData[sp3 + 1] - sourceLRGB[p3 + 1]);
            blurredColor[2] += weight * (linearSpriteData[sp3 + 2] - sourceLRGB[p3 + 2]);
          }
        }

        errorDelta += colorDelta(
          [
            blurredSourceInColorspace[at3],
            blurredSourceInColorspace[at3 + 1],
            blurredSourceInColorspace[at3 + 2]
          ],
          lRGBToColorspace(...blurredColor)
        ) - errorMap[at];
      }
    }
    return errorDelta;
  };

  const applySprite = (x, y, spriteX, spriteY) => {
    let errorDelta = 0;

    const X = x * widthProcessSprite;
    const Y = y * heightProcessSprite;

    for(let sX = -halfKernel; sX <= widthProcessSprite + halfKernel; sX++) {
      for(let sY = -halfKernel; sY <= heightProcessSprite + halfKernel; sY++) {
        const atX = X + sX;
        const atY = Y + sY;

        if(atX < 0 || atY < 0 || atX >= width || atY >= height) continue;

        const at = atX + atY * width;
        const at3 = at * 3;

        for(let kernelY = 0; kernelY < kernelSize; kernelY++) {
          for(let kernelX = 0; kernelX < kernelSize; kernelX++) {
            const spX = sX + kernelX - halfKernel;
            const spY = sY + kernelY - halfKernel;

            // skip pixel if outside of sprite
            if (
              spX < 0 ||
              spY < 0 ||
              spX >= widthProcessSprite ||
              spY >= heightProcessSprite
            ) continue;

            const weight = kernel[kernelX + kernelY * kernelSize];
            if (weight === 0) continue;

            const pointX = atX + kernelX - halfKernel;
            const pointY = atY + kernelY - halfKernel;

            const p = pointX + pointY * width;
            const p3 = p * 3;

            const sp = spriteX * widthProcessSprite + spX + (spriteY * heightProcessSprite + spY) * paletteWidth;
            const sp3 = sp * 3;

            blurredDitheredLRGB[at3] += weight * (linearSpriteData[sp3] - sourceLRGB[p3]);

            blurredDitheredLRGB[at3 + 1] += weight * (linearSpriteData[sp3 + 1] - sourceLRGB[p3 + 1]);

            blurredDitheredLRGB[at3 + 2] += weight * (linearSpriteData[sp3 + 2] - sourceLRGB[p3 + 2]);
          }
        }

        errorMap[at] = colorDelta(
          [
            blurredSourceInColorspace[at3],
            blurredSourceInColorspace[at3 + 1],
            blurredSourceInColorspace[at3 + 2]
          ],
          lRGBToColorspace(
            blurredDitheredLRGB[at3],
            blurredDitheredLRGB[at3 + 1],
            blurredDitheredLRGB[at3 + 2]
          )
        );
      }
    }
    return errorDelta;
  };

  let t = performance.now();
  callback(linearDatatoImageData(ditheredLRGB, width, height));

  let vv = 0;

  let changed = false;
  do {
    changed = false;
    for(let i = 0; i < totalSprites; i++) {
      if(performance.now() - t > 1000) {
        callback(linearDatatoImageData(ditheredLRGB, width, height));
        t = performance.now();
      }

      const best = spriteOrder[i];

      const x = best[0];
      const y = best[1];

      // pick best sprite
      let c = [0, 0];
      let bestScore = Infinity;
      for(let spriteX = 0; spriteX < spriteCountWidth; spriteX++) {
        for(let spriteY = 0; spriteY < spriteCountHeight; spriteY++) {
          const score = scoreSprite(x, y, spriteX, spriteY);
          if(score < bestScore) {
            bestScore = score;
            c[0] = spriteX;
            c[1] = spriteY;
          }
        }
      }

      // apply best sprite
      for(let X = 0; X < widthProcessSprite; X++) {
        for(let Y = 0; Y < heightProcessSprite; Y++) {
          const i = x * widthProcessSprite + X + (y * heightProcessSprite + Y) * width;
          const i3 = i * 3;
          const c3 = (
            c[0] * widthProcessSprite + X +
            (c[1] * heightProcessSprite + Y) * paletteWidth
          ) * 3;
          ditheredLRGB[i3 + 0] = linearSpriteData[c3 + 0];
          ditheredLRGB[i3 + 1] = linearSpriteData[c3 + 1];
          ditheredLRGB[i3 + 2] = linearSpriteData[c3 + 2];
        }
      }

      if(bestScore === 0) continue;

      applySprite(x, y, c[0], c[1]);

      for(let X = 0; X < widthProcessSprite; X++) {
        for(let Y = 0; Y < heightProcessSprite; Y++) {
          const i = x * widthProcessSprite + X + (y * heightProcessSprite + Y) * width;
          const i3 = i * 3;
          const c3 = (
            c[0] * widthProcessSprite + X +
            (c[1] * heightProcessSprite + Y) * paletteWidth
          ) * 3;
          sourceLRGB[i3 + 0] = linearSpriteData[c3 + 0];
          sourceLRGB[i3 + 1] = linearSpriteData[c3 + 1];
          sourceLRGB[i3 + 2] = linearSpriteData[c3 + 2];
        }
      }

      changed = true;
    }
  } while(changed);

  callback(linearDatatoImageData(ditheredLRGB, width, height));
}
