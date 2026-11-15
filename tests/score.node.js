// Chạy: node tests/score.node.js  (thang điểm lâm sàng 15/11/2026; in thêm phân bố hạng của ~5000 người phong trào mô phỏng)
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const win = {}; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../docs/reference.js'), 'utf8'), { window: win });
const REF = win.GAIT_REF.metrics;
const Score = require('../docs/score.js'); Score.setRef(REF);
const Gait = require('../docs/gait.js');
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, (msg || '') + ' ' + a + ' != ' + b);

// 1. Trọng số: tổng 100, khớp sơ đồ bác sĩ
const W = Score.WEIGHT; assert.strictEqual(Object.values(W).reduce((a, b) => a + b, 0), 100);
const gw = Object.fromEntries(Score.GROUPS.map((g) => [g.key, g.items.reduce((a, [, w]) => a + w, 0)]));
assert.deepStrictEqual(gw, { contact: 40, hip: 10, knee: 12, posture: 12, bounce: 14, balance: 12 });
assert.ok(!('arm_swing' in W) && !('strike' in W));

// 2. Mốc Tốt/Chú ý/Bất thường và đường dốc 100/85/55/0
const T = [['overstride', 10, 'ok'], ['overstride', 15, 'mid'], ['overstride', 20.5, 'bad'], ['overstride', -30, 'ok'],
  ['cadence', 165, 'ok'], ['cadence', 160, 'mid'], ['cadence', 154, 'bad'], ['cadence', 200, 'ok'],
  ['shank_ic', -5, 'ok'], ['shank_ic', 12, 'mid'], ['shank_ic', 16, 'bad'], ['knee_ic', 27, 'mid'], ['knee_ic', 7, 'mid'], ['knee_ic', 31, 'bad'], ['knee_ic', 4, 'bad'],
  ['hip_ext', 3, 'mid'], ['hip_ext', -1, 'bad'], ['hip_flex', 55, 'mid'], ['hip_flex', 60, 'bad'], ['knee_mid', 52, 'mid'], ['knee_swing', 80, 'mid'], ['knee_swing', 70, 'bad'],
  ['trunk', 2, 'mid'], ['trunk', -1, 'bad'], ['trunk', 13, 'mid'], ['trunk', 16, 'bad'], ['head_fwd', 25, 'mid'], ['elbow', 50, 'mid'], ['elbow', 130, 'bad'],
  ['vert_osc', 11, 'mid'], ['vert_osc', 13, 'bad'], ['contact_ms', 300, 'mid'], ['contact_ms', 340, 'bad'],
  ['leg_asym', 1.5, 'mid'], ['leg_asym', 2.5, 'bad'], ['step_asym', 6, 'mid'], ['contact_asym', 10, 'mid'], ['step_cv', 4, 'mid'], ['step_cv', 6, 'bad']];
