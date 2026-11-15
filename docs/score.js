/* Logic điểm dáng chạy (0-100), thuần JS, không DOM. Chạy trong trình duyệt (window.Score) và Node (module.exports).
 * Thang lâm sàng (bác sĩ duyệt 15/11/2026, 6A–13A), chỉ góc ngang:
 * - Ngưỡng Tốt / Chú ý / Bất thường ở reference.js (lo/hi/side = Tốt, warn = mép ngoài Chú ý), mốc cố định (8A).
 * - Điểm mỗi chỉ số theo đường dốc liền: 100 ở vùng tối ưu, 85 ở mép Tốt, 55 ở mép Bất thường, về 0 sau thêm một bề rộng vùng Chú ý.
 * - Chỉ số riêng chân = 60% chân kém + 40% chân tốt (11A). Tổng = trung bình có trọng số (GROUPS, tổng 100).
 * - Chỉ số có cờ tin cậy hoặc không đo được bị loại, chia lại trọng số; loại > 40% trọng số thì không cho điểm.
 * - Chốt trần (chỉ số trọng số ≥ 5): 1 Bất thường ≤ 84, 2 ≤ 69, ≥ 3 ≤ 54; ≥ 3 chỉ số ở mức Chú ý trở xuống ≤ 84 (7A).
 * - Góc sau lưng KHÔNG vào điểm (bác sĩ: tạm ẩn); bật lại bằng Score.setBackInScore(true) để gộp 50/50 như cũ.
 * Cần: window.GAIT_REF (reference.js) và window.Gait (gait.js) khi chạy trong trình duyệt; trong Node dùng Score.setRef(...) hoặc global.GAIT_REF. */
