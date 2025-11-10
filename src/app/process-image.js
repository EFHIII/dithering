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


let ditherWorker = false;

const fromCtx = fromCanvas1.getContext('2d', {
  colorSpace: 'srgb',
  alpha: false,
  willReadFrequently: true
});
const ditheredCtx = ditheredCanvas.getContext('2d', {
  colorSpace: 'srgb',
  alpha: false,
  willReadFrequently: true
});
const percieveCtx1 = perceptionCanvas1.getContext('2d', {
  colorSpace: 'srgb',
  alpha: false,
  willReadFrequently: true
});
const percieveCtx2 = perceptionCanvas2.getContext('2d', {
  colorSpace: 'srgb',
  alpha: false,
  willReadFrequently: true
});
const errorCtx = errorCanvas.getContext('2d', {
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

function handleImage(e, width = false) {
  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      originalImage = img;

      outputWidth.value = Math.min(1000, originalImage.width);

      if(width) outputWidth.value = width;

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
  energyStartText.innerText = parseFloat(energyStart.value) * 4;
  energyCoolingText.innerText = parseFloat(energyCooling.value) * 2;
  patternBiasText.innerText = parseFloat(patternBias.value);

  if (ditherWorker) {
    ditherWorker.terminate();
    ditherWorker = false;
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
  fromCanvas1.width = originalImage.width;
  fromCanvas1.height = originalImage.height;
  fromCtx.drawImage(originalImage, 0, 0);
  const originalImgData = fromCtx.getImageData(0, 0, originalImage.width, originalImage.height);

  // resize canvases
  fromCanvas1.width = width;
  fromCanvas1.height = height;
  ditheredCanvas.width = width;
  ditheredCanvas.height = height;
  perceptionCanvas1.width = width;
  perceptionCanvas1.height = height;
  perceptionCanvas2.width = width;
  perceptionCanvas2.height = height;
  errorCanvas.width = width;
  errorCanvas.height = height;

  fromCanvas1.style.width = width+'px';
  fromCanvas1.style.height = height+'px';
  ditheredCanvas.style.width = width+'px';
  ditheredCanvas.style.height = height+'px';
  perceptionCanvas1.style.width = width+'px';
  perceptionCanvas1.style.height = height+'px';
  perceptionCanvas2.style.width = width+'px';
  perceptionCanvas2.style.height = height+'px';
  errorCanvas.style.width = width+'px';
  errorCanvas.style.height = height+'px';

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
  fromCtx.putImageData(imgData, 0, 0);

  const linearBlurredImage = gaussianBlur(linearImageData, width, height, kernel, kernelSize);
  const blurredImage = linearDatatoImageData(linearBlurredImage, width, height);

  percieveCtx1.putImageData(blurredImage, 0, 0);

  score.innerText = 0;

  // start worker
  ditherWorker = new Worker('/src/app/worker-manager.js', {
    type: 'module'
  });

  ditherWorker.onmessage = (e) => {
    const {
      ditheredData,
      percieveData,
      errorData,
      totalError
    } = e.data;

    score.innerText = totalError.toPrecision(7);

    const ditheredImageData = new ImageData(new Uint8ClampedArray(ditheredData), width, height);
    ditheredCtx.putImageData(ditheredImageData, 0, 0);
    const errorImageData = new ImageData(new Uint8ClampedArray(errorData), width, height);
    errorCtx.putImageData(errorImageData, 0, 0);
    const percieveImageData = new ImageData(new Uint8ClampedArray(percieveData), width, height);
    percieveCtx2.putImageData(percieveImageData, 0, 0)
  };

  const palette = getPalette(linearImageData);

  drawPaletteVisualization(paletteCtx, palette);

  ditherWorker.postMessage({
    ditheringAlgorithm: ditheringAlgorithm.value,
    imgData,
    palette,
    kernel,
    kernelSize,
    // Algorithm parameters
    colorspace: colorspace.value,
    viewingCondition: viewingCondition.value,
    ditherMatrix: matrixName.value,
    pattern: pattern.value,
    patternBias: parseFloat(patternBias.value),
    patternSize: 2 ** parseInt(patternSize.value),
    energyPoints: parseInt(energyPoints.value),
    energyStart: parseFloat(energyStart.value) / 100,
    energyCooling: parseFloat(energyCooling.value) / 10000
  });
}

// Load default image
window.addEventListener('load', () => {
  const defaultImageUrl = '../assets/!redBrot.png';
  fetch(defaultImageUrl)
    .then(res => res.blob())
    .then(blob => {
      const file = new File([blob], '../assets/!redBrot.png', { type: blob.type });
      const event = { target: { files: [file] } };
      handleImage(event, 200);
    })
    .catch(console.error);
});
