/* Logic điểm dáng chạy (0-100), thuần JS, không DOM. Chạy trong trình duyệt (window.Score) và Node (module.exports).
 * Điểm mỗi chỉ số = 100 nếu trong khoảng bình thường, giảm dần theo độ lệch (hết điểm khi lệch bằng một bề rộng khoảng).
 * Cần: window.GAIT_REF (reference.js) và window.Gait (gait.js) khi chạy trong trình duyệt; trong Node dùng Score.setRef(...) hoặc global.GAIT_REF.
 * Chỉ đo 1 góc (ngang hoặc sau): tính riêng. Đo cả hai: trung bình 50/50 điểm ngang và điểm sau, áp cho trái/phải/tổng. */
(function (root) {
  const SCORE_KEYS = ['cadence', 'vert_osc', 'trunk', 'knee_ic', 'shank_ic', 'overstride', 'knee_mid', 'hip_ext', 'knee_swing'];
  const BACK_PERLEG = ['pelvic_drop', 'knee_valgus', 'foot_mid'];
  const BACK_COMMON = ['step_width', 'lat_trunk'];
  let refOverride = null;
  function getRef() { const g = refOverride || (root.GAIT_REF && root.GAIT_REF.metrics); return g || {}; }
  function getGait() {
    if (root.Gait) return root.Gait;
    if (typeof require === 'function') { try { return require('./gait.js'); } catch (e) { /* bỏ qua */ } }
    return null;
  }
  const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);

  function mScore(k, v) {
    const c = getRef()[k]; if (!c || c.lo == null || v == null || Number.isNaN(v)) return null;
    const w = c.hi - c.lo, dist = v < c.lo ? c.lo - v : v > c.hi ? v - c.hi : 0;
    return Math.round(100 * (1 - Math.min(1, dist / w)));
  }
  // Điểm góc ngang: R = kết quả Gait.computeBoth ({res:{L,R}, comb:{common}, q}). Giống hệt logic cũ của app.js.
  function side(R) {
    const out = { L: null, R: null, total: null };
    if (!R || (R.q && R.q.bad)) return out;
    const COMMON = (getGait() || {}).COMMON || [];
    for (const s of ['L', 'R']) {
      if (!R.res || !R.res[s]) continue;
      const v = SCORE_KEYS.map((k) => mScore(k, COMMON.includes(k) ? R.comb.common[k] : R.res[s].metrics[k])).filter((q) => q != null);
      if (v.length) out[s] = avg(v);
    }
    const t = [out.L, out.R].filter((q) => q != null);
    if (t.length) out.total = avg(t);
    return out;
  }
  // Điểm góc sau: B = kết quả Gait.computeBack ({per:{L?,R?}, common:{step_width, lat_trunk}}).
  // Mỗi chân = trung bình (chỉ số sau của chân đó + chỉ số sau chung); tổng = trung bình hai chân.
  function back(B) {
    const out = { L: null, R: null, total: null };
    if (!B || (B.q && B.q.bad)) return out;
    for (const s of ['L', 'R']) {
      if (!B.per || !B.per[s]) continue;
      const v = BACK_PERLEG.map((k) => mScore(k, B.per[s][k])).concat(BACK_COMMON.map((k) => mScore(k, B.common ? B.common[k] : null))).filter((q) => q != null);
      if (v.length) out[s] = avg(v);
    }
    const t = [out.L, out.R].filter((q) => q != null);
    if (t.length) out.total = avg(t);
    return out;
  }
  const has = (o) => !!o && (o.L != null || o.R != null || o.total != null);
  // Gộp: {side, back} là kết quả của Score.side / Score.back (hoặc null nếu không đo góc đó).
  function combine(o) {
    const sd = o && has(o.side) ? o.side : null, bk = o && has(o.back) ? o.back : null;
    const out = { L: null, R: null, total: null, side: sd, back: bk, backTemp: !!bk };
    for (const k of ['L', 'R', 'total']) {
      const v = [sd, bk].map((x) => (x ? x[k] : null)).filter((q) => q != null);
      if (v.length) out[k] = avg(v);
    }
    return out;
  }
  const api = { SCORE_KEYS, BACK_PERLEG, BACK_COMMON, mScore, side, back, combine, setRef: (m) => { refOverride = m; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Score = api;
})(typeof window !== 'undefined' ? window : globalThis);
