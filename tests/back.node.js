// Chạy: node tests/back.node.js   (GAIT=<đường dẫn gait.js khác> để so bản cũ; IN=1 để in bảng số)
// Góc SAU LƯNG: dữ liệu tổng hợp 10 s, 30 fps, cadence 170, chân trái cài valgus + sụt hông.
// So từng ca nhiễu nhãn với bản sạch tương ứng: mỗi chân lệch ≤ 1° (valgus, sụt hông), số bước bằng nhau.
const assert = require('assert'), path = require('path');
const Gait = require(process.env.GAIT ? path.resolve(process.env.GAIT) : '../docs/gait.js');

const FPS = 30, SEC = 10, CAD = 170, H = 170, PC = 3;   // PC: px mỗi cm
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

// foot: cổ chân so với đường giữa hai hông (cm, dương = phía bên mình) lúc giữa trụ (st) và giữa pha bay (sw)
function gen(o) {
  o = Object.assign({ seed: 1, valg: { L: 8.7, R: -0.4 }, drop: { L: 6, R: 2 }, foot: { st: 5, sw: 9 } }, o);
  const r = rng(o.seed), N = FPS * SEC, f = CAD / 120;
  const P = { x: [], y: [], v: [] };
  for (let j = 0; j < 33; j++) { P.x.push(new Float64Array(N)); P.y.push(new Float64Array(N)); P.v.push(new Float64Array(N)); }
  const thigh = 0.245 * H * PC, shank = 0.246 * H * PC, hh = 8 * PC, hip0 = 300, G = hip0 + 0.97 * (thigh + shank), A = 25 * PC;
  const own = { L: -1, R: 1 }, oth = { L: 'R', R: 'L' }, D2R = Math.PI / 180;
  const put = (j, i, x, y) => { P.x[j][i] = x + gauss(r); P.y[j][i] = y + gauss(r); P.v[j][i] = Math.min(0.99, 0.9 + 0.04 * gauss(r)); };
  for (let i = 0; i < N; i++) {
    const phL = 2 * Math.PI * f * (i / FPS) + 0.3, ph = { L: phL, R: phL + Math.PI };
    const mid = 640 + 1.5 * PC * Math.sin(phL), hy = hip0 + 2 * PC * Math.cos(2 * phL);
    for (let j = 0; j < 33; j++) put(j, i, mid, hy - 0.45 * H * PC);   // đầu/mặt/tay: không dùng, đặt cho đủ
    for (const s of ['L', 'R']) {
      const I = Gait.IDX[s], c = Math.cos(ph[s]), bump = Math.max(0, c), h = (1 - c) / 2;
      const hx = mid + own[s] * hh, hY = hy + 2 * hh * Math.tan(o.drop[oth[s]] * D2R) * Math.max(0, Math.cos(ph[oth[s]]));
      const s0 = (o.foot.st + o.foot.sw) / 2, s1 = (o.foot.st - o.foot.sw) / 2;
      const ax = mid + own[s] * PC * (s0 + s1 * c), ay = G - A * h * h;
      const t = thigh / (thigh + shank), half = Math.hypot(ax - hx, ay - hY) / 2;
      const kx = hx + (ax - hx) * t - own[s] * half * Math.tan((o.valg[s] / 2) * D2R) * bump, ky = hY + (ay - hY) * t;
      put(I.sh, i, mid + own[s] * 18 * PC, hy - 0.3 * H * PC);
      put(I.hip, i, hx, hY); put(I.knee, i, kx, ky); put(I.ank, i, ax, ay);
      put(I.heel, i, ax, ay + 3 * PC); put(I.toe, i, ax - own[s] * 2 * PC, ay + 2 * PC);
    }
  }
  return P;
}
// đánh dấu các đoạn 2–5 khung liền cho tới khi đủ tỉ lệ frac
function runs(seed, N, frac) {
  const r = rng(seed), m = new Uint8Array(N);
  let n = 0;
  while (n < frac * N) { const a = Math.floor(r() * N), len = 2 + Math.floor(r() * 4); for (let i = a; i < Math.min(N, a + len); i++) if (!m[i]) { m[i] = 1; n++; } }
  return m;
}
const swapPairs = (P, pairs, m) => { for (let i = 0; i < m.length; i++) if (m[i]) for (const [a, b] of pairs) for (const k of ['x', 'y', 'v']) { const t = P[k][a][i]; P[k][a][i] = P[k][b][i]; P[k][b][i] = t; } return P; };
// chép từ app.js fixLR: quay sau lưng, hông "trái" nằm bên phải ảnh thì đổi tên mọi cặp trái/phải
const LR_PAIRS = [[1, 4], [2, 5], [3, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [17, 18], [19, 20], [21, 22], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32]];
function fixLR(P) { const m = new Uint8Array(P.x[0].length); for (let i = 0; i < m.length; i++) m[i] = P.x[23][i] > P.x[24][i] ? 1 : 0; return swapPairs(P, LR_PAIRS, m); }
const LEG = [[25, 26], [27, 28], [29, 30], [31, 32]];
const N = FPS * SEC, FRAC = 0.19;

