import {
  lRGBToColorspace,
  findClosestPaletteColor
} from '../helper-functions/color-math.js';

export function createJoelYliluoma3(colorLRGB, paletteLRGB, paletteInColorSpace, limit) {
  const paletteSize = paletteLRGB.length;
  const colorColorspace = lRGBToColorspace(...colorLRGB);

  let solution = {};

  let closestColor = findClosestPaletteColor(colorColorspace, paletteInColorSpace);

  let closestColorspace = paletteInColorSpace[closestColor];

  let currentPenalty = (colorColorspace[0] - closestColorspace[0])**2 +
  (colorColorspace[1] - closestColorspace[1])**2 +
  (colorColorspace[2] - closestColorspace[2])**2;

  solution[closestColor] = limit;

  let dbllimit = 1 / limit;
  while(currentPenalty !== 0) {
    let bestPenalty = currentPenalty;
    let bestSplitfrom = 0;
    let bestSplitTo = [0, 0];

    for(let key in solution) {
      let splitColor = key;
      let splitCount = solution[key];
      let sum = [0, 0, 0];
      for(let key2 in solution) {
        if(key2 === splitColor) continue;
        sum[0] += paletteLRGB[key2][0] * solution[key] * dbllimit;
        sum[1] += paletteLRGB[key2][1] * solution[key] * dbllimit;
        sum[2] += paletteLRGB[key2][2] * solution[key] * dbllimit;
      }

      let portion1 = splitCount / 2 * dbllimit;
      let portion2 = (splitCount - splitCount / 2) * dbllimit;
      for(let a = 0; a < paletteSize; a++) {
        let firstb = 0;
        if(portion1 === portion2) firstb = a+1;
        for(let b = firstb; b < paletteSize; b++) {
          if(a === b) continue;
          let lumaDiff = paletteInColorSpace[a][2] - paletteInColorSpace[b][2];
          if(lumaDiff < 0) lumaDiff = -lumaDiff;
          //if(lumaDiff > 80000) continue;

          let test = [
            sum[0] + paletteLRGB[a][0] * portion1 + paletteLRGB[b][0] * portion2,
            sum[1] + paletteLRGB[a][1] * portion1 + paletteLRGB[b][1] * portion2,
            sum[2] + paletteLRGB[a][2] * portion1 + paletteLRGB[b][2] * portion2
          ];

          let testInColorspace = lRGBToColorspace(...test);
          let penalty = (colorColorspace[0] - testInColorspace[0])**2 +
          (colorColorspace[1] - testInColorspace[1])**2 +
          (colorColorspace[2] - testInColorspace[2])**2;

          if(penalty < bestPenalty) {
            bestPenalty = penalty;
            bestSplitfrom = splitColor;
            bestSplitTo = [a, b];
          }
          if(portion2 === 0) break;
        }
      }
    }
    if(bestPenalty === currentPenalty) break;

    let i = solution[bestSplitfrom];
    let splitCount = i;
    let split1 = splitCount / 2;
    let split2 = splitCount - split1;
    delete solution[bestSplitfrom];

    if(split1 > 0) {
      if(!solution.hasOwnProperty(bestSplitTo[0])) {
        solution[bestSplitTo[0]] = 0;
      }
      solution[bestSplitTo[0]] += split1;
    }
    if(split2 > 0) {
      if(!solution.hasOwnProperty(bestSplitTo[1])) {
        solution[bestSplitTo[1]] = 0;
      }
      solution[bestSplitTo[1]] += split2;
    }
    currentPenalty = bestPenalty;
  }

  let result = [];
  for(let s in solution) {
    for(let i = 0; i < solution[s]; i++) {
      if(result.length < limit) {
        result.push(parseInt(s));
      }
    }
  }

  return result;
}
