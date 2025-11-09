import {
  lRGBToColorspace,
  findClosestPaletteColor
} from '../helper-functions/color-math.js';


export function createPattern(target, paletteLRGB, paletteInColorSpace, patternSize) {
  let error = [0, 0, 0];
  let candidates = new Array(patternSize);
  for (let i = 0; i < patternSize; i++) {
    let attempt = [
      Math.min(1, Math.max(0, target[0] + error[0])),
      Math.min(1, Math.max(0, target[1] + error[1])),
      Math.min(1, Math.max(0, target[2] + error[2]))
    ];

    const attemptInColorSpace = lRGBToColorspace(attempt[0], attempt[1], attempt[2]);
    const candidate = findClosestPaletteColor(attemptInColorSpace, paletteInColorSpace);

    candidates[i] = candidate;

    error[0] += target[0] - paletteLRGB[candidate][0];
    error[1] += target[1] - paletteLRGB[candidate][1];
    error[2] += target[2] - paletteLRGB[candidate][2];
  }

  return candidates;
}
