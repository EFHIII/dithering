import {
  getKernel,
  drawKernelVisualization,
} from "../helpers/kernel.js";

import {
  getPalette,
  drawPaletteVisualization
} from '../helpers/palette.js';

import { scaleImageData } from '../helpers/color.js';

import {
  sRGBtolRGB,
  linearDatatoImageData,
  linearDatatoGrayscale,
  gaussianBlur
} from '../dithering-algorithms/helper-functions/color-math.js';


let ditherWorkers = false;

const algNames = [
  'Burkes',
  'Pattern Dither',
  'Least Error Scan',
  'Least Error First',
  'Energy Dithering (2 ppc)',
  'Energy Dithering w/ Swaps (4 ppc)'
];

const targetCtx = targetCanvas.getContext('2d', {
  colorSpace: 'srgb',
  alpha: false,
  willReadFrequently: true
});
const burkesCtx = burkesCanvas.getContext('2d', {
  colorSpace: 'srgb',
  alpha: false,
  willReadFrequently: true
});
const patternDitheringCtx = patternDitheringCanvas.getContext('2d', {
  colorSpace: 'srgb',
  alpha: false,
  willReadFrequently: true
});
const leastErrorScanCtx = leastErrorScanCanvas.getContext('2d', {
  colorSpace: 'srgb',
  alpha: false,
  willReadFrequently: true
});
const leastErrorFirstCtx = leastErrorFirstCanvas.getContext('2d', {
  colorSpace: 'srgb',
  alpha: false,
  willReadFrequently: true
});
const energyDitherCtx = energyDitherCanvas.getContext('2d', {
  colorSpace: 'srgb',
  alpha: false,
  willReadFrequently: true
});
const energyDitherSwapsCtx = energyDitherSwapsCanvas.getContext('2d', {
  colorSpace: 'srgb',
  alpha: false,
  willReadFrequently: true
});
const kernelCtx = kernelCanvas.getContext('2d', {
  colorSpace: 'srgb',
  alpha: false,
  willReadFrequently: true
});
const kernelGraphCtx = kernelGraphCanvas.getContext('2d', {
  colorSpace: 'srgb',
  alpha: false,
  willReadFrequently: true
});
const paletteCtx = paletteCanvas.getContext('2d', {
  colorSpace: 'srgb',
  alpha: false,
  willReadFrequently: true
});

const ditherCtx = [
  burkesCtx,
  patternDitheringCtx,
  leastErrorScanCtx,
  leastErrorFirstCtx,
  energyDitherCtx,
  energyDitherSwapsCtx
];

colorPalette.addEventListener('change', () => {
  if(colorPalette.value !== 'generate') {
    drawPaletteVisualization(paletteCtx, getPalette());
  }
});

kernelGraphCanvas.width = 250;
kernelGraphCanvas.height = 250;
kernelGraphCanvas.style.width = 250 + 'px';
kernelGraphCanvas.style.height = 250 + 'px';
drawKernelVisualization(kernelCtx, kernelGraphCtx);
//drawPaletteVisualization(paletteCtx, getPalette());


let originalImage = null;

imageLoader1.addEventListener('change', handleImage, false);

function handleImage(e) {
  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      originalImage = img;

      outputWidth.value = Math.min(1000, originalImage.width);

      processImage();
    }
    img.src = event.target.result;
  }
  reader.readAsDataURL(e.target.files[0]);
}

