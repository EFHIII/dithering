import {
  lRGBtosRGB
} from '../dithering-algorithms/helper-functions/color-math.js';

let currentGausianCount = 0;

export function reloadSumOfGaussians() {
  const n = parseInt(gaussianCount.value);
  const kernelSize = Math.floor((parseInt(kernelSizeInput.value) - 1) / 2) * 2 + 1;

  let updatedHTML = gaussianParams.innerHTML;

  for(let i = currentGausianCount; i < n; i++) {
    let p = document.createElement('div');
    p.classList.add('parameters');
    p.innerHTML = `
      <label for="radius${i}">Radius ${i+1}</label>
      <input type="range" name="radius${i}" id="radius${i}" value="${i===0?0.35:0.2}" min="0.01" step="0.01" max="1" oninput="processImage()">
    `;
    gaussianParams.appendChild(p);

    p = document.createElement('div');
    p.classList.add('parameters');
    p.innerHTML = `
      <label for="magnitude${i}">magnitude ${i+1}</label>
      <input type="range" name="magnitude${i}" id="magnitude${i}" value="${i===1?0.2:1}" min="0" max="1" step="0.01" oninput="processImage()">
      `;
    gaussianParams.appendChild(p);
  }

  for(let i = n; i < currentGausianCount; i++) {
    gaussianParams.children[i*2].remove();
    gaussianParams.children[i*2].remove();
  }

  currentGausianCount = n;
}

reloadSumOfGaussians();

export function updateFalloffFunction(show = true) {
  const falloffFunctionInputs = {
    gaussianSum,
    gaussianSpec,
    power,
    inversePower,
    reversePower,
  };

  for(let f in falloffFunctionInputs) {
    falloffFunctionInputs[f].style.display = (show && falloffFunction.value === f) ? 'flex' : 'none';
  }
}

const distanceFunctions = {
  manhattan: (x, y) => Math.abs(x) + Math.abs(y),
  euclidean: (x, y) => Math.sqrt(x*x + y*y),
  chebyshev: (x, y) => Math.max(Math.abs(x), Math.abs(y)),
};

function gaussian(distance, sigma) {
  return 1 / (sigma * Math.sqrt(2 * Math.PI)) * Math.pow(Math.E, -0.5 * (distance / sigma) ** 2);
}

const falloffFunctions = {
  gaussianSum: d => {
    const spec = -1 + 1 / (1 - parseFloat(gaussianSumSpec.value));
    const kSize = parseInt(kernelSizeInput.value);
    const size = -1 + 1 / (1 - parseFloat(gaussianSpecSize.value)) + 0.25 / kSize;

    let ans = d * kSize < 1 ? spec : 0;
    const n = parseInt(gaussianCount.value);
    for(let i = 0; i < n; i++) {
      const radius = parseFloat(window[`radius${i}`].value);
      const magnitude = parseFloat(window[`magnitude${i}`].value);
      ans += gaussian(d, radius) * magnitude;
    }
    return ans;
  },
  gaussianSpec: d => {
    const spec = -1 + 1 / (1 - parseFloat(gaussianSpecSpec.value));
    const kSize = parseInt(kernelSizeInput.value);
    const size = -1 + 1 / (1 - parseFloat(gaussianSpecSize.value)) + 0.25 / kSize;

    return gaussian(d, size) + (d * kSize < 1 ? spec : 0);
  },
  power: d => {
    const n = 1 + (1 - 1 / (powerSize.value)) * d;
    const p = - (1 - 1 / (1 - powerPower.value));
    return n <= 0 ? 0 : Math.pow(n, p);
  },
  inversePower: d => {
    const n = ((inversePowerSize.value-0.5) * 1e2) ** 3;
    const p = - (1 - 1 / (1 - inversePowerPower.value));
    if(d === 0) return n;
    return 1/Math.pow(Math.abs(d), p);
  },
  reversePower: d => {
    const n = - (1 - 1 / (reversePowerSize.value)) * d;
    const p = -1 + 1 / (1 - reversePowerPower.value ** 2);
    const ans = 1 - Math.pow(n, p);
    return ans <= 0 || isNaN(ans) ? 0 : 1 - Math.pow(n, p);
  },
};

