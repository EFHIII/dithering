import {
  createSaffronPatternSmooth,
  createSaffronPatternAccurate
} from '../pattern-generators/create-saffron-pattern.js';
import { createPattern, randomPattern } from '../pattern-generators/create-pattern.js';
import { createJoelYliluoma1 } from '../pattern-generators/joel-yliluoma-1.js';
import { createJoelYliluoma2 } from '../pattern-generators/joel-yliluoma-2.js';
import { createJoelYliluoma3 } from '../pattern-generators/joel-yliluoma-3.js';
import {
  createAnnealedPattern,
  createAnnealedPattern2x
} from '../pattern-generators/create-annealed-pattern.js';

const patternNames = {
  'saffronPatternSmooth': createSaffronPatternSmooth,
  'saffronPatternAccurate': createSaffronPatternAccurate,
  'patternDithering': createPattern,
  'JY1': createJoelYliluoma1,
  'JY2': createJoelYliluoma2,
  'JY3': createJoelYliluoma3,
  'greedyAnnealing': createAnnealedPattern,
  'randomAnnealing': createAnnealedPattern2x,
  'randomPattern': randomPattern,
};

export function patternFromName(patternName) {
  return patternNames[patternName];
}
