import { colorRamp } from './color-ramp.js';

import {
  colorDelta,
  imageDatatolRGB,
  lRGBCache
} from '../dithering-algorithms/helper-functions/color-math.js';


export function scaleImageData(img, w, h) {
  if(img.width === w && img.height === h) return imageDatatolRGB(img);

  const ans = new Float64Array(w * h * 3);

  let szX = img.width / w;
  let szY = img.height / h;

  for(let Y = 0; Y < h; Y++) {
    let pos = (Y * w) << 2;
    for(let X = 0; X < w; X++, pos += 4) {
      let total = 0;

      let colR = 0;
      let colG = 0;
      let colB = 0;

      // middle pixels
      let xx = X/w*img.width;
      let yy = Y/h*img.height;
      let xb = (X+1)/w*img.width;
      let yb = (Y+1)/h*img.height;

      for(let YY = Math.ceil(yy); YY <= yb - 1; YY++) {
        for(let XX = Math.ceil(xx); XX <= xb - 1; XX++) {
          total++;

          let ipos = (XX + (YY * img.width)) << 2;

          colR += lRGBCache[Math.round(img.data[ipos + 0] / 255 * 16383)];
          colG += lRGBCache[Math.round(img.data[ipos + 1] / 255 * 16383)];
          colB += lRGBCache[Math.round(img.data[ipos + 2] / 255 * 16383)];
        }
      }

      // edge pixels
      let amounta = 1 - (yy % 1);
      let amountb = yb % 1;
      let ipos;

      for(let XX = Math.ceil(xx); XX <= xx + szX - 1; XX++) {
        if(amounta < 1 && amounta > 0) {
          total += amounta;

          ipos = (XX + (Math.floor(yy) * img.width)) << 2;

          colR += amounta * lRGBCache[Math.round(img.data[ipos + 0] / 255 * 16383)];
          colG += amounta * lRGBCache[Math.round(img.data[ipos + 1] / 255 * 16383)];
          colB += amounta * lRGBCache[Math.round(img.data[ipos + 2] / 255 * 16383)];
        }
        if(amountb < 1 && amountb > 0) {
          total += amountb;

          ipos = (XX + (Math.floor(yb) * img.width)) << 2;

          colR += amountb * lRGBCache[Math.round(img.data[ipos + 0] / 255 * 16383)];
          colG += amountb * lRGBCache[Math.round(img.data[ipos + 1] / 255 * 16383)];
          colB += amountb * lRGBCache[Math.round(img.data[ipos + 2] / 255 * 16383)];
        }
      }

      let amountc = 1 - (xx % 1);
      let amountd = xb % 1;
      for(let YY = Math.ceil(yy); YY <= yy + szY - 1; YY++) {
        if(amountc < 1 && amountc > 0) {
          total += amountc;

          ipos = (Math.floor(xx) + (YY * img.width)) << 2;

          colR += amountc * lRGBCache[Math.round(img.data[ipos + 0] / 255 * 16383)];
          colG += amountc * lRGBCache[Math.round(img.data[ipos + 1] / 255 * 16383)];
          colB += amountc * lRGBCache[Math.round(img.data[ipos + 2] / 255 * 16383)];
        }
        if(amountd < 1 && amountd > 0) {
          total += amountd;

          ipos = (Math.floor(xb) + (YY * img.width)) << 2;

          colR += amountd * lRGBCache[Math.round(img.data[ipos + 0] / 255 * 16383)];
          colG += amountd * lRGBCache[Math.round(img.data[ipos + 1] / 255 * 16383)];
          colB += amountd * lRGBCache[Math.round(img.data[ipos + 2] / 255 * 16383)];
        }
      }

      // corner pixels
      if(amounta < 1 && amountc < 1 && amounta > 0 && amountc > 0) {
        total += amounta * amountc;
        ipos = (Math.floor(xx) + (Math.floor(yy) * img.width)) << 2;
        colR += (amounta * amountc) * lRGBCache[Math.round(img.data[ipos + 0] / 255 * 16383)];
        colG += (amounta * amountc) * lRGBCache[Math.round(img.data[ipos + 1] / 255 * 16383)];
        colB += (amounta * amountc) * lRGBCache[Math.round(img.data[ipos + 2] / 255 * 16383)];
      }

      if(amountb < 1 && amountc < 1 && amountb > 0 && amountc > 0) {
        total += amountb * amountc;
        ipos = (Math.floor(xx) + (Math.floor(yb) * img.width)) << 2;
        colR += (amountb * amountc) * lRGBCache[Math.round(img.data[ipos + 0] / 255 * 16383)];
        colG += (amountb * amountc) * lRGBCache[Math.round(img.data[ipos + 1] / 255 * 16383)];
        colB += (amountb * amountc) * lRGBCache[Math.round(img.data[ipos + 2] / 255 * 16383)];
      }

      if(amounta < 1 && amountd < 1 && amounta > 0 && amountd > 0) {
        total += amounta * amountd;
        ipos = (Math.floor(xb) + (Math.floor(yy) * img.width)) << 2;
        colR += (amounta * amountd) * lRGBCache[Math.round(img.data[ipos + 0] / 255 * 16383)];
        colG += (amounta * amountd) * lRGBCache[Math.round(img.data[ipos + 1] / 255 * 16383)];
        colB += (amounta * amountd) * lRGBCache[Math.round(img.data[ipos + 2] / 255 * 16383)];
      }

      if(amountb < 1 && amountd < 1 && amountb > 0 && amountd > 0) {
        total += amountb * amountd;
        ipos = (Math.floor(xb) + (Math.floor(yb) * img.width)) << 2;
        colR += (amountb * amountd) * lRGBCache[Math.round(img.data[ipos + 0] / 255 * 16383)];
        colG += (amountb * amountd) * lRGBCache[Math.round(img.data[ipos + 1] / 255 * 16383)];
        colB += (amountb * amountd) * lRGBCache[Math.round(img.data[ipos + 2] / 255 * 16383)];
      }

      colR /= total;
      colG /= total;
      colB /= total;

      const pos3 =  (X + Y * w) * 3;

      ans[pos3 + 0] = colR;
      ans[pos3 + 1] = colG;
      ans[pos3 + 2] = colB;
    }
  }

  return ans;
}


export function calculateErrorDataInColor(width, height, blurredSourceInColorSpace, blurredDitheredInColorSpace) {
  const errorData = new Uint8ClampedArray(width * height * 4);

  let totalError = 0;

  for (let i = 0; i < width * height; i++) {
    const i3 = i * 3;
    const i4 = i * 4;

    const delta = colorDelta(
      blurredSourceInColorSpace.slice(i3, i3 + 3),
      blurredDitheredInColorSpace.slice(i3, i3 + 3)
    );

    totalError += delta;

    const c = colorRamp(Math.pow(delta / 1000, 1 / 5));

    errorData[i4 + 0] = c[0];
    errorData[i4 + 1] = c[1];
    errorData[i4 + 2] = c[2];
    errorData[i4 + 3] = 255;
  }
  return [new ImageData(errorData, width, height), totalError / (width * height)];
}