T.forEach(([k, v, e]) => assert.strictEqual(Score.level(k, v), e, k + '=' + v));
near(Score.points('overstride', 10), 85); near(Score.points('overstride', 20), 55); near(Score.points('overstride', 30), 0); near(Score.points('overstride', 0), 100);
near(Score.points('cadence', 165), 85); near(Score.points('cadence', 155), 55); near(Score.points('cadence', 180), 100); near(Score.points('cadence', 145), 0);
near(Score.points('overstride', 15), 70);
assert.ok(Score.points('overstride', 8) > 85 && Score.points('overstride', 8) < 100);
assert.strictEqual(Score.points('overstride', NaN), null); assert.strictEqual(Score.level('cadence', null), null); assert.strictEqual(Score.points('pelvic_drop', 3), null);
for (const k of Object.keys(W)) {   // điểm luôn trong [0,100] và mức khớp điểm (Tốt ≥85, Chú ý 55–85, Bất thường ≤55)
  for (let v = -60; v <= 400; v += 0.25) {
    const q = Score.points(k, v), lv = Score.level(k, v);
    assert.ok(q >= 0 && q <= 100, k);
    assert.ok(lv === 'ok' ? q >= 85 - 1e-9 : lv === 'mid' ? q >= 55 - 1e-9 && q <= 85 + 1e-9 : q <= 55 + 1e-9, k + '=' + v + ' ' + lv + ' ' + q);
  }
}
// mScore cũ (lvLevel của app) khớp level mới; chỉ số góc sau giữ công thức cũ
assert.strictEqual(Score.mScore('overstride', 5), 100); assert.ok(Score.mScore('overstride', 15) > 0 && Score.mScore('overstride', 15) < 100); assert.strictEqual(Score.mScore('overstride', 25), 0);
assert.strictEqual(Score.mScore('cadence', 190), 100); assert.strictEqual(Score.mScore('cadence', null), null);
assert.strictEqual(Score.mScore('pelvic_drop', REF.pelvic_drop.lo), 100);
// hạng 6A
assert.deepStrictEqual([85, 84, 70, 69, 55, 54, 0].map((v) => Score.tierOf(v).key), ['good', 'fair', 'fair', 'improve', 'improve', 'risk', 'risk']);
assert.strictEqual(Score.tierOf(null), null);
// reference: chỉ số chưa có nguồn gắn tam (13A); câu overstride gợi ý TĂNG nhịp (AC6)
['contact_ms', 'step_cv', 'step_asym', 'contact_asym', 'hip_flex', 'elbow', 'head_fwd', 'leg_asym'].forEach((k) => assert.ok(REF[k].tam, 'tam ' + k));
assert.ok(/Tăng nhịp/.test(REF.overstride.high) && !/giảm cadence/i.test(REF.overstride.high));

// 3. Dựng kết quả góc ngang
const GOOD = { knee_ic: 18, shank_ic: 3, overstride: 2, knee_mid: 40, hip_ext: 12, knee_swing: 100 };
const EXG = { contact_ms: 240, hip_flex: 38, elbow: 85, head_fwd: 8 };
function mkR(o) {
  o = o || {};
  const res = {}, per = {};
  for (const s of ['L', 'R']) {
    if (o.only && o.only !== s) continue;
    const fl = (o.flag && o.flag[s]) || [], flags = {}, ef = {};
    fl.forEach((k) => { flags[k] = { lowConf: true }; ef[k] = { lowConf: true }; });
    res[s] = { metrics: Object.assign({}, GOOD, o[s]), extra: { flags } };
    per[s] = Object.assign({}, EXG, o['ex' + s], { flags: ef });
  }
  const common = Object.assign({ cadence: 175, vert_osc: 8, trunk: 7 }, o.common);
  return { q: o.bad ? { bad: true } : {}, res, comb: { common }, ex: o.noEx ? undefined : { per, common: Object.assign({ step_cv: 2, step_asym: 2, contact_asym: 3 }, o.exc), flags: o.exf || {} } };
}
let s = Score.side(mkR());
assert.strictEqual(s.total, 100); assert.strictEqual(s.L, 100); assert.strictEqual(s.R, 100);
assert.strictEqual(s.agg.cap, 100); assert.strictEqual(s.groups.length, 6); assert.ok(s.groups.every((g) => g.score === 100));
assert.strictEqual(Score.side(mkR({ bad: true })).total, null);
assert.deepStrictEqual([Score.side(null).total, Score.side({}).total], [null, null]);

// 4. 60% chân kém + 40% chân tốt (11A)
s = Score.side(mkR({ L: { overstride: 8 }, R: { overstride: 15 } }));
near(s.items.overstride.pts, 0.6 * 70 + 0.4 * Score.points('overstride', 8)); assert.strictEqual(s.items.overstride.level, 'mid');
assert.ok(s.L > s.R);

