const algorithmNames = [
  //{
  //  name: 'Deconvolution',
  //  algorithms: [
  //    ['richardson-lucy.js', 'Richardson-Lucy'],
  //  ]
  //},
  {
    name: 'Least Error',
    algorithms: [
      ['least-error-scan.js', 'Least Error Scan'],
      ['least-error-first.js', 'Least Error First'],
    ]
  },
  {
    name: 'Simulated Annealing',
    algorithms: [
      ['energy-dither.js', 'Energy Dither'],
      ['energy-with-swaps.js', 'Energy Dither w/ Swaps'],
    ]
  },
  {
    name: 'Ordered Dithering',
    algorithms: [
      ['pattern-dithering.js', 'Pattern Dithering'],
  //    ['joel-yliluoma-1.js', 'Joel Yliluoma 1'],
  //    ['joel-yliluoma-2.js', 'Joel Yliluoma 2'],
  //    ['joel-yliluoma-3.js', 'Joel Yliluoma 3']
    ]
  },
  {
    name: 'Error Diffusion',
    algorithms: [
      //['ostromoukhov.js', 'Ostromoukhov'],
      //['zhou-fang.js', 'Zhou-Fang'],
      ['floyd-steinberg.js', 'Floyd-Steinberg'],
      ['jarvis-judice-ninke.js', 'Jarvis, Judice, & Ninke'],
      ['stucki.js', 'Stucki'],
      ['atkinson.js', 'Atkinson'],
      ['burkes.js', 'Burkes'],
      ['sierra.js', 'Sierra'],
    ]
  },
  {
    name: 'Tools',
    algorithms: [
      ['ideal.js', 'Ideal'],
    ]
  }
];

export { algorithmNames };
