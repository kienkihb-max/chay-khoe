// Chạy: node tests/score.node.js
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const win = {}; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../docs/reference.js'), 'utf8'), { window: win });
const REF = win.GAIT_REF.metrics;
const Score = require('../docs/score.js'); Score.setRef(REF);
const Gait = require('../docs/gait.js');
// logic cũ chép nguyên từ app.js để so khớp
const KEYS = ['cadence', 'vert_osc', 'trunk', 'knee_ic', 'shank_ic', 'overstride', 'knee_mid', 'hip_ext', 'knee_swing'];
function mOld(k, v) { if (['cadence','vert_osc','overstride'].includes(k) && v != null && !Number.isNaN(v)) { const c = REF[k], w = c.hi - c.lo, d = c.side === 'low' ? Math.max(0, c.lo - v) : Math.max(0, v - c.hi); return Math.round(100 * (1 - Math.min(1, d / w))); } const c = REF[k]; if (!c || c.lo == null || v == null || Number.isNaN(v)) return null; const w = c.hi - c.lo, d = v < c.lo ? c.lo - v : v > c.hi ? v - c.hi : 0; return Math.round(100 * (1 - Math.min(1, d / w))); }
function oldScores(R) {
  const out = { L: null, R: null, total: null }; if (R.q && R.q.bad) return out;
  for (const s of ['L', 'R']) { if (!R.res[s]) continue;
    const v = KEYS.map((k) => mOld(k, Gait.COMMON.includes(k) ? R.comb.common[k] : R.res[s].metrics[k])).filter((q) => q != null);
    if (v.length) out[s] = Math.round(v.reduce((x, y) => x + y, 0) / v.length); }
  const t = [out.L, out.R].filter((q) => q != null); if (t.length) out.total = Math.round(t.reduce((x, y) => x + y, 0) / t.length); return out;
}
const mk = (o) => { const m = {}; KEYS.forEach((k) => { if (!Gait.COMMON.includes(k)) m[k] = o[k]; }); return m; };
const sideR = (a, b, c, bad) => ({ q: bad ? { bad: true } : {}, comb: { common: { cadence: c.cadence, vert_osc: c.vert_osc, trunk: c.trunk } }, res: { L: a ? { metrics: a } : undefined, R: b ? { metrics: b } : undefined } });
const good = { knee_ic: 18, shank_ic: 5, overstride: 3, knee_mid: 40, hip_ext: 12, knee_swing: 100 };
const bad = { knee_ic: 40, shank_ic: 20, overstride: 30, knee_mid: 10, hip_ext: 0, knee_swing: 60 };
const cases = [
  sideR(good, good, { cadence: 172, vert_osc: 8, trunk: 7 }),
  sideR(good, bad, { cadence: 150, vert_osc: 12, trunk: 2 }),
  sideR(bad, null, { cadence: 172, vert_osc: 8, trunk: 7 }),
  sideR({ knee_ic: NaN, shank_ic: null }, good, { cadence: NaN, vert_osc: 8, trunk: 7 }),
  sideR(good, good, { cadence: 172, vert_osc: 8, trunk: 7 }, true),
];
cases.forEach((R, i) => assert.deepStrictEqual(Score.side(R), oldScores(R), 'side case ' + i));
assert.deepStrictEqual(Score.side(cases[4]), { L: null, R: null, total: null });
assert.strictEqual(Score.side(cases[0]).total, 100);
assert.deepStrictEqual(Score.side(sideR({}, null, { cadence: NaN, vert_osc: NaN, trunk: NaN })), { L: null, R: null, total: null });

// phạt một phía (câu 54): cadence chỉ thấp, vert_osc/overstride chỉ cao
assert.strictEqual(REF.cadence.side, 'low'); assert.strictEqual(REF.vert_osc.side, 'high'); assert.strictEqual(REF.overstride.side, 'high');
assert.strictEqual(Score.mScore('cadence', 190), 100); assert.ok(Score.mScore('cadence', 160) < 100);
assert.strictEqual(Score.mScore('vert_osc', 5), 100); assert.ok(Score.mScore('vert_osc', 11) < 100);
assert.strictEqual(Score.mScore('overstride', -3), 100); assert.strictEqual(Score.mScore('overstride', -20), 100); assert.ok(Score.mScore('overstride', 12) < 100);
assert.ok(Score.mScore('trunk', 1) < 100 && Score.mScore('trunk', 14) < 100);

// góc sau
const bOk = { per: { L: { pelvic_drop: 2, knee_valgus: 3, foot_mid: 5 }, R: { pelvic_drop: 12, knee_valgus: 3, foot_mid: 5 } }, common: { step_width: 8, lat_trunk: 4 } };
const bk = Score.back(bOk);
assert.strictEqual(bk.L, 100); assert.strictEqual(bk.R, Math.round((Score.mScore("pelvic_drop", 12) + 400) / 5)); 
assert.strictEqual(bk.total, Math.round((bk.L + bk.R) / 2));
const bOne = Score.back({ per: { L: bOk.per.L }, common: { step_width: NaN, lat_trunk: 4 } });
assert.deepStrictEqual(bOne, { L: 100, R: null, total: 100 });
assert.deepStrictEqual(Score.back(null), { L: null, R: null, total: null });
assert.deepStrictEqual(Score.back({ per: { L: { pelvic_drop: NaN, knee_valgus: null, foot_mid: undefined } }, common: { step_width: NaN, lat_trunk: NaN } }), { L: null, R: null, total: null });

// gộp
const sd = Score.side(cases[1]);
let c = Score.combine({ side: sd, back: null });
assert.deepStrictEqual([c.L, c.R, c.total, c.back, c.backTemp], [sd.L, sd.R, sd.total, null, false]); assert.deepStrictEqual(c.side, sd);
c = Score.combine({ side: null, back: bk });
assert.deepStrictEqual([c.L, c.R, c.total, c.side, c.backTemp], [bk.L, bk.R, bk.total, null, true]);
c = Score.combine({ side: sd, back: bk });
assert.strictEqual(c.L, Math.round((sd.L + bk.L) / 2)); assert.strictEqual(c.R, Math.round((sd.R + bk.R) / 2)); assert.strictEqual(c.total, Math.round((sd.total + bk.total) / 2));
assert.ok(c.backTemp && c.side && c.back);
// thiếu: ngang chỉ có chân L, sau có cả hai -> R lấy từ sau
c = Score.combine({ side: Score.side(cases[2]), back: bk });
assert.strictEqual(c.R, bk.R); assert.strictEqual(c.L, Math.round((Score.side(cases[2]).L + bk.L) / 2));
// ngang bị đánh dấu xấu -> coi như không có ngang
c = Score.combine({ side: Score.side(cases[4]), back: bk });
assert.strictEqual(c.side, null); assert.strictEqual(c.total, bk.total);
c = Score.combine({ side: null, back: null });
assert.deepStrictEqual([c.L, c.R, c.total, c.side, c.back, c.backTemp], [null, null, null, null, null, false]);
c = Score.combine();
assert.strictEqual(c.total, null);
console.log('score.node.js: tất cả đạt');
