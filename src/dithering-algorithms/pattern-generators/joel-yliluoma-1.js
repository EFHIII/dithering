import {
  lRGBToColorspace,
  findClosestPaletteColor,
  colorDelta
} from '../helper-functions/color-math.js';

export function createJoelYliluoma1(target, paletteLRGB, paletteInColorSpace, patternSize) {
  const paletteSize = paletteLRGB.length;
  const targetInColorSpace = lRGBToColorspace(target[0], target[1], target[2]);

  let bestMix = new Array(patternSize).fill(0);
  let bestMixDist = Infinity;


  for(let a = 0; a < paletteSize; a++) {
    const colA = paletteLRGB[a];
    const distanceA = colorDelta(paletteInColorSpace[a], targetInColorSpace);
    for(let b = a+1; b < paletteSize; b++) {
      const colB = paletteLRGB[b];

      // binary search for best mix
      let start = 0;
      let end = patternSize;

      let bestIndex = 0;

      let lowDistance = colorDelta(paletteInColorSpace[b], targetInColorSpace);
      let highDistance = distanceA;

      let minDistance = lowDistance;

      if(highDistance < minDistance) {
        minDistance = highDistance;
        bestIndex = end;
      }

      while (start + 1 < end) {
        const middle = Math.floor((start + end) / 2);

        const distance = colorDelta(lRGBToColorspace(
          (colA[0] * middle + colB[0] * (patternSize - middle)) / patternSize,
          (colA[1] * middle + colB[1] * (patternSize - middle)) / patternSize,
          (colA[2] * middle + colB[2] * (patternSize - middle)) / patternSize
        ), targetInColorSpace);

        if(distance < minDistance) {
          minDistance = distance;
          bestIndex = middle;
        }

        if (lowDistance < highDistance && lowDistance < distance) {
          end = middle;
        }
        else if(highDistance < lowDistance && highDistance < distance) {
          start = middle;
        } else {
          start = Math.floor((start + middle) / 2);
          end = Math.floor((middle + end) / 2);

          lowDistance = colorDelta(lRGBToColorspace(
            (colA[0] * start + colB[0] * (patternSize - start)) / patternSize,
            (colA[1] * start + colB[1] * (patternSize - start)) / patternSize,
            (colA[2] * start + colB[2] * (patternSize - start)) / patternSize
          ), targetInColorSpace);


          highDistance = colorDelta(lRGBToColorspace(
            (colA[0] * end + colB[0] * (patternSize - end)) / patternSize,
            (colA[1] * end + colB[1] * (patternSize - end)) / patternSize,
            (colA[2] * end + colB[2] * (patternSize - end)) / patternSize
          ), targetInColorSpace);

          if(lowDistance < minDistance) {
            minDistance = lowDistance;
            bestIndex = start;
          }
          if(highDistance < minDistance) {
            minDistance = highDistance;
            bestIndex = end;
          }
        }
      }

      // psychovisual correction
      minDistance += 0.05 * colorDelta(paletteInColorSpace[a], paletteInColorSpace[b]);

      if(minDistance < bestMixDist) {
        bestMixDist = minDistance;

        for(let i = 0; i < patternSize; i++) {
          bestMix[i] = i < bestIndex ? a : b;
        }
      }
    }
  }

  return bestMix;
}
