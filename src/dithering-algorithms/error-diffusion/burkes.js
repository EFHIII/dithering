import { errorDiffusion } from './error-diffusion.js';

export function burkes({imgData, palette, callback, colorspace}) {
  callback(errorDiffusion(imgData, palette, [{
      x: 1,
      y: 0,
      w: 8 / 32
    }, {
      x: 2,
      y: 0,
      w: 4 / 32
    }, {
      x: -2,
      y: 1,
      w: 2 / 32
    }, {
      x: -1,
      y: 1,
      w: 4 / 32
    }, {
      x: 0,
      y: 1,
      w: 8 / 32
    }, {
      x: 1,
      y: 1,
      w: 4 / 32
    }, {
      x: 2,
      y: 1,
      w: 2 / 32
    }
  ], colorspace));
}
