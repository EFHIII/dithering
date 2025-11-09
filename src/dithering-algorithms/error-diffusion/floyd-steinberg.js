import { errorDiffusion } from './error-diffusion.js';

export function floydSteinberg({imgData, palette, callback, colorspace}) {
  callback(errorDiffusion(imgData, palette, [{
      x: 1,
      y: 0,
      w: 7 / 16
    },
    {
      x: -1,
      y: 1,
      w: 3 / 16
    },
    {
      x: 0,
      y: 1,
      w: 5 / 16
    },
    {
      x: 1,
      y: 1,
      w: 1 / 16
    }
  ], colorspace));
}
