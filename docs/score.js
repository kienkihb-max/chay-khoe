/* Logic điểm dáng chạy (0-100), thuần JS, không DOM. Chạy trong trình duyệt (window.Score) và Node (module.exports).
 * Điểm mỗi chỉ số = 100 nếu trong khoảng bình thường (hoặc lệch phía không bị phạt: ref.side = low/high), giảm dần theo độ lệch (hết điểm khi lệch bằng một bề rộng khoảng).
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
  // Cờ tin cậy của một chỉ số trên một chân (sr = res[s] của Gait.computeSide). Chịu được trường thiếu.
  // Đọc dạng theo từng chỉ số (extra.flags[k] / sr.flags[k]: {lowConf, conf, spread, suspect, suspectReason}); không có thì rơi về dạng theo chân
  // (extra.lowConf, extra.spread[k], extra.icSuspect áp cho các chỉ số phụ thuộc mốc chạm đất).
  const IC_KEYS = ['knee_ic', 'shank_ic', 'overstride'];
  const IC_REASON = 'Mốc chạm đất có thể bắt sai (gối lúc chạm đất ngoài khoảng thường gặp, hoặc chân chạm sau hông nhiều)';
  function flagOf(sr, k) {
    const ex = (sr && sr.extra) || {}, mf = (ex.flags && ex.flags[k]) || (sr && sr.flags && sr.flags[k]) || {};
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const sp = mf.spread !== undefined ? mf.spread : (ex.spread && typeof ex.spread === 'object' ? ex.spread[k] : null);
    const suspect = mf.suspect != null ? !!mf.suspect : !!ex.icSuspect && IC_KEYS.includes(k);
    return {
      lowConf: mf.lowConf != null ? !!mf.lowConf : !!ex.lowConf,
      conf: num(mf.conf != null ? mf.conf : ex.conf), spread: num(sp),
      suspect, reason: suspect ? (mf.suspectReason || ex.suspectReason || IC_REASON) : '',
    };
  }
  // COUNT_LOWCONF (gait.js có thể gọi LOWCONF_IN_SCORE); mặc định false = chỉ số có cờ không tính vào điểm
  function countLow() { const g = getGait(); return !!(g && (g.COUNT_LOWCONF != null ? g.COUNT_LOWCONF : g.LOWCONF_IN_SCORE)); }
  function skipped(sr, k) { if (countLow()) return false; const f = flagOf(sr, k); return f.lowConf || f.suspect; }
  // Luật cờ theo chân (dùng chung điểm, kết luận, gợi ý, bài tập): trả về các chân CÒN DÙNG ĐƯỢC cho chỉ số k.
  // Mọi chỉ số (riêng chân lẫn chung: nhịp, dao động, thân): bỏ chân có cờ ở chỉ số đó, dùng chân còn lại; cả hai chân có cờ mới bỏ hẳn.
  // (Video quay ngang thì chân xa luôn mờ, bỏ cả chỉ số chung là bỏ oan.)
  function usableLegs(R, k) {
    const legs = ['L', 'R'].filter((s) => R && R.res && R.res[s]);
    return legs.filter((s) => !skipped(R.res[s], k));
  }
  // Giá trị chỉ số chung dùng để chấm/kết luận: đủ hai chân thì = R.comb.common[k]; một chân dùng được thì giá trị chân đó; không chân nào thì null.
  function commonVal(R, k) {
    const u = usableLegs(R, k);
    if (!u.length) return null;
    return u.length === ['L', 'R'].filter((s) => R.res[s]).length ? R.comb.common[k] : R.res[u[0]].metrics[k];
  }
  const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);

  function mScore(k, v) {
    const c = getRef()[k]; if (!c || c.lo == null || v == null || Number.isNaN(v)) return null;
    const w = c.hi - c.lo, sd = c.side || 'both';
    const dist = v < c.lo && sd !== 'high' ? c.lo - v : v > c.hi && sd !== 'low' ? v - c.hi : 0;
    return Math.round(100 * (1 - Math.min(1, dist / w)));
  }
  // Điểm góc ngang: R = kết quả Gait.computeBoth ({res:{L,R}, comb:{common}, q}). Giống hệt logic cũ của app.js.
  function side(R) {
    const out = { L: null, R: null, total: null };
    if (!R || (R.q && R.q.bad)) return out;
    const COMMON = (getGait() || {}).COMMON || [];
    for (const s of ['L', 'R']) {
      if (!R.res || !R.res[s]) continue;
      const v = SCORE_KEYS.map((k) => {
        const u = usableLegs(R, k);
        if (COMMON.includes(k)) return u.length ? mScore(k, commonVal(R, k)) : null;
        return u.includes(s) ? mScore(k, R.res[s].metrics[k]) : null;
      }).filter((q) => q != null);
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
  const api = { SCORE_KEYS, BACK_PERLEG, BACK_COMMON, mScore, flagOf, skipped, usableLegs, commonVal, countLow, side, back, combine, setRef: (m) => { refOverride = m; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Score = api;
})(typeof window !== 'undefined' ? window : globalThis);