export function getKernel() {
  const kernelSize = Math.floor((parseInt(kernelSizeInput.value) - 1) / 2) * 2 + 1;
  const kernel = new Float64Array(kernelSize * kernelSize);
  const half = Math.floor(kernelSize / 2);
  let sum = 0;

  const distanceF = distanceFunctions[distanceFunction.value];
  const falloffF = falloffFunctions[falloffFunction.value];

  for (let y = 0; y < kernelSize; y++) {
    for (let x = 0; x < kernelSize; x++) {
      // 9x9 multi-sampling
      let subSampleSum = 0;
      for(let Y = 0; Y < 9; Y++) {
        const YY = y + Y / 9 - 8 / 18;
        for(let X = 0; X < 9; X++) {
          const XX = x + X / 9 - 8 / 18;

          let dist = distanceF(XX - half, YY - half);
          let value = falloffF(dist / half);
          subSampleSum += value;
        }
      }
      kernel[x + y * kernelSize] = subSampleSum;
      sum += subSampleSum;
    }
  }

  let afterSum = 0;
  for (let i = 0; i < kernel.length; i++) {
    kernel[i] /= sum;
    afterSum += kernel[i];
  }
  return kernel;
}

export function drawKernelVisualization(kernelCtx, kernelGraphCtx) {
  const kernelSize = Math.floor((parseInt(kernelSizeInput.value) - 1) / 2) * 2 + 1;
  kernelCanvas.width = kernelSize;
  kernelCanvas.height = kernelSize;

  const kernel = getKernel(kernelSize);

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < kernel.length; i++) {
    if (kernel[i] < min) min = kernel[i];
    if (kernel[i] > max) max = kernel[i];
  }

  const kernelImgData = new ImageData(new Uint8ClampedArray(kernelSize * kernelSize * 4), kernelSize, kernelSize);
  for (let i = 0; i < kernel.length; i++) {
    const value = kernel[i];
    let r, g, b;
    if (value < 0) {
      r = (value - min) / (0 - min);
      g = 0;
      b = 0;
    } else {
      r = 0;
      g = (value - 0) / (max - 0);
      b = 0;
    }

    const srgb = lRGBtosRGB(r, g, b);
    kernelImgData.data[i * 4] = srgb[0] * 255;
    kernelImgData.data[i * 4 + 1] = srgb[1] * 255;
    kernelImgData.data[i * 4 + 2] = srgb[2] * 255;
    kernelImgData.data[i * 4 + 3] = 255;
  }
  kernelCtx.putImageData(kernelImgData, 0, 0);

  // draw graph
  const half = Math.floor(kernelSize / 2);

  const distanceF = distanceFunctions[distanceFunction.value];
  const falloffF = falloffFunctions[falloffFunction.value];

  let sum = 0.00001;

  for(let i = 1; i < 125; i++) {
    sum = Math.max(sum, falloffF(i / 125))
  }

  kernelGraphCtx.fillStyle = '#000';
  kernelGraphCtx.fillRect(0, 0, 250, 250);
  kernelGraphCtx.strokeWeight = 1;

  kernelGraphCtx.fillStyle = '#300';
  kernelGraphCtx.fillRect(0, 0, 124 - (half+0.5) * 125 / ((half+1) / half) / half, 250);
  kernelGraphCtx.fillRect(124 + (half+0.5) * 125 / ((half+1) / half) / half, 0, 124 - half * 125 / ((half+1) / half) / half, 250);

  kernelGraphCtx.fillStyle = '#800';
  for(let d = 0.5; d < half + 1; d++) {
    kernelGraphCtx.fillRect(125 + d * 125 / ((half+1) / half) / half, 0, 1, 250);
    kernelGraphCtx.fillRect(124 - d * 125 / ((half+1) / half) / half, 0, 1, 250);
  }

  kernelGraphCtx.fillStyle = '#5af';
  kernelGraphCtx.fillRect(0, 225, 250, 1);

  kernelGraphCtx.strokeStyle = '#fff';
  kernelGraphCtx.beginPath();
  for(let x = 0; x <= 250; x++) {
    const y = 225 - falloffF(Math.abs(x-125) / 125 * (half+1) / half) * 200 / sum;
    kernelGraphCtx.lineTo(x, y);
  }
  kernelGraphCtx.stroke();
}
