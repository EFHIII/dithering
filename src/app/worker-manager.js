import { algorithmNames } from '../dithering-algorithms/algorithm-names.js';

import {
  calculateErrorDataInColor
} from '../helpers/color.js';

import {
  imageDatatolRGB,
  linearDatatoImageData,
  linearDatatoColorspace,
  gaussianBlur
} from '../dithering-algorithms/helper-functions/color-math.js';

// Least Error
import { leastErrorFirst } from '../dithering-algorithms/least-error/least-error-first.js';
import { leastErrorScan } from '../dithering-algorithms/least-error/least-error-scan.js';
// Simulated Annealing
import { energyDither } from '../dithering-algorithms/simulated-annealing/energy-dither.js';
import { energyWithSwaps } from '../dithering-algorithms/simulated-annealing/energy-with-swaps.js';
// Ordered Dithering
import { patternDithering } from '../dithering-algorithms/positional-dithering/pattern-dithering.js';
// Error Diffusion
import { floydSteinberg } from '../dithering-algorithms/error-diffusion/floyd-steinberg.js';
import { jarvisJudiceNinke } from '../dithering-algorithms/error-diffusion/jarvis-judice-ninke.js';
import { stucki } from '../dithering-algorithms/error-diffusion/stucki.js';
import { atkinson } from '../dithering-algorithms/error-diffusion/atkinson.js';
import { burkes } from '../dithering-algorithms/error-diffusion/burkes.js';
import { sierra } from '../dithering-algorithms/error-diffusion/sierra.js';
// Tools
import { ideal } from '../dithering-algorithms/tools/ideal.js';

const functions = {
  // Least Error
  'least-error-first.js': leastErrorFirst,
  'least-error-scan.js': leastErrorScan,
  // Simulated Annealing
  'energy-dither.js': energyDither,
  'energy-with-swaps.js': energyWithSwaps,
  // Ordered Dithering
  'pattern-dithering.js': patternDithering,
  // Error Diffusion
  'floyd-steinberg.js': floydSteinberg,
  'jarvis-judice-ninke.js': jarvisJudiceNinke,
  'stucki.js': stucki,
  'atkinson.js': atkinson,
  'burkes.js': burkes,
  'sierra.js': sierra,
  // Tools
  'ideal.js': ideal,
};

self.onmessage = (e) => {
  const {
    ditheringAlgorithm,
    imgData,
    kernel,
    kernelSize,
    colorspace,
    viewingCondition
  } = e.data;

  const width = imgData.width;
  const height = imgData.height;

  const linearImageData = imageDatatolRGB(imgData);
  const linearBlurredImage = gaussianBlur(linearImageData, width, height, kernel, kernelSize);
  const blurredImageInColorSpace = linearDatatoColorspace(linearBlurredImage, colorspace, viewingCondition);

  e.data.callback = (ditheredData) => {
    const linearDitheredData = imageDatatolRGB(ditheredData);
    const linearBlurredDithered = gaussianBlur(linearDitheredData, width, height, kernel, kernelSize);
    const blurredDitheredInColorSpace = linearDatatoColorspace(linearBlurredDithered, colorspace, viewingCondition);
    const percieveData = linearDatatoImageData(linearBlurredDithered, width, height);

    const errorDataArr = calculateErrorDataInColor(width, height, blurredImageInColorSpace, blurredDitheredInColorSpace);
    const errorData = errorDataArr[0];
    const totalError = errorDataArr[1];

    self.postMessage({
      ditheredData: ditheredData.data.buffer,
      errorData: errorData.data.buffer,
      percieveData: percieveData.data.buffer,
      totalError
    }, [ditheredData.data.buffer, errorData.data.buffer, percieveData.data.buffer]);
  }

  functions[ditheringAlgorithm](e.data);
}
