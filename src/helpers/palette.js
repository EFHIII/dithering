import {
  palettes
} from './palettes.js';

import {
  lRGBtosRGB,
  lRGBToHCT,
  parseCSSColorString
} from '../dithering-algorithms/helper-functions/color-math.js';


function farthestPointsExact(arr) {
  if(arr.length < 2) {
    return [0, 0];
  }

  let ans = [0, 1];
  let farthestDistance = 0;
  for(let i = 0; i < arr.length; i++) {
    for(let j = i + 1; j < arr.length; j++) {
      const dist = (arr[i][0]-arr[j][0])**2 + (arr[i][1]-arr[j][1])**2 + (arr[i][2]-arr[j][2])**2;
      if(dist > farthestDistance) {
        farthestDistance = dist;
        ans = [i, j];
      }
    }
  }
  return ans;
}

function farthestPoints(arr) {
  if(arr.length < 1000) {
    return farthestPointsExact(arr);
  }

  // create groups
  let groups = [];
  let totalGroups = Math.floor(Math.sqrt(arr.length));
  for(let i = 0; i < totalGroups; i++) {
    groups.push(arr[i * totalGroups]);
  }

  let farthestGroups = farthestPointsExact(groups);

  let A = groups[farthestGroups[0]];
  let B = groups[farthestGroups[1]];

  let groupA = [];
  let groupB = [];

  for(let i = 0; i < arr.length; i++) {
    const p = arr[i];
    const distA = (p[0]-A[0])**2 + (p[1]-A[1])**2 + (p[2]-A[2])**2;
    const distB = (p[0]-B[0])**2 + (p[1]-B[1])**2 + (p[2]-B[2])**2;

    let good = true;
    let closestDistance = Math.min(distA, distB);

    for(let j = 0; j < groups.length; j++) {
      const dist = (p[0]-groups[j][0])**2 + (p[1]-groups[j][1])**2 + (p[2]-groups[j][2])**2;
      if(dist < closestDistance) {
        good = false;
        break;
      }
    }

    if(good) {
      if(distA < distB) groupA.push(i);
      else groupB.push(i);
    }
  }

  let ans = [0, 1];
  let farthestDistance = -Infinity;

  for(let a = 0; a < groupA.length; a++) {
    const pA = arr[groupA[a]];
    for(let b = 0; b < groupB.length; b++) {
      const pB = arr[groupB[b]];
      const dist = (pA[0]-pB[0])**2 + (pA[1]-pB[1])**2 + (pA[2]-pB[2])**2;
      if(dist > farthestDistance) {
        farthestDistance = dist;
        ans = [groupA[a], groupB[b]];
      }
    }
  }

  return ans;
}

function farthestPointFrom(arr, points) {
  let farthestPoint = 0;
  let maxDist = -Infinity;

  for (let i = 0; i < arr.length; i++) {
    const a = arr[i];

    let minDist = Infinity;
    for (let j = 0; j < points.length; j++) {
      const p = points[j];
      const dist = (a[0]-p[0])**2 + (a[1]-p[1])**2 + (a[2]-p[2])**2;
      if (dist < minDist) minDist = dist;
    }

    if (minDist > maxDist) {
      maxDist = minDist;
      farthestPoint = i;
    }
  }

  return farthestPoint;
}

function standardDeviation(arr) {
  let ans = [0, 0, 0];
  let mean = [0, 0, 0];
  for(let i = 0; i < arr.length; i++) {
    mean[0] += arr[i][0];
    mean[1] += arr[i][1];
    mean[2] += arr[i][2];
  }
  mean[0] /= arr.length;
  mean[1] /= arr.length;
  mean[2] /= arr.length;
  for(let i = 0; i < arr.length; i++) {
    ans[0] += (arr[i][0] - mean[0])**2;
    ans[1] += (arr[i][1] - mean[1])**2;
    ans[2] += (arr[i][2] - mean[2])**2;
  }
  ans[0] /= arr.length;
  ans[1] /= arr.length;
  ans[2] /= arr.length;

  return ans[0] + ans[1] + ans[2];
}

function linearArrayToSRGB(arr) {
  let ans = [];

  for(let i = 0; i < arr.length; i++) {
    let col = lRGBtosRGB(...arr[i]);
    ans.push(`#${Math.round(col[0]*255).toString(16).padStart(2, 0)}${Math.round(col[1]*255).toString(16).padStart(2, 0)}${Math.round(col[2]*255).toString(16).padStart(2, 0)}`);
  }

  return ans;
}