(function (root) {
  // Danh sách chỉ số góc ngang của thang cũ (giữ cho chỗ cũ đang đọc).
  const SCORE_KEYS = ['cadence', 'vert_osc', 'trunk', 'knee_ic', 'shank_ic', 'overstride', 'knee_mid', 'hip_ext', 'knee_swing'];
  const BACK_PERLEG = ['pelvic_drop', 'knee_valgus', 'foot_mid'];
  const BACK_COMMON = ['step_width', 'lat_trunk'];
  // Nhóm và trọng số (tổng 100). show: chỉ hiển thị, không tính điểm (vung tay; kiểu tiếp đất 12A nằm ở extra.strike).
  const GROUPS = [
    { key: 'contact', label: 'Tiếp đất & nhịp', items: [['overstride', 13], ['cadence', 11], ['shank_ic', 10], ['knee_ic', 6]], show: ['strike'] },
    { key: 'hip', label: 'Hông', items: [['hip_ext', 8], ['hip_flex', 2]] },
    { key: 'knee', label: 'Gối', items: [['knee_mid', 8], ['knee_swing', 4]] },
    { key: 'posture', label: 'Thân, đầu, tay', items: [['trunk', 8], ['head_fwd', 2], ['elbow', 2]], show: ['arm_swing'] },
    { key: 'bounce', label: 'Nảy & chạm đất', items: [['vert_osc', 9], ['contact_ms', 5]] },
    { key: 'balance', label: 'Cân bằng', items: [['leg_asym', 6], ['step_asym', 3], ['contact_asym', 2], ['step_cv', 1]] },
  ];
  const WEIGHT = {}, GROUP_OF = {};
  for (const g of GROUPS) for (const [k, w] of g.items) { WEIGHT[k] = w; GROUP_OF[k] = g.key; }
  const TOTAL_W = Object.values(WEIGHT).reduce((a, b) => a + b, 0);
  const MAJOR_W = 5, MAX_EXCL = 0.4, LEG_WORSE = 0.6, OPT_FRAC = 0.25;
  // Hạng (6A). Màu do giao diện tự gán theo key.
  const TIERS = [
    { min: 85, key: 'good', label: 'Tốt' },
    { min: 70, key: 'fair', label: 'Khá' },
    { min: 55, key: 'improve', label: 'Cần cải thiện' },
    { min: 0, key: 'risk', label: 'Nguy cơ' },
  ];
  const tierOf = (v) => (v == null || Number.isNaN(v) ? null : TIERS.find((t) => v >= t.min) || TIERS[TIERS.length - 1]);
  const EX_PER = ['contact_ms', 'hip_flex', 'elbow', 'head_fwd'], EX_COMMON = ['step_cv', 'step_asym', 'contact_asym'];

  let refOverride = null, backInScore = false;
  function getRef() { const g = refOverride || (root.GAIT_REF && root.GAIT_REF.metrics); return g || {}; }
  function getGait() {
    if (root.Gait) return root.Gait;
    if (typeof require === 'function') { try { return require('./gait.js'); } catch (e) { /* bỏ qua */ } }
    return null;
  }
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  // Cờ tin cậy của một chỉ số trên một chân (sr = res[s] của Gait.computeSide, hoặc ex.per[s] của Gait.computeExtra). Chịu được trường thiếu.
  // Đọc dạng theo từng chỉ số (extra.flags[k] / sr.flags[k]: {lowConf, conf, spread, suspect, suspectReason}); không có thì rơi về dạng theo chân
  // (extra.lowConf, extra.spread[k], extra.icSuspect áp cho các chỉ số phụ thuộc mốc chạm đất).
  const IC_KEYS = ['knee_ic', 'shank_ic', 'overstride'];
  const IC_REASON = 'Mốc chạm đất có thể bắt sai (chân chạm sau hông nhiều)';
  function flagOf(sr, k) {
    const ex = (sr && sr.extra) || {}, mf = (ex.flags && ex.flags[k]) || (sr && sr.flags && sr.flags[k]) || {};
    const sp = mf.spread !== undefined ? mf.spread : (ex.spread && typeof ex.spread === 'object' ? ex.spread[k] : null);
    const suspect = mf.suspect != null ? !!mf.suspect : !!ex.icSuspect && IC_KEYS.includes(k);
    return {
      lowConf: mf.lowConf != null ? !!mf.lowConf : !!ex.lowConf,
      conf: num(mf.conf != null ? mf.conf : ex.conf) ? (mf.conf != null ? mf.conf : ex.conf) : null, spread: num(sp) ? sp : null,
      suspect, reason: suspect ? (mf.suspectReason || ex.suspectReason || IC_REASON) : '',
    };
  }
  // COUNT_LOWCONF (gait.js có thể gọi LOWCONF_IN_SCORE); mặc định false = chỉ số có cờ không tính vào điểm
  function countLow() { const g = getGait(); return !!(g && (g.COUNT_LOWCONF != null ? g.COUNT_LOWCONF : g.LOWCONF_IN_SCORE)); }
  function skipped(sr, k) { if (countLow()) return false; const f = flagOf(sr, k); return f.lowConf || f.suspect; }
  // Luật cờ theo chân (dùng chung điểm, kết luận, gợi ý, bài tập): trả về các chân CÒN DÙNG ĐƯỢC cho chỉ số k (chỉ số trong R.res).
  // Bỏ chân có cờ ở chỉ số đó, dùng chân còn lại; cả hai chân có cờ mới bỏ hẳn (video quay ngang thì chân xa luôn mờ).
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

  // ---------- Ngưỡng và điểm một chỉ số ----------
  // band(k): {good:[lo,hi], warn:[lo,hi], opt:[lo,hi]} (null = không giới hạn phía đó); null nếu chỉ số không có thang mới (thiếu warn).
  function band(k) {
    const c = getRef()[k]; if (!c || !Array.isArray(c.warn) || c.lo == null || c.hi == null) return null;
    const sd = c.side || 'both';
    const good = [sd === 'high' ? null : c.lo, sd === 'low' ? null : c.hi], warn = [c.warn[0], c.warn[1]];
    const gw = good[0] != null && good[1] != null ? good[1] - good[0] : Infinity;
    const inset = (i) => (good[i] == null ? null : Math.min(OPT_FRAC * (warn[i] != null ? Math.abs(good[i] - warn[i]) : gw), gw / 2));
    const opt = Array.isArray(c.opt) ? [c.opt[0], c.opt[1]] : [good[0] == null ? null : good[0] + inset(0), good[1] == null ? null : good[1] - inset(1)];
    return { good, warn, opt, tam: !!c.tam };
  }
  // Điểm một phía: d = khoảng cách vào trong tính từ mép Tốt (âm = ra ngoài), o = độ lùi tới vùng tối ưu, W = bề rộng vùng Chú ý.
  function edgePts(d, o, W) {
    if (d >= o) return 100;
    if (d >= 0) return o > 0 ? 85 + (15 * d) / o : 100;
    if (!(W > 0)) return 0;
    if (d >= -W) return 85 + (30 * d) / W;
    return Math.max(0, 55 + (55 * (d + W)) / W);
  }
  // Điểm liên tục 0–100 (không làm tròn); null nếu không có thang mới hoặc không đo được.
  function points(k, v) {
    const b = band(k); if (!b || !num(v)) return null;
    let p = 100;
    if (b.good[0] != null) p = Math.min(p, edgePts(v - b.good[0], b.opt[0] - b.good[0], b.warn[0] != null ? b.good[0] - b.warn[0] : 0));
    if (b.good[1] != null) p = Math.min(p, edgePts(b.good[1] - v, b.good[1] - b.opt[1], b.warn[1] != null ? b.warn[1] - b.good[1] : 0));
    return p;
  }
  const inR = (v, r) => (r[0] == null || v >= r[0]) && (r[1] == null || v <= r[1]);
  // Mức: 'ok' (Tốt) | 'mid' (Chú ý) | 'bad' (Bất thường) | null.
  function level(k, v) { const b = band(k); if (!b || !num(v)) return null; return inR(v, b.good) ? 'ok' : inR(v, b.warn) ? 'mid' : 'bad'; }
  // Tương thích app.js cũ (lvLevel: 100 = Tốt, 1–99 = Chú ý, 0 = Bất thường).
  // Chỉ số có thang mới: theo level(); chỉ số khác (góc sau lưng): công thức cũ theo lo/hi/side.
  function mScore(k, v) {
    if (band(k)) { const lv = level(k, v); return lv == null ? null : lv === 'ok' ? 100 : lv === 'bad' ? 0 : Math.max(1, Math.min(99, Math.round(points(k, v)))); }
    const c = getRef()[k]; if (!c || c.lo == null || v == null || Number.isNaN(v)) return null;
    const w = c.hi - c.lo, sd = c.side || 'both';
    const dist = v < c.lo && sd !== 'high' ? c.lo - v : v > c.hi && sd !== 'low' ? v - c.hi : 0;
    return Math.round(100 * (1 - Math.min(1, dist / w)));
  }

  // ---------- Đánh giá từng chỉ số trên kết quả góc ngang ----------
  const RANK = { ok: 0, mid: 1, bad: 2 };
  const worse = (a, b) => (a == null ? b : b == null ? a : RANK[a] >= RANK[b] ? a : b);
  const sidesOf = (R) => ['L', 'R'].filter((s) => R.res && R.res[s]);
  function exLegSkip(R, s, k) {
    const e = R.ex && R.ex.per && R.ex.per[s];
    if (e && e.flags) return skipped(e, k);
    return !countLow() && !!(R.res[s] && R.res[s].extra && R.res[s].extra.lowConf);   // bản lưu cũ chưa có cờ: theo cờ chân
  }
  // Chênh hai chân: max |trái − phải| / Gait.ASYM[k] trên các chỉ số riêng chân mà cả hai chân dùng được.
  function legAsym(R) {
    const G = getGait(), A = (G && G.ASYM) || {}, sd = sidesOf(R);
    if (sd.length < 2) return { v: null, flag: false };
    let v = null, any = false;
    for (const k of Object.keys(A)) {
      const a = R.res.L.metrics[k], b = R.res.R.metrics[k]; if (!num(a) || !num(b)) continue;
      any = true; if (usableLegs(R, k).length < 2) continue;
      v = Math.max(v == null ? 0 : v, Math.abs(a - b) / A[k]);
    }
    return { v, flag: v == null && any };
  }
  const mkLeg = (k, v, used) => ({ v, used, pts: used ? points(k, v) : null, level: used ? level(k, v) : null });
  // Một chỉ số: {k, w, group, kind, legs?, v?, pts, level, excl: null | 'flag' | 'missing'}. pts/level = giá trị dùng cho điểm tổng.
  function evalMetric(R, k) {
    const G = getGait() || {}, it = { k, w: WEIGHT[k] || 0, group: GROUP_OF[k] || null, pts: null, level: null, excl: null };
    const perRes = (G.PERLEG || []).includes(k) || (!G.PERLEG && IC_KEYS.concat(['knee_mid', 'hip_ext', 'knee_swing']).includes(k));
    if (perRes || EX_PER.includes(k)) {
      it.kind = 'leg'; it.legs = {};
      const use = perRes ? usableLegs(R, k) : sidesOf(R).filter((s) => !exLegSkip(R, s, k));
      for (const s of sidesOf(R)) {
        const v = perRes ? R.res[s].metrics[k] : (R.ex && R.ex.per && R.ex.per[s] ? R.ex.per[s][k] : null);
        it.legs[s] = mkLeg(k, num(v) ? v : null, num(v) && use.includes(s));
      }
      const ok = Object.values(it.legs).filter((l) => l.used && l.pts != null);
      if (!ok.length) { it.excl = Object.values(it.legs).some((l) => l.v != null) ? 'flag' : 'missing'; return it; }
      const p = ok.map((l) => l.pts).sort((a, b) => a - b);
      it.pts = p.length > 1 ? LEG_WORSE * p[0] + (1 - LEG_WORSE) * p[p.length - 1] : p[0];
      it.level = ok.reduce((a, l) => worse(a, l.level), null);   // mức của chân kém (khớp thẻ hiển thị chân kém nhất)
      return it;
    }
    it.kind = 'common';
    let v = null, flag = false;
    if (k === 'leg_asym') { const a = legAsym(R); v = a.v; flag = a.flag; }
    else if (EX_COMMON.includes(k)) { const e = R.ex || {}; v = e.common ? e.common[k] : null; flag = num(v) && skipped({ flags: e.flags || {} }, k); }
    else if (sidesOf(R).length && R.comb) { v = commonVal(R, k); flag = !usableLegs(R, k).length; }
    it.v = num(v) ? v : null;
    if (flag) { it.excl = 'flag'; return it; }
    if (it.v == null || points(k, it.v) == null) { it.excl = 'missing'; return it; }
    it.pts = points(k, it.v); it.level = level(k, it.v);
    return it;
  }
  // Gộp danh sách [{w, pts, level}] thành điểm: chia lại trọng số, luật loại > 40%, chốt trần.
  function aggregate(list) {
    let sw = 0, s = 0, ex = 0, nBad = 0, nMid = 0;
    for (const it of list) {
      if (it.pts == null) { ex += it.w; continue; }
      sw += it.w; s += it.w * it.pts;
      if (it.w >= MAJOR_W) { if (it.level === 'bad') nBad++; else if (it.level === 'mid') nMid++; }
    }
    const exclW = Math.round(ex * 10) / 10, out = { score: null, raw: null, cap: 100, nBad, nMid, exclW, insufficient: false };
    if (!sw || ex / TOTAL_W > MAX_EXCL) { out.insufficient = true; return out; }
    out.raw = s / sw;
    out.cap = nBad >= 3 ? 54 : nBad === 2 ? 69 : nBad === 1 ? 84 : nBad + nMid >= 3 ? 84 : 100;
    out.score = Math.min(Math.round(out.raw), out.cap);
    return out;
  }
  // Toàn bộ chi tiết điểm góc ngang. R = S.result góc ngang ({res:{L,R}, comb:{common}, ex?, q}).
  function sideDetail(R) {
    const out = { L: null, R: null, total: null, items: {}, groups: [], agg: null, legAgg: { L: null, R: null }, insufficient: false };
    if (!R || (R.q && R.q.bad) || !R.res || !sidesOf(R).length) return out;
    const items = Object.keys(WEIGHT).map((k) => evalMetric(R, k));
    for (const it of items) out.items[it.k] = it;
    out.agg = aggregate(items); out.total = out.agg.score; out.insufficient = out.agg.insufficient;
    for (const s of sidesOf(R)) {   // điểm riêng một chân: chỉ số riêng chân lấy đúng chân đó, chỉ số chung dùng chung
      const a = aggregate(items.map((it) => (it.kind === 'leg' ? { w: it.w, pts: it.legs[s] && it.legs[s].used ? it.legs[s].pts : null, level: it.legs[s] ? it.legs[s].level : null } : it)));
      out.legAgg[s] = a; out[s] = a.score;
    }
    out.groups = GROUPS.map((g) => {
      const its = g.items.map(([k]) => out.items[k]).filter((it) => it.pts != null), w = its.reduce((a, it) => a + it.w, 0);
      return { key: g.key, label: g.label, w: g.items.reduce((a, [, x]) => a + x, 0), wUsed: w, score: w ? Math.round(its.reduce((a, it) => a + it.w * it.pts, 0) / w) : null };
    });
    return out;
  }
  // Điểm góc ngang (API cũ, thêm trường): {L, R, total} + chi tiết của sideDetail.
  function side(R) { return sideDetail(R); }
  // Điểm góc sau: B = kết quả Gait.computeBack ({per:{L?,R?}, common:{step_width, lat_trunk}}). Giữ nguyên thang cũ (chưa duyệt).
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
  // Mặc định (backInScore = false): điểm chỉ lấy góc ngang; điểm góc sau để ở backHidden, không hiện. Bật lại: trung bình 50/50 như cũ.
  function combine(o) {
    const sd = o && has(o.side) ? o.side : null, bk0 = o && has(o.back) ? o.back : null, bk = backInScore ? bk0 : null;
    const out = { L: null, R: null, total: null, side: sd, back: bk, backTemp: !!bk, backHidden: backInScore ? null : bk0 };
    for (const k of ['L', 'R', 'total']) {
      const v = [sd, bk].map((x) => (x ? x[k] : null)).filter((q) => q != null);
      if (v.length) out[k] = avg(v);
    }
    out.tier = tierOf(out.total);
    return out;
  }
  const api = {
    SCORE_KEYS, BACK_PERLEG, BACK_COMMON, GROUPS, WEIGHT, TIERS, MAJOR_W, MAX_EXCL,
    mScore, points, level, band, tierOf, flagOf, skipped, usableLegs, commonVal, countLow, evalMetric, legAsym, aggregate,
    side, sideDetail, back, combine,
    setRef: (m) => { refOverride = m; }, setBackInScore: (b) => { backInScore = !!b; }, backInScore: () => backInScore,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Score = api;
})(typeof window !== 'undefined' ? window : globalThis);
