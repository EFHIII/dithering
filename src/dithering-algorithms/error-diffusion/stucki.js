import { errorDiffusion } from './error-diffusion.js';

export function stucki({imgData, palette, callback, colorspace}) {
  callback(errorDiffusion(imgData, palette, [{
      x: 1,
      y: 0,
      w: 8 / 42
    }, {
      x: 2,
      y: 0,
      w: 4 / 42
    },
    {
      x: -2,
      y: 1,
      w: 2 / 42
    }, {
      x: -1,
      y: 1,
      w: 4 / 42
    }, {
      x: 0,
      y: 1,
      w: 8 / 42
    }, {
      x: 1,
      y: 1,
      w: 4 / 42
    }, {
      x: 2,
      y: 1,
      w: 2 / 42
    },
    {
      x: -2,
      y: 2,
      w: 1 / 42
    }, {
      x: -1,
      y: 2,
      w: 2 / 42
    }, {
      x: 0,
      y: 2,
      w: 4 / 42
    }, {
      x: 1,
      y: 2,
      w: 2 / 42
    }, {
      x: 2,
      y: 2,
      w: 1 / 42
    }
  ], colorspace));
}
