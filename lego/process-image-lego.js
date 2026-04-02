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


const legoColors = [
  '#C91A09',
  '#F2CD37',
  '#E4CD9E',
  '#0055BF',
  '#958A73',
  '#FE8A18',
  '#F8BB3D',
  '#AA7D55',
  '#BBE90B',
  '#008F9B',
  '#A95500',
  '#078BC9',
  '#E4ADC8',
  '#36AEBF',

  '#FFFFFF',
  '#A0A5A9',
  // dark colors
  '#6C6E68',
  '#05131D',
  '#720E0F',
  '#582A12',
  '#237841',
  '#184632',
  '#0A3463',
];

const legoBricks = [
  { name: 'square', img: './bricks-40/square.png'},
  { name: 'circle', img: './bricks-40/circle.png'},
  { name: 'half-circle', img: './bricks-40/half-circle.png'},
  { name: 'quarter-circle', img: './bricks-40/quarter-circle.png'},
  { name: 'grill', img: './bricks-40/grill.png'},
  { name: 'triangle-small', img: './bricks-40/triangle-small.png'},
  { name: 'triangle', img: './bricks-40/triangle.png'},
  { name: 'mac', img: './bricks-40/mac.png'},
];

let matrix = Array.from({ length: legoBricks.length }, () => Array(legoColors.length).fill(false));

let cellRefs = [];
let recolorCache = new Map();
let columnSwatches = []; // DOM refs
let rowHeaders = []; // DOM refs (row images)

async function recolorImage(src, hex) {
  const key = src + '|' + hex;
  if (recolorCache.has(key)) return recolorCache.get(key);

  const img = new Image();
  img.src = src;
  await img.decode();

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  const rT = parseInt(hex.slice(1, 3), 16);
  const gT = parseInt(hex.slice(3, 5), 16);
  const bT = parseInt(hex.slice(5, 7), 16);

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i];
    const scale = gray / 255;

    if(rT**2+gT**2+bT**2 < 35000) {
      data[i] = rT * scale + (1-scale)*220;
      data[i+1] = gT * scale + (1-scale)*220;
      data[i+2] = bT * scale + (1-scale)*220;
    }
    else {
      data[i] = rT * scale + (1-scale)*30;
      data[i+1] = gT * scale + (1-scale)*30;
      data[i+2] = bT * scale + (1-scale)*30;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const out = canvas.toDataURL();
  recolorCache.set(key, out);
  return out;
}

