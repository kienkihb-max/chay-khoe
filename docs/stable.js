/* stable.js - chọn đoạn chạy ỔN ĐỊNH NHẤT trong một lần quay (mặc định 30 giây trong 1 phút).
 * Không phụ thuộc DOM, chạy được cả trong Node (tests/stable.node.js).
 *
 * Cách chấm một đoạn (điểm càng thấp càng ổn định):
 *   - nhịp chạy đều: độ lệch chuẩn của nhịp đo trên các khối 6 giây (bước/phút);
 *   - thấy rõ người: phạt số khung không nhận ra người hoặc khớp gối/cổ chân mờ;
 *   - đứng yên một chỗ trên máy: phạt hông trôi tới lui (so với chiều dài thân);
 *   - ngang nhau thì ưu tiên đoạn muộn hơn.
 * Đầu vào: frames = [{ t: giây, lm: [{x, y, v}] | null }] (toạ độ điểm ảnh, như S.frames), clip = độ dài đoạn cần chọn (giây).
 * Trả về: { t0, t1, from, to, total, cut, cad, cadSd, score }  (from/to tính từ đầu lần quay; cut = false khi lần quay không dài hơn clip).
 */
(function (root) {
  'use strict';
  var BLOCK = 6, HOP = 2, RATE = 60;
  var mean = function (a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : NaN; };
  var sd = function (a) { if (a.length < 2) return 0; var m = mean(a), s = 0; for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m); return Math.sqrt(s / (a.length - 1)); };
  var median = function (a) { if (!a.length) return NaN; var b = a.slice().sort(function (p, q) { return p - q; }); return b[Math.floor(b.length / 2)]; };

  // Đặc trưng mỗi khung: hông (x, y), chiều dài thân, khớp chân có rõ không
  function feat(f) {
    var lm = f.lm; if (!lm || !lm[23] || !lm[24]) return null;
    var vis = function (i) { return lm[i] ? (lm[i].v == null ? 1 : lm[i].v) : 0; };
    var a = lm[23], b = lm[24], va = vis(23), vb = vis(24);
    if (va < 0.3 && vb < 0.3) return null;
    var both = va >= 0.5 && vb >= 0.5, h = both ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : (va >= vb ? a : b);
    var sh = lm[11] && lm[12] ? { x: (lm[11].x + lm[12].x) / 2, y: (lm[11].y + lm[12].y) / 2 } : null;
    var leg = Math.max(Math.min(vis(25), vis(27)), Math.min(vis(26), vis(28)));   // chân rõ hơn trong hai chân: gối và cổ chân
    return { x: h.x, y: h.y, len: sh ? Math.hypot(sh.x - h.x, sh.y - h.y) : NaN, leg: leg };
  }

  // Nhịp chạy (bước/phút) của khối [t0, t0 + BLOCK] từ dao động lên xuống của hông; NaN nếu không rõ nhịp
  function cadBlock(ts, ys, t0) {
    var t1 = t0 + BLOCK, seg = [];
    for (var i = 0; i < ts.length; i++) if (ts[i] >= t0 && ts[i] <= t1) seg.push(i);
    if (seg.length < BLOCK * 10 || ts[seg[0]] - t0 > 0.7 || t1 - ts[seg[seg.length - 1]] > 0.7) return NaN;
    var n = BLOCK * RATE, y = new Float64Array(n), k = 0, m = 0, j;
    for (j = 0; j < n; j++) {
      var t = t0 + (j / n) * BLOCK;
      while (k < seg.length - 2 && ts[seg[k + 1]] < t) k++;
      var i0 = seg[k], i1 = seg[k + 1], g = ts[i1] - ts[i0];
      y[j] = ys[i0] + (ys[i1] - ys[i0]) * (g > 0 ? Math.max(0, Math.min(1, (t - ts[i0]) / g)) : 0); m += y[j];
    }
    m /= n;
    var sxy = 0, sxx = 0, mt = (n - 1) / 2;
    for (j = 0; j < n; j++) { sxy += (j - mt) * (y[j] - m); sxx += (j - mt) * (j - mt); }
    var sl = sxy / sxx; for (j = 0; j < n; j++) y[j] = y[j] - m - sl * (j - mt);
    var ac = function (L) { var s = 0; for (var q = 0; q + L < n; q++) s += y[q] * y[q + L]; return s / (n - L); };
    var a00 = ac(0); if (!(a00 > 0)) return NaN;
    var bl = 0, bv = -Infinity, ar = {};
    for (var L = 16; L <= 32; L++) { ar[L] = ac(L); if (ar[L] > bv) { bv = ar[L]; bl = L; } }   // 112–225 bước/phút
    if (bv / a00 < 0.3 || bl <= 16 || bl >= 32) return NaN;
    var y0 = ar[bl - 1], y1 = ar[bl], y2 = ar[bl + 1], den = y0 - 2 * y1 + y2, off = den !== 0 ? 0.5 * (y0 - y2) / den : 0;
    return 60 * RATE / (bl + off);
  }

  function pick(frames, clip) {
    frames = (frames || []).filter(function (f) { return f && typeof f.t === 'number'; });
    if (!frames.length) return { t0: 0, t1: 0, from: 0, to: 0, total: 0, cut: false, cad: NaN, cadSd: NaN, score: NaN };
    var T0 = frames[0].t, T1 = frames[frames.length - 1].t, total = T1 - T0;
    var whole = { t0: T0, t1: T1, from: 0, to: total, total: total, cut: false, cad: NaN, cadSd: NaN, score: NaN };
    if (!(clip > 0) || total <= clip + 1) return whole;
    var F = frames.map(feat), ts = [], ys = [], i;
    for (i = 0; i < frames.length; i++) if (F[i]) { ts.push(frames[i].t); ys.push(F[i].y); }
    var blocks = [];   // { c: tâm khối, cad }
    for (var b0 = T0; b0 + BLOCK <= T1 + 1e-6; b0 += HOP) blocks.push({ c: b0 + BLOCK / 2, cad: cadBlock(ts, ys, b0) });
    var best = null;
    for (var s = T0; s + clip <= T1 + 1e-6; s += 1) {
      var e = s + clip, n = 0, miss = 0, low = 0, xs = [], lens = [];
      for (i = 0; i < frames.length; i++) {
        var t = frames[i].t; if (t < s || t > e) continue;
        n++; var f = F[i];
        if (!f) { miss++; continue; }
        if (f.leg < 0.5) low++;
        xs.push(f.x); if (f.len > 0) lens.push(f.len);
      }
      if (!n) continue;
      var cads = [], nb = 0;
      for (i = 0; i < blocks.length; i++) if (blocks[i].c >= s + BLOCK / 2 - 1e-6 && blocks[i].c <= e - BLOCK / 2 + 1e-6) { nb++; if (!isNaN(blocks[i].cad)) cads.push(blocks[i].cad); }
      var cadSd = cads.length >= 3 ? sd(cads) : 15, inval = nb ? 1 - cads.length / nb : 1;
      var L = median(lens), drift = L > 0 && xs.length > 5 ? sd(xs) / L : 0;
      var score = cadSd + 30 * (miss / n) + 15 * (low / n) + 10 * inval + 20 * drift;
      score -= 0.01 * (s - T0);   // hai đoạn ổn định ngang nhau thì lấy đoạn muộn hơn (người chạy đã quen nhịp)
      if (!best || score < best.score - 1e-9) best = { t0: s, t1: e, from: s - T0, to: e - T0, total: total, cut: true, cad: mean(cads), cadSd: cads.length >= 3 ? cadSd : NaN, score: score };
    }
    return best || whole;
  }

  var api = { pick: pick, cadBlock: cadBlock };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Stable = api;
})(typeof window !== 'undefined' ? window : globalThis);