const CROSS = { foot: { st: -3, sw: 1 } };
const cases = [
  { name: 'sạch', base: {}, mk: (P) => P },
  { name: 'đảo cả người', base: {}, mk: (P) => swapPairs(P, LR_PAIRS, runs(11, N, FRAC)) },
  { name: 'tráo riêng chân', base: {}, mk: (P) => swapPairs(P, LEG, runs(12, N, FRAC)) },
  { name: 'tráo riêng cổ chân', base: {}, mk: (P) => swapPairs(P, [[27, 28]], runs(13, N, FRAC)) },
  { name: 'chập cổ chân', base: {}, mk: (P) => {
    const m = runs(14, N, 0.1), r = rng(15);
    for (let i = 0; i < N; i++) if (m[i]) {   // MediaPipe đặt cả hai nhãn cổ chân lên một bàn chân; nhãn nào mờ hơn là ngẫu nhiên
      const [src, dst] = r() < 0.5 ? [27, 28] : [28, 27];
      P.x[dst][i] = P.x[src][i] + gauss(r); P.y[dst][i] = P.y[src][i] + gauss(r);
      P.v[27][i] = 0.7 + 0.25 * r(); P.v[28][i] = 0.7 + 0.25 * r();
    }
    return P;
  } },
  { name: 'chạy chéo sạch', base: CROSS, mk: (P) => P },
  { name: 'chạy chéo + tráo chân', base: CROSS, mk: (P) => swapPairs(P, LEG, runs(16, N, FRAC)) },
];
const run = (c) => Gait.computeBack(fixLR(c.mk(gen(c.base))), FPS, H);
const ref = {};
let fail = 0;
const f1 = (v) => (v == null || Number.isNaN(v) ? ' NaN' : v.toFixed(1).padStart(5));
for (const c of cases) {
  const key = JSON.stringify(c.base);
  const b = run(c);
  if (!ref[key]) ref[key] = b;
  const R0 = ref[key], st = (x) => x.extra.steps.L + '/' + x.extra.steps.R;
  const row = [];
  for (const s of ['L', 'R']) for (const k of ['knee_valgus', 'pelvic_drop']) {
    const v = b.per[s] ? b.per[s][k] : NaN, v0 = R0.per[s] ? R0.per[s][k] : NaN;
    row.push(s + '.' + k.split('_')[1] + f1(v));
    if (!(Math.abs(v - v0) <= 1)) { fail++; row.push('<-- lệch ' + (v - v0).toFixed(1)); }
  }
  if (st(b) !== st(R0)) { fail++; row.push('<-- số bước ' + st(b) + ' khác ' + st(R0)); }
  if (process.env.IN || fail) console.log(c.name.padEnd(22), 'bước', st(b), row.join('  '), b.extra.legSwapDrops != null ? 'drops ' + b.extra.legSwapDrops + (b.extra.legLabelUnstable ? ' (không ổn định)' : '') : '');
}
// ca sạch (thường và chạy chéo) phải ra gần đúng giá trị cài (valgus trái 8,7°, phải -0,4°; sụt hông khi trái trụ 6°, phải trụ 2°)
const C = ref['{}'];
for (const [nm, X] of [['sạch', C], ['chạy chéo sạch', ref[JSON.stringify(CROSS)]]]) {
  const want = { 'L.knee_valgus': 8.7, 'R.knee_valgus': -0.4, 'L.pelvic_drop': 6, 'R.pelvic_drop': 2 };
  for (const k in want) { const [s, m] = k.split('.'), v = X.per[s] ? X.per[s][m] : NaN; if (!(Math.abs(v - want[k]) <= 1.5)) { fail++; console.log(nm + ' lệch giá trị cài', k, v, 'cài', want[k]); } }
}
if (!process.env.GAIT) {
  assert.strictEqual(typeof Gait.fixBackLegs, 'function');
  assert.strictEqual(C.extra.legLabelUnstable, false, 'ca sạch không được báo nhãn chân không ổn định');
}
assert.strictEqual(fail, 0, fail + ' kiểm tra không đạt');
console.log('back.node.js: tất cả đạt');
