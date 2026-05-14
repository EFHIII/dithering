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

export function leastErrorMultiScan({
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
  
  const B = 1; // bright
  const L = 0.8; // light
  const M = 0.7; // medium
  const D = 0.14; // dark

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


  const ditheredLRGB = new Float64Array(totalPixels * 3);

  const trueSourceLRGB = imageDatatolRGB(imgData);
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

  const scorePattern = (x, y, pattern, pw = 1, ph = 1) => {
    let errorDelta = 0;

    const X = x * widthProcessPattern;
    const Y = y * widthProcessPattern;

    const deltaMask = new Array(widthProcessPattern ** 2 * pw * ph);
    for(let sX = 0; sX < widthProcessPattern * pw; sX++) {
      for(let sY = 0; sY < widthProcessPattern * ph; sY++) {
        const p = sX + X + (sY + Y) * width;
        const p3 = p * 3;

        const sp = sX + sY * widthProcessPattern * pw;
        const sp3 = sp * 3;
        deltaMask[sp] = (
          pattern[sp3 + 0] === sourceLRGB[p3 + 0] &&
          pattern[sp3 + 1] === sourceLRGB[p3 + 1] &&
          pattern[sp3 + 2] === sourceLRGB[p3 + 2]
        );
      }
    }

    for(let sX = -halfKernel; sX <= widthProcessPattern * pw + halfKernel; sX++) {
      for(let sY = -halfKernel; sY <= widthProcessPattern * ph + halfKernel; sY++) {
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
              spX >= widthProcessPattern * pw ||
              spY >= widthProcessPattern * ph
            ) continue;

            const sp = spX + spY * widthProcessPattern * pw;
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

  const applyPattern = (x, y, pattern, pw = 1, ph = 1) => {
    const X = x * widthProcessPattern;
    const Y = y * widthProcessPattern;

    // changes for each changed pixel
    for(let sX = 0; sX < widthProcessPattern * pw; sX++) {
      for(let sY = 0; sY < widthProcessPattern * ph; sY++) {
        const atX = X + sX;
        const atY = Y + sY;

        const at = atX + atY * width;
        const at3 = at * 3;

        const sp = sX + sY * widthProcessPattern * pw;
        const sp3 = sp * 3;

        // changes for each blurred pixel in gaussian range
        for(let kernelY = 0; kernelY < kernelSize; kernelY++) {
          for(let kernelX = 0; kernelX < kernelSize; kernelX++) {
            const spX = atX + kernelX - halfKernel;
            const spY = atY + kernelY - halfKernel;

            // skip pixel if outside of range
            if (
              spX < 0 ||
              spY < 0 ||
              spX >= width ||
              spY >= height
            ) continue;

            const weight = kernel[kernelX + kernelY * kernelSize];
            if (weight === 0) continue;

            const p = spX + spY * width;
            const p3 = p * 3;

            blurredDitheredLRGB[p3 + 0] += weight * (pattern[sp3] - sourceLRGB[at3]);
            blurredDitheredLRGB[p3 + 1] += weight * (pattern[sp3 + 1] - sourceLRGB[at3 + 1]);
            blurredDitheredLRGB[p3 + 2] += weight * (pattern[sp3 + 2] - sourceLRGB[at3 + 2]);
          }
        }

        // apply pixel
        sourceLRGB[at3 + 0] = pattern[sp3 + 0];
        sourceLRGB[at3 + 1] = pattern[sp3 + 1];
        sourceLRGB[at3 + 2] = pattern[sp3 + 2];
      }
    }

    for(let sX = -halfKernel; sX <= widthProcessPattern * pw + halfKernel; sX++) {
      for(let sY = -halfKernel; sY <= widthProcessPattern * ph + halfKernel; sY++) {
        const atX = X + sX;
        const atY = Y + sY;

        if(atX < 0 || atY < 0 || atX >= width || atY >= height) continue;

        const at = atX + atY * width;
        const at3 = at * 3;

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
  };

  const applyAlphaPattern = (x, y, pattern, part, rotation) => {
    const ind = Math.abs(part);
    let negativePart = false;
    if(part < 0) {
      negativePart = true;
    }
    for(let X = 0; X < widthProcessPattern; X++) {
      for(let Y = 0; Y < widthProcessPattern; Y++) {

        let alpha = linearpatternSheetData[
          (X + ind * widthProcessPattern +
          (Y + rotation * widthProcessPattern) * patternCountWidth * widthProcessPattern
          ) * 3];

        if(negativePart) alpha = 1 - alpha;

        const index = (X + Y * widthProcessPattern) * 3;
        const at = (x * widthProcessPattern + X + (y * widthProcessPattern + Y) * width) * 3;

        pattern[index + 0] = alpha * pattern[index + 0] + (1 - alpha) * ditheredLRGB[at + 0];
        pattern[index + 1] = alpha * pattern[index + 1] + (1 - alpha) * ditheredLRGB[at + 1];
        pattern[index + 2] = alpha * pattern[index + 2] + (1 - alpha) * ditheredLRGB[at + 2];
      }
    }
  };

  const applyPiecePattern = (col, pattern, part, rotation) => {
    const ind = Math.abs(part);
    let negativePart = false;
    if(part < 0) {
      negativePart = true;
    }
    for(let X = 0; X < widthProcessPattern; X++) {
      for(let Y = 0; Y < widthProcessPattern; Y++) {

        let alpha = linearpatternSheetData[
          (X + ind * widthProcessPattern +
          (Y + rotation * widthProcessPattern) * patternCountWidth * widthProcessPattern
          ) * 3];

        if(negativePart) alpha = 1 - alpha;

        const index = (X + Y * widthProcessPattern) * 3;

        pattern[index + 0] = alpha * col[0] + (1 - alpha) * pattern[index + 0];
        pattern[index + 1] = alpha * col[1] + (1 - alpha) * pattern[index + 1];
        pattern[index + 2] = alpha * col[2] + (1 - alpha) * pattern[index + 2];
      }
    }
  };

  const joinPatterns = (patterns) => {
    const ans = [];
    for(let y = 0; y < patterns.length; y++) {
      for(let l = 0; l < widthProcessPattern; l++) {
        for(let x = 0; x < patterns[y].length; x++) {
          ans.push(...patterns[y][x].slice(l * widthProcessPattern * 3, (l + 1) * widthProcessPattern * 3));
        }
      }
    }
    return ans;
  };

  const getPattern = (x, y, pw = 1, ph = 1) => {
    const ans = new Float64Array(widthProcessPattern ** 2 * 3 * pw * ph);
    let at3 = 0;
    for(let Y = 0; Y < widthProcessPattern * ph; Y++) {
      for(let X = 0; X < widthProcessPattern * pw; X++) {
        const p = X + x * widthProcessPattern + (Y + y * widthProcessPattern) * width;
        const p3 = p * 3;

        ans[at3++] = ditheredLRGB[p3 + 0];
        ans[at3++] = ditheredLRGB[p3 + 1];
        ans[at3++] = ditheredLRGB[p3 + 2];
      }
    }
    return ans;
  };

  const resetImage = () => {
    for(let i = 0; i < trueSourceLRGB.length; i++) {
      sourceLRGB[i] = trueSourceLRGB[i];
      blurredDitheredLRGB[i] = blurredSourceLRGB[i];
      ditheredLRGB[i] = 0;
    }
    for(let j = 0; j < totalPixels; j++) {
      errorMap[j] = 0;
    }
  };

  const alphaBlock = new Float64Array(widthProcessPattern ** 2 * 3);

  const getAlphaBlock = (x, y) => {
    applyAlphaPattern(x, y, alphaBlock, 0, 0);
    return alphaBlock;
  };

  // find best 1x1 pattern
  console.log('phase 1:');

  let t = performance.now();
  callback(linearDatatoImageData(ditheredLRGB, width, height));

  const squarePatterns = [];
  // squares
  for(let c = 0; c < brickColors[0].length; c++) {
    const col = legoColorsLRGB[brickColors[0][c]];

    const pattern = new Float64Array(widthProcessPattern ** 2 * 3);
    for(let index = 0; index < pattern.length; index += 3) {
      pattern[index + 0] = col[0];
      pattern[index + 1] = col[1];
      pattern[index + 2] = col[2];
    }

    squarePatterns.push(pattern);
  }

  const circlePatterns = [];
  // circles
  for(let c = 0; c < brickColors[0].length; c++) {
    for(let c2 = 0; c2 < brickColors[1].length; c2++) {
      const col = legoColorsLRGB[brickColors[0][c]];
      const col2 = legoColorsLRGB[brickColors[1][c2]];

      const pattern = new Float64Array(widthProcessPattern ** 2 * 3);
      for(let index = 0; index < pattern.length; index += 3) {
        pattern[index + 0] = col[0] * M;
        pattern[index + 1] = col[1] * M;
        pattern[index + 2] = col[2] * M;
      }

      applyPiecePattern(col2, pattern, 4, 0);

      circlePatterns.push(pattern);
    }
  }

  const halfCirclePatterns = [];
  // half circles
  for(let c = 0; c < brickColors[0].length; c++) {
    for(let c2 = 0; c2 < brickColors[2].length; c2++) {
      for(let r = 0; r < 4; r++) {
        const col = legoColorsLRGB[brickColors[0][c]];
        const col2 = legoColorsLRGB[brickColors[2][c2]];

        const pattern = new Float64Array(widthProcessPattern ** 2 * 3);
        for(let index = 0; index < pattern.length; index += 3) {
          pattern[index + 0] = col[0] * M;
          pattern[index + 1] = col[1] * M;
          pattern[index + 2] = col[2] * M;
        }

        applyPiecePattern(col2, pattern, 6, r);

        halfCirclePatterns.push(pattern);
      }
    }
  }

  const quarterCirclePatterns = [];
  // quarter circles
  for(let c = 0; c < brickColors[0].length; c++) {
    for(let c2 = 0; c2 < brickColors[3].length; c2++) {
      for(let r = 0; r < 4; r++) {
        const col = legoColorsLRGB[brickColors[0][c]];
        const col2 = legoColorsLRGB[brickColors[3][c2]];

        const pattern = new Float64Array(widthProcessPattern ** 2 * 3);
        for(let index = 0; index < pattern.length; index += 3) {
          pattern[index + 0] = col[0] * M;
          pattern[index + 1] = col[1] * M;
          pattern[index + 2] = col[2] * M;
        }

        applyPiecePattern(col2, pattern, 10, r);

        quarterCirclePatterns.push(pattern);
      }
    }
  }

  const patternMap = new Array(totalPixels);
  for(let i = 0; i < patternMap.length; i++) {
    patternMap[i] = {
      choice: {type: '1x1', index: -1},
      options: {
        '1x1': [...squarePatterns],
        '1x2': [],
        '2x1': [],
        '2x2': [],
      },
    };
  }

  const patterns1x1 = [...squarePatterns, ...circlePatterns, ...halfCirclePatterns,...quarterCirclePatterns];

  let changed = true;
  /*
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

      let best1x1Score = Infinity;
      let bestPattern = 0;

      for(let j = 0; j < squarePatterns.length; j++) {
        const score = scorePattern(x, y, squarePatterns[j], 1, 1);
        if(score < best1x1Score) {
          best1x1Score = score;
          bestPattern = j;
        }
      }

      if(bestPattern !== patternMap[i].choice.index) {
        for(let X = 0; X < widthProcessPattern; X++) {
          for(let Y = 0; Y < widthProcessPattern; Y++) {
            const i = x * widthProcessPattern + X + (y * widthProcessPattern + Y) * width;
            const i3 = i * 3;
            const c3 = (X + Y * widthProcessPattern) * 3;
            ditheredLRGB[i3 + 0] = squarePatterns[bestPattern][c3 + 0];
            ditheredLRGB[i3 + 1] = squarePatterns[bestPattern][c3 + 1];
            ditheredLRGB[i3 + 2] = squarePatterns[bestPattern][c3 + 2];
          }
        }

        applyPattern(x, y, squarePatterns[bestPattern]);
        patternMap[i].choice.index = bestPattern;
        changed = true;
      }
    }
  } while (changed);
  */
  callback(linearDatatoImageData(ditheredLRGB, width, height));

  // find best 2/3 x 1 pattern vertical
  console.log('phase 1A:');
  resetImage();

  let firstPass = true;

  if(circlePatterns.length > 0) {
    do {
      changed = false;

      for(let i = 0; i < totalStuds; i++) {
        const best = studOrder[i];

        const x = best[0];
        const y = best[1];

        if(performance.now() - t > 1000) {
          callback(linearDatatoImageData(ditheredLRGB, width, height));
          t = performance.now();
        }

        let best1x1Score = Infinity;
        let bestPattern = 0;

        for(let j = 0; j < circlePatterns.length; j++) {
          let score = scorePattern(x, y, circlePatterns[j]);

          if(score < best1x1Score) {
            best1x1Score = score;
            bestPattern = j;
          }
        }

        if(firstPass || best1x1Score < 0) {
          for(let X = 0; X < widthProcessPattern; X++) {
            for(let Y = 0; Y < widthProcessPattern; Y++) {
              const i = x * widthProcessPattern + X + (y * widthProcessPattern + Y) * width;
              const i3 = i * 3;
              const c3 = (X + Y * widthProcessPattern) * 3;
              ditheredLRGB[i3 + 0] = circlePatterns[bestPattern][c3 + 0];
              ditheredLRGB[i3 + 1] = circlePatterns[bestPattern][c3 + 1];
              ditheredLRGB[i3 + 2] = circlePatterns[bestPattern][c3 + 2];
            }
          }

          applyPattern(x, y, circlePatterns[bestPattern]);

          patternMap[i].choice.index = bestPattern;
          changed = true;
        }
      }
      firstPass = false;
    } while (changed);

    callback(linearDatatoImageData(ditheredLRGB, width, height));

    for(let i = 0; i < totalStuds; i++) {
      const best = studOrder[i];

      const x = best[0];
      const y = best[1];

      //patternMap[i].options['1x1'].push(getPattern(x, y, 1, 1));
      patternMap[i].options['1x1'].push(circlePatterns[patternMap[i].choice.index]);
    }
  }
  console.log('phase 1B:');
  resetImage();

  firstPass = true;

  if(halfCirclePatterns.length > 0) {
    do {
      changed = false;

      for(let i = 0; i < totalStuds; i++) {
        const best = studOrder[i];

        const x = best[0];
        const y = best[1];

        if(performance.now() - t > 1000) {
          callback(linearDatatoImageData(ditheredLRGB, width, height));
          t = performance.now();
        }

        let best1x1Score = Infinity;
        let bestPattern = 0;

        for(let j = 0; j < halfCirclePatterns.length; j++) {
          let score = scorePattern(x, y, halfCirclePatterns[j]);

          if(score < best1x1Score) {
            best1x1Score = score;
            bestPattern = j;
          }
        }

        if(firstPass || best1x1Score < 0) {
          for(let X = 0; X < widthProcessPattern; X++) {
            for(let Y = 0; Y < widthProcessPattern; Y++) {
              const i = x * widthProcessPattern + X + (y * widthProcessPattern + Y) * width;
              const i3 = i * 3;
              const c3 = (X + Y * widthProcessPattern) * 3;
              ditheredLRGB[i3 + 0] = halfCirclePatterns[bestPattern][c3 + 0];
              ditheredLRGB[i3 + 1] = halfCirclePatterns[bestPattern][c3 + 1];
              ditheredLRGB[i3 + 2] = halfCirclePatterns[bestPattern][c3 + 2];
            }
          }

          applyPattern(x, y, halfCirclePatterns[bestPattern]);

          patternMap[i].choice.index = bestPattern;
          changed = true;
        }
      }
      firstPass = false;
    } while (changed);

    callback(linearDatatoImageData(ditheredLRGB, width, height));

    for(let i = 0; i < totalStuds; i++) {
      const best = studOrder[i];

      const x = best[0];
      const y = best[1];

      //patternMap[i].options['1x1'].push(getPattern(x, y, 1, 1));
      patternMap[i].options['1x1'].push(halfCirclePatterns[patternMap[i].choice.index]);
    }
  }

  console.log('phase 1C:');
  resetImage();

  firstPass = true;

  if(quarterCirclePatterns.length > 0) {
    do {
      changed = false;

      for(let i = 0; i < totalStuds; i++) {
        const best = studOrder[i];

        const x = best[0];
        const y = best[1];

        if(performance.now() - t > 1000) {
          callback(linearDatatoImageData(ditheredLRGB, width, height));
          t = performance.now();
        }

        let best1x1Score = Infinity;
        let bestPattern = 0;

        for(let j = 0; j < quarterCirclePatterns.length; j++) {
          let score = scorePattern(x, y, quarterCirclePatterns[j]);

          if(score < best1x1Score) {
            best1x1Score = score;
            bestPattern = j;
          }
        }

        if(firstPass || best1x1Score < 0) {
          for(let X = 0; X < widthProcessPattern; X++) {
            for(let Y = 0; Y < widthProcessPattern; Y++) {
              const i = x * widthProcessPattern + X + (y * widthProcessPattern + Y) * width;
              const i3 = i * 3;
              const c3 = (X + Y * widthProcessPattern) * 3;
              ditheredLRGB[i3 + 0] = quarterCirclePatterns[bestPattern][c3 + 0];
              ditheredLRGB[i3 + 1] = quarterCirclePatterns[bestPattern][c3 + 1];
              ditheredLRGB[i3 + 2] = quarterCirclePatterns[bestPattern][c3 + 2];
            }
          }

          applyPattern(x, y, quarterCirclePatterns[bestPattern]);

          patternMap[i].choice.index = bestPattern;
          changed = true;
        }
      }
      firstPass = false;
    } while (changed);

    callback(linearDatatoImageData(ditheredLRGB, width, height));

    for(let i = 0; i < totalStuds; i++) {
      const best = studOrder[i];

      const x = best[0];
      const y = best[1];

      //patternMap[i].options['1x1'].push(getPattern(x, y, 1, 1));
      patternMap[i].options['1x1'].push(quarterCirclePatterns[patternMap[i].choice.index]);
    }
  }

  console.log('phase 1D:');
  resetImage();

  firstPass = true;

  if(circlePatterns.length > 0 || halfCirclePatterns.length > 0 || quarterCirclePatterns.length > 0) {
    do {
      changed = false;

      for(let i = 0; i < totalStuds; i++) {
        const best = studOrder[i];

        const x = best[0];
        const y = best[1];

        if(performance.now() - t > 1000) {
          callback(linearDatatoImageData(ditheredLRGB, width, height));
          t = performance.now();
        }

        let best1x1Score = Infinity;
        let bestPattern = 0;

        for(let j = 0; j < patterns1x1.length; j++) {
          let score = scorePattern(x, y, patterns1x1[j]);

          if(score < best1x1Score) {
            best1x1Score = score;
            bestPattern = j;
          }
        }

        if(firstPass || best1x1Score < 0) {
          for(let X = 0; X < widthProcessPattern; X++) {
            for(let Y = 0; Y < widthProcessPattern; Y++) {
              const i = x * widthProcessPattern + X + (y * widthProcessPattern + Y) * width;
              const i3 = i * 3;
              const c3 = (X + Y * widthProcessPattern) * 3;
              ditheredLRGB[i3 + 0] = patterns1x1[bestPattern][c3 + 0];
              ditheredLRGB[i3 + 1] = patterns1x1[bestPattern][c3 + 1];
              ditheredLRGB[i3 + 2] = patterns1x1[bestPattern][c3 + 2];
            }
          }

          applyPattern(x, y, patterns1x1[bestPattern]);

          patternMap[i].choice.index = bestPattern;
          changed = true;
        }
      }
      firstPass = false;
    } while (changed);

    callback(linearDatatoImageData(ditheredLRGB, width, height));

    for(let i = 0; i < totalStuds; i++) {
      const best = studOrder[i];

      const x = best[0];
      const y = best[1];

      //patternMap[i].options['1x1'].push(getPattern(x, y, 1, 1));
      patternMap[i].options['1x1'].push(patterns1x1[patternMap[i].choice.index]);
    }
  }

  // find best 2/3 x 1 pattern vertical
  console.log('phase 2:');
  resetImage();

  const squareVerticalPatterns = [
    [],[],[],[],[],[]
  ];
  const squareHorizontalPatterns = [
    [],[],[],[],[],[]
  ];
  for(let c = 0; c < brickColors[0].length; c++) {
    const col = legoColorsLRGB[brickColors[0][c]];

    for(let i = 0; i < 12; i++) {
      const pattern = new Float64Array(widthProcessPattern ** 2 * 3);
      for(let index = 0; index < pattern.length; index += 3) {
        pattern[index + 0] = col[0];
        pattern[index + 1] = col[1];
        pattern[index + 2] = col[2];
      }
      if(i < 6) squareVerticalPatterns[i].push(pattern);
      else if(i < 12) squareHorizontalPatterns[i-6].push(pattern);
    }
  }

  firstPass = true;

  do {
    changed = false;
    // [part, rotation]
    const pParts = [
      [1, 2],
      [2, 2],
      [3, 2],
      [2, 0],
      [1, 0]
    ];
    for(let i = 0; i < totalStuds; i++) {
      const best = studOrder[i];

      const x = best[0];
      const y = best[1];
      for(let p = 0; p < 5; p++) {
        if(performance.now() - t > 1000) {
          callback(linearDatatoImageData(ditheredLRGB, width, height));
          t = performance.now();
        }

        if(p < 3 && y % 2 === 1) continue;
        if(p >= 3 && y % 2 === 0) continue;

        let best1x1Score = Infinity;
        let bestPattern = 0;

        for(let j = 0; j < squareVerticalPatterns[p].length; j++) {
          applyAlphaPattern(x, y, squareVerticalPatterns[p][j], pParts[p][0], pParts[p][1]);
          let score;

          if(p === 2 && y < heightStuds - 1) {
            applyAlphaPattern(x, y + 1, squareVerticalPatterns[5][j], 3, 0);
            score = scorePattern(x, y, [...squareVerticalPatterns[p][j], ...squareVerticalPatterns[5][j]], 1, 2);
          }
          else {
            score = scorePattern(x, y, squareVerticalPatterns[p][j], 1, 1);
          }

          if(score < best1x1Score) {
            best1x1Score = score;
            bestPattern = j;
          }
        }

        if(firstPass || best1x1Score < 0) {
          for(let X = 0; X < widthProcessPattern; X++) {
            for(let Y = 0; Y < widthProcessPattern; Y++) {
              const i = x * widthProcessPattern + X + (y * widthProcessPattern + Y) * width;
              const i3 = i * 3;
              const c3 = (X + Y * widthProcessPattern) * 3;
              ditheredLRGB[i3 + 0] = squareVerticalPatterns[p][bestPattern][c3 + 0];
              ditheredLRGB[i3 + 1] = squareVerticalPatterns[p][bestPattern][c3 + 1];
              ditheredLRGB[i3 + 2] = squareVerticalPatterns[p][bestPattern][c3 + 2];

              if(p === 2 && y < heightStuds - 1) {
                const i = x * widthProcessPattern + X + ((y + 1) * widthProcessPattern + Y) * width;
                const i3 = i * 3;
                ditheredLRGB[i3 + 0] = squareVerticalPatterns[5][bestPattern][c3 + 0];
                ditheredLRGB[i3 + 1] = squareVerticalPatterns[5][bestPattern][c3 + 1];
                ditheredLRGB[i3 + 2] = squareVerticalPatterns[5][bestPattern][c3 + 2];
              }
            }
          }

          applyPattern(x, y, squareVerticalPatterns[p][bestPattern]);

          if(p === 2 && y < heightStuds - 1) {
            applyPattern(x, y + 1, squareVerticalPatterns[5][bestPattern]);
          }
          patternMap[i].choice.index = bestPattern;
          changed = true;
        }
      }
    }
    firstPass = false;
  } while (changed);

  callback(linearDatatoImageData(ditheredLRGB, width, height));

  for(let i = 0; i < totalStuds; i++) {
    const best = studOrder[i];

    const x = best[0];
    const y = best[1];

    if(y % 2 === 1 || y === height - 1) continue;

    patternMap[i].options['1x2'].push(getPattern(x, y, 1, 2));
  }

  console.log('phase 3:');
  resetImage();

  firstPass = true;

  do {
    changed = false;
    // [part, rotation]
    const pParts = [
      [1, 2],
      [2, 2],
      [3, 2],
      [2, 0],
      [1, 0]
    ];
    for(let i = 0; i < totalStuds; i++) {
      for(let p = 0; p < 5; p++) {
        if(performance.now() - t > 1000) {
          callback(linearDatatoImageData(ditheredLRGB, width, height));
          t = performance.now();
        }

        const best = studOrder[i];

        const x = best[0];
        const y = best[1];
        if(p < 3 && y % 2 === 0) continue;
        if(p >= 3 && y % 2 === 1) continue;

        let best1x1Score = Infinity;
        let bestPattern = 0;

        for(let j = 0; j < squareVerticalPatterns[p].length; j++) {
          applyAlphaPattern(x, y, squareVerticalPatterns[p][j], pParts[p][0], pParts[p][1]);
          let score;

          if(p === 2 && y < heightStuds - 1) {
            applyAlphaPattern(x, y + 1, squareVerticalPatterns[5][j], 3, 0);
            score = scorePattern(x, y, [...squareVerticalPatterns[p][j], ...squareVerticalPatterns[5][j]], 1, 2);
          }
          else {
            score = scorePattern(x, y, squareVerticalPatterns[p][j], 1, 1);
          }

          if(score < best1x1Score) {
            best1x1Score = score;
            bestPattern = j;
          }
        }

        if(firstPass || best1x1Score < 0) {
          for(let X = 0; X < widthProcessPattern; X++) {
            for(let Y = 0; Y < widthProcessPattern; Y++) {
              const i = x * widthProcessPattern + X + (y * widthProcessPattern + Y) * width;
              const i3 = i * 3;
              const c3 = (X + Y * widthProcessPattern) * 3;
              ditheredLRGB[i3 + 0] = squareVerticalPatterns[p][bestPattern][c3 + 0];
              ditheredLRGB[i3 + 1] = squareVerticalPatterns[p][bestPattern][c3 + 1];
              ditheredLRGB[i3 + 2] = squareVerticalPatterns[p][bestPattern][c3 + 2];

              if(p === 2 && y < heightStuds - 1) {
                const i = x * widthProcessPattern + X + ((y + 1) * widthProcessPattern + Y) * width;
                const i3 = i * 3;
                ditheredLRGB[i3 + 0] = squareVerticalPatterns[5][bestPattern][c3 + 0];
                ditheredLRGB[i3 + 1] = squareVerticalPatterns[5][bestPattern][c3 + 1];
                ditheredLRGB[i3 + 2] = squareVerticalPatterns[5][bestPattern][c3 + 2];
              }
            }
          }

          applyPattern(x, y, squareVerticalPatterns[p][bestPattern]);

          if(p === 2 && y < heightStuds - 1) {
            applyPattern(x, y + 1, squareVerticalPatterns[5][bestPattern]);
          }
          patternMap[i].choice.index = bestPattern;
          changed = true;
        }
      }
    }
    firstPass = false;
  } while (changed);

  callback(linearDatatoImageData(ditheredLRGB, width, height));

  for(let i = 0; i < totalStuds; i++) {
    const best = studOrder[i];

    const x = best[0];
    const y = best[1];

    if(y % 2 === 0 || y === height - 1) continue;

    patternMap[i].options['1x2'].push(getPattern(x, y, 1, 2));
  }

  // find best 2/3 x 1 pattern horizontal
  console.log('phase 4:');
  resetImage();

  firstPass = true;

  do {
    changed = false;
    // [part, rotation]
    const pParts = [
      [1, 1],
      [2, 1],
      [3, 1],
      [2, 3],
      [1, 3]
    ];
    for(let i = 0; i < totalStuds; i++) {
      for(let p = 0; p < 5; p++) {
        if(performance.now() - t > 1000) {
          callback(linearDatatoImageData(ditheredLRGB, width, height));
          t = performance.now();
        }

        const best = studOrder[i];

        const x = best[0];
        const y = best[1];
        if(p < 3 && x % 2 === 1) continue;
        if(p >= 3 && x % 2 === 0) continue;

        let best1x1Score = Infinity;
        let bestPattern = 0;

        for(let j = 0; j < squareHorizontalPatterns[p].length; j++) {
          applyAlphaPattern(x, y, squareHorizontalPatterns[p][j], pParts[p][0], pParts[p][1]);
          let score;

          if(p === 2 && x < widthStuds - 1) {
            applyAlphaPattern(x + 1, y, squareHorizontalPatterns[5][j], 3, 3);
            score = scorePattern(x, y, joinPatterns([[squareHorizontalPatterns[p][j], squareHorizontalPatterns[5][j]]]), 2, 1);
          }
          else {
            score = scorePattern(x, y, squareHorizontalPatterns[p][j], 1, 1);
          }

          if(score < best1x1Score) {
            best1x1Score = score;
            bestPattern = j;
          }
        }

        if(firstPass || best1x1Score < 0) {
          for(let X = 0; X < widthProcessPattern; X++) {
            for(let Y = 0; Y < widthProcessPattern; Y++) {
              const i = x * widthProcessPattern + X + (y * widthProcessPattern + Y) * width;
              const i3 = i * 3;
              const c3 = (X + Y * widthProcessPattern) * 3;
              ditheredLRGB[i3 + 0] = squareHorizontalPatterns[p][bestPattern][c3 + 0];
              ditheredLRGB[i3 + 1] = squareHorizontalPatterns[p][bestPattern][c3 + 1];
              ditheredLRGB[i3 + 2] = squareHorizontalPatterns[p][bestPattern][c3 + 2];

              if(p === 2 && x < widthStuds - 1) {
                const i = (x + 1) * widthProcessPattern + X + (y * widthProcessPattern + Y) * width;
                const i3 = i * 3;
                ditheredLRGB[i3 + 0] = squareHorizontalPatterns[5][bestPattern][c3 + 0];
                ditheredLRGB[i3 + 1] = squareHorizontalPatterns[5][bestPattern][c3 + 1];
                ditheredLRGB[i3 + 2] = squareHorizontalPatterns[5][bestPattern][c3 + 2];
              }
            }
          }

          applyPattern(x, y, squareHorizontalPatterns[p][bestPattern]);

          if(p === 2 && x < widthStuds - 1) {
            applyPattern(x + 1, y, squareHorizontalPatterns[5][bestPattern]);
          }
          patternMap[i].choice.index = bestPattern;
          changed = true;
        }
      }
    }
    firstPass = false;
  } while (changed);

  callback(linearDatatoImageData(ditheredLRGB, width, height));

  for(let i = 0; i < totalStuds; i++) {
    const best = studOrder[i];

    const x = best[0];
    const y = best[1];

    if(x % 2 === 1 || x === width - 1) continue;

    patternMap[i].options['2x1'].push(getPattern(x, y, 2, 1));
  }

  console.log('phase 5:');
  resetImage();

  firstPass = true;

  do {
    changed = false;
    // [part, rotation]
    const pParts = [
      [1, 1],
      [2, 1],
      [3, 1],
      [2, 3],
      [1, 3]
    ];
    for(let i = 0; i < totalStuds; i++) {
      for(let p = 0; p < 5; p++) {
        if(performance.now() - t > 1000) {
          callback(linearDatatoImageData(ditheredLRGB, width, height));
          t = performance.now();
        }

        const best = studOrder[i];

        const x = best[0];
        const y = best[1];
        if(p < 3 && x % 2 === 0) continue;
        if(p >= 3 && x % 2 === 1) continue;

        let best1x1Score = Infinity;
        let bestPattern = 0;

        for(let j = 0; j < squareHorizontalPatterns[p].length; j++) {
          applyAlphaPattern(x, y, squareHorizontalPatterns[p][j], pParts[p][0], pParts[p][1]);
          let score;

          if(p === 2 && x < widthStuds - 1) {
            applyAlphaPattern(x + 1, y, squareHorizontalPatterns[5][j], 3, 3);
            score = scorePattern(x, y, joinPatterns([[squareHorizontalPatterns[p][j], squareHorizontalPatterns[5][j]]]), 2, 1);
          }
          else {
            score = scorePattern(x, y, squareHorizontalPatterns[p][j], 1, 1);
          }

          if(score < best1x1Score) {
            best1x1Score = score;
            bestPattern = j;
          }
        }

        if(firstPass || best1x1Score < 0) {
          for(let X = 0; X < widthProcessPattern; X++) {
            for(let Y = 0; Y < widthProcessPattern; Y++) {
              const i = x * widthProcessPattern + X + (y * widthProcessPattern + Y) * width;
              const i3 = i * 3;
              const c3 = (X + Y * widthProcessPattern) * 3;
              ditheredLRGB[i3 + 0] = squareHorizontalPatterns[p][bestPattern][c3 + 0];
              ditheredLRGB[i3 + 1] = squareHorizontalPatterns[p][bestPattern][c3 + 1];
              ditheredLRGB[i3 + 2] = squareHorizontalPatterns[p][bestPattern][c3 + 2];

              if(p === 2 && x < widthStuds - 1) {
                const i = (x + 1) * widthProcessPattern + X + (y * widthProcessPattern + Y) * width;
                const i3 = i * 3;
                ditheredLRGB[i3 + 0] = squareHorizontalPatterns[5][bestPattern][c3 + 0];
                ditheredLRGB[i3 + 1] = squareHorizontalPatterns[5][bestPattern][c3 + 1];
                ditheredLRGB[i3 + 2] = squareHorizontalPatterns[5][bestPattern][c3 + 2];
              }
            }
          }

          applyPattern(x, y, squareHorizontalPatterns[p][bestPattern]);

          if(p === 2 && x < widthStuds - 1) {
            applyPattern(x + 1, y, squareHorizontalPatterns[5][bestPattern]);
          }
          patternMap[i].choice.index = bestPattern;
          changed = true;
        }
      }
    }
    firstPass = false;
  } while (changed);

  callback(linearDatatoImageData(ditheredLRGB, width, height));

  for(let i = 0; i < totalStuds; i++) {
    const best = studOrder[i];

    const x = best[0];
    const y = best[1];

    if(x % 2 === 0 || x === width - 1) continue;

    patternMap[i].options['2x1'].push(getPattern(x, y, 2, 1));
  }

  console.log('phase 6:');


  console.log('phase omega:');
  resetImage();

  firstPass = true;


  for(let i = 0; i < totalStuds; i++) {
    patternMap[i].choice.index = 0;
  }

  do {
    changed = false;
    for(let i = 0; i < totalStuds; i++) {
      if(performance.now() - t > 1000) {
        callback(linearDatatoImageData(ditheredLRGB, width, height));

        t = performance.now();
      }

      //while(performance.now() - t < 1000) {}

      const best = studOrder[i];

      const x = best[0];
      const y = best[1];

      let best1x1Score = Infinity;
      let bestPattern = 0;
      let subPatterns = [];

      for(let j = 0; j < patternMap[i].options['1x1'].length; j++) {
        let score = scorePattern(x, y, patternMap[i].options['1x1'][j]);

        if(patternMap[i].choice.type === '2x1') {
          if(patternMap[i].choice.index === -1) {
            let bestNestedScore = Infinity;
            let bestNestedPattern = 0;
            for(let k = 0; k < patternMap[i-1].options['1x1'].length; k++) {
              let nestedScore = scorePattern(x-1, y, joinPatterns([[patternMap[i-1].options['1x1'][k],patternMap[i].options['1x1'][j]]]), 2, 1);
              if(nestedScore < bestNestedScore) {
                bestNestedScore = nestedScore;
                bestNestedPattern = k;
              }
            }

            if(bestNestedScore < best1x1Score) {
              best1x1Score = bestNestedScore;
              bestPattern = j;
              subPatterns = [[-1, 0, bestNestedPattern]];
            }
          }
          else {
            if(patternMap[i].choice.index === -1) {
              let bestNestedScore = Infinity;
              let bestNestedPattern = 0;
              for(let k = 0; k < patternMap[i+1].options['1x1'].length; k++) {
                let nestedScore = scorePattern(x, y, joinPatterns([[patternMap[i].options['1x1'][j],patternMap[i+1].options['1x1'][k]]]), 2, 1);
                if(nestedScore < bestNestedScore) {
                  bestNestedScore = nestedScore;
                  bestNestedPattern = k;
                }
              }

              if(bestNestedScore < best1x1Score) {
                best1x1Score = bestNestedScore;
                bestPattern = j;
                subPatterns = [[1, 0, bestNestedPattern]];
              }
            }
          }
        }
        else if(patternMap[i].choice.type === '1x2') {
          if(patternMap[i].choice.index === -1) {
            let bestNestedScore = Infinity;
            let bestNestedPattern = 0;
            for(let k = 0; k < patternMap[i-widthStuds].options['1x1'].length; k++) {
              let nestedScore = scorePattern(x, y-1, [...patternMap[i-widthStuds].options['1x1'][k],...patternMap[i].options['1x1'][j]], 1, 2);
              if(nestedScore < bestNestedScore) {
                bestNestedScore = nestedScore;
                bestNestedPattern = k;
              }
            }

            if(bestNestedScore < best1x1Score) {
              best1x1Score = bestNestedScore;
              bestPattern = j;
              subPatterns = [[0, -1, bestNestedPattern]];
            }
          }
          else {
            if(patternMap[i].choice.index === -1) {
              let bestNestedScore = Infinity;
              let bestNestedPattern = 0;
              for(let k = 0; k < patternMap[i+widthStuds].options['1x1'].length; k++) {
                let nestedScore = scorePattern(x, y, [...patternMap[i].options['1x1'][j],...patternMap[i+widthStuds].options['1x1'][k]], 1, 2);
                if(nestedScore < bestNestedScore) {
                  bestNestedScore = nestedScore;
                  bestNestedPattern = k;
                }
              }

              if(bestNestedScore < best1x1Score) {
                best1x1Score = bestNestedScore;
                bestPattern = j;
                subPatterns = [[0, 1, bestNestedPattern]];
              }
            }
          }
        }
        else if(score < best1x1Score) {
          best1x1Score = score;
          bestPattern = j;
          subPatterns = [];
        }
      }

      if((firstPass && patternMap[i].choice.type === '1x1') || best1x1Score < 0) {
        for(let X = 0; X < widthProcessPattern; X++) {
          for(let Y = 0; Y < widthProcessPattern; Y++) {
            const i3 = (x * widthProcessPattern + X + (y * widthProcessPattern + Y) * width) * 3;
            const c3 = (X + Y * widthProcessPattern) * 3;
            ditheredLRGB[i3 + 0] = patternMap[i].options['1x1'][bestPattern][c3 + 0];
            ditheredLRGB[i3 + 1] = patternMap[i].options['1x1'][bestPattern][c3 + 1];
            ditheredLRGB[i3 + 2] = patternMap[i].options['1x1'][bestPattern][c3 + 2];
          }
        }

        for(let j = 0; j < subPatterns.length; j++) {
          const PMIndex = i + subPatterns[j][0] + subPatterns[j][1] * widthStuds;
          const PM = patternMap[PMIndex];
          for(let X = 0; X < widthProcessPattern; X++) {
            for(let Y = 0; Y < widthProcessPattern; Y++) {
              const i = (x + subPatterns[j][0]) * widthProcessPattern + X + ((y + subPatterns[j][1]) * widthProcessPattern + Y) * width;
              const i3 = i * 3;
              const c3 = (X + Y * widthProcessPattern) * 3;
              ditheredLRGB[i3 + 0] = PM.options['1x1'][subPatterns[j][2]][c3 + 0];
              ditheredLRGB[i3 + 1] = PM.options['1x1'][subPatterns[j][2]][c3 + 1];
              ditheredLRGB[i3 + 2] = PM.options['1x1'][subPatterns[j][2]][c3 + 2];
            }
          }

          applyPattern(x + subPatterns[j][0], y + subPatterns[j][0], PM.options['1x1'][subPatterns[j][2]]);

          PM.choice.type = '1x1';
          PM.choice.index = subPatterns[j][2];
        }

        applyPattern(x, y, patternMap[i].options['1x1'][bestPattern]);

        patternMap[i].choice.type = '1x1';
        patternMap[i].choice.index = bestPattern;
        changed = true;
      }

      let best2x1Score = Infinity;
      let best1x2Score = Infinity;
      let bestPattern2x1 = 0;
      let bestPattern1x2 = 0;
      let subPatterns2x1 = [];
      let subPatterns1x2 = [];
      if(x < widthStuds - 1 &&
        (
          (patternMap[i].choice.type === '1x1' && patternMap[i + 1].choice.type === '1x1') ||
          (patternMap[i].choice.type === '2x1' && patternMap[i].choice.index >= 0)
        )
      ) {
        for(let j = 0; j < patternMap[i].options['2x1'].length; j++) {
          let score = scorePattern(x, y, patternMap[i].options['2x1'][j], 2, 1);

          if(score < best2x1Score) {
            best2x1Score = score;
            bestPattern2x1 = j;
            subPatterns2x1 = [];
          }
        }
      }
      else if (x < widthStuds - 1 &&
        (
          (patternMap[i].choice.type === '1x1' && patternMap[i + 1].choice.type === '1x2') ||
          (patternMap[i].choice.type === '1x2' && patternMap[i + 1].choice.type === '1x1')
      )) {
        let PX = patternMap[i].choice.type === '1x1' ? 1 : 0;
        let PY = patternMap[i + PX].choice.index >= 0 ? 1 : 0;
        for(let j = 0; j < patternMap[i].options['2x1'].length; j++) {
          for(let k = 0; k < patternMap[i].options['1x1'].length; k++) {
            let PA = [[0,0]];
            PA[0][PX] = patternMap[i+PX+(PY===1?1:-1)*widthStuds].options['1x1'][k];
            PA[0][1-PX] = getAlphaBlock(x + 1 - PX, y + (PY === 1 ? 1 : -1));

            PA = joinPatterns(PA);

            let score;

            if(PY === 1) {
              let score = scorePattern(x, y,
                [
                  ...patternMap[i].options['2x1'][j],
                  ...PA,
                ],
                2, 2);
            }
            else {
              let score = scorePattern(x, y-1,
                [
                  ...PA,
                  ...patternMap[i].options['2x1'][j],
                ],
                2, 2);
            }

            if(score < best2x1Score) {
              best2x1Score = score;
              bestPattern2x1 = j;
              subPatterns2x1 = [[PX, (PY===1?1:-1), k]];
            }
          }
        }
      }

      if(y < heightStuds - 1 &&
        (
          (patternMap[i].choice.type === '1x1' && patternMap[i + widthStuds].choice.type === '1x1') ||
          (patternMap[i].choice.type === '1x2' && patternMap[i].choice.index >= 0)
        )
      ) {
        for(let j = 0; j < patternMap[i].options['1x2'].length; j++) {
          let score = scorePattern(x, y, patternMap[i].options['1x2'][j], 1, 2);

          if(score < best1x2Score) {
            best1x2Score = score;
            bestPattern1x2 = j;
            subPatterns1x2 = [];
          }
        }
      }

      if(best2x1Score < 0 && best2x1Score < best1x2Score) {
        for(let X = 0; X < widthProcessPattern * 2; X++) {
          for(let Y = 0; Y < widthProcessPattern; Y++) {
            const i3 = (x * widthProcessPattern + X + (y * widthProcessPattern + Y) * width) * 3;
            const c3 = (X + Y * widthProcessPattern*2) * 3;
            ditheredLRGB[i3 + 0] = patternMap[i].options['2x1'][bestPattern2x1][c3 + 0];
            ditheredLRGB[i3 + 1] = patternMap[i].options['2x1'][bestPattern2x1][c3 + 1];
            ditheredLRGB[i3 + 2] = patternMap[i].options['2x1'][bestPattern2x1][c3 + 2];
          }
        }

        for(let j = 0; j < subPatterns2x1.length; j++) {
          const PMIndex = i + subPatterns2x1[j][0] + subPatterns2x1[j][1] * widthStuds;
          const PM = patternMap[PMIndex];
          for(let X = 0; X < widthProcessPattern; X++) {
            for(let Y = 0; Y < widthProcessPattern; Y++) {
              const i = (x + subPatterns2x1[j][0]) * widthProcessPattern + X + ((y + subPatterns2x1[j][1]) * widthProcessPattern + Y) * width;
              const i3 = i * 3;
              const c3 = (X + Y * widthProcessPattern) * 3;
              ditheredLRGB[i3 + 0] = PM.options['1x1'][subPatterns2x1[j][2]][c3 + 0];
              ditheredLRGB[i3 + 1] = PM.options['1x1'][subPatterns2x1[j][2]][c3 + 1];
              ditheredLRGB[i3 + 2] = PM.options['1x1'][subPatterns2x1[j][2]][c3 + 2];
            }
          }

          applyPattern(x + subPatterns2x1[j][0], y + subPatterns2x1[j][0], PM.options['1x1'][subPatterns2x1[j][2]]);

          PM.choice.type = '1x1';
          PM.choice.index = subPatterns2x1[j][2];
        }

        applyPattern(x, y, patternMap[i].options['2x1'][bestPattern2x1], 2, 1);

        patternMap[i].choice.type = '2x1';
        patternMap[i].choice.index = bestPattern2x1;

        patternMap[i + 1].choice.type = '2x1';
        patternMap[i + 1].choice.index = -1;

        changed = true;
      }
      else if(best1x2Score < 0 && best1x2Score < best2x1Score) {
        for(let X = 0; X < widthProcessPattern; X++) {
          for(let Y = 0; Y < widthProcessPattern*2; Y++) {
            const i3 = (x * widthProcessPattern + X + (y * widthProcessPattern + Y) * width) * 3;
            const c3 = (X + Y * widthProcessPattern) * 3;
            ditheredLRGB[i3 + 0] = patternMap[i].options['1x2'][bestPattern2x1][c3 + 0];
            ditheredLRGB[i3 + 1] = patternMap[i].options['1x2'][bestPattern2x1][c3 + 1];
            ditheredLRGB[i3 + 2] = patternMap[i].options['1x2'][bestPattern2x1][c3 + 2];
          }
        }

        applyPattern(x, y, patternMap[i].options['1x2'][bestPattern2x1], 1, 2);

        patternMap[i].choice.type = '1x2';
        patternMap[i].choice.index = bestPattern2x1;

        patternMap[i + widthStuds].choice.type = '1x2';
        patternMap[i + widthStuds].choice.index = -1;
        changed = true;
      }
    }
    firstPass = false;
  } while (changed);

  callback(linearDatatoImageData(ditheredLRGB, width, height));

  throw 'end';

  // ~~ OLD CODE ~~
  // patterns
  const patterns = [];

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

    patterns.push({
      parts: [
        [-4, 0, M, 0],
        [4, 0, B, 1],
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

    patterns.push({
      parts: [
        [-6, 0, M, 0],
        [6, 0, B, 2],
      ],
      restrictions: [],
    });
  }

  // quarter circle
  if(usedBricks[3]) {
    patterns.push({
      parts: [
        [10, 0, B, 3],
        [-10, 0, M, 0]
      ],
      restrictions: [],
    });

    patterns.push({
      parts: [
        [-10, 0, M, 0],
        [10, 0, B, 3],
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
        [1, 0, B, 0],
        [3, 0, B, 0],
        [2, 0, B, 0],
      ],
      restrictions: [
        [[3, 2, 1], 0, 0, 0]
      ],
    });

    patterns.push({
      parts: [
        [1, 0, B, 0],
        [2, 0, B, 0],
        [3, 0, B, 0],
      ],
      restrictions: [
        [[3, 2, 2], 0, 0, 0]
      ],
    });

    patterns.push({
      parts: [
        [3, 0, B, 0],
        [2, 0, B, 0],
        [1, 0, B, 0],
      ],
      restrictions: [
        [[3, 2, 0], 0, 0, 0]
      ],
    });

    patterns.push({
      parts: [
        [3, 0, B, 0],
        [1, 0, B, 0],
        [2, 0, B, 0],
      ],
      restrictions: [
        [[3, 2, 0], 0, 0, 0]
      ],
    });

    patterns.push({
      parts: [
        [2, 0, B, 0],
        [1, 0, B, 0],
        [3, 0, B, 0],
      ],
      restrictions: [
        [[3, 2, 2], 0, 0, 0]
      ],
    });

    patterns.push({
      parts: [
        [2, 0, B, 0],
        [3, 0, B, 0],
        [1, 0, B, 0],
      ],
      restrictions: [
        [[3, 2, 1], 0, 0, 0]
      ],
    });
  }

  //const patternMap = new Array(totalPixels);
  for(let i = 0; i < patternMap.length; i++) {
    patternMap[i] = {
      parts: [],
      colors: [],
      restrictions: [],
    };
  }

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

  let vv = 0;

  do {
    changed = false;
    for(let i = 0; i < totalStuds; i++) {
      if(performance.now() - t > 1000) {
        //if(Math.random() < 0.5) {
          callback(linearDatatoImageData(ditheredLRGB, width, height));
        //}
        //else {
        //  callback(linearDatatoImageData(blurredDitheredLRGB, width, height));
        //}

        //  callback(linearDatatoImageData(sourceLRGB, width, height));
        t = performance.now();
      }

      const best = studOrder[i];

      const x = best[0];
      const y = best[1];

      // pick best pattern for stud

      // sort patterns by score
      // resolve best score, if there's a better unresolved score, resolve that etc.

      let best1x1Score = Infinity;
      let best1x1Col = 0;
      let bestScore = Infinity;
      let bestPatternOffsetX = 0;
      let bestPatternOffsetY = 0;

      let bestPattern = new Float64Array(widthProcessPattern ** 2 * 3);
      let testPattern = new Float64Array(widthProcessPattern ** 2 * 3);

      // find best color for a square
      for(let c = 0; c < brickColors[0].length; c++) {
        const col = legoColorsLRGB[brickColors[0][c]];

        for(let index = 0; index < testPattern.length; index += 3) {
          testPattern[index + 0] = col[0];
          testPattern[index + 1] = col[1];
          testPattern[index + 2] = col[2];
        }

        const score = scorePattern(x, y, testPattern, 1, 1);
        if(score < best1x1Score) {
          best1x1Score = score;
          const tmp = bestPattern;
          bestPattern = testPattern;
          testPattern = tmp;
        }
      }

      bestScore = best1x1Score;
      best1x1Col = [bestPattern[0], bestPattern[1], bestPattern[2]];

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

      let bestColorPattern = new Float64Array(widthProcessPattern ** 2 * 3);
      let bestPatternRotation = [0, 0];

      for(let p = 1; p < patterns.length; p++) {
        const pat = patterns[p];
        // test each rotation
        for(let r = 0; r < 4; r++) {

          // set background
          for(let X = 0; X < widthProcessPattern; X++) {
            for(let Y = 0; Y < widthProcessPattern; Y++) {
              const index = (X + Y * widthProcessPattern) * 3;
              const at = (x * widthProcessPattern + X + (y * widthProcessPattern + Y) * width) * 3;

              testPattern[index + 0] = sourceLRGB[at + 0];
              testPattern[index + 1] = sourceLRGB[at + 1];
              testPattern[index + 2] = sourceLRGB[at + 2];

              bestColorPattern[index + 0] = sourceLRGB[at + 0];
              bestColorPattern[index + 1] = sourceLRGB[at + 1];
              bestColorPattern[index + 2] = sourceLRGB[at + 2];
            }
          }

          for(let part = 0; part < pat.parts.length; part++) {
            const thisPart = pat.parts[part];
            const index = Math.abs(thisPart[0]);
            const rot = (thisPart[1] + r) % 4;
            const brightness = thisPart[2];
            const piece = thisPart[3];
            let negativePart = false;
            if(thisPart[0] < 0) {
              negativePart = true;
            }

            let bestColorScore = Infinity;

            // find best color for nth part
            for(let c = 0; c < brickColors[piece].length; c++) {
              const col = legoColorsLRGB[brickColors[piece][c]];

              // generate pattern
              for(let x = 0; x < widthProcessPattern; x++) {
                for(let y = 0; y < widthProcessPattern; y++) {

                  const mix = linearpatternSheetData[
                    (x + index * widthProcessPattern +
                    (y + rot * widthProcessPattern) * patternCountWidth * widthProcessPattern
                    ) * 3];

                  const at = (x + y * widthProcessPattern) * 3;

                  if(negativePart) {
                    testPattern[at + 0] = brightness * col[0] * (1 - mix) + testPattern[0] * mix;
                    testPattern[at + 1] = brightness * col[1] * (1 - mix) + testPattern[1] * mix;
                    testPattern[at + 2] = brightness * col[2] * (1 - mix) + testPattern[2] * mix;
                  }
                  else{
                    testPattern[at + 0] = brightness * col[0] * mix + testPattern[0] * (1 - mix);
                    testPattern[at + 1] = brightness * col[1] * mix + testPattern[1] * (1 - mix);
                    testPattern[at + 2] = brightness * col[2] * mix + testPattern[2] * (1 - mix);
                  }
                }
              }

              // score 1x1
              const score = scorePattern(x, y, testPattern, 1, 1);
              if(score < bestColorScore) {
                bestColorScore = score;
                const tmp = bestColorPattern;
                bestColorPattern = testPattern;
                testPattern = tmp;
              }
            }

            const tmp = bestColorPattern;
            bestColorPattern = testPattern;
            testPattern = tmp;
          }

          const score = scorePattern(x, y, bestColorPattern, 1, 1);
          if(score < bestScore) {
            bestScore = score;
            const tmp = bestColorPattern;
            bestColorPattern = bestPattern;
            bestPattern = tmp;
            bestPatternRotation = [p, r];
          }
        }
      }

      // resolve dependencies

      // apply best pattern
      for(let X = 0; X < widthProcessPattern; X++) {
        for(let Y = 0; Y < widthProcessPattern; Y++) {
          const i = x * widthProcessPattern + X + (y * widthProcessPattern + Y) * width;
          const i3 = i * 3;
          const c3 = (X + Y * widthProcessPattern) * 3;
          ditheredLRGB[i3 + 0] = bestPattern[c3 + 0];
          ditheredLRGB[i3 + 1] = bestPattern[c3 + 1];
          ditheredLRGB[i3 + 2] = bestPattern[c3 + 2];
        }
      }

      if(bestScore === 0) continue;

      applyPattern(x, y, bestPattern, 1, 1);

      /*
      for(let X = 0; X < widthProcessPattern; X++) {
        for(let Y = 0; Y < widthProcessPattern; Y++) {
          const i = x * widthProcessPattern + X + (y * widthProcessPattern + Y) * width;
          const i3 = i * 3;
          const c3 = (X + Y * widthProcessPattern) * 3;
          sourceLRGB[i3 + 0] = bestPattern[c3 + 0];
          sourceLRGB[i3 + 1] = bestPattern[c3 + 1];
          sourceLRGB[i3 + 2] = bestPattern[c3 + 2];
        }
      }
      //*/

      changed = true;

      /*
      if(y === 2 && x === 0 && ++aa == 1) {
      //callback(linearDatatoImageData(sourceLRGB, width, height));
      //callback(linearDatatoImageData(ditheredLRGB, width, height));
      //callback(linearDatatoImageData(blurredDitheredLRGB, width, height));

        let ans = [];
        for(let i = 0; i < width * height; i++) {
          ans.push(errorMap[i] / 1000);
          ans.push(errorMap[i] / 1000);
          ans.push(errorMap[i] / 1000);
        }

        callback(linearDatatoImageData(ans, width, height));

        throw '';
      }
      //*/

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

let aa = 0;
