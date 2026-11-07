/* gait.js - lõi đo dáng chạy 2D (cả hai chân), port từ gait_screen.py.
 * Dữ liệu vào: P = { x:[33][N], y:[33][N], v:[33][N] } đã lấy mẫu đều ở `fps`.
 * Chạy được trong trình duyệt (window.Gait) và Node (module.exports) để kiểm thử. */
(function (root) {
  'use strict';

  const IDX = {
    L: { sh: 11, hip: 23, knee: 25, ank: 27, heel: 29, toe: 31 },
    R: { sh: 12, hip: 24, knee: 26, ank: 28, heel: 30, toe: 32 },
  };
  const RATIO = 0.245 + 0.246; // Winter: đùi + cẳng chân / chiều cao
  const COMMON = ['cadence', 'vert_osc', 'trunk'];
  const PERLEG = ['knee_ic', 'shank_ic', 'overstride', 'knee_mid', 'hip_ext', 'knee_swing'];
  const ASYM = { knee_ic: 6, shank_ic: 6, overstride: 5, knee_mid: 8, hip_ext: 6, knee_swing: 10 };

  // ---------- tiện ích số ----------
  function median(v) {
    const a = Array.from(v).filter((x) => !Number.isNaN(x)).sort((p, q) => p - q);
    if (!a.length) return NaN;
    const m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  function percentile(arr, p) {
    const s = Array.from(arr).sort((a, b) => a - b);
    const idx = (p / 100) * (s.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return s[lo] + (s[hi] - s[lo]) * (idx - lo);
  }
  function interpNaN(a) {
    const n = a.length, out = Float64Array.from(a);
    let first = -1, cnt = 0;
    for (let i = 0; i < n; i++) if (!Number.isNaN(out[i])) { cnt++; if (first < 0) first = i; }
    if (cnt < 2) throw new Error('Không nhận diện được người trong video (thiếu khung xương).');
    let prev = -1;
    for (let i = 0; i < n; i++) {
      if (!Number.isNaN(a[i])) { prev = i; continue; }
      let nxt = -1;
      for (let j = i + 1; j < n; j++) if (!Number.isNaN(a[j])) { nxt = j; break; }
      if (prev < 0) out[i] = a[nxt];
      else if (nxt < 0) out[i] = a[prev];
      else out[i] = a[prev] + ((a[nxt] - a[prev]) * (i - prev)) / (nxt - prev);
    }
    return out;
  }

  // ---------- Butterworth bậc 2 lọc thấp, zero-phase (giống scipy filtfilt) ----------
  function butterLP2(fc, fs) {
    const wc = Math.tan((Math.PI * fc) / fs);
    const k1 = Math.SQRT2 * wc, k2 = wc * wc, a0 = 1 + k1 + k2;
    return { b: [k2 / a0, (2 * k2) / a0, k2 / a0], a: [1, (2 * (k2 - 1)) / a0, (1 - k1 + k2) / a0] };
  }
  function lfilter(b, a, x, zi) {
    const y = new Float64Array(x.length);
    let z1 = zi[0], z2 = zi[1];
    for (let i = 0; i < x.length; i++) {
      const yi = b[0] * x[i] + z1;
      z1 = b[1] * x[i] - a[1] * yi + z2;
      z2 = b[2] * x[i] - a[2] * yi;
      y[i] = yi;
    }
    return y;
  }
  function lfilterZi(b, a) {
    const B1 = b[1] - a[1] * b[0], B2 = b[2] - a[2] * b[0];
    const det = 1 + a[1] + a[2];
    return [(B1 + B2) / det, ((1 + a[1]) * B2 - a[2] * B1) / det];
  }
  function filtfilt(b, a, x) {
    const n = x.length, pad = 9;
    if (n <= pad) return Float64Array.from(x);
    const ext = new Float64Array(n + 2 * pad);
    for (let i = 0; i < pad; i++) {
      ext[i] = 2 * x[0] - x[pad - i];
      ext[pad + n + i] = 2 * x[n - 1] - x[n - 2 - i];
    }
    for (let i = 0; i < n; i++) ext[pad + i] = x[i];
    const zi = lfilterZi(b, a);
    let y = lfilter(b, a, ext, zi.map((v) => v * ext[0]));
    y.reverse();
    y = lfilter(b, a, y, zi.map((v) => v * y[0]));
    y.reverse();
    return y.slice(pad, pad + n);
  }
  function smooth(a, fps, fc) {
    fc = fc || 10;
    const f = Math.min(fc, (fps / 2) * 0.9);
    const { b, a: aa } = butterLP2(f, fps);
    return filtfilt(b, aa, a);
  }

  // ---------- find_peaks (khoảng cách rồi prominence, như scipy) ----------
  function findPeaks(x, distance, prominence) {
    const n = x.length;
    let peaks = [];
    let i = 1;
    while (i < n - 1) {
      if (x[i - 1] < x[i]) {
        let ahead = i + 1;
        while (ahead < n - 1 && x[ahead] === x[i]) ahead++;
        if (x[ahead] < x[i]) { peaks.push((i + ahead - 1) >> 1); i = ahead; continue; }
      }
      i++;
    }
    if (distance > 1 && peaks.length) {
      const keep = new Array(peaks.length).fill(true);
      const order = peaks.map((p, idx) => idx).sort((p, q) => x[peaks[p]] - x[peaks[q]] || p - q);
      for (let t = order.length - 1; t >= 0; t--) {
        const j = order[t];
        if (!keep[j]) continue;
        for (let k = j - 1; k >= 0 && peaks[j] - peaks[k] < distance; k--) keep[k] = false;
        for (let k = j + 1; k < peaks.length && peaks[k] - peaks[j] < distance; k++) keep[k] = false;
      }
      peaks = peaks.filter((p, idx) => keep[idx]);
    }
    if (prominence != null) {
      peaks = peaks.filter((p) => {
        let lm = x[p], k = p;
        while (k >= 0 && x[k] <= x[p]) { if (x[k] < lm) lm = x[k]; k--; }
        let rm = x[p]; k = p;
        while (k < n && x[k] <= x[p]) { if (x[k] < rm) rm = x[k]; k++; }
        return x[p] - Math.max(lm, rm) >= prominence;
      });
    }
    return peaks;
  }

  // ---------- đo một bên ----------
  function computeSide(P, fps, heightCm, speedMs, side) {
    const ids = IDX[side];
    const N = P.x[0].length;
    const keys = ['sh', 'hip', 'knee', 'ank', 'heel', 'toe'];
    let vs = 0;
    for (const k of keys) for (let i = 0; i < N; i++) vs += P.v[ids[k]][i];
    const vis = vs / (keys.length * N);

    const masked = (j) => {
      const xs = new Float64Array(N), ys = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        const bad = !(P.v[j][i] >= 0.3);
        xs[i] = bad ? NaN : P.x[j][i];
        ys[i] = bad ? NaN : P.y[j][i];
      }
      return [xs, ys];
    };
    const S = {};
    for (const k of keys) {
      const [xs, ys] = masked(ids[k]);
      S[k] = { x: smooth(interpNaN(xs), fps), y: smooth(interpNaN(ys), fps) };
    }
    const [nx0] = masked(0);
    const noseX = interpNaN(nx0);
    const diffs = new Float64Array(N);
    for (let i = 0; i < N; i++) diffs[i] = noseX[i] - S.hip.x[i];
    const d = median(diffs) > 0 ? 1 : -1;

    const seg = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      seg[i] = Math.hypot(S.hip.x[i] - S.knee.x[i], S.hip.y[i] - S.knee.y[i]) +
        Math.hypot(S.knee.x[i] - S.ank.x[i], S.knee.y[i] - S.ank.y[i]);
    }
    const pxcm = median(seg) / (RATIO * heightCm);

    const deg = (r) => (r * 180) / Math.PI;
    const kneeFlex = new Float64Array(N), trunk = new Float64Array(N), shank = new Float64Array(N);
    const thigh = new Float64Array(N), foot = new Float64Array(N), rel = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const v1x = S.hip.x[i] - S.knee.x[i], v1y = S.hip.y[i] - S.knee.y[i];
      const v2x = S.ank.x[i] - S.knee.x[i], v2y = S.ank.y[i] - S.knee.y[i];
      const c = (v1x * v2x + v1y * v2y) / (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) + 1e-9);
      kneeFlex[i] = 180 - deg(Math.acos(Math.max(-1, Math.min(1, c))));
      trunk[i] = deg(Math.atan2(d * (S.sh.x[i] - S.hip.x[i]), -(S.sh.y[i] - S.hip.y[i])));
      shank[i] = deg(Math.atan2(d * (S.ank.x[i] - S.knee.x[i]), S.ank.y[i] - S.knee.y[i]));
      thigh[i] = deg(Math.atan2(d * (S.knee.x[i] - S.hip.x[i]), S.knee.y[i] - S.hip.y[i]));
      foot[i] = deg(Math.atan2(S.heel.y[i] - S.toe.y[i], d * (S.toe.x[i] - S.heel.x[i])));
      rel[i] = d * (S.ank.x[i] - S.hip.x[i]);
    }

    const prom = 0.35 * (percentile(rel, 95) - percentile(rel, 5));
    const dist = Math.max(Math.floor(0.35 * fps), 1);
    const ic = findPeaks(rel, dist, prom);
    const negRel = rel.map((v) => -v);
    const to = findPeaks(negRel, dist, prom);
    if (ic.length < 4) throw new Error('chân ' + (side === 'L' ? 'trái' : 'phải') + ': phát hiện quá ít bước (<4)');

    const cadIC = (2 * (ic.length - 1)) / ((ic[ic.length - 1] - ic[0]) / fps) * 60;
    let meanY = 0;
    for (let i = 0; i < N; i++) meanY += S.hip.y[i];
    meanY /= N;
    const yy = new Float64Array(N);
    const hw = Math.max(2, Math.round(fps * 0.5));   // bỏ trôi chậm: trừ trung bình trượt 1 giây
    for (let i = 0; i < N; i++) {
      let m = 0, c = 0;
      for (let j = Math.max(0, i - hw); j <= Math.min(N - 1, i + hw); j++) { m += S.hip.y[j]; c++; }
      yy[i] = (S.hip.y[i] - m / c) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
    }
    let best = -1, cadFFT = cadIC;
    for (let f = 1.2; f <= 4.0; f += 0.005) {
      let re = 0, im = 0;
      const w = (2 * Math.PI * f) / fps;
      for (let i = 0; i < N; i++) { re += yy[i] * Math.cos(w * i); im -= yy[i] * Math.sin(w * i); }
      const m = re * re + im * im;
      if (m > best) { best = m; cadFFT = f * 60; }
    }
    const cadence = Math.abs(cadIC - cadFFT) < 8 ? cadIC : cadFFT;

    const vo = [];
    for (let t = 0; t + 1 < ic.length; t++) {
      const a = ic[t], b = ic[t + 1];
      if (b - a > 3) {
        let mn = Infinity, mx = -Infinity;
        for (let i = a; i < b; i++) { mn = Math.min(mn, S.hip.y[i]); mx = Math.max(mx, S.hip.y[i]); }
        vo.push((mx - mn) / pxcm);
      }
    }
    const at = (arr, k) => median(Array.from(arr).slice(Math.max(k - 1, 0), k + 2));
    const kneeIc = ic.map((k) => at(kneeFlex, k));
    const shankIc = ic.map((k) => at(shank, k));
    const trunkIc = ic.map((k) => at(trunk, k));
    const over = ic.map((k) => at(rel, k) / pxcm);
    const fsa = ic.map((k) => at(foot, k));
    const kneeMid = [], kneeSwing = [], hipExt = [];
    for (let t = 0; t + 1 < ic.length; t++) {
      const k = ic[t], k2 = ic[t + 1];
      const tos = to.filter((q) => q > k && q < k2);
      if (tos.length) {
        const tt = tos[0];
        let mx = -Infinity;
        for (let i = k; i <= tt; i++) mx = Math.max(mx, kneeFlex[i]);
        kneeMid.push(mx);
        let ms = -Infinity;
        for (let i = tt; i <= Math.min(k2, N - 1); i++) ms = Math.max(ms, kneeFlex[i]);
        kneeSwing.push(ms);
        hipExt.push(-thigh[tt]);
      }
    }
    const fsaMed = median(fsa);
    const strike = fsaMed > 8 ? 'Gót' : fsaMed < -1.6 ? 'Mũi chân' : 'Giữa bàn';
    const metrics = {
      cadence, vert_osc: median(vo), trunk: median(trunkIc), knee_ic: median(kneeIc),
      shank_ic: median(shankIc), overstride: median(over), knee_mid: median(kneeMid),
      hip_ext: median(hipExt), knee_swing: median(kneeSwing),
    };
    const extra = { side, vis, strike, fsa: fsaMed, nSteps: ic.length, cadIC, cadFFT, pxcm, d };
    const arrays = { S, ic, to, kneeFlex, trunk, d, rel, pxcm };
    return { metrics, extra, arrays };
  }

  function computeBoth(P, fps, heightCm, speedMs) {
    const res = {}, errs = {};
    for (const s of ['L', 'R']) {
      try { res[s] = computeSide(P, fps, heightCm, speedMs, s); } catch (e) { errs[s] = e.message; }
    }
    if (!Object.keys(res).length) throw new Error(Object.values(errs).join('; ') || 'Không đo được');
    return { res, errs };
  }

  function combine(res, speedMs) {
    const sides = Object.keys(res);
    const common = {};
    for (const k of COMMON) common[k] = sides.reduce((a, s) => a + res[s].metrics[k], 0) / sides.length;
    return { common, stepLen: speedMs / (common.cadence / 60) };
  }


  // ---------- chỉ số mở rộng (chỉ cần camera ngang) ----------
  // Ghi chú: tai/khuỷu/cổ tay dùng mốc 7/8, 13/14, 15/16 của MediaPipe.
  const XIDX = { L: { ear: 7, elb: 13, wri: 15 }, R: { ear: 8, elb: 14, wri: 16 } };
  function extraSide(P, fps, res, side) {
    const r = res[side], A = r.arrays, S = A.S, N = S.hip.x.length, d = A.d, pxcm = A.pxcm;
    const ids = IDX[side], xi = XIDX[side], deg = (q) => (q * 180) / Math.PI;
    const get = (j) => {
      const xs = new Float64Array(N), ys = new Float64Array(N); let vs = 0;
      for (let i = 0; i < N; i++) { const bad = !(P.v[j][i] >= 0.3); xs[i] = bad ? NaN : P.x[j][i]; ys[i] = bad ? NaN : P.y[j][i]; vs += P.v[j][i]; }
      return { x: smooth(interpNaN(xs), fps), y: smooth(interpNaN(ys), fps), vis: vs / N };
    };
    const out = {};
    const ic = A.ic, to = A.to;
    // thời gian tiếp đất: khoảng liên tục trong mỗi chu kỳ mà đáy bàn chân ở sát mặt đất (ước lượng, ±1 khung hình)
    const ct = [];
    const low = new Float64Array(N);
    for (let i = 0; i < N; i++) low[i] = Math.max(S.heel.y[i], S.toe.y[i]);
    for (let t = 0; t + 1 < ic.length; t++) {
      const a = ic[t], b = ic[t + 1]; if (b - a < 4) continue;
      let mn = Infinity, mx = -Infinity;
      for (let i = a; i < b; i++) { mn = Math.min(mn, low[i]); mx = Math.max(mx, low[i]); }
      const thr = mx - 0.2 * (mx - mn);
      let best = 0, run = 0;
      for (let i = a; i < b; i++) { if (low[i] >= thr) { run++; best = Math.max(best, run); } else run = 0; }
      ct.push((best / fps) * 1000);
    }
    out.contact_ms = median(ct);
    // gót đá sau + nâng gối (đùi gập) trong mỗi chu kỳ
    const kick = [], hf = [], stride = [];
    for (let t = 0; t + 1 < ic.length; t++) {
      const a = ic[t], b = ic[t + 1]; if (b - a < 4) continue;
      let mn = Infinity, mx = -Infinity, th = -Infinity;
      for (let i = a; i < b; i++) {
        mn = Math.min(mn, S.heel.y[i]); mx = Math.max(mx, S.heel.y[i]);
        th = Math.max(th, deg(Math.atan2(d * (S.knee.x[i] - S.hip.x[i]), S.knee.y[i] - S.hip.y[i])));
      }
      kick.push((mx - mn) / pxcm); hf.push(th); stride.push((b - a) / fps);
    }
    out.heel_kick = median(kick); out.hip_flex = median(hf);
    out.stride = stride;
    // tay: biên độ vung vai–khuỷu, góc gập khuỷu
    try {
      const E = get(xi.elb), W = get(xi.wri);
      if (E.vis < 0.4 || W.vis < 0.4) throw new Error('arm');
      const sw = [], el = [];
      for (let t = 0; t + 1 < ic.length; t++) {
        const a = ic[t], b = ic[t + 1]; if (b - a < 4) continue;
        let mn = Infinity, mx = -Infinity;
        for (let i = a; i < b; i++) {
          const ang = deg(Math.atan2(d * (E.x[i] - S.sh.x[i]), E.y[i] - S.sh.y[i]));
          mn = Math.min(mn, ang); mx = Math.max(mx, ang);
          const v1x = S.sh.x[i] - E.x[i], v1y = S.sh.y[i] - E.y[i], v2x = W.x[i] - E.x[i], v2y = W.y[i] - E.y[i];
          const c = (v1x * v2x + v1y * v2y) / (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) + 1e-9);
          el.push(deg(Math.acos(Math.max(-1, Math.min(1, c)))));
        }
        sw.push(mx - mn);
      }
      out.arm_swing = median(sw); out.elbow = median(el);
    } catch (e) { out.arm_swing = NaN; out.elbow = NaN; }
    // đầu: tai lệch ra trước vai (độ nghiêng đường vai–tai so với phương thẳng đứng)
    try {
      const H = get(xi.ear);
      if (H.vis < 0.4) throw new Error('ear');
      const a = new Float64Array(N);
      for (let i = 0; i < N; i++) a[i] = deg(Math.atan2(d * (H.x[i] - S.sh.x[i]), -(H.y[i] - S.sh.y[i])));
      out.head_fwd = median(a);
    } catch (e) { out.head_fwd = NaN; }
    return out;
  }
  const CV = (a) => { if (a.length < 3) return NaN; const m = a.reduce((x, y) => x + y, 0) / a.length; const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / a.length); return (sd / m) * 100; };
  function computeExtra(P, fps, res, common, speedMs) {
    const per = {}, sides = Object.keys(res);
    for (const s of sides) { try { per[s] = extraSide(P, fps, res, s); } catch (e) { per[s] = {}; } }
    const cm = {};
    const stepTime = 60 / common.cadence * 1000;
    const cts = sides.map((s) => per[s].contact_ms).filter((v) => !Number.isNaN(v) && v != null);
    cm.flight_ms = cts.length ? Math.max(0, stepTime - cts.reduce((a, b) => a + b, 0) / cts.length) : NaN;
    cm.duty = cts.length ? (cts.reduce((a, b) => a + b, 0) / cts.length) / stepTime * 100 : NaN;
    const all = [].concat(...sides.map((s) => per[s].stride || []));
    cm.step_cv = CV(all);
    // đối xứng: thời gian từ chạm đất chân này sang chân kia, so 2 chiều
    if (res.L && res.R) {
      const ev = [];
      res.L.arrays.ic.forEach((i) => ev.push([i, 'L'])); res.R.arrays.ic.forEach((i) => ev.push([i, 'R']));
      ev.sort((a, b) => a[0] - b[0]);
      const lr = [], rl = [];
      for (let i = 0; i + 1 < ev.length; i++) {
        const dt = (ev[i + 1][0] - ev[i][0]) / fps * 1000;
        if (ev[i][1] === 'L' && ev[i + 1][1] === 'R') lr.push(dt); else if (ev[i][1] === 'R' && ev[i + 1][1] === 'L') rl.push(dt);
      }
      if (lr.length >= 3 && rl.length >= 3) { const a = median(lr), b = median(rl); cm.step_asym = Math.abs(a - b) / ((a + b) / 2) * 100; }
      else cm.step_asym = NaN;
      const cl = per.L.contact_ms, cr = per.R.contact_ms;
      cm.contact_asym = (cl > 0 && cr > 0) ? Math.abs(cl - cr) / ((cl + cr) / 2) * 100 : NaN;
    } else { cm.step_asym = NaN; cm.contact_asym = NaN; }
    return { per, common: cm };
  }
  // so sánh đầu buổi với cuối buổi (mệt mỏi): trả về mức thay đổi
  function fatigue(early, late) {
    const g = (c) => (c ? c.comb.common : null);
    const a = g(early), b = g(late); if (!a || !b) return null;
    return { d_cadence: b.cadence - a.cadence, d_vert: b.vert_osc - a.vert_osc, d_trunk: b.trunk - a.trunk };
  }

  // ---------- góc SAU LƯNG (camera đặt sau người chạy, ngang hông) ----------
  // Cùng định dạng P như góc ngang (toạ độ pixel). Trái/phải theo nhãn MediaPipe; dấu "trong/ngoài" tính theo
  // đường giữa hai hông nên không phụ thuộc ảnh có lật gương hay không.
  // Thời điểm giữa pha chống chân (mid-stance) của chân s = lúc bàn chân s thấp nhất so với chân kia trong ảnh.
  // Chỉ số mỗi chân (chân trụ):
  //   pelvic_drop  độ, hông bên KHÔNG trụ tụt xuống (đỉnh trong pha trụ, đã trừ độ nghiêng trung bình của cả clip để bỏ máy đặt lệch)
  //   knee_valgus  độ, góc hông–gối–cổ chân nhìn từ sau (FPPA): dương = gối đổ vào trong, âm = gối choãi ra (đỉnh trong pha trụ)
  //   foot_mid     cm, cổ chân trụ so với đường giữa hai hông lúc giữa pha trụ: dương = phía bên mình, âm = đặt chéo qua đường giữa
  // Chỉ số chung: step_width (cm, khoảng ngang giữa hai bàn chân ở hai bước liền nhau; âm = chéo), lat_trunk (độ, biên độ thân lắc ngang mỗi chu kỳ)
  const BACK_PERLEG = ['pelvic_drop', 'knee_valgus', 'foot_mid'];
  const BACK_COMMON = ['step_width', 'lat_trunk'];
  function computeBack(P, fps, heightCm) {
    const N = P.x[0].length, deg = (r) => (r * 180) / Math.PI;
    const ser = (j) => {
      const xs = new Float64Array(N), ys = new Float64Array(N); let vs = 0;
      for (let i = 0; i < N; i++) { const bad = !(P.v[j][i] >= 0.3); xs[i] = bad ? NaN : P.x[j][i]; ys[i] = bad ? NaN : P.y[j][i]; vs += P.v[j][i]; }
      return { x: smooth(interpNaN(xs), fps), y: smooth(interpNaN(ys), fps), vis: vs / N };
    };
    const S = {};
    for (const s of ['L', 'R']) { S[s] = {}; for (const k of ['sh', 'hip', 'knee', 'ank']) S[s][k] = ser(IDX[s][k]); }
    const vis = ['L', 'R'].reduce((a, s) => a + ['hip', 'knee', 'ank'].reduce((b, k) => b + S[s][k].vis, 0), 0) / 6;
    // thước đo: đùi + cẳng chân nhìn từ sau ngắn lại khi gối gập, nên lấy lúc chân duỗi nhất (bách phân vị 90)
    const seg = [];
    for (const s of ['L', 'R']) for (let i = 0; i < N; i++) {
      const L = S[s];
      seg.push(Math.hypot(L.hip.x[i] - L.knee.x[i], L.hip.y[i] - L.knee.y[i]) + Math.hypot(L.knee.x[i] - L.ank.x[i], L.knee.y[i] - L.ank.y[i]));
    }
    const pxcm = percentile(seg, 90) / (RATIO * heightCm);
    const midX = new Float64Array(N), tilt = new Float64Array(N), lean = new Float64Array(N), dy = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const hl = S.L.hip, hr = S.R.hip;
      midX[i] = (hl.x[i] + hr.x[i]) / 2;
      tilt[i] = deg(Math.atan2(hr.y[i] - hl.y[i], Math.abs(hr.x[i] - hl.x[i]) + 1e-9));   // dương = hông phải thấp hơn
      const sx = (S.L.sh.x[i] + S.R.sh.x[i]) / 2, sy = (S.L.sh.y[i] + S.R.sh.y[i]) / 2;
      lean[i] = deg(Math.atan2(sx - midX[i], -(sy - (hl.y[i] + hr.y[i]) / 2)));
      dy[i] = S.L.ank.y[i] - S.R.ank.y[i];   // dương = cổ chân trái thấp hơn (trái đang trụ)
    }
    const tilt0 = median(tilt);
    const own = { L: Math.sign(median(Array.from(S.L.hip.x, (x, i) => x - S.R.hip.x[i]))) || -1 };
    own.R = -own.L;   // hướng "ra ngoài" của mỗi chân trên trục x ảnh
    const prom = 0.35 * (percentile(dy, 95) - percentile(dy, 5));
    const dist = Math.max(Math.floor(0.35 * fps), 1), cap = Math.max(2, Math.round(0.25 * fps));
    const ev = { L: findPeaks(dy, dist, prom), R: findPeaks(dy.map((v) => -v), dist, prom) };
    const per = {}, errs = {}, steps = {};
    for (const s of ['L', 'R']) {
      const sg = s === 'L' ? 1 : -1, L = S[s];
      steps[s] = ev[s].length;
      if (ev[s].length < 3) { errs[s] = 'chân ' + (s === 'L' ? 'trái' : 'phải') + ': phát hiện quá ít bước (<3)'; continue; }
      const drop = [], valg = [], foot = [];
      for (const k of ev[s]) {
        let a = k, b = k;
        while (a > 0 && k - a < cap && sg * dy[a - 1] > 0) a--;
        while (b < N - 1 && b - k < cap && sg * dy[b + 1] > 0) b++;
        let dm = 0, vm = 0;   // giữ giá trị có độ lớn lớn nhất trong pha trụ (giữ cả dấu âm)
        const pk = (cur, v) => (Math.abs(v) > Math.abs(cur) ? v : cur);
        for (let i = a; i <= b; i++) {
          dm = pk(dm, sg * (tilt[i] - tilt0));   // trái trụ: hông phải tụt = tilt tăng
          const hx = L.hip.x[i], hy = L.hip.y[i], kx = L.knee.x[i], ky = L.knee.y[i], ax = L.ank.x[i], ay = L.ank.y[i];
          const ux = kx - hx, uy = ky - hy, wx = ax - kx, wy = ay - ky;
          const ang = deg(Math.acos(Math.max(-1, Math.min(1, (ux * wx + uy * wy) / (Math.hypot(ux, uy) * Math.hypot(wx, wy) + 1e-9)))));
          const xl = Math.abs(ay - hy) > 1e-6 ? hx + ((ax - hx) * (ky - hy)) / (ay - hy) : hx;
          vm = pk(vm, (kx - xl) * own[s] < 0 ? ang : -ang);
        }
        drop.push(dm); valg.push(vm);
        foot.push(((L.ank.x[k] - midX[k]) * own[s]) / pxcm);
      }
      per[s] = { pelvic_drop: median(drop), knee_valgus: median(valg), foot_mid: median(foot) };
    }
    if (!Object.keys(per).length) throw new Error(Object.values(errs).join('; ') || 'Không đo được góc sau lưng');
    // độ rộng bước: hai lần trụ liền nhau của hai chân khác nhau
    const all = [];
    ev.L.forEach((i) => all.push([i, 'L'])); ev.R.forEach((i) => all.push([i, 'R']));
    all.sort((a, b) => a[0] - b[0]);
    const sw = [];
    for (let t = 0; t + 1 < all.length; t++) {
      const [i1, s1] = all[t], [i2, s2] = all[t + 1];
      if (s1 === s2) continue;
      const xl = s1 === 'L' ? S.L.ank.x[i1] : S.L.ank.x[i2], xr = s1 === 'R' ? S.R.ank.x[i1] : S.R.ank.x[i2];
      sw.push(((xl - xr) * own.L) / pxcm);
    }
    // thân lắc ngang: biên độ góc thân (giữa vai – giữa hông) trong mỗi chu kỳ của chân có nhiều bước hơn
    const ref = ev.L.length >= ev.R.length ? ev.L : ev.R, lt = [];
    for (let t = 0; t + 1 < ref.length; t++) {
      let mn = Infinity, mx = -Infinity;
      for (let i = ref[t]; i < ref[t + 1]; i++) { mn = Math.min(mn, lean[i]); mx = Math.max(mx, lean[i]); }
      lt.push(mx - mn);
    }
    const common = { step_width: sw.length >= 2 ? median(sw) : NaN, lat_trunk: lt.length ? median(lt) : NaN };
    return { per, common, errs, extra: { vis, pxcm, steps, tilt0 }, arrays: { ev, dy, tilt, lean, midX, own } };
  }

  function rateValue(v, cfg) {
    if (v == null || Number.isNaN(v)) return 'n/a';
    return v < cfg.lo ? 'thấp' : v > cfg.hi ? 'cao' : 'trong khoảng';
  }

  // ---------- lấy mẫu đều từ khung hình có thời gian ----------
  // frames: [{t (giây), lm: [{x,y,v} x33] | null}]
  function resample(frames, fps) {
    const ok = frames.filter((f) => f.lm);
    if (ok.length < 10) throw new Error('Không thấy người trong hình (có ' + ok.length + ' khung hình nhận diện được).');
    const t0 = ok[0].t, t1 = ok[ok.length - 1].t;
    const N = Math.floor((t1 - t0) * fps) + 1;
    const P = { x: [], y: [], v: [] };
    for (let j = 0; j < 33; j++) { P.x.push(new Float64Array(N)); P.y.push(new Float64Array(N)); P.v.push(new Float64Array(N)); }
    let k = 0;
    for (let i = 0; i < N; i++) {
      const t = t0 + i / fps;
      while (k < ok.length - 2 && ok[k + 1].t < t) k++;
      const a = ok[k], b = ok[Math.min(k + 1, ok.length - 1)];
      const gap = b.t - a.t;
      const w = gap > 0 ? Math.max(0, Math.min(1, (t - a.t) / gap)) : 0;
      const hole = gap > 0.25;
      for (let j = 0; j < 33; j++) {
        if (hole) { P.x[j][i] = NaN; P.y[j][i] = NaN; P.v[j][i] = 0; continue; }
        P.x[j][i] = a.lm[j].x + (b.lm[j].x - a.lm[j].x) * w;
        P.y[j][i] = a.lm[j].y + (b.lm[j].y - a.lm[j].y) * w;
        P.v[j][i] = a.lm[j].v + (b.lm[j].v - a.lm[j].v) * w;
      }
    }
    return { P, N, t0 };
  }

  const api = { IDX, COMMON, PERLEG, ASYM, median, percentile, smooth, filtfilt, findPeaks,
    computeSide, computeBoth, combine, computeExtra, BACK_PERLEG, BACK_COMMON, computeBack, fatigue, rateValue, resample };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Gait = api;
})(typeof window !== 'undefined' ? window : globalThis);
