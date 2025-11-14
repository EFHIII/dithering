import {
  lRGBToColorspace,
  findClosestPaletteColor,
  colorDelta
} from '../helper-functions/color-math.js';

// from n -> 1: check if changing the first n pixels to a palette color improves error

export function createSaffronPatternSmooth(target, paletteLRGB, paletteInColorSpace, patternSize) {
  const paletteSize = paletteLRGB.length;
  const targetInColorSpace = lRGBToColorspace(target[0], target[1], target[2]);
  const closestColor = findClosestPaletteColor(targetInColorSpace, paletteInColorSpace);

  let bestMix;
  let bestMixDist = Infinity;

  let mix = new Array(patternSize).fill(closestColor);
  let approximation = [
    paletteLRGB[closestColor][0] * patternSize,
    paletteLRGB[closestColor][1] * patternSize,
    paletteLRGB[closestColor][2] * patternSize
  ];

  let dist = colorDelta(paletteInColorSpace[closestColor], targetInColorSpace);

  for(let i = patternSize - 1; i > 0; i--) {
    const oldCol = paletteLRGB[mix[0]];
    const approx = [
      approximation[0] - oldCol[0] * i,
      approximation[1] - oldCol[1] * i,
      approximation[2] - oldCol[2] * i
    ];

    // check if changing pixel will improve distance
    let best = -1;
    let bestDist = dist;
    let bestApprox = [0, 0, 0];
    for(let j = 0; j < paletteSize; j++) {
      const col = paletteLRGB[j];
      const newApprox = [
        approx[0] + col[0] * i,
        approx[1] + col[1] * i,
        approx[2] + col[2] * i
      ];
      const newDist = colorDelta(lRGBToColorspace(
        newApprox[0] / patternSize,
        newApprox[1] / patternSize,
        newApprox[2] / patternSize
      ), targetInColorSpace);

      if(newDist < bestDist) {
        best = j;
        bestDist = newDist;
        bestApprox = newApprox;
      }
    }

    // potentially apply change
    if(best >= 0) {
      for(let j = 0; j < i; j++) {
        mix[j] = best;
      }
      dist = bestDist;
      approximation = bestApprox;
    }
  }

  return mix;
}

// check starting with each palette color and choose the best one
export function createSaffronPatternAccurate(target, paletteLRGB, paletteInColorSpace, patternSize) {
  const paletteSize = paletteLRGB.length;
  const targetInColorSpace = lRGBToColorspace(target[0], target[1], target[2]);

  let bestMix;
  let bestMixDist = Infinity;
  let bestP;

  for(let p = 0; p < paletteSize; p++) {
    let mix = new Array(patternSize).fill(p);
    let approximation = [
      paletteLRGB[p][0] * patternSize,
      paletteLRGB[p][1] * patternSize,
      paletteLRGB[p][2] * patternSize
    ];

    let dist = colorDelta(paletteInColorSpace[p], targetInColorSpace);

    for(let i = patternSize - 1; i > 0; i--) {
      const oldCol = paletteLRGB[mix[0]];
      const approx = [
        approximation[0] - oldCol[0] * i,
        approximation[1] - oldCol[1] * i,
        approximation[2] - oldCol[2] * i
      ];

      // check if changing pixel will improve distance
      let best = -1;
      let bestDist = dist;
      let bestApprox = [0, 0, 0];
      for(let j = 0; j < paletteSize; j++) {
        const col = paletteLRGB[j];
        const newApprox = [
          approx[0] + col[0] * i,
          approx[1] + col[1] * i,
          approx[2] + col[2] * i
        ];
        const newDist = colorDelta(lRGBToColorspace(
          newApprox[0] / patternSize,
          newApprox[1] / patternSize,
          newApprox[2] / patternSize
        ), targetInColorSpace);

        if(newDist < bestDist) {
          best = j;
          bestDist = newDist;
          bestApprox = newApprox;
        }
      }

      // potentially apply change
      if(best >= 0) {
        for(let j = 0; j < i; j++) {
          mix[j] = best;
        }
        dist = bestDist;
        approximation = bestApprox;
      }
    }

    if(dist < bestMixDist) {
      bestMix = mix;
      bestMixDist = dist;
      bestP = p;
    }
  }

  return bestMix;
}


export function createSaffronPatternSmoothBiased(target, paletteLRGB, paletteInColorSpace, patternSize) {
  const paletteSize = paletteLRGB.length;
  const targetInColorSpace = lRGBToColorspace(target[0], target[1], target[2]);
  const closestColor = findClosestPaletteColor(targetInColorSpace, paletteInColorSpace);

  const bias = 0.075;

  let bestMix;
  let bestMixDist = Infinity;

  let mix = new Array(patternSize).fill(closestColor);
  let approximation = [
    paletteLRGB[closestColor][0] * patternSize,
    paletteLRGB[closestColor][1] * patternSize,
    paletteLRGB[closestColor][2] * patternSize
  ];

  let dist = colorDelta(paletteInColorSpace[closestColor], targetInColorSpace);
  let biasDist = colorDelta(paletteInColorSpace[closestColor], targetInColorSpace) * paletteSize;

  for(let i = patternSize - 1; i > 0; i--) {
    const oldCol = paletteLRGB[mix[0]];
    const approx = [
      approximation[0] - oldCol[0] * i,
      approximation[1] - oldCol[1] * i,
      approximation[2] - oldCol[2] * i
    ];
    const oldBiasDist = biasDist - colorDelta(paletteInColorSpace[mix[0]], targetInColorSpace);

    // check if changing pixel will improve distance
    let best = -1;
    //let bestDist = dist;
    let bestDist = dist;
    let bestBiasDist = biasDist;
    let bestApprox = [0, 0, 0];
    for(let j = 0; j < paletteSize; j++) {
      const col = paletteLRGB[j];
      const newApprox = [
        approx[0] + col[0] * i,
        approx[1] + col[1] * i,
        approx[2] + col[2] * i
      ];
      const newDist = colorDelta(lRGBToColorspace(
        newApprox[0] / patternSize,
        newApprox[1] / patternSize,
        newApprox[2] / patternSize
      ), targetInColorSpace);
      const newBiasDist = oldBiasDist + colorDelta(paletteInColorSpace[j], targetInColorSpace);

      if(newDist * (1 - bias) + newBiasDist / paletteSize * bias < bestDist * (1 - bias) + bestBiasDist / paletteSize * bias) {
        best = j;
        bestDist = newDist;
        bestBiasDist = newBiasDist;
        bestApprox = newApprox;
      }
    }

    // potentially apply change
    if(best >= 0) {
      for(let j = 0; j < i; j++) {
        mix[j] = best;
      }
      dist = bestDist;
      biasDist = bestBiasDist;
      approximation = bestApprox;
    }
  }

  return mix;
}
