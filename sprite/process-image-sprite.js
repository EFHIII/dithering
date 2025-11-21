import {
  getKernel,
  drawKernelVisualization,
} from "../src/helpers/kernel.js";

import { scaleImageData } from '../src/helpers/color.js';

import {
  sRGBtolRGB,
  linearDatatoImageData,
  linearDatatoGrayscale,
  gaussianBlur
} from '../src/dithering-algorithms/helper-functions/color-math.js';


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
const palette2Ctx = paletteCanvas2.getContext('2d', {
  colorSpace: 'srgb',
  alpha: false,
  willReadFrequently: true
});

function drawPaletteVisualization(ctx, palette) {
  paletteCanvas.width = parseInt(spriteWidth.value);
  paletteCanvas.height = parseInt(spriteHeight.value);

  ctx.drawImage(palette, 0, 0);
}

function drawPaletteVisualization2(ctx, palette) {
  paletteCanvas2.width = parseInt(processingSpriteWidth.value);
  paletteCanvas2.height = parseInt(processingSpriteHeight.value);

  ctx.putImageData(palette, 0, 0);
}

kernelGraphCanvas.width = 250;
kernelGraphCanvas.height = 250;
kernelGraphCanvas.style.width = 250 + 'px';
kernelGraphCanvas.style.height = 250 + 'px';
drawKernelVisualization(kernelCtx, kernelGraphCtx);
//drawPaletteVisualization(paletteCtx, getPalette());


let originalImage = null;
let spriteSheetImage = null;

imageLoader1.addEventListener('change', handleImage, false);
imageLoader2.addEventListener('change', handleSpriteSheet, false);

function handleImage(e, width = false) {
  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      originalImage = img;

      outputWidth.value = Math.floor(Math.min(1000, originalImage.width) / parseInt(processingSpriteWidth.value));

      if(width) outputWidth.value = width;

      processImage();
    }
    img.src = event.target.result;
  }
  reader.readAsDataURL(e.target.files[0]);
}

function handleSpriteSheet(e, width = false, height = false) {
  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      spriteSheetImage = img;

      spriteWidth.value = spriteSheetImage.width;
      spriteHeight.value = spriteSheetImage.height;

      if(width) spriteWidth.value = width;
      if(height) spriteHeight.value = height;

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


  let widthSprite = parseInt(spriteWidth.value);
  let heightSprite = parseInt(spriteHeight.value);

  if(widthSprite === 0 || heightSprite === 0) {
    return;
  }

  if(spriteSheetImage) {
    drawPaletteVisualization(paletteCtx, spriteSheetImage);
  }

  if (!originalImage || !spriteSheetImage) {
    return;
  }

  let widthProcessSprite = parseInt(processingSpriteWidth.value);
  let heightProcessSprite = parseInt(processingSpriteHeight.value);

  let widthSprites, heightSprites;
  const aspectRatio = originalImage.height / originalImage.width;
  if (outputWidth.value) {
    widthSprites = parseInt(outputWidth.value, 10);
    heightSprites = Math.round(widthSprites * widthProcessSprite * aspectRatio / heightProcessSprite);
  } else if (outputHeight.value) {
    heightSprites = parseInt(outputHeight.value, 10);
    widthSprites = Math.round(heightSprites * heightProcessSprite / aspectRatio / widthProcessSprite);
  } else {
    widthSprites = Math.floor(Math.min(1000, originalImage.width) / widthProcessSprite);
    heightSprites = Math.round(widthSprites * aspectRatio);
  }

  let width = widthSprites * widthProcessSprite;
  let height = heightSprites * heightProcessSprite;

  if(width === 0 || height === 0) {
    return;
  }

  // Get original image data
  fromCanvas1.width = originalImage.width;
  fromCanvas1.height = originalImage.height;
  fromCtx.drawImage(originalImage, 0, 0);
  const originalImgData = fromCtx.getImageData(0, 0, originalImage.width, originalImage.height);

  fromCanvas1.width = spriteSheetImage.width;
  fromCanvas1.height = spriteSheetImage.height;
  fromCtx.drawImage(spriteSheetImage, 0, 0);
  const originalSpriteData = fromCtx.getImageData(0, 0, spriteSheetImage.width, spriteSheetImage.height);

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

  const spriteCountWidth = Math.floor(spriteSheetImage.width / widthSprite);
  const spriteCountHeight = Math.floor(spriteSheetImage.height / heightSprite);

  const spritesheetProcessWidth = spriteCountWidth * widthProcessSprite;
  const spritesheetProcessHeight = spriteCountHeight * heightProcessSprite;
  const linearSpriteData = scaleImageData(originalSpriteData, spritesheetProcessWidth, spritesheetProcessHeight);

  const spriteData = linearDatatoImageData(linearSpriteData, spritesheetProcessWidth, spritesheetProcessHeight);
  drawPaletteVisualization2(palette2Ctx, spriteData);

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
  ditherWorker = new Worker('./worker-manager-sprite.js', {
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

  ditherWorker.postMessage({
    ditheringAlgorithm: ditheringAlgorithm.value,
    imgData,
    spriteData,
    linearSpriteData,
    widthProcessSprite,
    heightProcessSprite,
    spriteCountWidth,
    spriteCountHeight,
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

// Load default sprite sheet
window.addEventListener('load', () => {
  const defaultImageUrl = './sprite-palettes/emojis.png';
  fetch(defaultImageUrl)
    .then(res => res.blob())
    .then(blob => {
      const file = new File([blob], './sprite-palettes/emojis.png', { type: blob.type });
      const event = { target: { files: [file] } };
      handleSpriteSheet(event, 22, 22);
    })
    .catch(console.error);
});

// Load default image
window.addEventListener('load', () => {
  const defaultImageUrl = '../assets/!redBrot.png';
  fetch(defaultImageUrl)
    .then(res => res.blob())
    .then(blob => {
      const file = new File([blob], './assets/!redBrot.png', { type: blob.type });
      const event = { target: { files: [file] } };
      handleImage(event, 40);
    })
    .catch(console.error);
});
