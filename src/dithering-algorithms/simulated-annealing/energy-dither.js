/*
Algorithm description:

For each pixel, create a list of candidate colors via the Positional Dithering algorithm

Using a threshold matrix (in this implementation, Void And Cluster), choose a color from the candidate list for each pixel to create a starting image

Create a blurred version of the starting image and original image

Iteratively go through every pixel in the image, checking if a pixel change to a random different palette color would reduce the error between the blurred dithered vs blurred original image

In this implementation, the palette color chosen is randomly selected from the candidate list; this lets it quickly check probable candidates with probability corelated to an estimate of their statistically likelyhood of being correct
*/

/*
Possible area for improvement:
if an estimate for the likelyhood of a pixel already being correct can be efficiently made, then perhaps performance could be enhanced by testing pixels that have a higher estimate of being correct with lower frequency.
*/
import {
  lRGBToColorspace,
  imageDatatolRGB,
  linearDatatoColorspace,
  linearDatatoImageData,
  parseCSSColorString,
  imageDelta,
  gaussianBlur,
  voidAndClusterMatrix,
  ditheredPixelOrder,
  colorDelta,
  findClosestPaletteColor
} from '../helper-functions/color-math.js';

import { patternFromName } from '../helper-functions/pattern-from-name.js';

export function energyDither({
  imgData,
  palette,
  pattern,
  patternSize,
  patternBias,
  kernel,
  kernelSize,
  energyPoints,
  energyStart,
  energyCooling,
  callback,
  colorspace
}) {
  const paletteLRGB = palette.map(parseCSSColorString);
  const paletteInColorSpace = paletteLRGB.map(c => lRGBToColorspace(...c, colorspace));
  const paletteLength = palette.length;

  const width = imgData.width;
  const height = imgData.height;
  const totalPixels = width * height;

  const ditheredIndexes = paletteLength <= 256 ? new Uint8Array(totalPixels) : new Int32Array(totalPixels);
  const ditheredLRGB = new Float64Array(totalPixels * 3);

  const sourceLRGB = imageDatatolRGB(imgData);
  const blurredSourceLRGB = gaussianBlur(sourceLRGB, width, height, kernel, kernelSize);

  const candidateCache = new Array(width * height);
  const sameMap = new Uint8Array(width * height);

  const patternFunction = patternFromName(pattern);

  const matrix = voidAndClusterMatrix;
  const matrixHeight = matrix.length;
  const matrixWidth = matrix[0].length;

  let t = performance.now();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = x + y * width;
      const pixelIndex3 = pixelIndex * 3;

      const candidates = patternFunction([
        sourceLRGB[pixelIndex3],
        sourceLRGB[pixelIndex3 + 1],
        sourceLRGB[pixelIndex3 + 2]
      ], paletteLRGB, paletteInColorSpace, patternSize);
      candidateCache[pixelIndex] = candidates;

      candidates.sort((a, b) => paletteInColorSpace[a][2] - paletteInColorSpace[b][2]);

      sameMap[pixelIndex] = candidates[0] === candidates[patternSize - 1] ? 1 : 0;

      const threshold = matrix[y % matrixHeight][x % matrixWidth];

      const candidate = candidates[Math.floor(threshold * patternSize)];

      const color = paletteLRGB[candidate];

      ditheredIndexes[pixelIndex] = candidate;

      ditheredLRGB[pixelIndex3] = color[0];
      ditheredLRGB[pixelIndex3 + 1] = color[1];
      ditheredLRGB[pixelIndex3 + 2] = color[2];
    }

    if(performance.now() - t > 1000) {
      callback(linearDatatoImageData(ditheredLRGB, width, height));
      t = performance.now();
    }
  }

  const blurredDitheredLRGB = gaussianBlur(ditheredLRGB, width, height, kernel, kernelSize);

  const blurredSourceInColorSpace = linearDatatoColorspace(blurredSourceLRGB);
  const blurredDitheredInColorSpace = linearDatatoColorspace(blurredDitheredLRGB);

  const blurredDeltaInColorSpace = imageDelta(blurredSourceInColorSpace, blurredDitheredInColorSpace);

  let pixelsChanged = -1;
  let pass = 0;

  const pixelOrder = ditheredPixelOrder(width, height);

  const halfKernel = Math.floor(kernelSize / 2);

  let totalModifiedKernelPoints = 0;

  const maxKernelPoints = Math.min(
    (kernelSize * 3 - 2) * (kernelSize * 3 - 2),
    kernelSize * kernelSize * energyPoints
  );

  const modifiedKernelPointsMap = new Uint8Array(width * height);
  const modifiedKernelPoints = new Int32Array(maxKernelPoints);
  const modifiedPointsDeltaR = new Float64Array(maxKernelPoints);
  const modifiedPointsDeltaG = new Float64Array(maxKernelPoints);
  const modifiedPointsDeltaB = new Float64Array(maxKernelPoints);
  const modifiedPointsError = new Float64Array(maxKernelPoints);

  callback(linearDatatoImageData(ditheredLRGB, width, height));

  do {
    const currentEnergy = energyStart * Math.pow(1 - energyCooling, pass);

    pixelLoop:
      for(let index of pixelOrder) {
        const x = index % width;
        const y = Math.floor(index / width);

        // [x, y, index, deltaR, deltaG, deltaB, newPaletteIndex]
        const pixelsToChange = [];

        choosePoints:
          for(let i = 0; i < energyPoints; i++) {
            let pixelX;
            let pixelY;

            // first pixel is always the middle pixel
            if (i === 0) {
              pixelX = x;
              pixelY = y;
            } else {
              // choose another pixel within kernel range
              // (so that they influnce eachother)
              pixelX = x + Math.round((Math.random() - 0.5) * kernelSize);
              pixelY = y + Math.round((Math.random() - 0.5) * kernelSize);

              // skip pixel if outside of image
              if (
                pixelX < 0 ||
                pixelY < 0 ||
                pixelX >= width ||
                pixelY >= height
              ) continue choosePoints;
            }

            const pixelIndex = pixelX + pixelY * width;

            // skip pixel if it has already been chosen
            for(let change of pixelsToChange) {
              if (pixelIndex === change[2]) continue choosePoints;
            }

            const oldCandidate = ditheredIndexes[pixelIndex];

            let newCandidate;
            if(sameMap[pixelIndex] === 0 && Math.random() < patternBias) {
              do {
                newCandidate = candidateCache[pixelIndex][Math.floor(Math.random() * patternSize)];
              } while (oldCandidate === newCandidate);
            }
            else {
              do {
                newCandidate = Math.floor(Math.random() * paletteLength);
              } while (oldCandidate === newCandidate);
            }

            // skip pixel if it would go unchanged
            if (oldCandidate === newCandidate) {
              // the middle pixel must change
              if (i === 0) continue pixelLoop;
              continue choosePoints;
            }

            const oldLRGB = paletteLRGB[oldCandidate];
            const newLRGB = paletteLRGB[newCandidate];

            pixelsToChange.push([
              pixelX,
              pixelY,
              pixelIndex,
              newLRGB[0] - oldLRGB[0],
              newLRGB[1] - oldLRGB[1],
              newLRGB[2] - oldLRGB[2],
              newCandidate,
            ]);
          }

        // create list of pixels within kernel range
        for(let change of pixelsToChange) {
          for(let kernelY = 0; kernelY < kernelSize; kernelY++) {
            for(let kernelX = 0; kernelX < kernelSize; kernelX++) {
              const weight = kernel[kernelX + kernelY * kernelSize];
              if (weight === 0) continue;
              const pointX = change[0] + kernelX - halfKernel;
              const pointY = change[1] + kernelY - halfKernel;

              // skip pixel if outside of image
              if (
                pointX < 0 ||
                pointY < 0 ||
                pointX >= width ||
                pointY >= height
              ) continue;

              const pixelIndex = pointX + pointY * width;
              if(modifiedKernelPointsMap[pixelIndex] === 0) {
                modifiedKernelPoints[totalModifiedKernelPoints++] = pixelIndex;
                modifiedKernelPointsMap[pixelIndex] = totalModifiedKernelPoints;
              }
              const currentModifiedPoint = modifiedKernelPointsMap[pixelIndex] - 1;

              modifiedPointsDeltaR[currentModifiedPoint] += change[3] * weight;
              modifiedPointsDeltaG[currentModifiedPoint] += change[4] * weight;
              modifiedPointsDeltaB[currentModifiedPoint] += change[5] * weight;
            }
          }
        }

        let deltaError = 0;

        // check how much error the changes result in
        for(let p = 0; p < totalModifiedKernelPoints; p++) {
          const pixelIndex = modifiedKernelPoints[p];
          const pixelIndex3 = pixelIndex * 3;

          const newError = colorDelta(
            [
              blurredSourceInColorSpace[pixelIndex3],
              blurredSourceInColorSpace[pixelIndex3 + 1],
              blurredSourceInColorSpace[pixelIndex3 + 2]
            ],
            lRGBToColorspace(
              blurredDitheredLRGB[pixelIndex3] + modifiedPointsDeltaR[p],
              blurredDitheredLRGB[pixelIndex3 + 1] + modifiedPointsDeltaG[p],
              blurredDitheredLRGB[pixelIndex3 + 2] + modifiedPointsDeltaB[p]
            )
          );

          modifiedPointsError[p] = newError;
          deltaError += (newError - blurredDeltaInColorSpace[pixelIndex]) / 100;
        }

        // apply pixel changes if it improves the image or it's close enough that random energy allows it
        if(deltaError < 0 || (Math.random() < Math.exp(-deltaError / currentEnergy))) {
          for(let change of pixelsToChange) {
            const pixelIndex = change[2];
            const pixelIndex3 = pixelIndex * 3;
            ditheredIndexes[pixelIndex] = change[6];

            const paletteColor = paletteLRGB[change[6]];
            ditheredLRGB[pixelIndex3] = paletteColor[0];
            ditheredLRGB[pixelIndex3 + 1] = paletteColor[1];
            ditheredLRGB[pixelIndex3 + 2] = paletteColor[2];
          }

          for(let p = 0; p < totalModifiedKernelPoints; p++) {
            const pixelIndex = modifiedKernelPoints[p];
            const pixelIndex3 = pixelIndex * 3;
            blurredDitheredLRGB[pixelIndex3] += modifiedPointsDeltaR[p];
            blurredDitheredLRGB[pixelIndex3 + 1] += modifiedPointsDeltaG[p];
            blurredDitheredLRGB[pixelIndex3 + 2] += modifiedPointsDeltaB[p];
            blurredDeltaInColorSpace[pixelIndex] = modifiedPointsError[p];
          }
        }

        // cleanup
        for(let p = 0; p < totalModifiedKernelPoints; p++) {
          modifiedKernelPointsMap[modifiedKernelPoints[p]] = 0;
          modifiedPointsDeltaR[p] = 0;
          modifiedPointsDeltaG[p] = 0;
          modifiedPointsDeltaB[p] = 0;
          modifiedPointsError[p] = 0;
        }
        totalModifiedKernelPoints = 0;
      }

    // only update every 16 passes
    //if (pass % 16 === 0) callback(linearDatatoImageData(ditheredLRGB, width, height));

    callback(linearDatatoImageData(ditheredLRGB, width, height));
  } while (++pass);
}
