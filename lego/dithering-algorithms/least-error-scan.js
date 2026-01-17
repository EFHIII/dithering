/*
Algorithm description:

*/
//*
import {
  lRGBToColorspace,
  imageDatatolRGB,
  linearDatatoColorspace,
  linearDatatoImageData,
  imageDelta,
  gaussianBlur,
  ditheredPixelOrder,
  colorDelta,
  findClosestPaletteColor,
  parseCSSColorString
} from '../../src/dithering-algorithms/helper-functions/color-math.js';
//*/

export function leastErrorScan({
  imgData,
  palette,
  kernel,
  kernelSize,
  callback,
  colorspace,
  viewingCondition,
  // patterns
  patternSheetData,
  linearpatternSheetData,
  widthProcessPattern,
  patternCountWidth,
  // LEGO
  legoColors,
  legoBricks,
  matrix
}) {
  const usedBricks = matrix.map(a => a.reduce((b,c) => b||c));

  const brickColors = [];
  for(let i = 0; i < matrix.length; i++) {
    brickColors.push([]);
    for(let j = 0; j < matrix[i].length; j++) {
      if(matrix[i][j]) {
        brickColors[i].push(j);
      }
    }
  }

  // patterns
  const patterns = [];

  const B = 1; // bright
  const L = 0.7; // light
  const M = 0.25; // medium
  const D = 0.14; // dark

  /*
  pattern:
  {
    parts: [Index, rotation, brightness, piece],
    restrictions: [
      {
        <ID>,
        <angleOffset 0-4>,
        <color -1 / part # >,
        <piece # [determines colors]>
      }, // north
      // east
      // south
      // west
    ],
  }
  */

  // normal square
  patterns.push({
    parts: [
      [0, 0, B, 0]
    ],
    restrictions: [],
  });

  // circle
  if(usedBricks[1]) {
    patterns.push({
      parts: [
        [4, 0, B, 1],
        [-4, 0, M, 0]
      ],
      restrictions: [],
    });
  }

  // half circle
  if(usedBricks[2]) {
    patterns.push({
      parts: [
        [6, 0, B, 2],
        [-6, 0, M, 0]
      ],
      restrictions: [],
    });
  }

  // quarter circle
  if(usedBricks[3]) {
    patterns.push({
      parts: [
        [10, 0, B, 9],
        [-10, 0, M, 0]
      ],
      restrictions: [],
    });
  }

  // grill
  if(usedBricks[4]) {
    patterns.push({
      parts: [
        [5, 0, B, 4],
        [-5, 0, D, 0]
      ],
      restrictions: [
        [[-5, 2, 1], 0, 0, 0]
      ],
    });
  }

  // square
  if(usedBricks[0]) {
    // stacked squares
    patterns.push({
      parts: [
        [0, 0, B, 0],
        [1, 0, B, 0],
        [2, 0, B, 0]
      ],
      restrictions: [
        [[2, 2, 2], 0, 0, 0]
      ],
    });

    patterns.push({
      parts: [
        [1, 0, B, 0],
        [0, 0, B, 0],
        [2, 0, B, 0]
      ],
      restrictions: [
        [[2, 2, 2], 0, 0, 0]
      ],
    });
  }

  const legoColorsLRGB = legoColors.map(parseCSSColorString);
  const legoColorsInColorspace = legoColorsLRGB.map(c => lRGBToColorspace(...c, colorspace, viewingCondition));
  const legoColorsLength = legoColors.length;

  const legoBricksLength = legoBricks.length;

  const width = imgData.width;
  const height = imgData.height;
  const totalPixels = width * height;

  const widthStuds = width / widthProcessPattern;
  const heightStuds = height / widthProcessPattern;
  const totalStuds = widthStuds * heightStuds;


  const patternMap = new Array(totalPixels);
  for(let i = 0; i < patternMap.length; i++) {
    patternMap[i] = {
      parts: [],
      colors: [],
      restrictions: [],
    };
  }

  const ditheredLRGB = new Float64Array(totalPixels * 3);

  const sourceLRGB = imageDatatolRGB(imgData);
  const blurredSourceLRGB = gaussianBlur(sourceLRGB, width, height, kernel, kernelSize);
  const blurredDitheredLRGB = gaussianBlur(sourceLRGB, width, height, kernel, kernelSize);
  const errorMap = new Float64Array(totalPixels);

  const blurredSourceInColorspace = linearDatatoColorspace(blurredSourceLRGB);

  const studOrder = new Array(totalStuds);
  for(let y = 0; y < heightStuds; y++) {
    for(let x = 0; x < widthStuds; x++) {
      studOrder[x + y * widthStuds] = [x, y];
    }
  }

  const halfKernel = Math.floor(kernelSize / 2);

  const scorePattern = (x, y, pattern, w, h) => {
    let errorDelta = 0;

    const X = x * widthProcessPattern;
    const Y = y * widthProcessPattern;

    const deltaMask = new Array(w * h * widthProcessPattern ** 2);
    for(let sX = 0; sX < widthProcessPattern * w; sX++) {
      for(let sY = 0; sY < widthProcessPattern * h; sY++) {
        const p = sX + X + (sY + Y) * widthProcessPattern * w;
        const p3 = p * 3;

        const sp = sX + sY * widthProcessPattern * w;
        const sp3 = sp * 3;
        deltaMask[sp] = (
          pattern[sp3 + 0] === sourceLRGB[p3 + 0] &&
          pattern[sp3 + 1] === sourceLRGB[p3 + 1] &&
          pattern[sp3 + 2] === sourceLRGB[p3 + 2]
        );
      }
    }

    for(let sX = -halfKernel; sX <= widthProcessPattern * w + halfKernel; sX++) {
      for(let sY = -halfKernel; sY <= widthProcessPattern * h + halfKernel; sY++) {
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

            // skip pixel if outside of range
            if (
              spX < 0 ||
              spY < 0 ||
              spX >= widthProcessPattern * w ||
              spY >= widthProcessPattern * h
            ) continue;

            const sp = spX + spY * widthProcessPattern * w;
            if(deltaMask[sp]) continue;

            const weight = kernel[kernelX + kernelY * kernelSize];
            if (weight === 0) continue;

            const pointX = atX + kernelX - halfKernel;
            const pointY = atY + kernelY - halfKernel;

            const p = pointX + pointY * width;
            const p3 = p * 3;

            const sp3 = sp * 3;

            blurredColor[0] += weight * (pattern[sp3] - sourceLRGB[p3]);
            blurredColor[1] += weight * (pattern[sp3 + 1] - sourceLRGB[p3 + 1]);
            blurredColor[2] += weight * (pattern[sp3 + 2] - sourceLRGB[p3 + 2]);
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

  const applyPattern = (x, y, pattern, w, h) => {
    let errorDelta = 0;

    const X = x * widthProcessPattern;
    const Y = y * widthProcessPattern;

    const deltaMask = new Array(w * h * widthProcessPattern ** 2);
    for(let sX = 0; sX < widthProcessPattern * w; sX++) {
      for(let sY = 0; sY < widthProcessPattern * h; sY++) {
        const p = sX + X + (sY + Y) * widthProcessPattern * w;
        const p3 = p * 3;

        const sp = sX + sY * widthProcessPattern * w;
        const sp3 = sp * 3;
        deltaMask[sp] = (
          pattern[sp3 + 0] === sourceLRGB[p3 + 0] &&
          pattern[sp3 + 1] === sourceLRGB[p3 + 1] &&
          pattern[sp3 + 2] === sourceLRGB[p3 + 2]
        );
      }
    }

    for(let sX = -halfKernel; sX <= widthProcessPattern * w + halfKernel; sX++) {
      for(let sY = -halfKernel; sY <= widthProcessPattern * h + halfKernel; sY++) {
        const atX = X + sX;
        const atY = Y + sY;

        if(atX < 0 || atY < 0 || atX >= width || atY >= height) continue;

        const at = atX + atY * width;
        const at3 = at * 3;

        for(let kernelY = 0; kernelY < kernelSize; kernelY++) {
          for(let kernelX = 0; kernelX < kernelSize; kernelX++) {
            const spX = sX + kernelX - halfKernel;
            const spY = sY + kernelY - halfKernel;

            // skip pixel if outside of range
            if (
              spX < 0 ||
              spY < 0 ||
              spX >= widthProcessPattern * w ||
              spY >= widthProcessPattern * h
            ) continue;

            const sp = spX + spY * widthProcessPattern * w;
            if(deltaMask[sp]) continue;

            const weight = kernel[kernelX + kernelY * kernelSize];
            if (weight === 0) continue;

            const pointX = atX + kernelX - halfKernel;
            const pointY = atY + kernelY - halfKernel;

            const p = pointX + pointY * width;
            const p3 = p * 3;

            const sp3 = sp * 3;

            blurredDitheredLRGB[at3 + 0] += weight * (pattern[sp3] - sourceLRGB[p3]);
            blurredDitheredLRGB[at3 + 1] += weight * (pattern[sp3 + 1] - sourceLRGB[p3 + 1]);
            blurredDitheredLRGB[at3 + 2] += weight * (pattern[sp3 + 2] - sourceLRGB[p3 + 2]);
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

  // to avoid making impossible shape patterns
  const xy = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];

  const restrictionConflict = (x, y, pattern, r, visited) => {
    // check imposing restrictions
    for(let i = 0; i < pattern.restrictions.length; i++) {
      if(pattern.restrictions[i] !== 0) {
        for(let j = 0; j < 4; j++) {
          const X = x + xy[j][0];
          const Y = y + xy[j][1];

          if(X < 0 || Y < 0 || X >= width || Y >= height) {
            return true;
          }

          if(visited.hasOwnProperty(X + ',' + Y)) {
            // check if restriction invalidated
            // TODO:
          }
        }
      }
    }

    // check imposed restrictions

    const A = x + ',' + (y + 1);
    const B = (x - 1) + ',' + y;
    const C = x + ',' + (y - 1);
    const D = (x + 1) + ',' + y;

    if(visited.hasOwnProperty(A)) {
      const v = visited[A]; // 0
    }
    if(visited.hasOwnProperty(B)) {
      const v = visited[B]; // 1
    }
    if(visited.hasOwnProperty(C)) {
      const v = visited[C]; // 2
    }
    if(visited.hasOwnProperty(D)) {
      const v = visited[D]; // 3
    }

    return false;
  };

  const resolveCellScore = (x, y) => {
    // TODO:
  };

  const resolveCell = (x, y, visited) => {
    let best1x1Score = Infinity;
    let bestScore = Infinity;

    let bestPattern = patterns[0];
    let bestPatternColors = [];
    let bestPatternRotation = 0;

    let bestPatternArray = -1;
    let bestPatternArrayOffsetX = 0;
    let bestPatternArrayOffsetY = 0;

    // find best color for a square
    for(let c = 0; c < brickColors[0].length; c++) {
      const col = legoColorsLRGB[brickColors[0][c]];

      const pattern = new Float64Array(widthProcessPattern ** 2 * 3);
      for(let index = 0; index < pattern.length; index += 3) {
        pattern[index + 0] = col[0];
        pattern[index + 1] = col[1];
        pattern[index + 2] = col[2];
      }

      const score = scorePattern(x, y, pattern, 1, 1);
      if(score < best1x1Score) {
        best1x1Score = score;
        bestPatternArray = pattern;
        bestPatternColors = [c];
      }
    }

    for(let p = 1; p < patterns.length; p++) {
      for(let r = 0; r < 4; r++) {
        if(patterns[p].restrictions.length > 0) {
          // check if restrictions are met
          if(restrictionConflict(x, y, patterns[p], r, visited)) continue;
        }
        // find best color for nth part

        // score 1x1
        // if 1x1 score < best1x1Score
        // resolve dependencies
        // TODO:
      }
    }
  };

  let t = performance.now();
  callback(linearDatatoImageData(ditheredLRGB, width, height));

  let vv = 0;

  let changed = false;
  do {
    changed = false;
    for(let i = 0; i < totalStuds; i++) {
      if(performance.now() - t > 1000) {
        callback(linearDatatoImageData(ditheredLRGB, width, height));
        t = performance.now();
      }

      const best = studOrder[i];

      const x = best[0];
      const y = best[1];

      // pick best pattern for stud

      // sort patterns by score
      // resolve best score, if there's a better unresolved score, resolve that etc.

      let best1x1Score = Infinity;
      let bestScore = Infinity;
      let bestPattern = -1;
      let bestPatternOffsetX = 0;
      let bestPatternOffsetY = 0;

      // find best color for a square
      for(let c = 0; c < brickColors[0].length; c++) {
        const col = legoColorsLRGB[brickColors[0][c]];

        const pattern = new Float64Array(widthProcessPattern ** 2 * 3);
        for(let index = 0; index < pattern.length; index += 3) {
          pattern[index + 0] = col[0];
          pattern[index + 1] = col[1];
          pattern[index + 2] = col[2];
        }

        const score = scorePattern(x, y, pattern, 1, 1);
        if(score < best1x1Score) {
          best1x1Score = score;
          bestPattern = pattern;
        }
      }

      for(let p = 0; p < patterns.length; p++) {
        for(let r = 0; r < 4; r++) {
          // find best color for nth part

          // score 1x1
          // if 1x1 score < best1x1Score
          // resolve dependencies
        }
      }

      // old pick best pattern for stud
      /*
      let c = [0, 0];
      let bestScore = Infinity;
      for(let studX = 0; studX < patternCountWidth; studX++) {
        for(let studY = 0; studY < 4; studY++) {
          const score = scoreStud(x, y, studX, studY);
          if(score < bestScore) {
            bestScore = score;
            c[0] = studX;
            c[1] = studY;
          }
        }
      }

      // apply best stud
      for(let X = 0; X < widthProcessPattern; X++) {
        for(let Y = 0; Y < widthProcessPattern; Y++) {
          const i = x * widthProcessPattern + X + (y * widthProcessPattern + Y) * width;
          const i3 = i * 3;
          const c3 = (
            c[0] * widthProcessPattern + X +
            (c[1] * widthProcessPattern + Y) * paletteWidth
          ) * 3;
          ditheredLRGB[i3 + 0] = linearStudData[c3 + 0];
          ditheredLRGB[i3 + 1] = linearStudData[c3 + 1];
          ditheredLRGB[i3 + 2] = linearStudData[c3 + 2];
        }
      }

      if(bestScore === 0) continue;

      applyStud(x, y, c[0], c[1]);

      for(let X = 0; X < widthProcessPattern; X++) {
        for(let Y = 0; Y < widthProcessPattern; Y++) {
          const i = x * widthProcessPattern + X + (y * widthProcessPattern + Y) * width;
          const i3 = i * 3;
          const c3 = (
            c[0] * widthProcessPattern + X +
            (c[1] * widthProcessPattern + Y) * paletteWidth
          ) * 3;
          sourceLRGB[i3 + 0] = linearStudData[c3 + 0];
          sourceLRGB[i3 + 1] = linearStudData[c3 + 1];
          sourceLRGB[i3 + 2] = linearStudData[c3 + 2];
        }
      }

      changed = true;
      */
    }
  } while(changed);

  callback(linearDatatoImageData(ditheredLRGB, width, height));
}
