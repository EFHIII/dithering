# Dithering Algorithms
#### Table of Contents
- [Usage](#Usage)
  - [Parameters](#Parameters)
- [Error Diffusion](#ErrorDiffusion)
  - [Floyd-Steinberg](#Floyd-Steinberg)
  - [Atkinson](#Atkinson)
  - [Burkes](#Burkes)
  - [Jarvis, Judice, & Ninke](#JarvisJudiceNinke)
  - [Sierra](#Sierra)
- [Least Error](#LeastError)
  - [Least Error First](#LeastErrorFirst)
  - [Least Error Scan](#LeastErrorScan)
- [Positional Dithering](#PositionalDithering)
  - [Saffron Smooth](#SaffronSmooth)
  - [Saffron Accurate](#SaffronAccurate)
- [Pattern Dithering](#PatternDither)
  - [Joel Yliluoma 1](#JoelYliluoma1)
  - [Joel Yliluoma 2](#JoelYliluoma2)
  - [Joel Yliluoma 3](#JoelYliluoma3)
- [Simulated Annealing](#SimulatedAnnealing)
  - [Energy Dither](#EnergyDither)
  - [Energy Dither w/ Swaps](#EnergyDitherSwaps)
- [Tools](#Tools)
  - [Ideal](#Ideal)

<a name="Usage"></a>
## Usage
All of the dithering algorithm functions in here work very similarly. As input, they take an object with a subset of the following keys:
```js
// general parameters
callback,
imgData,
palette,
kernel,
kernelSize,
colorspace,
viewingCondition,
// Algorithm parameters
ditherMatrix,
pattern,
patternBias,
patternSize,
energyPoints,
energyStart,
energyCooling,
```

As output, they call the callback function with the output imageData. All of the slower algorithms will call the callback function multiple times targeting one call per second.

Example usage:
```js
import { leastErrorScan } from 'dithering-algorithms/least-error/least-error-scan.js';

function callback(imgData) {
  console.log(imgData);
}

// example image
const width = 64;
const height = 64;
const myImage = new ImageData(width, height);
const data = myImage.data;

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    data[i + 0] = Math.floor((x / width) * 255);
    data[i + 1] = Math.floor((y / height) * 255);
    data[i + 3] = 255;
  }
}

// call dithering function
leastErrorScan({
  imgData: myImage,
  callback,
  palette: ['#000', '#f00', '#fff'],
  kernel: [
    1/16, 2/16, 1/16,
    2/16, 4/16, 2/16,
    1/16, 2/16, 1/16
  ],
  kernelSize: 3,
  colorspace: 'hct',
  viewingCondition: 'D65 Standard Medium'
});
```

<a name="Parameters"></a>
### Parameters
- callback - `function(imageData)` - A function to be called with the output
- imgData - `imageData` - The target image
- palette - `Array[CSS Color String]` - The palette to use (in sRGB)
- kernel - `Array[Number]` - A normalized-sum flattened 2D array of the kernel
- kernelSize - `Number` - The width/height of the kernel
- colorspace - `String` - One of:
```js
'hct', // Default
'oklrab',
'okl_ab',
'oklab',
'cam16',
'lrgb',
'srgb',
'luma',
```
- viewingCondition - `String` - The viewing conditions for the colorspace. One of:
```js
'D65 Outdoor High',
'D65 Outdoor Medium',
'D65 Outdoor Low',
'D65 Outdoor Very Low',
'D65 Standard High',
'D65 Standard Medium',
'D65 Standard Low',
'D65 Standard Very Low',
'D65 Cinematic High',
'D65 Cinematic Medium',
'D65 Cinematic Low',
'D65 Cinematic Very Low'
```
- ditherMatrix - `String` - The dithering matrix to use. One of:
```js
'bayer-1',
'bayer-2',
'bayer-4',
'bayer-8',
'bayer-16',
'cluster-dot-4',
'cluster-dot-8',
'cluster-dot-16',
'void-and-cluster-matrix'
```
- pattern - `String` - The pattern Generator to use. One of:
```js
'saffronPatternSmooth',
'saffronPatternAccurate',
'patternDithering',
'JY1',
'JY2',
'JY3',
'greedyAnnealing',
'randomAnnealing',
```
- patternBias - `Number (0 to 1)` - How often to use a random color vs pattern color.
- patternSize - `Number` - How many entries to have in the pattern
- energyPoints - `Number` - How many pixels to change at a time (energy dithering)
- energyStart - `Number` - The starting amount of Energy (energy dithering)
- energyCooling `Number` - The rate of energy cooling (energy dithering)

<a name="ErrorDiffusion"></a>
## Error Diffusion
Error diffusion algorithms scan through the image choosing the best palette color for matching the current pixel followed by updating yet-to-be-visited neighbor pixels based on the error in the match. All of the ones listed here use a matrix of weights that determine how much of the error gets diffused to each neighbor pixel.

Error diffusion is used mostly for palettes that are uniform and that encompass the entire available color gamut. When the palette is insufficiently complete most Error Diffusion algorithms have a problem with error accumulation where error from each pixel propagates without any way to be removed. Clipping the error to be in-gamut helps, but does not eliminate the problem.

<a name="Floyd-Steinberg"></a>
### Floyd-Steinberg
**Floyd-Steinberg** is the most widely used error diffusion dithering algorithm, not because it's the best, just because it's pretty good, one of the oldest ones, and the simplest one, so newer ones often get overlooked.

<a name="Atkinson"></a>
### Atkinson

<a name="Burkes"></a>
### Burkes

<a name="JarvisJudiceNinke"></a>
### Jarvis, Judice, & Ninke

<a name="Sierra"></a>
### Sierra

<a name="LeastError"></a>
## Least Error
The Least Error algorithms are (to my knowledge) something invented by myself (Saffron Haas). The original form of the algorithm was used in an [Emoji Dithering](https://github.com/EFHIII/emoji-mosaic) program written in September 2024. In that context, error diffusion was done in a way more akin to algorithms like Floyd-Steinberg. In these newer iterations of the algorithm, error diffusion is done by examining a "score" evaluation function which essentially looks at a blurred version of the dithered image and compares it to a blurred version of the target image to determine a score and then iteratively uses how that score would change given various pixel changes to decide what pixel changes to make until all pixels have been dithered and there are no ways to improve the "score" among the changes examined.

<a name="LeastErrorFirst"></a>
### Least Error First
Least Error First chooses the pixel change that would cause the score to go up the least (or down the most if negative) among all possible pixels and palette options.

<a name="LeastErrorScan"></a>
### Least Error Scan
Least Error Scan does the same thing as Least Error First but only for palette selection on a single pixel at a time (in scan-line order) as apposed to for all pixels at once. This makes it much faster than Least Error First but the final result is not as good.

<a name="PositionalDithering"></a>
## Positional Dithering
These algorithms all create a list of colors that, when mixed, approximate the desired pixel color at a given pixel, then use an order matrix (e.g. Bayer matrix or Void & Cluster matrix) to choose the index of the pattern to use.

<a name="SaffronSmooth"></a>
### Saffron Smooth

<a name="SaffronAccurate"></a>
### Saffron Accurate

<a name="PatternDither"></a>
### Pattern Dithering

<a name="JoelYliluoma1"></a>
### Joel Yliluoma 1
As described on https://bisqwit.iki.fi/story/howto/dither/jy/

<a name="JoelYliluoma2"></a>
### Joel Yliluoma 2
As described on https://bisqwit.iki.fi/story/howto/dither/jy/

<a name="JoelYliluoma3"></a>
### Joel Yliluoma 3
As described on https://bisqwit.iki.fi/story/howto/dither/jy/ (without throwing away pairs that exceed a threshold because it's unclear what threshold to use)

<a name="SimulatedAnnealing"></a>
## Simulated Annealing
Simulated Annealing is essentially a random walk with a bias towards walking down-hill in function space. The strength of that bias is referred to as energy. 0 energy means it randomly moves but only ever down-hill. High energy means it randomly moves without any bias. The sweet spot is somewhere in-between where you move mostly down-hill, but up-hill often enough to avoid bad local minima in search of a better global minima.

<a name="EnergyDither"></a>
### Energy Dither
Energy Dither uses the same scoring metric as Least Error, just applied in a stochastic algorithm. In testing, I've found that randomly changing 2 pixels at a time (`energyPoints = 2`) gives high quality results the fastest. `patternBias` is a bit more variable and depends on the quality of the pattern generator's output along with the size of the palette. Bigger palette's benefit more from having a higher pattern bias because a low pattern bias results in having to check many palette colors that are completely wrong between checking realistic candidate palette colors. However, a bad pattern may not have the "correct" palette color in the pattern.

<a name="EnergyDitherSwaps"></a>
### Energy Dither w/ Swaps
Energy Dither w/ Swaps does the same thing as Energy Dither, except 50% of the time it will choose to try swapping the palette colors of the chosen pixels rather than assigning random palette colors. This can work well especially for when neighbor pixels are often similar in color.

<a name="Tools"></a>
## Tools
Tools don't dither things but use the same interface for generating informative images.

<a name="Ideal"></a>
### Ideal

**Ideal** takes a pattern generating algorithm and for each pixel outputs the blending of all entries in the pattern given for that pixel. This gives an output roughly the same as if you used pattern dithering on the image but with an arbitrarily high resolution and viewed from far away / zoomed out.
