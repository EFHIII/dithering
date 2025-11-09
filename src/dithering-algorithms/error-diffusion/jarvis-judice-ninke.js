import { errorDiffusion } from './error-diffusion.js';

export function jarvisJudiceNinke({imgData, palette, callback, colorspace}) {
  callback(errorDiffusion(imgData, palette, [{
      x: 1,
      y: 0,
      w: 7 / 48
    }, {
      x: 2,
      y: 0,
      w: 5 / 48
    },
    {
      x: -2,
      y: 1,
      w: 3 / 48
    }, {
      x: -1,
      y: 1,
      w: 5 / 48
    }, {
      x: 0,
      y: 1,
      w: 7 / 48
    }, {
      x: 1,
      y: 1,
      w: 5 / 48
    }, {
      x: 2,
      y: 1,
      w: 3 / 48
    },
    {
      x: -2,
      y: 2,
      w: 1 / 48
    }, {
      x: -1,
      y: 2,
      w: 3 / 48
    }, {
      x: 0,
      y: 2,
      w: 5 / 48
    }, {
      x: 1,
      y: 2,
      w: 3 / 48
    }, {
      x: 2,
      y: 2,
      w: 1 / 48
    }
  ], colorspace));
}
