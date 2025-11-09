import { errorDiffusion } from './error-diffusion.js';

export function atkinson({imgData, palette, callback, colorspace}) {
  callback(errorDiffusion(imgData, palette, [{
      x: 1,
      y: 0,
      w: 1 / 8
    }, {
      x: 2,
      y: 0,
      w: 1 / 8
    },
    {
      x: -1,
      y: 1,
      w: 1 / 8
    }, {
      x: 0,
      y: 1,
      w: 1 / 8
    }, {
      x: 1,
      y: 1,
      w: 1 / 8
    },
    {
      x: 0,
      y: 2,
      w: 1 / 8
    }
  ], colorspace));
}