function fullGamut(linearImageData, n) {
  let colorsHCT = [];
  let colorsLinear = [];

  for(let i = 0; i < linearImageData.length; i+=3) {
    colorsLinear.push([linearImageData[i], linearImageData[i + 1], linearImageData[i + 2]]);
    colorsHCT.push(lRGBToHCT(...colorsLinear[Math.round(i / 3)]));
  }

  const firstColor = farthestPointFrom(colorsHCT, [[0, 0, 0]]);
  let ansHCT = [];
  let ans = [];

  ansHCT.push(colorsHCT[firstColor]);
  ans.push(colorsLinear[firstColor]);

  for(let i = 1; i < n; i++) {
    const id = farthestPointFrom(colorsHCT, ansHCT);

    ansHCT.push(colorsHCT[id]);
    ans.push(colorsLinear[id]);
  }

  return ans;
}

export function getPalette(linearImageData) {
  const selectedPaletteKey = colorPalette.value;
  if (selectedPaletteKey === 'custom') {
    return customPalette.value.split(',').map(c => c.trim());
  }

  if(selectedPaletteKey === 'generate') {
    const colors = parseInt(generatePaletteSize.value);
    const linearPalette = fullGamut(linearImageData, colors);
    return linearArrayToSRGB(linearPalette);
  }

  for(let group in palettes) {
    if (palettes[group][selectedPaletteKey]) {
      return palettes[group][selectedPaletteKey].colors;
    }
  }

  return [];
}

export function drawPaletteVisualization(ctx, palette) {
  const paletteLRGB = palette.map(parseCSSColorString);

  let paletteHCT = [];

  let sorted = [];

  for(let i = 0; i < paletteLRGB.length; i++) {
    paletteHCT.push(lRGBToHCT(...paletteLRGB[i]));

    sorted.push(i);
  }

  sorted = sorted.sort((a, b) => {
    return (Math.atan2(-paletteHCT[b][1], -paletteHCT[b][0]) - Math.atan2(-paletteHCT[a][1], -paletteHCT[a][0]))*1000 + (paletteHCT[b][2] - paletteHCT[a][2]);
  });

  const sz = Math.ceil(Math.sqrt(paletteLRGB.length));

  paletteCanvas.width = sz * 2;
  paletteCanvas.height = sz * 2;

  const imgData = new ImageData(new Uint8ClampedArray(sz * sz * 16).fill(255), sz * 2, sz * 2);
  for(let x = 0; x < sz * 2; x++) {
    for(let y = 0; y < sz * 2; y++) {
      let val = ((x + y) % 2) ? 200 : 230;
      imgData.data[(x + y * sz * 2) * 4 + 0] = val;
      imgData.data[(x + y * sz * 2) * 4 + 1] = val;
      imgData.data[(x + y * sz * 2) * 4 + 2] = val;
    }
  }

  for(let i = 0; i < paletteLRGB.length; i++) {
    const col = lRGBtosRGB(...paletteLRGB[sorted[i]]);
    for(let x = 0; x < 2; x++) {
      const X = (i % sz) * 2 + x;
      for(let y = 0; y < 2; y++) {
        const Y = Math.floor(i / sz) * 2 + y;
        imgData.data[(X + Y * sz * 2) * 4 + 0] = col[0] * 255;
        imgData.data[(X + Y * sz * 2) * 4 + 1] = col[1] * 255;
        imgData.data[(X + Y * sz * 2) * 4 + 2] = col[2] * 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

colorPalette.innerHTML = '';
const customOption = document.createElement('option');
customOption.value = 'custom';
customOption.textContent = 'Custom';
colorPalette.appendChild(customOption);

const customOption2 = document.createElement('option');
customOption2.value = 'generate';
customOption2.textContent = 'Generate from image';
colorPalette.appendChild(customOption2);

for (const group in palettes) {
  const optGroup = document.createElement('optgroup');
  optGroup.label = group;

  for(let key in palettes[group]) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = palettes[group][key].name;
    optGroup.appendChild(option);
  }
  colorPalette.appendChild(optGroup);
}
colorPalette.value = 'generate';

colorPalette.addEventListener('change', () => {
  grayscale.checked = palettes.Grayscale.hasOwnProperty(colorPalette.value);
});
