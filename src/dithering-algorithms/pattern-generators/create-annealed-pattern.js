import {
  lRGBToColorspace,
  findClosestPaletteColor,
  colorDelta
} from '../helper-functions/color-math.js';

function scoreFunction(dist, MSE) {
  return dist + MSE * MSE;
}

export function createAnnealedPattern(target, paletteLRGB, paletteInColorSpace, patternSize) {
  const paletteSize = paletteLRGB.length;
  const targetInColorSpace = lRGBToColorspace(target[0], target[1], target[2]);
  const closestColor = findClosestPaletteColor(targetInColorSpace, paletteInColorSpace);
  let mix = new Array(patternSize).fill(closestColor);
  let approximation = [
    paletteLRGB[closestColor][0] * patternSize,
    paletteLRGB[closestColor][1] * patternSize,
    paletteLRGB[closestColor][2] * patternSize
  ];

  let dist = colorDelta(lRGBToColorspace(...paletteLRGB[closestColor]), targetInColorSpace) / 10000;

  // mean squared error
  let MSE = dist * patternSize;

  let score = scoreFunction(dist, MSE / patternSize);
  let oldScore;
  do {
    oldScore = score;
    for(let i = 0; i < patternSize; i++) {
      const oldCol = paletteLRGB[mix[i]];
      const approx = [
        approximation[0] - oldCol[0],
        approximation[1] - oldCol[1],
        approximation[2] - oldCol[2]
      ];

      const oldDelta = colorDelta(paletteInColorSpace[mix[i]], targetInColorSpace) / 10000;
      const startMSE = MSE - oldDelta;

      // check if changing pixel will improve distance
      let best = -1;
      let bestDist = dist;
      let bestMSE = MSE;
      let bestApprox = [0, 0, 0];
      let bestScore = score;
      for(let j = 0; j < paletteSize; j++) {
        if(mix[i] === j) continue;

        const col = paletteLRGB[j];
        const newApprox = [
          approx[0] + col[0],
          approx[1] + col[1],
          approx[2] + col[2]
        ];
        const newDist = colorDelta(lRGBToColorspace(
          newApprox[0] / patternSize,
          newApprox[1] / patternSize,
          newApprox[2] / patternSize
        ), targetInColorSpace) / 10000;

        const newDelta = colorDelta(paletteInColorSpace[j], targetInColorSpace) / 10000;

        const newMSE = startMSE + newDelta;

        const newScore = scoreFunction(newDist, newMSE / patternSize);

        if(newScore < bestScore) {
          bestScore = newScore;
          best = j;
          bestDist = newDist;
          bestMSE = newMSE;
          bestApprox = newApprox;
        }
      }

      // potentially apply change
      if(best >= 0) {
        score = bestScore;
        mix[i] = best;
        dist = bestDist;
        MSE = bestMSE;
        approximation = bestApprox;
      }
    }
  } while(oldScore !== score);

  return mix;
}

export function createAnnealedPattern2x(target, paletteLRGB, paletteInColorSpace, patternSize) {
  const paletteSize = paletteLRGB.length;
  const targetInColorSpace = lRGBToColorspace(target[0], target[1], target[2]);
  const closestColor = findClosestPaletteColor(targetInColorSpace, paletteInColorSpace);
  let mix = new Array(patternSize).fill(closestColor);
  let approximation = [
    paletteLRGB[closestColor][0] * patternSize,
    paletteLRGB[closestColor][1] * patternSize,
    paletteLRGB[closestColor][2] * patternSize
  ];

  let dist = colorDelta(lRGBToColorspace(...paletteLRGB[closestColor]), targetInColorSpace);

  let oldDist;
  let n = 0;
  do {
    oldDist = dist;
    for(let l = 0; l < patternSize * paletteSize; l++) {
      for(let i = 0; i < patternSize; i++) {
        let i2 = Math.floor(Math.random() * patternSize);
        if(i === i2) continue;
        const oldCol1 = paletteLRGB[mix[i]];
        const oldCol2 = paletteLRGB[mix[i2]];

        // check if changing pixels will improve distance
        const c1 = Math.floor(Math.random() * paletteSize);
        const c2 = Math.floor(Math.random() * paletteSize);
        const col1 = paletteLRGB[c1];
        const col2 = paletteLRGB[c2];
        const newApprox = [
          approximation[0] - oldCol1[0] - oldCol2[0] + col1[0] + col2[0],
          approximation[1] - oldCol1[1] - oldCol2[1] + col1[1] + col2[1],
          approximation[2] - oldCol1[2] - oldCol2[2] + col1[2] + col2[2]
        ];
        const newDist = colorDelta(lRGBToColorspace(
          newApprox[0] / patternSize,
          newApprox[1] / patternSize,
          newApprox[2] / patternSize
        ), targetInColorSpace);

        // potentially apply change
        if(newDist < dist) {
          mix[i] = c1;
          mix[i2] = c2;
          dist = newDist;
          approximation = newApprox;
        }
      }
    }

    n = oldDist !== dist ? 0 : n + 1;
  } while(n < 8);

  const approxAvg = [
    (approximation[0]) / patternSize,
    (approximation[1]) / patternSize,
    (approximation[2]) / patternSize
  ];

  return mix;
}
