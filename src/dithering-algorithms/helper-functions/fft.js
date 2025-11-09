// Cooley–Tukey Radix-2 FFT
export function fft2d(real, width, height) {
    // Input: Float64Array
    // Output: { re: Float64Array, im: Float64Array } complex representation

    const re = new Float64Array(width * height);
    const im = new Float64Array(width * height);
    real.forEach((v, i) => re[i] = v);

    // Apply 1D FFT on rows, then columns (in-place)
    for (let y = 0; y < height; y++) {
        const row = getRow(re, im, y, width);
        const rowFFT = fft1d(row.re, row.im);
        setRow(re, im, rowFFT.re, rowFFT.im, y, width);
    }

    for (let x = 0; x < width; x++) {
        const col = getCol(re, im, x, width, height);
        const colFFT = fft1d(col.re, col.im);
        setCol(re, im, colFFT.re, colFFT.im, x, width, height);
    }

    return { re, im };
}

export function ifft2d({ re, im }, width, height) {
    // Inverse 2D FFT (normalized)
    const reOut = new Float64Array(re);
    const imOut = new Float64Array(im);

    // Inverse on columns, then rows
    for (let x = 0; x < width; x++) {
        const col = getCol(reOut, imOut, x, width, height);
        const colIFFT = ifft1d(col.re, col.im);
        setCol(reOut, imOut, colIFFT.re, colIFFT.im, x, width, height);
    }

    for (let y = 0; y < height; y++) {
        const row = getRow(reOut, imOut, y, width);
        const rowIFFT = ifft1d(row.re, row.im);
        setRow(reOut, imOut, rowIFFT.re, rowIFFT.im, y, width);
    }

    const n = width * height;
    const realPart = new Float64Array(n);
    // normalize
    for (let i = 0; i < n; i++) realPart[i] = reOut[i] / n;

    return realPart;
}

export function multiplyComplex(A, B) {
    // Pointwise multiplication of complex 2D arrays
    const n = A.re.length;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        re[i] = A.re[i] * B.re[i] - A.im[i] * B.im[i];
        im[i] = A.re[i] * B.im[i] + A.im[i] * B.re[i];
    }
    return { re, im };
}

export function conjComplex(A) {
    const n = A.re.length;
    const re = new Float64Array(A.re);
    const im = new Float64Array(A.im);
    for (let i = 0; i < n; i++) im[i] = -im[i];
    return { re, im };
}


function fft1d(re, im) {
    // Recursive radix-2 Cooley–Tukey FFT
    const n = re.length;
    if (n <= 1) return { re, im };

    const half = n / 2;
    const evenRe = new Float64Array(half);
    const evenIm = new Float64Array(half);
    const oddRe = new Float64Array(half);
    const oddIm = new Float64Array(half);
    for (let i = 0; i < half; i++) {
        evenRe[i] = re[2 * i];
        evenIm[i] = im[2 * i];
        oddRe[i] = re[2 * i + 1];
        oddIm[i] = im[2 * i + 1];
    }

    const Fe = fft1d(evenRe, evenIm);
    const Fo = fft1d(oddRe, oddIm);

    const outRe = new Float64Array(n);
    const outIm = new Float64Array(n);
    for (let k = 0; k < half; k++) {
        const t = -2 * Math.PI * k / n;
        const wr = Math.cos(t);
        const wi = Math.sin(t);
        const tr = wr * Fo.re[k] - wi * Fo.im[k];
        const ti = wr * Fo.im[k] + wi * Fo.re[k];
        outRe[k] = Fe.re[k] + tr;
        outIm[k] = Fe.im[k] + ti;
        outRe[k + half] = Fe.re[k] - tr;
        outIm[k + half] = Fe.im[k] - ti;
    }
    return { re: outRe, im: outIm };
}

function ifft1d(re, im) {
    // Inverse FFT via conjugate symmetry
    const n = re.length;
    const conjRe = new Float64Array(re);
    const conjIm = new Float64Array(im);
    for (let i = 0; i < n; i++) conjIm[i] = -conjIm[i];
    const forward = fft1d(conjRe, conjIm);
    const outRe = new Float64Array(n);
    const outIm = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        outRe[i] = forward.re[i] / n;
        outIm[i] = -forward.im[i] / n;
    }
    return { re: outRe, im: outIm };
}

function getRow(re, im, y, width) {
    const start = y * width;
    return {
        re: re.slice(start, start + width),
        im: im.slice(start, start + width)
    };
}
function setRow(re, im, srcRe, srcIm, y, width) {
    const start = y * width;
    for (let i = 0; i < width; i++) {
        re[start + i] = srcRe[i];
        im[start + i] = srcIm[i];
    }
}
function getCol(re, im, x, width, height) {
    const reCol = new Float64Array(height);
    const imCol = new Float64Array(height);
    for (let y = 0; y < height; y++) {
        reCol[y] = re[y * width + x];
        imCol[y] = im[y * width + x];
    }
    return { re: reCol, im: imCol };
}
function setCol(re, im, srcRe, srcIm, x, width, height) {
    for (let y = 0; y < height; y++) {
        re[y * width + x] = srcRe[y];
        im[y * width + x] = srcIm[y];
    }
}