async function buildTable() {
  const container = document.createElement('div');
  const table = document.createElement('table');

  const headerRow = document.createElement('tr');
  headerRow.appendChild(document.createElement('th'));

  // create column swatches
  legoColors.forEach((hex, cIdx) => {
    const th = document.createElement('th');
    const swatch = document.createElement('div');
    swatch.className = 'col-swatch';
    swatch.style.background = hex;

    swatch.addEventListener('click', () => {
      // only toggle rows that are not entirely disabled
      const rowsAllowed = [];
      for (let r = 0; r < legoBricks.length; r++) {
        const rowAny = matrix[r].some(v => v);
        if (rowAny) rowsAllowed.push(r);
      }

      // if no rowsAllowed, do nothing for turning on; allow turning off existing ones
      const currentActive = rowsAllowed.some(r => matrix[r][cIdx]);
      const next = !currentActive;

      for (let r = 0; r < legoBricks.length; r++) {
        if (!next && matrix[r][cIdx]) {
          // turning off any active regardless of row state
          matrix[r][cIdx] = false;
        } else if (next) {
          // turning on only for rows that are not entirely disabled
          if (matrix[r].some(v => v)) {
            matrix[r][cIdx] = true;
          }
        }
      }

      updateUI();
    });

    th.appendChild(swatch);
    headerRow.appendChild(th);
    columnSwatches[cIdx] = swatch;
  });

  table.appendChild(headerRow);

  // precompute recolors
  for (const brick of legoBricks) {
    for (const hex of legoColors) await recolorImage(brick.img, hex);
  }

  legoBricks.forEach((brick, rIdx) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th');

    const rowImg = document.createElement('img');
    rowImg.src = brick.img;
    rowImg.className = 'cell-img';

    rowImg.addEventListener('click', () => {
      // only toggle columns that are not entirely disabled
      const colsAllowed = [];
      for (let c = 0; c < legoColors.length; c++) {
        const colAny = matrix.some(row => row[c]);
        if (colAny) colsAllowed.push(c);
      }

      const currentActive = colsAllowed.some(c => matrix[rIdx][c]);
      const next = !currentActive;

      for (let c = 0; c < legoColors.length; c++) {
        if (!next && matrix[rIdx][c]) {
          matrix[rIdx][c] = false;
        } else if (next) {
          if (matrix.some(row => row[c])) {
            matrix[rIdx][c] = true;
          }
        }
      }

      updateUI();
    });

    th.appendChild(rowImg);
    tr.appendChild(th);

    rowHeaders[rIdx] = rowImg;

    const rowCells = [];

    legoColors.forEach((hex, cIdx) => {
      const td = document.createElement('td');
      const wrapper = document.createElement('div');
      wrapper.className = 'cell-wrapper';

      const coloredSrc = recolorCache.get(brick.img + '|' + hex);
      const cellImg = new Image();
      cellImg.src = coloredSrc;
      cellImg.className = 'cell-img';

      wrapper.appendChild(cellImg);
      td.appendChild(wrapper);
      tr.appendChild(td);

      wrapper.addEventListener('click', () => {
        matrix[rIdx][cIdx] = !matrix[rIdx][cIdx];
        updateUI();
      });

      rowCells[cIdx] = cellImg;
    });

    cellRefs[rIdx] = rowCells;
    table.appendChild(tr);
  });

  container.appendChild(table);
  const mount = document.getElementById('brickPalette') || document.body;
  mount.appendChild(container);

  // set default table values
  const myTable = document.getElementsByTagName('table')[0];

  myTable.children[1].children[2].children[0].click();

  myTable.children[1].children[15].children[0].click();
  myTable.children[1].children[16].children[0].click();
  myTable.children[1].children[17].children[0].click();
  myTable.children[1].children[18].children[0].click();
}

function updateUI() {
  const rowHasAny = legoBricks.map((_, r) => matrix[r].some(v => v));
  const colHasAny = legoColors.map((_, c) => matrix.some(r => r[c]));

  // update cells
  for (let r = 0; r < legoBricks.length; r++) {
    for (let c = 0; c < legoColors.length; c++) {
      const img = cellRefs[r][c];
      const active = !!matrix[r][c];
      if (img) {
        img.classList.toggle('darkened', !active);
        img.style.filter = active ? 'brightness(1)' : 'brightness(0.4)';
      }
    }
  }

  // update header outlines
  columnSwatches.forEach((swatch, c) => {
    if (!swatch) return;
    swatch.classList.toggle('header-active', colHasAny[c]);
  });
  rowHeaders.forEach((hdr, r) => {
    if (!hdr) return;
    hdr.classList.toggle('header-active', rowHasAny[r]);
  });

  processImage();
}

buildTable();

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

kernelGraphCanvas.width = 250;
kernelGraphCanvas.height = 250;
kernelGraphCanvas.style.width = 250 + 'px';
kernelGraphCanvas.style.height = 250 + 'px';
drawKernelVisualization(kernelCtx, kernelGraphCtx);

let originalImage = null;
let patternSheetImage = null;

imageLoader1.addEventListener('change', handleImage, false);

function handleImage(e, width = false) {
  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      originalImage = img;

      outputWidth.value = Math.floor(Math.min(1000, originalImage.width) / parseInt(processingPatternWidth.value));

      if(width) outputWidth.value = width;

      processImage();
    }
    img.src = event.target.result;
  }
  reader.readAsDataURL(e.target.files[0]);
}

