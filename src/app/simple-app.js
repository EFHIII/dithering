import {
  reloadSumOfGaussians,
  updateFalloffFunction,
} from "../helpers/kernel.js";

import { processImage } from './simple-process-image.js';

colorPalette.addEventListener('change', () => {
  customPaletteGroup.style.display = colorPalette.value === 'custom' ? 'block' : 'none';
  generatePaletteGroup.style.display = colorPalette.value === 'generate' ? 'block' : 'none';

  processImage();
});

falloffFunction.addEventListener('change', () => {
  updateFalloffFunction();
  processImage();
});

gaussianCount.addEventListener('change', () => {
  reloadSumOfGaussians();
  processImage();
});

outputWidth.addEventListener('input', () => {
  outputHeight.value = '';
  processImage();
});

outputHeight.addEventListener('input', () => {
  outputWidth.value = '';
  processImage();
});

blackPoint.addEventListener('input', () => {
  if(blackPoint.value === '255') blackPoint.value = 254;
  if(parseInt(whitePoint.value) <= parseInt(blackPoint.value)) {
    whitePoint.value = parseInt(blackPoint.value) + 1;
  }
  processImage();
});

whitePoint.addEventListener('input', () => {
  if(whitePoint.value === '0') whitePoint.value = 1;
  if(parseInt(whitePoint.value) <= parseInt(blackPoint.value)) {
    blackPoint.value = parseInt(whitePoint.value) - 1;
  }
  processImage();
});

advanced.addEventListener('input', () => {
  kernelField.style.display = advanced.checked ? 'block' : 'none';
  kernelGraph.style.display = advanced.checked ? 'block' : 'none';
  kernelPreview.style.display = advanced.checked ? 'block' : 'none';
  updateFalloffFunction(advanced.checked);
});

window.processImage = processImage;