export function processImage() {
  patternSizeText.innerText = Math.pow(2, parseInt(patternSize.value));

  blackPointText.innerText = blackPoint.value;
  whitePointText.innerText = whitePoint.value;

  if (ditherWorkers) {
    for(let i = 0; i < ditherWorkers.length; i++) {
      ditherWorkers[i].terminate();
    }
    ditherWorkers = false;
  }

  const kernelSize = Math.floor((parseInt(kernelSizeInput.value) - 1) / 2) * 2 + 1;

  const kernel = getKernel();

  drawKernelVisualization(kernelCtx, kernelGraphCtx);

  if (!originalImage) {
    return;
  }

  let width, height;
  const aspectRatio = originalImage.height / originalImage.width;
  if (outputWidth.value) {
    width = parseInt(outputWidth.value, 10);
    height = Math.round(width * aspectRatio);
  } else if (outputHeight.value) {
    height = parseInt(outputHeight.value, 10);
    width = Math.round(height / aspectRatio);
  } else {
    width = Math.min(1000, originalImage.width);
    height = Math.round(width * aspectRatio);
  }

  if(width === 0 || height === 0) {
    return;
  }

  // Get original image data
  targetCanvas.width = originalImage.width;
  targetCanvas.height = originalImage.height;
  targetCtx.drawImage(originalImage, 0, 0);
  const originalImgData = targetCtx.getImageData(0, 0, originalImage.width, originalImage.height);

  // resize canvases
  targetCanvas.width = width;
  targetCanvas.height = height;
  burkesCanvas.width = width;
  burkesCanvas.height = height;
  patternDitheringCanvas.width = width;
  patternDitheringCanvas.height = height;
  leastErrorScanCanvas.width = width;
  leastErrorScanCanvas.height = height;
  leastErrorFirstCanvas.width = width;
  leastErrorFirstCanvas.height = height;
  energyDitherCanvas.width = width;
  energyDitherCanvas.height = height;
  energyDitherSwapsCanvas.width = width;
  energyDitherSwapsCanvas.height = height;

  targetCanvas.style.width = width+'px';
  targetCanvas.style.height = height+'px';
  burkesCanvas.style.width = width+'px';
  burkesCanvas.style.height = height+'px';
  patternDitheringCanvas.style.width = width+'px';
  patternDitheringCanvas.style.height = height+'px';
  leastErrorScanCanvas.style.width = width+'px';
  leastErrorScanCanvas.style.height = height+'px';
  leastErrorFirstCanvas.style.width = width+'px';
  leastErrorFirstCanvas.style.height = height+'px';
  energyDitherCanvas.style.width = width+'px';
  energyDitherCanvas.style.height = height+'px';
  energyDitherSwapsCanvas.style.width = width+'px';
  energyDitherSwapsCanvas.style.height = height+'px';

  // Get linear image data
  const linearImageData = scaleImageData(originalImgData, width, height);

  // Preprocessing
  const linearBlackpoint = sRGBtolRGB(parseInt(blackPoint.value) / 255)[0];
  const linearWhitepoint = sRGBtolRGB(parseInt(whitePoint.value) / 255)[0];
  if(linearBlackpoint > 0 || linearWhitepoint < 1) {
    const gamut = linearWhitepoint - linearBlackpoint;

    for(let i = 0; i < linearImageData.length; i++) {
      linearImageData[i] = linearBlackpoint + linearImageData[i] * gamut;
    }
  }
  if(grayscale.checked) {
    linearDatatoGrayscale(linearImageData, width, height);
  }

  // get image data
  const imgData = linearDatatoImageData(linearImageData, width, height);
  targetCtx.putImageData(imgData, 0, 0);

  score.innerText = 'N/A';

  const palette = getPalette(linearImageData);

  drawPaletteVisualization(paletteCtx, palette);

  // start worker
  ditherWorkers = [];

  for(let i = 0; i < ditherCtx.length; i++) {
    ditherWorkers.push(new Worker('../dithering/src/app/worker-manager.js', {
      type: 'module'
    }));

    ditherWorkers[i].onmessage = ((v) => (e) => {
      const {
        ditheredData,
        totalError
      } = e.data;

      if(score.innerText === 'N/A' || parseFloat(score.innerText) > totalError) {
        score.innerText = totalError.toPrecision(7);
        bestAlg.innerText = algNames[v];
      }

      const ditheredImageData = new ImageData(new Uint8ClampedArray(ditheredData), width, height);
      ditherCtx[v].putImageData(ditheredImageData, 0, 0);
    })(i);

    ditherWorkers[i].postMessage({
      ditheringAlgorithm: ['burkes.js', 'pattern-dithering.js', 'least-error-scan.js', 'least-error-first.js', 'energy-dither.js', 'energy-with-swaps.js'][i],
      imgData,
      palette,
      kernel,
      kernelSize,
      // Algorithm parameters
      colorspace: 'hct',
      ditherMatrix: 'voidAndCluster',
      pattern: pattern.value,
      patternBias: 0.5,
      patternSize: 2 ** parseInt(patternSize.value),
      energyPoints: 2,
      energyStart: 2 / 100,
      energyCooling: 3 / 10000
    });
  }
}