// 5. Chốt trần: 1 Bất thường ≤84, 2 ≤69, ≥3 ≤54, ≥3 Chú ý ≤84 (7A); chỉ số trọng số <5 không tính trần
s = Score.side(mkR({ common: { cadence: 150 } })); assert.strictEqual(s.agg.nBad, 1); assert.ok(s.total <= 84, 'cap1 ' + s.total);
s = Score.side(mkR({ common: { cadence: 150, vert_osc: 14 } })); assert.ok(s.total <= 69);
s = Score.side(mkR({ common: { cadence: 150, vert_osc: 14, trunk: 20 } })); assert.ok(s.total <= 54); assert.strictEqual(Score.tierOf(s.total).key, 'risk');
s = Score.side(mkR({ common: { cadence: 164, vert_osc: 10.5, trunk: 12 } })); assert.strictEqual(s.agg.nMid, 3); assert.ok(s.total <= 84);
s = Score.side(mkR({ common: { cadence: 164, vert_osc: 10.5 } })); assert.strictEqual(s.agg.cap, 100);
s = Score.side(mkR({ exL: { head_fwd: 50, elbow: 150 }, exR: { head_fwd: 50, elbow: 150 }, exc: { step_cv: 9 } }));
assert.strictEqual(s.agg.nBad, 0); assert.strictEqual(s.agg.cap, 100); assert.ok(s.total < 100 && s.total >= 90);

// 6. Cờ: bỏ chân có cờ, dùng chân còn lại; cả hai cờ thì loại và chia lại trọng số
s = Score.side(mkR({ R: { overstride: 30 }, flag: { R: ['overstride'] } }));
assert.strictEqual(s.items.overstride.pts, 100); assert.strictEqual(s.total, 100); assert.strictEqual(s.R, 100);
s = Score.side(mkR({ L: { overstride: 30 }, R: { overstride: 30 }, flag: { L: ['overstride'], R: ['overstride'] } }));
assert.strictEqual(s.items.overstride.excl, 'flag'); assert.strictEqual(s.agg.exclW, 13); assert.strictEqual(s.total, 100);
s = Score.side(mkR({ exL: { contact_ms: 400 }, exR: { contact_ms: 400 }, flag: { L: ['contact_ms'], R: ['contact_ms'] } }));
assert.strictEqual(s.items.contact_ms.excl, 'flag'); assert.strictEqual(s.total, 100);
s = Score.side(mkR({ exc: { step_cv: 9 }, exf: { step_cv: { lowConf: true } } })); assert.strictEqual(s.items.step_cv.excl, 'flag');
// loại > 40% trọng số -> không cho điểm
const all = ['knee_ic', 'shank_ic', 'overstride', 'knee_mid', 'hip_ext', 'knee_swing'];
s = Score.side(mkR({ flag: { L: all, R: all } })); assert.ok(s.agg.exclW > 40); assert.strictEqual(s.total, null); assert.strictEqual(s.insufficient, true);
const four = ['overstride', 'shank_ic', 'knee_ic', 'hip_ext'];
s = Score.side(mkR({ flag: { L: four, R: four } }));
assert.strictEqual(s.agg.exclW, 37); assert.ok(s.total != null);   // 13+10+6+8 = 37% < 40%: vẫn cho điểm
s = Score.side(mkR({ flag: { L: four.concat('knee_mid'), R: four.concat('knee_mid') } }));
assert.strictEqual(s.agg.exclW, 45); assert.strictEqual(s.total, null);
// bản lưu cũ không có ex: các chỉ số ex bị coi là thiếu (17 điểm) -> vẫn cho điểm
s = Score.side(mkR({ noEx: true })); assert.strictEqual(s.agg.exclW, 2 + 2 + 2 + 5 + 3 + 2 + 1); assert.strictEqual(s.total, 100);
// một chân: leg_asym thiếu
s = Score.side(mkR({ only: 'L' })); assert.strictEqual(s.items.leg_asym.excl, 'missing'); assert.strictEqual(s.total, 100); assert.strictEqual(s.R, null);

// 7. Chênh hai chân = max |L−R| / Gait.ASYM
s = Score.side(mkR({ L: { knee_mid: 40 }, R: { knee_mid: 52 } }));
near(s.items.leg_asym.v, 12 / Gait.ASYM.knee_mid); assert.strictEqual(s.items.leg_asym.level, 'mid');

