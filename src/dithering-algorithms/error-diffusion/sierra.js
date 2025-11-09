import { errorDiffusion } from './error-diffusion.js';

export function sierra({imgData, palette, callback, colorspace}) {
  callback(errorDiffusion(imgData, palette, [{
      x: 1,
      y: 0,
      w: 5 / 32
    }, {
      x: 2,
      y: 0,
      w: 3 / 32
    },
    {
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
      w: 5 / 32
    }, {
      x: 1,
      y: 1,
      w: 4 / 32
    }, {
      x: 2,
      y: 1,
      w: 2 / 32
    },
    {
      x: -1,
      y: 2,
      w: 2 / 32
    }, {
      x: 0,
      y: 2,
      w: 3 / 32
    }, {
      x: 1,
      y: 2,
      w: 2 / 32
    }
  ], colorspace));
}
