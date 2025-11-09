import {
  lRGBToColorspace,
  findClosestPaletteColor,
  colorDelta
} from '../helper-functions/color-math.js';

export function createJoelYliluoma2(target, paletteLRGB, paletteInColorSpace, patternSize) {
  const paletteSize = paletteLRGB.length;
  const targetInColorSpace = lRGBToColorspace(target[0], target[1], target[2]);

  let bestMix = new Array(patternSize).fill(0);
  let bestMixDist = Infinity;

  let added = 0;

  let soFar = [0, 0, 0];

  while(added < patternSize) {
    let count = 1;
    let candidate = 0;
    let max = added === 0 ? 1 : added;
    let leastError = Infinity;
    for(let a = 0; a < paletteSize; a++) {
      const col = paletteLRGB[a];
      let sum = [soFar[0], soFar[1], soFar[2]];
      let add = [col[0], col[1], col[2]];
      for(let p = 1; p <= max; p *= 2) {
        sum = [
          sum[0] + add[0],
          sum[1] + add[1],
          sum[2] + add[2],
        ];
        add = [
          add[0] + add[0],
          add[1] + add[1],
          add[2] + add[2],
        ];
        let t = added + p;
        let test = [
          sum[0] / t,
          sum[1] / t,
          sum[2] / t,
        ];
        let error = colorDelta(lRGBToColorspace(...test), targetInColorSpace);

        if(error < leastError) {
          leastError = error;
          candidate = a;
          count = p;
        }
      }
    }

    for(let p = 0; p < count; p++) {
      if(added >= patternSize) break;
      bestMix[added++] = candidate;
    }

    const col = paletteLRGB[candidate];
    soFar[0] += col[0] * count;
    soFar[1] += col[1] * count;
    soFar[2] += col[2] * count;
  }

  return bestMix;
}
