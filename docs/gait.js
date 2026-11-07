/* gait.js - lõi đo dáng chạy 2D (cả hai chân), port từ gait_screen.py.
 * Dữ liệu vào: P = { x:[33][N], y:[33][N], v:[33][N] } đã lấy mẫu đều ở `fps`.
 * Chạy được trong trình duyệt (window.Gait) và Node (module.exports) để kiểm thử. */
(function (root) {
  'use strict';

  const IDX = {
    L: { sh: 11, hip: 23, knee: 25, ank: 27, heel: 29, toe: 31 },
    R: { sh: 12, hip: 24, knee: 26, ank: 28, heel: 30, toe: 32 },
  };
  // Ngưỡng tin cậy điểm khớp (visibility 0..1): dưới mức này điểm bị coi là mờ, khung đó bỏ khỏi tính; chỉnh ở đây.
  const VIS_MIN = 0.6;
  // Chân xa camera: điểm 0,3–0,6 vẫn nhận cho một bước nếu qua kiểm tra hợp lý (độ dài đùi/cẳng, không nhảy, hai gối không chập).
  const VIS_LOW = 0.3;
  // Chân có ít hơn MIN_STEPS bước rõ (mọi điểm chân ≥ VIS_MIN lúc chạm đất) = "dưới ngưỡng tin cậy": vẫn hiện số kèm ±X
  // (X = nửa khoảng tứ phân vị giữa các bước). Có tính chân đó vào điểm không: Linh chọn tạm KHÔNG (07/11/2026), đổi ở đây.
  const COUNT_LOWCONF = false;
  // Mốc chạm đất nghi bắt sai: gối lúc chạm đất ngoài khoảng này (độ) hoặc chân chạm sau hông quá OVER_MIN_CM.
  const KNEE_IC_OK = [0, 30], OVER_MIN_CM = -5;
  const IC_KEYS = ['knee_ic', 'shank_ic', 'overstride'];   // chỉ số đo đúng lúc chạm đất: bị gắn cờ khi nghi bắt sai mốc
  const BAD_FRAC_MAX = 0.3;   // quá tỉ lệ khung bị bỏ này thì báo 'Khung hình kém'
  const MIN_STEPS = 4;        // ít bước hơn mức này thì báo 'Khung hình kém'
  // tỉ lệ khung có ít nhất một điểm trong `ids` dưới ngưỡng
  function badFrac(P, ids, N) {
    let b = 0;
    for (let i = 0; i < N; i++) { for (const j of ids) if (!(P.v[j][i] >= VIS_MIN)) { b++; break; } }
    return N ? b / N : 1;
  }
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
  // lọc trung vị cửa sổ w (lẻ), bỏ qua NaN; cửa sổ toàn NaN thì giữ NaN
  function medfilt(a, w) {
    const n = a.length, h = w >> 1, out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = median(Array.prototype.slice.call(a, Math.max(0, i - h), Math.min(n, i + h + 1)));
    return out;
  }
  // tần số trội (Hz) của tín hiệu trong dải [f0, f1]: trừ trung bình (hw>0: trung bình trượt ±hw khung), cửa sổ Hann, quét DFT bước 0,005 Hz
  function domFreq(x, fps, f0, f1, hw) {
    const N = x.length, yy = new Float64Array(N);
    let g = 0;
    for (let i = 0; i < N; i++) g += x[i];
    g /= N;
    for (let i = 0; i < N; i++) {
      let m = g;
      if (hw > 0) {
        let s = 0, c = 0;
        for (let j = Math.max(0, i - hw); j <= Math.min(N - 1, i + hw); j++) { s += x[j]; c++; }
        m = s / c;
      }
      yy[i] = (x[i] - m) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
    }
    let best = -1, fb = NaN;
    for (let f = f0; f <= f1; f += 0.005) {
      let re = 0, im = 0;
      const w = (2 * Math.PI * f) / fps;
      for (let i = 0; i < N; i++) { re += yy[i] * Math.cos(w * i); im -= yy[i] * Math.sin(w * i); }
      const m = re * re + im * im;
      if (m > best) { best = m; fb = f; }
    }
    return fb;
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

  // ---------- tìm bước không dựa vào nhãn trái/phải ----------
  // Quay ngang, MediaPipe hay đổi nhãn "trái"/"phải" giữa hai chân (video áo xám: cùng một bàn chân đang trụ khung này
  // mang nhãn phải, khung sau mang nhãn trái, có khi kéo dài 3–5 khung) và visibility đi theo NHÃN chứ không theo chân thật.
  // Lọc trung vị không gỡ được đoạn tráo dài, làm mốc chạm đất (IC) bắt trễ 3–5 khung, lúc chân kia đã nhấc.
  // Nên ở đây tìm bước bằng những gì không phụ thuộc nhãn:
  //  1. Ghép điểm thành hai chân trong từng khung: gót/mũi theo cổ chân gần nhất, gối theo độ dài cẳng chân sát độ dài điển hình.
  //  2. "Mặt đất" = đường thẳng ước từ điểm thấp nhất của bàn chân qua cả đoạn (đường nghiêng theo camera), lấy mức các lần trụ.
  //  3. Mỗi bước hông xuống thấp nhất một lần. Trong khoảng giữa hai đáy hông: IC = khung đầu bàn chân phía trước xuống tới mức
  //     trụ của bước đó (± TOL_GROUND_CM); TO = khung cuối bàn chân trụ còn ở mức đó. Đo trên điểm thô (chưa lọc, chưa làm mượt).
  //  4. Hai lần trụ liền nhau là hai chân khác nhau (chạy luôn đổi chân). Chân nào là "phải" lấy theo nhãn MediaPipe đa số.
  //     Hạn chế: tên trái/phải chỉ đúng khi đa số khung MediaPipe gán đúng nhãn; hai chân hoán tên thì số vẫn đúng từng chân.
  //  5. Ghi lại P theo chân thật (mỗi khung: chân đang trụ/vừa nhấc của lần trụ đó mang tên chân đó) để phần đo và ảnh dùng.
  const TOL_GROUND_CM = 2.5;
  // Bàn chân lúc trụ phải nằm trong TOL_BAND_CM so với mặt đất chung (rộng vì chân xa camera trông cao hơn chân gần 3–6 cm).
  const TOL_BAND_CM = 8;
  function findSteps(P0, fps, heightCm) {
    const N = P0.x[0].length, L = IDX.L, R = IDX.R;
    const P = { x: P0.x.map((a) => Float64Array.from(a)), y: P0.y.map((a) => Float64Array.from(a)), v: P0.v.map((a) => Float64Array.from(a)) };
    const pt = (j, i) => (P0.v[j][i] >= VIS_LOW ? [P0.x[j][i], P0.y[j][i]] : [NaN, NaN]);
    const D = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    const other = (j, part) => (j === L[part] ? R[part] : L[part]);
    // hông: hai hông gần như trùng nhau khi quay ngang, lấy điểm rõ hơn cho cả hai
    const hipJ = new Int32Array(N);
    for (let i = 0; i < N; i++) hipJ[i] = P0.v[L.hip][i] >= P0.v[R.hip][i] ? L.hip : R.hip;
    // chân 0 = cổ chân mang nhãn trái gốc; s0[part][i] = ô của chân 0 ở khung i (chân 1 là ô còn lại)
    const s0 = { ank: new Int32Array(N).fill(L.ank), heel: new Int32Array(N), toe: new Int32Array(N), knee: new Int32Array(N) };
    for (const part of ['heel', 'toe']) {
      for (let i = 0; i < N; i++) {
        const a = D(pt(L[part], i), pt(L.ank, i)) + D(pt(R[part], i), pt(R.ank, i));
        const b = D(pt(R[part], i), pt(L.ank, i)) + D(pt(L[part], i), pt(R.ank, i));
        s0[part][i] = b < a ? R[part] : L[part];
      }
    }
    const sh = [], th = [];
    for (let i = 0; i < N; i++) {
      const a = D(pt(L.knee, i), pt(L.ank, i)) + D(pt(R.knee, i), pt(R.ank, i));
      const b = D(pt(R.knee, i), pt(L.ank, i)) + D(pt(L.knee, i), pt(R.ank, i));
      const m = Math.min(a, b);
      if (Number.isFinite(m)) sh.push(m / 2);
      for (const j of [L.knee, R.knee]) { const t = D(pt(hipJ[i], i), pt(j, i)); if (Number.isFinite(t)) th.push(t); }
    }
    const Ls = median(sh), Lt = median(th);
    if (!(Ls > 0 && Lt > 0)) throw new Error('Không nhận diện được người trong video (thiếu khung xương).');
    for (let i = 0; i < N; i++) {
      const c = (kA, kB) => Math.abs(D(pt(kA, i), pt(L.ank, i)) - Ls) + Math.abs(D(pt(kB, i), pt(R.ank, i)) - Ls);
      s0.knee[i] = c(R.knee, L.knee) < c(L.knee, R.knee) ? R.knee : L.knee;
    }
    const slot = (leg, part, i) => (leg === 0 ? s0[part][i] : other(s0[part][i], part));
    // hướng chạy: mũi ở phía nào của hông
    const dd = [];
    for (let i = 0; i < N; i++) { const t = pt(0, i)[0] - P0.x[hipJ[i]][i]; if (Number.isFinite(t)) dd.push(t); }
    const d = median(dd) >= 0 ? 1 : -1;
    // điểm thấp nhất mỗi bàn chân (ảnh: y hướng xuống) và vị trí cổ chân so với hông
    const lo = [new Float64Array(N), new Float64Array(N)], lx = [new Float64Array(N), new Float64Array(N)], rel = [new Float64Array(N), new Float64Array(N)];
    for (let l = 0; l < 2; l++) {
      for (let i = 0; i < N; i++) {
        let y = NaN, x = NaN;
        for (const part of ['heel', 'toe']) { const p = pt(slot(l, part, i), i); if (Number.isFinite(p[1]) && !(p[1] <= y)) { y = p[1]; x = p[0]; } }
        lo[l][i] = y; lx[l][i] = x;
        rel[l][i] = d * (pt(slot(l, 'ank', i), i)[0] - P0.x[hipJ[i]][i]);
      }
    }
    const pxcm = (Ls + Lt) / (RATIO * heightCm);
    // mặt đất: đường y = a + b·x bám theo phía dưới (y lớn) của điểm thấp nhất mỗi khung
    const gx = [], gy = [];
    for (let i = 0; i < N; i++) {
      const l = !(lo[1][i] > lo[0][i]) ? 0 : 1;
      if (Number.isFinite(lo[l][i])) { gx.push(lx[l][i]); gy.push(lo[l][i]); }
    }
    if (gy.length < 10) throw new Error('Không nhận diện được người trong video (thiếu khung xương).');
    let ga = median(gy), gb = 0;
    for (let it = 0; it < 4; it++) {
      const r = gy.map((y, k) => y - (ga + gb * gx[k])), thr = percentile(r, 50);
      let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (let k = 0; k < gy.length; k++) if (r[k] >= thr) { n++; sx += gx[k]; sy += gy[k]; sxx += gx[k] * gx[k]; sxy += gx[k] * gy[k]; }
      const den = n * sxx - sx * sx;
      gb = Math.abs(den) > 1e-9 ? (n * sxy - sx * sy) / den : 0;
      if (Math.abs(gb) > 0.3) gb = 0;   // nghiêng quá vô lý thì bỏ nghiêng
      ga = (sy - gb * sx) / n;
    }
    const res0 = gy.map((y, k) => y - (ga + gb * gx[k]));
    const g0 = percentile(res0, 85), tol = TOL_GROUND_CM * pxcm, band = TOL_BAND_CM * pxcm;
    const hgt = (l, i) => ga + gb * lx[l][i] + g0 - lo[l][i];    // độ cao bàn chân l so với mặt đất (px, dương = ở trên)
    // Mỗi bước hông xuống thấp nhất một lần (giữa pha trụ). Cửa sổ tìm IC của một bước = từ đáy hông trước (+2 khung) tới đáy này.
    const hy = new Float64Array(N);
    for (let i = 0; i < N; i++) hy[i] = P0.v[hipJ[i]][i] >= VIS_LOW ? P0.y[hipJ[i]][i] : NaN;
    const hyS = smooth(interpNaN(hy), fps, 6);
    const fStep = domFreq(hyS, fps, 1.2, 4.0, Math.max(2, Math.round(fps * 0.5)));
    const per = Number.isFinite(fStep) && fStep > 0 ? fps / fStep : 0.36 * fps;
    const vall = findPeaks(hyS, Math.max(2, Math.round(0.6 * per)), 0.25 * (percentile(hyS, 95) - percentile(hyS, 5)));
    // bàn chân phía trước / phía sau (theo cổ chân so với hông); thiếu một bên thì lấy bên còn lại
    const front = (i) => (!(rel[1][i] > rel[0][i]) ? (Number.isFinite(rel[0][i]) ? 0 : 1) : 1);
    const loF = (i) => lo[front(i)][i];
    const ank = (l, i) => pt(slot(l, 'ank', i), i);
    // IC = khung đầu trong cửa sổ mà bàn chân phía trước đã xuống tới mức trụ của chính bước đó (± TOL_GROUND_CM).
    // Mức trụ lấy riêng từng bước vì bàn chân xa camera chạm đất trông cao hơn chân gần 3–6 cm (phối cảnh).
    // Bước mà bàn chân phía trước không xuống gần "mặt đất" chung (cách quá TOL_BAND_CM) thì bỏ (điểm hỏng).
    const steps = [];
    for (let k = 0; k < vall.length; k++) {
      const v = vall[k], w0 = k > 0 ? vall[k - 1] + 2 : Math.max(1, v - Math.round(per));
      if (w0 >= v) continue;
      let Lv = -Infinity, iv = -1;   // Lv: điểm thấp nhất của bàn chân phía trước trong cửa sổ, chỉ dùng để loại bước không chạm "mặt đất"
      for (let i = w0; i <= Math.min(N - 1, v + 2); i++) if (loF(i) > Lv) { Lv = loF(i); iv = i; }
      if (iv < 0 || !(hgt(front(iv), iv) <= band)) continue;
      // Mức trụ tính riêng cho gót và mũi: lúc bàn chân đặt phẳng, mũi (gần camera) thấp hơn lúc vừa chạm vài cm, nên so
      // "điểm thấp nhất" với mức trụ phẳng sẽ bắt trễ. Chạm đất = gót HOẶC mũi đã xuống tới mức trụ của chính nó.
      const fy = (part, i) => pt(slot(front(i), part, i), i)[1];
      let Hv = -Infinity, Tv = -Infinity;
      for (let i = w0; i <= Math.min(N - 1, v + 2); i++) {
        if (fy('heel', i) > Hv) Hv = fy('heel', i);
        if (fy('toe', i) > Tv) Tv = fy('toe', i);
      }
      let ic = w0;
      while (ic < v && !(fy('heel', ic) >= Hv - tol || fy('toe', ic) >= Tv - tol)) ic++;
      if (ic === w0 && k === 0) continue;   // đầu video: không biết bàn chân đã chạm từ lúc nào
      steps.push({ ic, to: ic, leg: front(ic), Hv, Tv });
    }
    // TO: bám bàn chân trụ (cổ chân gần vị trí khung trước nhất) tới khi nó rời mức trụ (cho phép hở 2 khung vì điểm gót/mũi hay nhảy), trước IC kế tiếp
    for (let k = 0; k < steps.length; k++) {
      const s = steps[k], end = k + 1 < steps.length ? steps[k + 1].ic - 1 : N - 1;
      let cur = s.leg, last = s.ic, miss = 0;
      for (let i = s.ic + 1; i <= end && miss < 3; i++) {
        const p = ank(cur, i - 1), o = 1 - cur;
        if (D(ank(o, i), p) < D(ank(cur, i), p)) cur = o;
        if (pt(slot(cur, 'heel', i), i)[1] >= s.Hv - tol || pt(slot(cur, 'toe', i), i)[1] >= s.Tv - tol) { last = i; miss = 0; } else miss++;
      }
      s.to = last;
      delete s.Hv; delete s.Tv;
    }
    // hai lần chạm sát nhau bất thường (< 0,5 khoảng điển hình) là nhiễu: bỏ lần có đoạn trụ ngắn hơn
    for (let changed = true; changed && steps.length > 2;) {
      changed = false;
      const iv = []; for (let k = 1; k < steps.length; k++) iv.push(steps[k].ic - steps[k - 1].ic);
      const mi = median(iv);
      for (let k = 1; k < steps.length; k++) {
        if (steps[k].ic - steps[k - 1].ic < 0.5 * mi) {
          const dk = steps[k].to - steps[k].ic < steps[k - 1].to - steps[k - 1].ic ? k : k - 1;
          steps.splice(dk, 1); changed = true; break;
        }
      }
    }
    // đặt tên chân: hai lần trụ liền nhau đổi chân; quãng hở lớn (sót bước) thì bắt đầu đoạn mới, mỗi đoạn theo nhãn đa số
    const iv = []; for (let k = 1; k < steps.length; k++) iv.push(steps[k].ic - steps[k - 1].ic);
    const mi = median(iv);
    for (let a = 0; a < steps.length;) {
      let b = a;
      while (b + 1 < steps.length && steps[b + 1].ic - steps[b].ic <= 1.6 * mi) b++;
      let vote = 0;   // >0: lần trụ thứ chẵn trong đoạn là chân phải
      for (let k = a; k <= b; k++) {
        const s = steps[k], lab = slot(s.leg, 'ank', s.ic) === R.ank ? 1 : -1;
        vote += ((k - a) % 2 === 0 ? 1 : -1) * lab * Math.min(1, P0.v[slot(s.leg, 'ank', s.ic)][s.ic]);
      }
      for (let k = a; k <= b; k++) steps[k].side = ((k - a) % 2 === 0) === vote >= 0 ? 'R' : 'L';
      a = b + 1;
    }
    // ghi lại P theo chân thật. Trong [IC_k, IC_k+1): lúc trụ, chân k = bàn chân gần vị trí khung trước nhất (bàn chân trụ chỉ trôi
    // chậm theo băng tải); sau khi nhấc = chân phía sau. Trước lần chạm đầu: chân sắp chạm = chân phía trước.
    const legOf = new Int8Array(N).fill(-1), sideOf = [];
    for (let k = 0; k < steps.length; k++) {
      const s = steps[k], end = k + 1 < steps.length ? steps[k + 1].ic : N;
      let cur = s.leg;
      for (let i = s.ic; i < end; i++) {
        if (i <= s.to) {
          if (i > s.ic) {
            const p = pt(slot(cur, 'ank', i - 1), i - 1), o = 1 - cur;
            const dc = D(pt(slot(cur, 'ank', i), i), p), dO = D(pt(slot(o, 'ank', i), i), p);
            if (dO < dc) cur = o;
          }
        } else cur = rel[0][i] < rel[1][i] ? 0 : rel[1][i] < rel[0][i] ? 1 : cur;
        legOf[i] = cur; sideOf[i] = s.side;
      }
    }
    if (steps.length) for (let i = 0; i < steps[0].ic; i++) { legOf[i] = rel[0][i] >= rel[1][i] ? 0 : 1; sideOf[i] = steps[0].side; }
    for (let i = 0; i < N; i++) {
      if (legOf[i] < 0) continue;
      const sd = sideOf[i], od = sd === 'L' ? 'R' : 'L';
      for (const part of ['knee', 'ank', 'heel', 'toe']) {
        const js = slot(legOf[i], part, i), jo = other(js, part);
        for (const A of ['x', 'y', 'v']) { const vs = P0[A][js][i], vo = P0[A][jo][i]; P[A][IDX[sd][part]][i] = vs; P[A][IDX[od][part]][i] = vo; }
      }
      for (const A of ['x', 'y', 'v']) { P[A][L.hip][i] = P0[A][hipJ[i]][i]; P[A][R.hip][i] = P0[A][hipJ[i]][i]; }
    }
    return { P, steps, pxcm, Ls, Lt, d, ground: { a: ga, b: gb, g0, tol } };
  }

  // ---------- đo một bên ----------
  function computeSide(P, fps, heightCm, speedMs, side, st) {
    const ids = IDX[side];
    const N = P.x[0].length;
    const keys = ['sh', 'hip', 'knee', 'ank', 'heel', 'toe'];
    let vs = 0;
    for (const k of keys) for (let i = 0; i < N; i++) vs += P.v[ids[k]][i];
    const vis = vs / (keys.length * N);

    const masked = (j) => {
      const xs = new Float64Array(N), ys = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        const bad = !(P.v[j][i] >= VIS_LOW); // nhận cả điểm mờ vừa (chân xa); bước nào dùng được xét riêng ở dưới
        xs[i] = bad ? NaN : P.x[j][i];
        ys[i] = bad ? NaN : P.y[j][i];
      }
      return [xs, ys];
    };
    // Lọc trung vị ~0,15 s bỏ điểm nhảy lẻ. Tráo nhãn trái/phải đã được findSteps gỡ (P ghi lại theo chân thật), nên điểm chân
    // không cần lọc dài 0,25 s như trước (lọc dài làm trễ và bẹt góc quanh lúc chạm đất).
    const mw = Math.max(3, Math.round(fps * 0.15) | 1), mwLeg = mw;
    const S = {};
    for (const k of keys) {
      const [xs, ys] = masked(ids[k]);
      const w = k === 'hip' || k === 'sh' ? mw : mwLeg;
      S[k] = { x: smooth(interpNaN(medfilt(xs, w)), fps), y: smooth(interpNaN(medfilt(ys, w)), fps) };
    }
    const [nx0] = masked(0);
    const noseX = interpNaN(nx0);
    const diffs = new Float64Array(N);
    for (let i = 0; i < N; i++) diffs[i] = noseX[i] - S.hip.x[i];
    const d = median(diffs) > 0 ? 1 : -1;

    // Tỉ lệ px/cm dùng chung cho hai chân (findSteps: độ dài đùi + cẳng điển hình so với chiều cao).
    const pxcm = st.pxcm;

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

    // ---- Nhịp và chu kỳ ----
    // cadFFT: tần số trội của dao động dọc hông (2 lần nảy mỗi sải) trên cả đoạn, 1,2–4 Hz.
    const cadFFT = domFreq(S.hip.y, fps, 1.2, 4.0, Math.max(2, Math.round(fps * 0.5))) * 60;

    // ---- Chạm đất (IC) và nhấc chân (TO) ----
    // Lấy từ findSteps: IC = khung đầu bàn chân chạm mặt đất, TO = khung cuối, đo trên điểm thô (xem ghi chú ở findSteps).
    // Cách cũ (Zeni 2008: đỉnh cổ chân xa nhất trước hông, rồi chờ bàn chân hết hạ) bắt trễ 3–5 khung vì nhãn trái/phải bị tráo.
    // Đỉnh Zeni giờ chỉ là cận sớm: nếu cổ chân còn đang vươn ra trước sau khung "chạm" (thường là nhiễu điểm thấp) thì dời IC
    // tới đỉnh đó, miễn là bàn chân vẫn chạm đất.
    const mine = st.steps.filter((s) => s.side === side);
    const pick = (k, i) => [P.x[ids[k]][i], P.y[ids[k]][i]];
    const H = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    const oth = IDX[side === 'L' ? 'R' : 'L'];
    const vmin = (i) => Math.min(...['knee', 'ank', 'heel', 'toe'].map((k) => P.v[ids[k]][i]));
    const relRaw = (i) => d * (P.x[ids.ank][i] - P.x[ids.hip][i]);
    for (const s of mine) {
      let a = s.ic;
      while (a + 1 <= s.to && a - s.ic < Math.round(0.1 * fps) && relRaw(a + 1) > relRaw(a) + 0.5 * pxcm) a++;
      s.icZ = a;
    }
    // Phân loại từng bước theo độ rõ chân này ở khung IC: "rõ" = gối, cổ chân, gót, mũi đều ≥ VIS_MIN;
    // "cứu được" = thấp nhất ≥ VIS_LOW và qua kiểm tra hợp lý: đùi/cẳng trong ±20% độ dài điển hình (cả hai chân và riêng
    // các bước rõ của chân này), cổ chân không nhảy quá 35% cẳng chân so với khung trước/sau, gối cách gối chân kia > 1/4 đùi;
    // "mờ" = còn lại, bỏ khỏi số đo.
    const lens = (i) => [H(pick('hip', i), pick('knee', i)), H(pick('knee', i), pick('ank', i))];
    const own = mine.filter((s) => vmin(s.icZ) >= VIS_MIN).map((s) => lens(s.icZ));
    const ownT = own.length >= 2 ? median(own.map((v) => v[0])) : NaN, ownS = own.length >= 2 ? median(own.map((v) => v[1])) : NaN;
    const near = (v, ref) => !Number.isFinite(ref) || Math.abs(v - ref) <= 0.2 * ref;
    const stepQ = { clear: 0, rescued: 0, blur: 0 };
    const ic = [], to = [], nextIc = [], kinds = [];
    for (let m = 0; m < mine.length; m++) {
      const i = mine[m].icZ;
      let kind = 'blur';
      if (vmin(i) >= VIS_MIN) kind = 'clear';
      else if (vmin(i) >= VIS_LOW && i > 0 && i + 1 < N) {
        const [t, s] = lens(i);
        const jump = Math.max(H(pick('ank', i), pick('ank', i - 1)), H(pick('ank', i + 1), pick('ank', i)));
        const kk = H(pick('knee', i), [P.x[oth.knee][i], P.y[oth.knee][i]]);
        if (near(t, st.Lt) && near(s, st.Ls) && near(t, ownT) && near(s, ownS) && jump < 0.35 * st.Ls && kk > st.Lt / 4) kind = 'rescued';
      }
      stepQ[kind]++;
      if (kind === 'blur') continue;
      ic.push(i); to.push(mine[m].to); kinds.push(kind);
      nextIc.push(m + 1 < mine.length ? mine[m + 1].icZ : NaN);
    }
    if (ic.length < 2) throw new Error('chân ' + (side === 'L' ? 'trái' : 'phải') + ': phát hiện quá ít bước rõ (<2)');

    // Nhịp: cadIC theo trung vị khoảng cách giữa các lần chạm đất của chân này (mọi bước, kể cả bước mờ: mốc thời gian
    // lấy từ cả hai bàn chân nên không phụ thuộc độ rõ chân này). Hai cách khớp nhau trong 5% thì lấy cadFFT
    // (dùng cả đoạn, chính xác hơn đếm khung ±1); lệch hơn thì FFT có thể đã bắt nhầm hài (hông nảy không đều), lấy cadIC.
    const iv = [];
    for (let t = 0; t + 1 < mine.length; t++) iv.push(mine[t + 1].icZ - mine[t].icZ);
    const ivMed = median(iv);
    const cadSteps = iv.filter((v) => v <= 1.6 * ivMed).map((v) => (120 * fps) / v);
    const cadIC = (120 * fps) / ivMed;
    const cadence = Number.isFinite(cadFFT) && Math.abs(cadIC - cadFFT) <= 0.05 * cadFFT ? cadFFT : cadIC;

    // Dao động dọc: lọc thấp hông ở 2× tần số bước (bỏ nhiễu khung hình, giữ dạng nảy), biên độ đỉnh–đáy mỗi sải, lấy trung vị.
    const hipLP = smooth(S.hip.y, fps, Math.max(3, (2 * cadence) / 60));
    const vo = [];
    for (let t = 0; t + 1 < mine.length; t++) {
      const a = mine[t].icZ, b = mine[t + 1].icZ;
      if (b - a > 3 && b - a <= 1.6 * ivMed) {
        let mn = Infinity, mx = -Infinity;
        for (let i = a; i < b; i++) { mn = Math.min(mn, hipLP[i]); mx = Math.max(mx, hipLP[i]); }
        vo.push((mx - mn) / pxcm);
      }
    }
    const at = (arr, k) => median(Array.from(arr).slice(Math.max(k - 1, 0), k + 2));
    const kneeIc = ic.map((k) => at(kneeFlex, k));
    const shankIc = ic.map((k) => at(shank, k));
    const trunkIc = ic.map((k) => at(trunk, k));
    const over = ic.map((k) => at(rel, k) / pxcm);
    const fsa = ic.map((k) => at(foot, k));
    // knee_mid: gập gối lớn nhất trong pha trụ thật [IC, TO]; knee_swing: từ TO đến lần chạm đất sau; hip_ext: duỗi hông lúc nhấc chân.
    const kneeMid = [], kneeSwing = [], hipExt = [];
    for (let t = 0; t < ic.length; t++) {
      const k = ic[t], tt = to[t], k2 = nextIc[t];
      if (!(tt > k && tt < k2 && k2 - k <= 1.6 * ivMed)) continue;
      let mx = -Infinity;
      for (let i = k; i <= tt; i++) mx = Math.max(mx, kneeFlex[i]);
      kneeMid.push(mx);
      let ms = -Infinity;
      for (let i = tt; i <= k2; i++) ms = Math.max(ms, kneeFlex[i]);
      kneeSwing.push(ms);
      hipExt.push(-at(thigh, tt));
    }
    const fsaMed = median(fsa);
    const strike = fsaMed > 8 ? 'Gót' : fsaMed < -1.6 ? 'Mũi chân' : 'Giữa bàn';
    const per = {
      cadence: cadSteps, vert_osc: vo, trunk: trunkIc, knee_ic: kneeIc, shank_ic: shankIc, overstride: over,
      knee_mid: kneeMid, hip_ext: hipExt, knee_swing: kneeSwing,
    };
    const metrics = {};
    for (const k of Object.keys(per)) metrics[k] = median(per[k]);
    metrics.cadence = cadence;
    // Dưới ngưỡng tin cậy: ít hơn MIN_STEPS bước rõ. spread = nửa khoảng tứ phân vị giữa các bước (độ dao động giữa các bước,
    // KHÔNG phải sai số đã kiểm chứng).
    const lowConf = stepQ.clear < MIN_STEPS;
    const spread = {};
    for (const k of Object.keys(per)) spread[k] = per[k].length >= 2 ? (percentile(per[k], 75) - percentile(per[k], 25)) / 2 : NaN;
    // Nghi bắt sai mốc chạm đất: gối lúc chạm đất ngoài khoảng thường gặp, hoặc bàn chân chạm sau hông nhiều.
    const kneeBad = !(metrics.knee_ic >= KNEE_IC_OK[0] && metrics.knee_ic <= KNEE_IC_OK[1]);
    const overBad = metrics.overstride < OVER_MIN_CM;
    const icSuspect = kneeBad || overBad;
    const why = [];
    if (kneeBad && !Number.isFinite(metrics.knee_ic)) why.push('Không đo được gối lúc chạm đất');
    else if (kneeBad) why.push('Gối lúc chạm đất ' + Math.round(metrics.knee_ic) + '° ngoài ' + KNEE_IC_OK[0] + '–' + KNEE_IC_OK[1] + '°');
    if (overBad) why.push('Bàn chân chạm sau hông ' + Math.round(-metrics.overstride) + ' cm');
    const suspectReason = why.join('; ');
    // conf: độ rõ trung bình (0–1) các điểm đã dùng. Chỉ số đo ở chân: hông, gối, cổ chân, gót, mũi ở các khung chạm đất đã nhận.
    // Nhịp, dao động dọc, thân: vai và hông trên cả đoạn.
    const mv = (parts, frames) => { let a = 0, n = 0; for (const i of frames) for (const k of parts) { a += P.v[ids[k]][i]; n++; } return n ? a / n : NaN; };
    const legConf = mv(['hip', 'knee', 'ank', 'heel', 'toe'], ic);
    const allF = Array.from({ length: N }, (_, i) => i);
    const bodyConf = mv(['sh', 'hip'], allF);
    // flags[k]: hợp đồng dữ liệu cho phần hiển thị/điểm (score.js đọc extra.flags[k]).
    const flags = {};
    for (const k of Object.keys(per)) {
      const sus = icSuspect && IC_KEYS.includes(k);
      flags[k] = {
        lowConf, conf: ['cadence', 'vert_osc', 'trunk'].includes(k) ? bodyConf : legConf,
        spread: Number.isFinite(spread[k]) ? spread[k] : null, suspect: sus, suspectReason: sus ? suspectReason : '',
      };
    }
    const extra = {
      side, vis, strike, fsa: fsaMed, nSteps: ic.length, stepQ, lowConf, spread, icSuspect, suspectReason, flags,
      badFrac: badFrac(P, keys.map((k) => ids[k]), N), cadIC, cadFFT, pxcm, d,
    };
    const arrays = { S, ic, to, kinds, kneeFlex, trunk, d, rel, pxcm };
    return { metrics, extra, arrays };
  }

  function computeBoth(P0, fps, heightCm, speedMs) {
    const st = findSteps(P0, fps, heightCm);
    const P = st.P;
    const res = {}, errs = {};
    for (const s of ['L', 'R']) {
      try { res[s] = computeSide(P, fps, heightCm, speedMs, s, st); } catch (e) { errs[s] = e.message; }
    }
    if (!Object.keys(res).length) throw new Error(Object.values(errs).join('; ') || 'Không đo được');
    // P: bản đã ghi lại theo chân thật (bản vào không bị sửa), để vẽ khung xương khớp với số đo.
    return { res, errs, P, steps: st.steps, ground: st.ground };
  }

  // Bỏ chân "dưới ngưỡng tin cậy" khỏi phần tính điểm khi COUNT_LOWCONF = false (số vẫn hiện, kèm cờ và ±X).
  // score.js tự lọc theo extra.flags[k]; hàm này cho nơi cần bỏ cả chân.
  function scoreRes(res) {
    if (COUNT_LOWCONF) return res;
    const out = {};
    for (const s of Object.keys(res || {})) if (!res[s].extra.lowConf) out[s] = res[s];
    return out;
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
      for (let i = 0; i < N; i++) { const bad = !(P.v[j][i] >= VIS_MIN); xs[i] = bad ? NaN : P.x[j][i]; ys[i] = bad ? NaN : P.y[j][i]; vs += P.v[j][i]; }
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
      if (E.vis < VIS_MIN || W.vis < VIS_MIN) throw new Error('arm');
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
      if (H.vis < VIS_MIN) throw new Error('ear');
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
      for (let i = 0; i < N; i++) { const bad = !(P.v[j][i] >= VIS_MIN); xs[i] = bad ? NaN : P.x[j][i]; ys[i] = bad ? NaN : P.y[j][i]; vs += P.v[j][i]; }
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
    return { per, common, errs, extra: { vis, pxcm, steps, tilt0, badFrac: badFrac(P, ['L', 'R'].flatMap((s) => ['hip', 'knee', 'ank'].map((k) => IDX[s][k])), N) }, arrays: { ev, dy, tilt, lean, midX, own } };
  }

  // cfg.side (reference.js): "low" = chỉ thấp hơn lo mới là bất thường, "high" = chỉ cao hơn hi, mặc định cả hai phía
  // (khớp cách score.js trừ điểm, để chip Đánh giá không báo "cao"/"thấp" ở phía không bị trừ điểm).
  function rateValue(v, cfg) {
    if (v == null || Number.isNaN(v)) return 'n/a';
    const side = cfg.side || 'both';
    if (v < cfg.lo && side !== 'high') return 'thấp';
    if (v > cfg.hi && side !== 'low') return 'cao';
    return 'trong khoảng';
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

  const api = { VIS_MIN, VIS_LOW, COUNT_LOWCONF, IC_KEYS, KNEE_IC_OK, OVER_MIN_CM, scoreRes, findSteps, BAD_FRAC_MAX, MIN_STEPS, badFrac, IDX, COMMON, PERLEG, ASYM, median, percentile, smooth, filtfilt, findPeaks,
    computeSide, computeBoth, combine, computeExtra, BACK_PERLEG, BACK_COMMON, computeBack, fatigue, rateValue, resample };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Gait = api;
})(typeof window !== 'undefined' ? window : globalThis);