function handlePatternSheet(e) {
  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      patternSheetImage = img;

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

  if (!originalImage || !patternSheetImage) {
    return;
  }

  let widthProcessPattern = parseInt(processingPatternWidth.value);

  let widthStuds, heightStuds;
  const aspectRatio = originalImage.height / originalImage.width;
  if (outputWidth.value) {
    widthStuds = parseInt(outputWidth.value, 10);
    heightStuds = Math.round(widthStuds * widthProcessPattern * aspectRatio / widthProcessPattern);
  } else if (outputHeight.value) {
    heightStuds = parseInt(outputHeight.value, 10);
    widthStuds = Math.round(heightStuds * widthProcessPattern / aspectRatio / widthProcessPattern);
  } else {
    widthStuds = Math.floor(Math.min(1000, originalImage.width) / widthProcessPattern);
    heightStuds = Math.round(widthStuds * aspectRatio);
  }

  let width = widthStuds * widthProcessPattern;
  let height = heightStuds * widthProcessPattern;

  if(width === 0 || height === 0) {
    return;
  }

  // Get original image data
  fromCanvas1.width = originalImage.width;
  fromCanvas1.height = originalImage.height;
  fromCtx.drawImage(originalImage, 0, 0);
  const originalImgData = fromCtx.getImageData(0, 0, originalImage.width, originalImage.height);

  fromCanvas1.width = patternSheetImage.width;
  fromCanvas1.height = patternSheetImage.height;
  fromCtx.drawImage(patternSheetImage, 0, 0);
  const originalPatternSheetData = fromCtx.getImageData(0, 0, patternSheetImage.width, patternSheetImage.height);

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

  const pxRatio = window.devicePixelRatio;

  fromCanvas1.style.width = (width / pxRatio)+'px';
  fromCanvas1.style.height = (height / pxRatio)+'px';
  ditheredCanvas.style.width = (width / pxRatio)+'px';
  ditheredCanvas.style.height = (height / pxRatio)+'px';
  perceptionCanvas1.style.width = (width / pxRatio)+'px';
  perceptionCanvas1.style.height = (height / pxRatio)+'px';
  perceptionCanvas2.style.width = (width / pxRatio)+'px';
  perceptionCanvas2.style.height = (height / pxRatio)+'px';
  errorCanvas.style.width = (width / pxRatio)+'px';
  errorCanvas.style.height = (height / pxRatio)+'px';

  // Get linear image data
  const linearImageData = scaleImageData(originalImgData, width, height);

  const patternCountWidth = Math.floor(patternSheetImage.width / 40);
  const patternCountHeight = 4; // north/east/south/west

  const patternSheetProcessWidth = patternCountWidth * widthProcessPattern;
  const patternSheetProcessHeight = patternCountHeight * widthProcessPattern;
  const linearpatternSheetData = scaleImageData(originalPatternSheetData, patternSheetProcessWidth, patternSheetProcessHeight);

  const patternSheetData = linearDatatoImageData(linearpatternSheetData, patternSheetProcessWidth, patternSheetProcessHeight);

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
  ditherWorker = new Worker('./worker-manager-lego.js', {
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
    patternSheetData,
    linearpatternSheetData,
    widthProcessPattern,
    patternCountWidth,
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
    energyCooling: parseFloat(energyCooling.value) / 10000,
    // LEGO
    legoColors,
    legoBricks,
    matrix
  });
}

// Load pattern sheet
window.addEventListener('load', () => {
  const defaultImageUrl = './patterns/patterns.png';
  fetch(defaultImageUrl)
    .then(res => res.blob())
    .then(blob => {
      const file = new File([blob], './patterns/patterns.png', { type: blob.type });
      const event = { target: { files: [file] } };
      handlePatternSheet(event);
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
