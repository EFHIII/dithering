import {
  reloadSumOfGaussians,
  drawKernelVisualization,
  updateFalloffFunction,
} from "../helpers/kernel.js";

import { algorithmNames } from '../dithering-algorithms/algorithm-names.js';

import { processImage } from './process-image.js';

for(let i = 0; i < algorithmNames.length; i++) {
  const optGroup = document.createElement('optgroup');
  optGroup.label = algorithmNames[i].name;
  //ditheringAlgorithm
  for(let algorithm of algorithmNames[i].algorithms) {
    const option = document.createElement('option');
    option.value = algorithm[0];
    option.textContent = algorithm[1];
    optGroup.appendChild(option);
  }
  ditheringAlgorithm.appendChild(optGroup);
}

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

ditheringAlgorithm.addEventListener('change', () => {
  energyParams.style.display = 'none';
  patternDitheringParams.style.display = 'none';
  patternSizeDiv.style.display = 'none';
  patternDiv.style.display = 'none';
  switch (ditheringAlgorithm.value) {
    case 'energy-dither.js':
    case 'energy-with-swaps.js':
      energyParams.style.display = 'flex';
      patternSizeDiv.style.display = 'flex';
      patternDiv.style.display = 'flex';
      break;
    case 'pattern-dithering.js':
      patternDitheringParams.style.display = 'flex';
      patternSizeDiv.style.display = 'flex';
      patternDiv.style.display = 'flex';
      break;
    case 'ideal.js':
      patternSizeDiv.style.display = 'flex';
      patternDiv.style.display = 'flex';
      break;
  }
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

matrixName.addEventListener('change', () => {
  switch (matrixName.value) {
    case 'bayer-1':
      patternSize.value = 0;
      break;
    case 'bayer-2':
      patternSize.value = 2;
      break;
    case 'bayer-4':
      patternSize.value = 4;
      break;
    case 'bayer-8':
    case 'clusterDot':
    case 'voidAndCluster':
      patternSize.value = 6;
      break;
    case 'bayer-16':
      patternSize.value = 8;
      break;
  }
  processImage();
});

window.processImage = processImage;
