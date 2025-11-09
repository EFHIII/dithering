/*
Linear RGB to HCT

parameters:
_r  - linear Red
_g  - linear Green
_b  - linear Blue
L_A - adapting
Y_b - background
Y_w - whitepoint

output:
[H, C, T, a*, b*]
*/
export function lRGBToHCT(_r, _g, _b, L_A = 0.4, Y_b = 0.2, Y_w = 1) {
  _r = Math.min(1, Math.max(0, _r));
  _g = Math.min(1, Math.max(0, _g));
  _b = Math.min(1, Math.max(0, _b));
  // convert lRGB to CIE XYZ
  const ay = _r * 0.2126729 + _g * 0.7151522 + _b * 0.0721750,
  // convert CIE Y to CIE L*
  CIE_Lt = ay / 1,
  CIE_L = ((CIE_Lt > 0.008856) ? Math.pow(CIE_Lt, 1 / 3) : (CIE_Lt * 7.787 + 16 / 116)) * 116 - 16,
  n = Y_b / Y_w,
  z = 1.48 + Math.sqrt(n),
  N_bb = 0.725 * Math.pow(n, -0.2),
  R_w = 0.97555292473,
  G_w = 1.01646898486,
  B_w = 1.08476924428,
  D = Math.min(1,Math.max(0,1 - 1/3.6 * Math.exp((-L_A-42)/92))),
  D_r = (1-D) + 100/R_w * D,
  D_g = (1-D) + 100/G_w * D,
  D_b = (1-D) + 100/B_w * D,
  R_cw = R_w*D_r,
  G_cw = G_w*D_g,
  B_cw = B_w*D_b,
  k = 1 / (5 * L_A + 1),
  k4 = k*k*k*k,
  F_L = (k4 * L_A + 0.1 * (1 - k4)*(1 - k4) * Math.pow(5 * L_A, 1/3)),
  F_L_4 = Math.pow(F_L, 0.25),
  R_aw_x = Math.pow(F_L * Math.abs(R_cw) * 0.01, 0.42),
  G_aw_x = Math.pow(F_L * Math.abs(G_cw) * 0.01, 0.42),
  B_aw_x = Math.pow(F_L * Math.abs(B_cw) * 0.01, 0.42),
  R_aw = Math.sign(R_cw) * 400 * R_aw_x / (R_aw_x + 27.13),
  G_aw = Math.sign(G_cw) * 400 * G_aw_x / (G_aw_x + 27.13),
  B_aw = Math.sign(B_cw) * 400 * B_aw_x / (B_aw_x + 27.13),
  A_w = N_bb * (2*R_aw + G_aw + 0.05*B_aw),
  X = _r * 0.4124564 + _g * 0.3575761 + _b * 0.1804375,
  Y = _r * 0.2126729 + _g * 0.7151522 + _b * 0.0721750,
  Z = _r * 0.0193339 + _g * 0.1191920 + _b * 0.9503041,
  M16_R = (0.401288*X + 0.650173*Y - 0.051461*Z) * D_r,
  M16_G = (-0.250268*X + 1.204414*Y + 0.045854*Z) * D_g,
  M16_B = (-0.002079*X + 0.048952*Y + 0.953127*Z) * D_b,
  R_a_x = Math.pow(F_L * Math.abs(M16_R) * 0.01, 0.42),
  G_a_x = Math.pow(F_L * Math.abs(M16_G) * 0.01, 0.42),
  B_a_x = Math.pow(F_L * Math.abs(M16_B) * 0.01, 0.42),
  R_a = Math.sign(M16_R) * 400 * R_a_x / (R_a_x + 27.13),
  G_a = Math.sign(M16_G) * 400 * G_a_x / (G_a_x + 27.13),
  B_a = Math.sign(M16_B) * 400 * B_a_x / (B_a_x + 27.13),
  a = R_a + (-12*G_a + B_a) / 11, // redness-greenness
  b = (R_a + G_a - 2 * B_a) / 9, // yellowness-blueness
  h_rad = Math.atan2(b, a), // hue in radians
  e_t = 0.25 * (Math.cos(h_rad + 2) + 3.8),
  A = N_bb * (2*R_a + G_a + 0.05*B_a),
  J_root = Math.pow(A / A_w, 0.5 * 0.69 * z),
  t = (5e4 / 13 * N_bb * e_t * Math.sqrt(a*a + b*b) / (R_a + G_a + 1.05 * B_a + 0.305)),
  alpha = Math.pow(t, 0.9) * Math.pow(1.64 - Math.pow(0.29, n), 0.73),
  C = alpha * J_root, // chroma
  M = C * F_L_4, // colorfulness
  M_prime = Math.log(1 + 0.0228 * M) / 0.0228,
  aprime = M_prime * Math.cos(Math.abs(h_rad)),
  bprime = M_prime * Math.cos(Math.abs(h_rad + Math.PI/2));
  return [
    Math.atan2(bprime, aprime),
    Math.sqrt(aprime * aprime + bprime * bprime),
    CIE_L,
    aprime,
    bprime
  ];
}

/*
Delta HCT

parameters:
c1 - HCT Array - [H, C, T, a*, b*]
c2 - HCT Array - [H, C, T, a*, b*]

output:
delta
*/
export function deltaHCT(c1, c2) {
  const da = c2[3] - c1[3]; // delta a*
  const db = c2[4] - c1[4]; // delta b*
  const dL = c2[2] - c1[2]; // delta Luma (Tone)
  return Math.sqrt(da * da + db * db + dL * dL); // delta
}

/*
squared Delta HCT

parameters:
c1 - HCT Array - [H, C, T, a*, b*]
c2 - HCT Array - [H, C, T, a*, b*]

output:
squared delta
*/
export function squaredDeltaHCT(c1, c2) {
  const da = c2[3] - c1[3]; // delta a*
  const db = c2[4] - c1[4]; // delta b*
  const dL = c2[2] - c1[2]; // delta Luma (Tone)
  return da * da + db * db + dL * dL; // sum of squares
}