// 8. Góc sau giữ thang cũ; mặc định không vào điểm
const bOk = { per: { L: { pelvic_drop: 2, knee_valgus: 3, foot_mid: 5 }, R: { pelvic_drop: 12, knee_valgus: 3, foot_mid: 5 } }, common: { step_width: 8, lat_trunk: 4 } };
const bk = Score.back(bOk);
assert.strictEqual(bk.L, 100); assert.strictEqual(bk.R, Math.round((Score.mScore('pelvic_drop', 12) + 400) / 5));
assert.deepStrictEqual(Score.back(null), { L: null, R: null, total: null });
const sd = Score.side(mkR({ R: { overstride: 15 } }));
let c = Score.combine({ side: sd, back: bk });
assert.deepStrictEqual([c.L, c.R, c.total, c.back, c.backTemp], [sd.L, sd.R, sd.total, null, false]); assert.strictEqual(c.backHidden, bk);
assert.strictEqual(c.tier.key, Score.tierOf(sd.total).key);
c = Score.combine({ side: null, back: bk }); assert.strictEqual(c.total, null);
Score.setBackInScore(true);
c = Score.combine({ side: sd, back: bk }); assert.strictEqual(c.total, Math.round((sd.total + bk.total) / 2)); assert.ok(c.backTemp);
Score.setBackInScore(false);

// 9. Mô phỏng ~5000 người chạy phong trào (nhịp 164±8, chân đặt trước hông 13±6 cm, 30% chân xa có cờ)
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const gauss = (m, sdv) => { const u = 1 - rnd(), v = rnd(); return m + sdv * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const N = 5000, dist = { good: 0, fair: 0, improve: 0, risk: 0, none: 0 }, totals = [];
for (let i = 0; i < N; i++) {
  const cad = gauss(164, 8), ov = gauss(13, 6);
  // giá trị riêng chân = mức của người đó + lệch nhỏ giữa hai chân (hai chân của một người gần nhau)
  const base = { overstride: ov, shank_ic: 2 + 0.45 * ov + gauss(0, 3), knee_ic: gauss(18, 5), knee_mid: gauss(41, 5), hip_ext: gauss(10, 5), knee_swing: gauss(100, 15) };
  const LN = { overstride: 2, shank_ic: 1.5, knee_ic: 2, knee_mid: 2, hip_ext: 2, knee_swing: 5 };
  const leg = () => Object.fromEntries(Object.keys(base).map((k) => [k, base[k] + gauss(0, LN[k])]));
  const exLeg = () => ({ contact_ms: gauss(275, 25), hip_flex: gauss(38, 7), elbow: gauss(85, 15), head_fwd: Math.abs(gauss(12, 8)) });
  const far = rnd() < 0.5 ? 'L' : 'R', flagged = rnd() < 0.3;
  const o = { L: leg(), R: leg(), exL: exLeg(), exR: exLeg(), common: { cadence: cad, vert_osc: gauss(8.5, 1.5), trunk: gauss(7, 3) },
    exc: { step_cv: Math.abs(gauss(2.5, 1)), step_asym: Math.abs(gauss(3, 2)), contact_asym: Math.abs(gauss(4, 3)) } };
  if (flagged) o.flag = { [far]: all.concat(['contact_ms', 'hip_flex', 'elbow', 'head_fwd']) };
  const t = Score.side(mkR(o)).total;
  if (t == null) dist.none++; else { dist[Score.tierOf(t).key]++; totals.push(t); }
}
totals.sort((a, b) => a - b);
const pct = (n) => (100 * n / N).toFixed(1) + '%';
console.log('Mô phỏng ' + N + ' người: Tốt ' + pct(dist.good) + ', Khá ' + pct(dist.fair) + ', Cần cải thiện ' + pct(dist.improve) + ', Nguy cơ ' + pct(dist.risk) + ', không điểm ' + pct(dist.none) + '; trung vị ' + totals[totals.length >> 1]);
assert.ok(dist.good / N > 0.2 && dist.good / N < 0.5, 'tỉ lệ Tốt lệch xa 1/3');
console.log('score.node.js: OK');
