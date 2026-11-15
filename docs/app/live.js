/* app/live.js - MediaPipe, khung xương và số đo trực tiếp trên màn đo (L2). Một phần của app cũ; cách chia sẻ biến xem đầu app/core.js. */
(function (App) {
  'use strict';
  const { $, Q, CFG, REF, CAD_REDO, BLUE, ORANGE, LINKS, S, refreshL1 } = App;
  // hàm ở file nạp sau: gọi qua App khi chạy
  function rr(...a) { return App.rr(...a); }
  function mScore(...a) { return App.mScore(...a); }
  // hàm của file này (khai báo function được nâng lên đầu nên đưa ra ngay)
  Object.assign(App, { plFresh, initPose, detect, layout, lvLevel, lvReset, lvRec, lvFeed, drawLive });
  // ---------- MediaPipe ----------
  // Pose Landmarker (@mediapipe/tasks-vision 1.2.2, tự host ở vendor/tasks-vision; xem VERSION.txt trong đó).
  // Video tải lên dùng mô hình Heavy (chính xác hơn, chậm hơn); quay trực tiếp dùng Full (đủ nhanh cho thời gian thực).
  // ?cx=0/1/2 ép một mô hình cho cả hai chế độ: lite/full/heavy.
  // ?mock=1 (mock_pose.js) và stub của test định nghĩa window.Pose kiểu @mediapipe/pose cũ: có window.Pose thì đi đường cũ.
  const PL_DIR = 'vendor/tasks-vision/', PL_VAR = ['lite', 'full', 'heavy'];
  const plVariant = (m) => (Q.get('cx') != null && PL_VAR[CFG.cx]) ? PL_VAR[CFG.cx] : m === 'file' ? 'heavy' : 'full';
  const PL = {};        // tên mô hình -> Promise<{ lm, v, delegate, last, off }>, tải một lần, lỗi thì lần sau tải lại
  let plFiles = null;   // Promise bộ wasm dùng chung cho mọi mô hình
  // Tạo một bộ nhận diện mới (GPU, máy không có WebGL2 thì CPU). only = chỉ thử đúng delegate đó.
  async function plCreate(v, only) {
    const V = window.Vision;
    if (!plFiles) { plFiles = V.FilesetResolver.forVisionTasks(new URL(PL_DIR + 'wasm', location.href).href); plFiles.catch(() => { plFiles = null; }); }
    const fs = await plFiles;
    const opt = (d) => ({ baseOptions: { modelAssetPath: PL_DIR + 'models/pose_landmarker_' + v + '.task', delegate: d }, runningMode: 'VIDEO', numPoses: 1,
      minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5, outputSegmentationMasks: false });
    const mk = async (d) => ({ lm: await V.PoseLandmarker.createFromOptions(fs, opt(d)), v, delegate: d, last: -Infinity, off: 0 });
    if (only) return mk(only);
    try { return await mk('GPU'); } catch (e) { return mk('CPU'); }
  }
  function plLoad(v) {
    if (!PL[v]) { PL[v] = plCreate(v); PL[v].catch(() => { delete PL[v]; }); }
    return PL[v];
  }
  // Video tải lên: bộ nhận diện chế độ VIDEO nhớ khung trước (làm mượt, bám người), nên trước lượt đoán quay chậm và trước
  // lượt phân tích chính thay bằng bộ MỚI, mốc thời gian bắt đầu lại từ 0 -> cùng video luôn ra cùng kết quả.
  async function plFresh() {
    const old = S.pl; if (!old) return;
    const p = await plCreate(old.v, old.delegate);
    if (S.pl !== old) { p.lm.close(); return; }   // trong lúc tạo đã đổi chế độ
    S.pl = p; PL[old.v] = Promise.resolve(p);
    try { old.lm.close(); } catch (e) { /* bỏ qua */ }
  }
  let poseWait = null;
  // Gọi lúc mở trang và mỗi lần đổi chế độ quay trực tiếp / video: nạp đúng mô hình của chế độ đang chọn (S.pl), xong mới bật nút đo.
  async function initPose() {
    if (S.pose) return;   // đường cũ đã sẵn sàng
    try {
      if (typeof window.Pose === 'function') {
        const pose = new Pose({ locateFile: (f) => 'vendor/pose/' + f });
        pose.setOptions({ modelComplexity: CFG.cx, smoothLandmarks: true, enableSegmentation: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        pose.onResults((r) => { if (poseWait) { const w = poseWait; poseWait = null; w(r); } });
        await pose.initialize();
        S.pose = pose; S.poseReady = true; S.poseInfo = 'mock';
      } else {
        if (!window.Vision) throw new Error('thiếu vendor/tasks-vision/vision_bundle.js');
        const v = plVariant(S.mode);
        if (S.pl && S.pl.v === v) return;
        S.pl = null; S.poseReady = false; refreshL1();
        const p = await plLoad(v);
        if (plVariant(S.mode) !== v) return;   // trong lúc tải đã đổi chế độ: lần gọi mới lo
        S.pl = p; S.poseReady = true; S.poseInfo = v + '/' + p.delegate;
      }
    } catch (e) {
      $('msg1').textContent = 'Không tải được mô hình nhận diện: ' + e.message;
    }
    refreshL1();
  }
  // Trả về { poseLandmarks } giống @mediapipe/pose cũ (x, y chuẩn hóa 0..1, visibility) để phần tính chỉ số không phải đổi.
  // tMs: mốc thời gian của khung (ms; video tải lên = thời điểm tính từ điểm bắt đầu, bộ mới nên bắt đầu từ 0; quay trực tiếp = đồng hồ máy).
  // Pose Landmarker bắt buộc mốc tăng dần: khi mốc lùi lại (phòng hờ) thì cộng bù để cách khung trước 1 giây.
  function detect(video, tMs) {
    if (S.pose) return new Promise((res) => { poseWait = res; S.pose.send({ image: video }).catch(() => res(null)); });
    const p = S.pl; if (!p) return Promise.resolve(null);
    let ts = (tMs == null ? performance.now() : tMs) + p.off;
    if (ts <= p.last) { p.off += p.last + 1000 - ts; ts = p.last + 1000; }
    p.last = ts;
    try { const r = p.lm.detectForVideo(video, ts); return Promise.resolve({ poseLandmarks: r.landmarks && r.landmarks[0] }); }
    catch (e) { return Promise.resolve(null); }
  }

  // ---------- Lớp 2: chạy + thu ----------
  const v2 = $('v2'), ov = $('ov'), octx = ov.getContext('2d');
  const grab = document.createElement('canvas'), gctx = grab.getContext('2d');

  function layout() {
    const dpr = window.devicePixelRatio || 1;
    ov.width = ov.clientWidth * dpr; ov.height = ov.clientHeight * dpr;
  }
  window.addEventListener('resize', layout);
  // khung #ov đổi cỡ mà cửa sổ không đổi (thanh điều hướng, xoay máy) thì vẽ lại theo cỡ mới, tránh khung xương bị kéo giãn lệch khỏi người
  if (window.ResizeObserver) new ResizeObserver(() => { if (ov.clientWidth) { layout(); drawLive(S.lastLm); } }).observe(ov);
  v2.addEventListener('resize', () => drawLive(S.lastLm));

  // ---------- Hiển thị trực tiếp trên màn đo (gói 2) ----------
  // Số live chỉ là ƯỚC TÍNH trên ~6 giây gần nhất, tính lại mỗi giây bằng đúng Gait.computeBoth/combine như lúc ra kết quả;
  // không ghi vào S.frames, không ảnh hưởng điểm cuối.
  const LV_WIN = 6, LEAF = '#A9D69B';
  // màu mức: cùng bộ màu trạng thái của dòng #ph trên màn đo (ok/wn/rec); camera.css có bản sao cho thẻ số (.lvc[data-lv])
  const LV_COL = { ok: '#33d6a0', mid: '#ffb03b', bad: '#ff5a45', none: LEAF };
  const LV = { buf: [], wave: [], st: null, side: 'L', tCalc: -1e9, sec: null, wv: null, fix: null, hist: [], steps: { L: 0, R: 0 }, lastIc: { L: -1e9, R: -1e9 }, per: null };
  const LV_LEG = { L: '#6AA8FF', R: '#FFA94D' };   // màu chân trái/phải trên đồ thị trực tiếp (xanh dương/cam, khác nhau cả về độ sáng)
  // Mức theo thang lâm sàng (Score.level: Tốt = xanh, Chú ý = vàng, Bất thường = đỏ; mốc ở reference.js lo/hi + warn).
  // Chỉ số chưa có thang mới (góc sau lưng): cách cũ theo mScore (100 = xanh, 1–99 = vàng, 0 = đỏ).
  function lvLevel(k, v) {
    const lv = Score.level(k, v); if (lv) return lv;
    if (Score.band(k)) return 'none';
    const s = mScore(k, v); return s == null ? 'none' : s === 100 ? 'ok' : s > 0 ? 'mid' : 'bad';
  }
  const LV_CARDS = [['cadence', 'Cadence', 'bước/phút'], ['knee_ic', 'Gập gối lúc chạm', '°'], ['trunk', 'Nghiêng thân', '°']];   // nhãn giống thẻ số ở màn kết quả
  // Quay sau lưng: không có góc gối nhìn ngang, chỉ hiện các chỉ số nhìn từ sau (gait.js computeBack); chỉ số từng chân hiện chân lệch nhiều hơn
  const LV_CARDS_BACK = [['pelvic_drop', 'Sụt hông', '°'], ['knee_valgus', 'Gối đổ vào', '°'], ['lat_trunk', 'Thân lắc', '°']];
  const LV_PERLEG_BACK = ['pelvic_drop', 'knee_valgus'];
  const lvCardsHTML = (list) => list.map(([k, t, u]) => '<div class="lvc" data-k="' + k + '" data-u="' + u + '" data-lv="none"><em>' + t + '</em><b>–</b><small>' + (u === '°' ? '' : u) + '</small></div>').join('');
  const lvBox = document.createElement('div'); lvBox.id = 'lv';
  lvBox.innerHTML = '<div id="lvrec" hidden><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19"/><circle id="lvarc" cx="22" cy="22" r="19" pathLength="100"/></svg><b id="lvsec"></b><span><i></i>REC</span></div>' +
    '<div id="lvcards">' + lvCardsHTML(LV_CARDS) + '</div>' +
    '<div id="lvw"><div><em>Góc gối <span id="lvwside"></span></em><b id="lvwv"></b></div><canvas id="lvwave"></canvas>' +
    // Bảng theo dõi mở rộng (quay ngang, màn hình rộng): cadence và nghiêng thân từ đầu buổi, vạch chạm đất 6 giây gần nhất
    '<div id="lvtrend"><div><em>Cadence</em><span id="lvcadr"></span></div><canvas id="lvcad"></canvas><div><em>Nghiêng thân</em><span id="lvtrr"></span></div><canvas id="lvtr"></canvas><div><em>Nhịp bước</em><span>6 giây gần nhất</span></div><canvas id="lvst"></canvas></div></div>' +
    '<table id="lvtbl"><thead><tr><th></th><th style="color:' + LV_LEG.L + '">Trái</th><th style="color:' + LV_LEG.R + '">Phải</th></tr></thead><tbody>' +
    [['knee', 'Gập gối lúc chạm'], ['ov', 'Đặt chân trước hông']]   /* bác sĩ Kiên 11/11: chỉ hiện số đo và đồ thị, không hiện thông số video hay tỷ lệ khung hình lỗi */.map(([k, t]) => '<tr><td>' + t + '</td><td data-c="' + k + 'L">–</td><td data-c="' + k + 'R">–</td></tr>').join('') + '</tbody></table>';
  $('L2').insertBefore(lvBox, $('chip'));
  const lvWaveCv = $('lvwave'), wctx = lvWaveCv.getContext('2d');
  // điểm thân trên MediaPipe (gait.js không xuất ra): tai, khuỷu, cổ tay; ngưỡng rõ để vẽ thân trên và góc chân bên xa camera
  const LV_XI = { L: { ear: 7, elb: 13, wri: 15 }, R: { ear: 8, elb: 14, wri: 16 } }, LV_VIS_UP = 0.3, LV_VIS_FAR = 0.5;
  const sideTxt = (s) => (s === 'L' ? 'chân trái' : 'chân phải');

  // góc tức thời một bên, tính trên toạ độ điểm ảnh (cùng định nghĩa gait.js: gối = 180 - góc hông-gối-cổ chân; hông = đùi so với phương thẳng đứng)
  function lvAngles(lm, side, vw, vh, vmin = Gait.VIS_MIN) {
    const I = Gait.IDX[side];
    if (!(lm[I.hip].visibility >= vmin && lm[I.knee].visibility >= vmin && lm[I.ank].visibility >= vmin)) return null;
    const hx = lm[I.hip].x * vw, hy = lm[I.hip].y * vh, kx = lm[I.knee].x * vw, ky = lm[I.knee].y * vh, ax = lm[I.ank].x * vw, ay = lm[I.ank].y * vh;
    const ang = (ux, uy, wx, wy) => Math.acos(Math.max(-1, Math.min(1, (ux * wx + uy * wy) / (Math.hypot(ux, uy) * Math.hypot(wx, wy) + 1e-9)))) * 180 / Math.PI;
    return { knee: 180 - ang(hx - kx, hy - ky, ax - kx, ay - ky), hip: ang(0, 1, kx - hx, ky - hy) };
  }
  function lvPickSide(lm) {   // chưa có ước tính thì lấy bên thấy rõ hơn ở khung hiện tại
    const v = (s) => { const I = Gait.IDX[s]; return (lm[I.hip].visibility || 0) + (lm[I.knee].visibility || 0) + (lm[I.ank].visibility || 0); };
    return v('L') >= v('R') ? 'L' : 'R';
  }
  function lvReset() {
    LV.buf = []; LV.wave = []; LV.st = null; LV.tCalc = -1e9; LV.wv = null; LV.side = 'L';
    LV.fix = null; LV.hist = []; LV.steps = { L: 0, R: 0 }; LV.lastIc = { L: -1e9, R: -1e9 }; LV.per = null;
    const back = S.take === 'back', tk = S.take || 'side';
    if ((lvBox.dataset.take || 'side') !== tk) { lvBox.dataset.take = tk; $('lvcards').innerHTML = lvCardsHTML(back ? LV_CARDS_BACK : LV_CARDS); }
    $('lvw').hidden = back;   // sóng góc gối chỉ có nghĩa khi quay ngang
    $('lvtbl').hidden = back; lvTable(); lvTrend(0);
    $('lvwv').textContent = ''; $('lvwside').textContent = ''; lvCards(); lvRec(null); wctx.clearRect(0, 0, lvWaveCv.width, lvWaveCv.height);
  }
  function lvCards() {
    for (const el of lvBox.querySelectorAll('.lvc')) {
      const k = el.dataset.k, v = LV.st ? LV.st[k] : null, ok = v != null && !Number.isNaN(v);
      el.querySelector('b').textContent = ok ? (k === 'trunk' || S.take === 'back' ? v.toFixed(1) : String(Math.round(v))) + (el.dataset.u === '°' ? '°' : '') : '–';
      el.dataset.lv = ok ? lvLevel(k, v) : 'none';
      if (k === 'cadence' && ok && S.take !== 'back') {   // dưới CAD_REDO: nghi chân bên xa bị che, không hiện như số bình thường
        const low = v < CAD_REDO;
        if (low) { el.querySelector('b').textContent = '~' + Math.round(v) + '?'; el.dataset.lv = 'mid'; }
        el.querySelector('small').textContent = low ? 'nghi đo thiếu bước' : el.dataset.u;
      }
      if (k === 'knee_ic') el.querySelector('small').textContent = LV.st ? sideTxt(LV.side) : '';
      if (LV_PERLEG_BACK.includes(k)) el.querySelector('small').textContent = ok && LV.st.leg[k] ? sideTxt(LV.st.leg[k]) : '';
    }
  }
  // vòng đếm ngược đoạn thu + chấm REC; sec = số giây còn lại (đúng số trên dòng trạng thái), frac = phần còn lại 0–1; sec = null thì ẩn
  function lvRec(sec, frac) {
    const box = $('lvrec');
    if (sec == null) { if (!box.hidden) box.hidden = true; LV.sec = null; return; }
    box.hidden = false;
    $('lvarc').style.strokeDashoffset = String(100 * (1 - Math.max(0, Math.min(1, frac))));
    if (sec !== LV.sec) { LV.sec = sec; $('lvsec').textContent = sec; }
  }
  // gọi sau mỗi lần nhận diện; t = giây (thời gian của người chạy)
  function lvFeed(t, lm) {
    if (!S.take) return;   // chưa nhận góc: chưa tính chỉ số
    const vw = v2.videoWidth, vh = v2.videoHeight;
    if (lm && vw) LV.buf.push({ t, lm: lm.map((q) => ({ x: q.x * vw, y: q.y * vh, v: q.visibility == null ? 1 : q.visibility })) });
    while (LV.buf.length && LV.buf[0].t < t - LV_WIN) LV.buf.shift();
    if (t - LV.tCalc >= 1 && LV.buf.length >= 30 && t - LV.buf[0].t >= 4) {
      LV.tCalc = t;
      try {
        const { P } = Gait.resample(LV.buf, 30);
        if (S.take === 'back') LV.st = lvBackStat(Gait.computeBack(P, 30, (S.sub && S.sub.height) || 165));
        else {
          const { res } = Gait.computeBoth(P, 30, (S.sub && S.sub.height) || 165, App.SPEED);
          const cm = Gait.combine(res, App.SPEED).common;
          const side = res.L && res.R ? (res.L.extra.vis >= res.R.extra.vis ? 'L' : 'R') : res.L ? 'L' : 'R';
          LV.side = side; LV.st = { cadence: cm.cadence, trunk: cm.trunk, knee_ic: res[side].metrics.knee_ic, hip_ext: res[side].metrics.hip_ext };
          // Bảng mở rộng: sóng gối hai chân theo nhãn đã gỡ nhầm trái/phải (arrays.kneeFlex), lịch sử cadence/nghiêng thân, đếm bước.
          const t0w = LV.buf[0].t;
          LV.fix = { t0: t0w, tEnd: t, L: res.L ? res.L.arrays.kneeFlex : null, R: res.R ? res.R.arrays.kneeFlex : null, ic: { L: res.L ? res.L.arrays.ic.map((i) => t0w + i / 30) : [], R: res.R ? res.R.arrays.ic.map((i) => t0w + i / 30) : [] } };
          LV.hist.push({ t, cad: cm.cadence, trunk: cm.trunk });
          // đếm bước dồn: chỉ nhận lần chạm đất mới hơn lần đã đếm 0,25 giây và đã lùi khỏi mép cửa sổ 0,4 giây (mép cửa sổ còn đổi)
          for (const sd of ['L', 'R']) for (const ti of LV.fix.ic[sd]) if (ti > LV.lastIc[sd] + 0.25 && ti <= t - 0.4) { LV.steps[sd]++; LV.lastIc[sd] = ti; }
          LV.per = {};
          for (const sd of ['L', 'R']) LV.per[sd] = res[sd] ? { knee: res[sd].metrics.knee_ic, ov: res[sd].metrics.overstride, clear: 1 - res[sd].extra.badFrac } : null;
        }
      } catch (e) { LV.st = null; }
      lvCards(); if (S.take !== 'back') { lvTable(); lvTrend(t); }
    }
    if (S.take === 'back') return;   // không có sóng góc gối khi quay sau lưng
    const side = LV.st ? LV.side : lm ? lvPickSide(lm) : LV.side;
    const a = lm && vw ? lvAngles(lm, side, vw, vh) : null;
    LV.wave.push({ t, v: a ? a.knee : null });
    while (LV.wave.length && LV.wave[0].t < t - LV_WIN) LV.wave.shift();
    const wv = a ? Math.round(a.knee) + '°' : '–';
    if (wv !== LV.wv) { LV.wv = wv; $('lvwv').textContent = wv; $('lvwside').textContent = '· ' + sideTxt(side); }
    lvWave(t);
  }
  // Chỉ số sau lưng cho thẻ live: mỗi chỉ số từng chân lấy chân lệch nhiều hơn (mức xấu hơn, cùng mức thì trị tuyệt đối lớn hơn)
  function lvBackStat(b) {
    const RANK = { bad: 3, mid: 2, ok: 1, none: 0 }, st = { lat_trunk: b.common.lat_trunk, leg: {}, per: b.per };
    for (const k of LV_PERLEG_BACK) {
      let best = null;
      for (const s of ['L', 'R']) {
        const v = b.per[s] ? b.per[s][k] : NaN; if (v == null || Number.isNaN(v)) continue;
        const r = RANK[lvLevel(k, v)];
        if (!best || r > best.r || (r === best.r && Math.abs(v) > Math.abs(best.v))) best = { s, v, r };
      }
      st[k] = best ? best.v : NaN; st.leg[k] = best ? best.s : null;
    }
    return st;
  }
  function lvWave(tNow) {   // sóng góc gối 6 giây gần nhất, trục 0–130°: hai chân theo nhãn đã gỡ nhầm (mỗi giây cập nhật), đuôi mới nhất là điểm thô của chân đang theo dõi
    const dpr = window.devicePixelRatio || 1, w = Math.round(lvWaveCv.clientWidth * dpr), h = Math.round(lvWaveCv.clientHeight * dpr);
    if (!w || !h) return;
    if (lvWaveCv.width !== w || lvWaveCv.height !== h) { lvWaveCv.width = w; lvWaveCv.height = h; }
    const c = wctx; c.clearRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = dpr;
    for (const g of [0, 60, 120]) { const y = Math.round(h - 2 * dpr - (g / 130) * (h - 4 * dpr)) + 0.5; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    const X = (t) => w - ((tNow - t) / LV_WIN) * w, Y = (v) => h - 2 * dpr - (Math.max(0, Math.min(130, v)) / 130) * (h - 4 * dpr);
    c.lineJoin = 'round'; c.lineCap = 'round';
    const line = (pts, col, lw) => {
      c.beginPath(); let pen = false;
      for (const q of pts) { if (q.v == null || Number.isNaN(q.v)) { pen = false; continue; } const x = X(q.t), y = Y(q.v); if (pen) c.lineTo(x, y); else c.moveTo(x, y); pen = true; }
      c.strokeStyle = col; c.lineWidth = lw * dpr; c.stroke();
    };
    const fx = LV.fix, side = LV.st ? LV.side : null;
    if (fx) for (const sd of ['L', 'R']) {
      const a = fx[sd]; if (!a) continue;
      const pts = []; for (let i = 0; i < a.length; i++) { const t = fx.t0 + i / 30; if (t >= tNow - LV_WIN) pts.push({ t, v: a[i] }); }
      line(pts, LV_LEG[sd], 2);
    }
    const tail = fx ? LV.wave.filter((q) => q.t >= fx.tEnd) : LV.wave;
    line(tail, side ? LV_LEG[side] : LEAF, 2);
  }
  function lvTable() {
    const set = (k, txt) => { const el = lvBox.querySelector('[data-c="' + k + '"]'); if (el && el.textContent !== txt) el.textContent = txt; };
    const num = (v, f) => (v == null || Number.isNaN(v) ? '–' : f(v));
    for (const sd of ['L', 'R']) {
      const p = LV.per && LV.per[sd];
      set('knee' + sd, num(p && p.knee, (v) => Math.round(v) + '°'));
      set('ov' + sd, num(p && p.ov, (v) => Math.round(v) + ' cm'));
      set('n' + sd, LV.per ? String(LV.steps[sd]) : '–');
      set('clear' + sd, num(p && p.clear, (v) => Math.round(v * 100) + '%'));
    }
  }
  // Đồ thị cadence và nghiêng thân từ đầu buổi (mỗi giây một điểm ước tính), dải mờ = khoảng tham chiếu trong reference.js; vạch chạm đất 6 giây gần nhất.
  function lvTrend(tNow) {
    const dpr = window.devicePixelRatio || 1;
    const prep = (id) => { const cv = $(id), w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr); if (!w || !h) return null; if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } const c = cv.getContext('2d'); c.clearRect(0, 0, w, h); return { c, w, h }; };
    const H = LV.hist, tA = H.length ? H[0].t : 0, tB = Math.max(tNow, tA + 30);
    const series = (id, key, lo, hi, yMin, yMax, col) => {
      const g = prep(id); if (!g) return;
      const { c, w, h } = g, X = (t) => ((t - tA) / (tB - tA)) * w, Y = (v) => h - dpr - ((Math.max(yMin, Math.min(yMax, v)) - yMin) / (yMax - yMin)) * (h - 2 * dpr);
      if (lo != null && hi != null) { c.fillStyle = 'rgba(124,255,107,.14)'; c.fillRect(0, Y(hi), w, Y(lo) - Y(hi)); }
      c.beginPath(); let pen = false;
      for (const q of H) { const v = q[key]; if (v == null || Number.isNaN(v)) { pen = false; continue; } if (pen) c.lineTo(X(q.t), Y(v)); else c.moveTo(X(q.t), Y(v)); pen = true; }
      c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = col; c.lineWidth = 2 * dpr; c.stroke();
    };
    const rc = REF.cadence || {}, rt = REF.trunk || {};
    const cads = H.map((q) => q.cad).filter((v) => v != null && !Number.isNaN(v));   // trục cadence nới theo số đo để đường không dính mép
    series('lvcad', 'cad', rc.lo, rc.hi, Math.min(130, Math.min.apply(null, cads.concat(130)) - 8), Math.max(200, Math.max.apply(null, cads.concat(200)) + 8), '#7CFF6B');
    series('lvtr', 'trunk', rt.lo, rt.hi, 0, 20, '#5FE0C2');
    $('lvcadr').textContent = rc.lo != null ? 'vùng tham khảo ' + rc.lo + '–' + rc.hi : '';
    $('lvtrr').textContent = rt.lo != null ? 'vùng tham khảo ' + rt.lo + '–' + rt.hi + '°' : '';
    const g = prep('lvst'); if (!g || !LV.fix) return;
    for (const sd of ['L', 'R']) { g.c.fillStyle = LV_LEG[sd]; for (const ti of LV.fix.ic[sd]) { const x = g.w - ((tNow - ti) / LV_WIN) * g.w; if (x >= 0) g.c.fillRect(Math.round(x) - 2 * dpr, sd === 'L' ? 0 : g.h / 2 + dpr, 4 * dpr, g.h / 2 - dpr); } }
  }

  function drawLive(lm) {
    const W = ov.width, H = ov.height; octx.clearRect(0, 0, W, H);
    if (!lm || !v2.videoWidth) return;
    const vw = v2.videoWidth, vh = v2.videoHeight, sc = Math.min(W / vw, H / vh);
    const ox = (W - vw * sc) / 2, oy = (H - vh * sc) / 2;
    const p = (j) => [ox + lm[j].x * vw * sc, oy + lm[j].y * vh * sc];
    const dpr = window.devicePixelRatio || 1, lw = Math.max(3, W / 500), rad = Math.max(4, W / 380);
    const near = LV.st ? LV.side : lvPickSide(lm), lev = (k) => LV_COL[LV.st ? lvLevel(k, LV.st[k]) : 'none'];
    const c = octx; c.lineCap = 'round'; c.lineJoin = 'round';
    if (S.take === 'back') { drawLiveBack(c, p, lw, rad, dpr, W); return; }
    // khung xương màu Savita phát sáng (quầng rộng mờ rồi nét chính; không dùng shadowBlur cho nhẹ); bên xa camera mờ hơn
    // thân trên (tai, khuỷu, cổ tay) chỉ vẽ khi điểm đủ rõ; chân giữ như cũ
    const far = near === 'L' ? 'R' : 'L', seen = (j) => lm[j] && !(lm[j].visibility < LV_VIS_UP);
    for (const side of [far, near]) {
      const ids = Gait.IDX[side], xi = LV_XI[side], fa = side === near ? 1 : 0.45;
      const segs = LINKS.map(([a, b]) => [ids[a], ids[b], side === near && a === 'sh' ? lev('trunk') : LEAF])
        .concat([[ids.sh, xi.ear], [ids.sh, xi.elb], [xi.elb, xi.wri]].filter(([a, b]) => seen(a) && seen(b)).map(([a, b]) => [a, b, LEAF]));
      for (const pass of [0, 1]) {
        c.globalAlpha = fa * (pass ? 1 : 0.22); c.lineWidth = pass ? lw : lw * 3.4;
        for (const [a, b, col] of segs) {
          const A = p(a), B = p(b); c.strokeStyle = col;
          c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke();
        }
      }
      c.globalAlpha = fa;
      for (const k of Object.keys(ids)) {
        const A = p(ids[k]), col = side !== near ? LEAF : k === 'knee' ? lev('knee_ic') : k === 'hip' ? lev('hip_ext') : k === 'sh' ? lev('trunk') : LEAF;
        c.fillStyle = col; c.beginPath(); c.arc(A[0], A[1], rad, 0, 7); c.fill();
      }
      c.fillStyle = LEAF;
      for (const j of [xi.ear, xi.elb, xi.wri]) if (seen(j)) { const A = p(j); c.beginPath(); c.arc(A[0], A[1], rad * 0.85, 0, 7); c.fill(); }
    }
    c.globalAlpha = 1;
    // Góc khớp tính một lần mỗi khung, trên toạ độ điểm ảnh của video (không méo theo khung hiển thị)
    const I = Gait.IDX[near], X = LV_XI[near], q = (j) => [lm[j].x * vw, lm[j].y * vh];
    const deg = 180 / Math.PI;
    const ang3 = (a, b, e) => { const u = [a[0] - b[0], a[1] - b[1]], w = [e[0] - b[0], e[1] - b[1]]; return Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1]) / (Math.hypot(u[0], u[1]) * Math.hypot(w[0], w[1]) + 1e-9)))) * deg; };
    const d = Math.sign(lm[I.toe].x - lm[I.heel].x) || 1;   // hướng chạy trên ảnh: mũi chân so với gót chân gần camera
    const lean = (lo, hi) => Math.atan2((hi[0] - lo[0]) * d, lo[1] - hi[1]) * deg;   // nghiêng về trước (+) so với phương thẳng đứng
    const a = lvAngles(lm, near, vw, vh), af = lvAngles(lm, far, vw, vh, LV_VIS_FAR);
    // cung góc tại hông và gối bên gần camera (số độ đặt trong ô nhãn bên dưới)
    const Hp = p(I.hip), K = p(I.knee), A2 = p(I.ank);
    if (a) {
      const r = Math.max(16 * dpr, Math.min(56 * dpr, Math.hypot(K[0] - Hp[0], K[1] - Hp[1]) * 0.32));
      const arcAt = (P0, a1, a2, col) => {
        let dd = a2 - a1; while (dd > Math.PI) dd -= 2 * Math.PI; while (dd < -Math.PI) dd += 2 * Math.PI;
        c.fillStyle = col; c.globalAlpha = 0.22; c.beginPath(); c.moveTo(P0[0], P0[1]); c.arc(P0[0], P0[1], r, a1, a1 + dd, dd < 0); c.closePath(); c.fill();
        c.globalAlpha = 1; c.strokeStyle = col; c.lineWidth = Math.max(2, lw * 0.7); c.beginPath(); c.arc(P0[0], P0[1], r, a1, a1 + dd, dd < 0); c.stroke();
      };
      arcAt(Hp, Math.PI / 2, Math.atan2(K[1] - Hp[1], K[0] - Hp[0]), lev('hip_ext'));
      arcAt(K, Math.atan2(K[1] - Hp[1], K[0] - Hp[0]), Math.atan2(A2[1] - K[1], A2[0] - K[0]), lev('knee_ic'));
    }
    // Ô số góc nhỏ kiểu Ochy: chỉ số độ, đặt ra ngoài thân theo hướng của đoạn chi, có vạch nối về khớp; né nhau và không tràn mép
    const fs = Math.round(Math.max(13, Math.min(26, Math.min(W, H) / dpr / 40)) * dpr), bh = Math.round(fs * 1.45);
    c.font = '700 ' + fs + 'px "Segoe UI",system-ui,Arial'; c.textBaseline = 'middle'; c.textAlign = 'center';
    const placed = [];
    const tag = (J, val, col, dir, alpha) => {
      if (!J || !isFinite(val)) return;
      const txt = Math.round(val) + '°', bw = Math.round(c.measureText(txt).width + fs * 0.7);
      let x = J[0] + dir * (rad * 3.5 + bw / 2) - bw / 2, y = J[1] - bh / 2;
      x = Math.max(2 * dpr, Math.min(W - bw - 2 * dpr, x));
      for (let t = 0; t < 6 && placed.some((b) => x < b[0] + b[2] + 3 * dpr && b[0] < x + bw + 3 * dpr && y < b[1] + b[3] + 3 * dpr && b[1] < y + bh + 3 * dpr); t++) y += bh + 4 * dpr;
      y = Math.max(2 * dpr, Math.min(H - bh - 2 * dpr, y)); placed.push([x, y, bw, bh]);
      const ex = dir > 0 ? x : x + bw;
      c.globalAlpha = alpha * 0.8; c.strokeStyle = col; c.lineWidth = Math.max(1, dpr);
      c.beginPath(); c.moveTo(J[0], J[1]); c.lineTo(ex, y + bh / 2); c.stroke();
      c.globalAlpha = alpha; c.fillStyle = 'rgba(8,19,11,.82)'; rr(c, x, y, bw, bh, 4 * dpr); c.fill();
      c.strokeStyle = col; c.lineWidth = 1.5 * dpr; c.stroke();
      c.fillStyle = col; c.fillText(txt, x + bw / 2, y + bh / 2 + dpr * 0.5);
    };
    const away = (j, from, dflt) => Math.sign(p(j)[0] - p(from)[0]) || dflt;
    const Sh = p(I.sh), mid = [(Sh[0] + Hp[0]) / 2, (Sh[1] + Hp[1]) / 2];
    if (seen(X.ear)) tag(p(X.ear), lean(q(I.sh), q(X.ear)), LEAF, -d, 1);           // đầu/cổ: đường vai-tai so với phương thẳng đứng
    tag(mid, lean(q(I.hip), q(I.sh)), lev('trunk'), -d, 1);                            // thân: hông-vai so với phương thẳng đứng
    if (seen(X.elb) && seen(X.wri)) tag(p(X.elb), ang3(q(I.sh), q(X.elb), q(X.wri)), LEAF, away(X.elb, I.sh, -d), 1);   // khuỷu: góc vai-khuỷu-cổ tay
    if (a) { tag(Hp, a.hip, lev('hip_ext'), -d, 1); tag(K, a.knee, lev('knee_ic'), away(I.knee, I.hip, d), 1); }
    if (a) tag(A2, ang3(q(I.knee), q(I.ank), q(I.toe)), LEAF, away(I.ank, I.knee, d), 1);   // cổ chân: góc gối-cổ chân-mũi chân
    if (af) { const F = Gait.IDX[far]; tag(p(F.hip), af.hip, LEAF, -d, 0.6); tag(p(F.knee), af.knee, LEAF, away(F.knee, F.hip, d), 0.6); }
    c.globalAlpha = 1;
  }
  // Khung xương khi quay sau lưng: hai chân rõ như nhau (không có bên gần/xa), đường ngang hai hông và hai vai, nhãn Trái/Phải theo chân thật (đã fixLR).
  // Chấm gối/hông tô theo mức gối đổ vào/sụt hông của đúng chân đó; vai theo thân lắc. Không vẽ cung góc gối (đó là góc nhìn ngang).
  function drawLiveBack(c, p, lw, rad, dpr, W) {
    const ok = (v) => v != null && !Number.isNaN(v);
    const levLeg = (k, s) => { const v = LV.st && LV.st.per && LV.st.per[s] ? LV.st.per[s][k] : NaN; return LV_COL[ok(v) ? lvLevel(k, v) : 'none']; };
    const levT = LV_COL[LV.st && ok(LV.st.lat_trunk) ? lvLevel('lat_trunk', LV.st.lat_trunk) : 'none'];
    const line = (A, B, col) => { for (const pass of [0, 1]) { c.globalAlpha = pass ? 1 : 0.22; c.strokeStyle = col; c.lineWidth = pass ? lw : lw * 3.4; c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke(); } };
    const IL = Gait.IDX.L, IR = Gait.IDX.R;
    line(p(IL.hip), p(IR.hip), LEAF); line(p(IL.sh), p(IR.sh), levT);
    for (const s of ['L', 'R']) {
      const ids = Gait.IDX[s];
      for (const [a, b] of LINKS) line(p(ids[a]), p(ids[b]), a === 'sh' ? levT : LEAF);
      c.globalAlpha = 1;
      for (const k of Object.keys(ids)) {
        const A = p(ids[k]), col = k === 'knee' ? levLeg('knee_valgus', s) : k === 'hip' ? levLeg('pelvic_drop', s) : k === 'sh' ? levT : LEAF;
        c.fillStyle = col; c.beginPath(); c.arc(A[0], A[1], rad, 0, 7); c.fill();
      }
    }
    const fs = Math.round((W / dpr < 640 ? 13 : 16) * dpr);
    c.font = '700 ' + fs + 'px "Segoe UI",system-ui,Arial'; c.textBaseline = 'middle'; c.textAlign = 'center';
    for (const s of ['L', 'R']) {
      const A = p(Gait.IDX[s].ank), txt = s === 'L' ? 'Trái' : 'Phải', tw = c.measureText(txt).width + fs * 0.9, th = fs * 1.6, y = A[1] + fs * 2;
      c.fillStyle = 'rgba(8,19,11,.78)'; rr(c, A[0] - tw / 2, y - th / 2, tw, th, th / 2); c.fill();
      c.fillStyle = s === 'L' ? BLUE : ORANGE; c.fillText(txt, A[0], y + dpr * 0.5);
    }
    c.globalAlpha = 1;
  }
  Object.assign(App, { v2, grab, gctx, LEAF, LV_COL, LV_CARDS, LV_CARDS_BACK, LV_PERLEG_BACK, LV_XI,
    LV_VIS_UP, sideTxt });
})(window.App);
