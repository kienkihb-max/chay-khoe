/* app.js - giao diện 3 lớp + camera + MediaPipe + đo + vẽ kết quả. Chạy hoàn toàn trong trình duyệt. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const Q = new URLSearchParams(location.search);
  const CFG = {
    total: +(Q.get('total') || 120),   // tổng thời gian chạy (giây)
    rec: +(Q.get('rec') || 50),        // thời điểm bắt đầu thu
    clip: Math.max(+(Q.get('clip') || 15), 6), // độ dài đoạn thu
    pace: +(Q.get('pace') || 6),       // phút/km
    cx: +(Q.get('cx') || 1),           // độ phức tạp mô hình (0,1,2)
    fps: 30,
    res: 720,
  };
  const CONTACT = 'bacsikien.com  ·  0345 901 772';   // in ở cuối trang 2 của PDF; sửa tại đây
  let SPEED0 = 1000 / (CFG.pace * 60);
  let SPEED = SPEED0;   // m/s
  const REF = (window.GAIT_REF || {}).metrics || {};
  const BLUE = '#2F6FEB', ORANGE = '#E8890C', GREEN = '#0B7A5C', AMBER = '#B7791F';
  const LINKS = [['sh', 'hip'], ['hip', 'knee'], ['knee', 'ank'], ['ank', 'heel'], ['heel', 'toe'], ['ank', 'toe']];

  const S = {
    stream: null, pose: null, poseReady: false, camReady: false,
    nextId: 1, rows: [], busy: false, running: false,
    mode: 'live', file: null, fileUrl: null, sub: null, t0: 0, frames: [], jobs: [], result: null, computing: false, lastLm: null, abort: false,
  };
  try { S.rows = JSON.parse(localStorage.getItem('gait_rows') || '[]'); S.nextId = S.rows.length + 1; } catch (e) { /* bỏ qua */ }

  const show = (id) => { ['L1', 'L2', 'L3'].forEach((x) => $(x).classList.toggle('show', x === id)); };
  const pad = (n) => String(n).padStart(2, '0');
  const idStr = () => 'A' + pad(S.nextId);


  // ---------- Ghi hình người chạy và lưu video ----------
  const REC = { mr: null, chunks: [], t0: 0, tm: null, ext: 'webm', name: '' };
  function pickMime() {
    const c = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (const m of c) { try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m; } catch (e) { /* bỏ qua */ } }
    return '';
  }
  function recStart() {
    if (REC.mr || !S.stream) return false;
    if (!window.MediaRecorder) { $('recst').textContent = 'Trình duyệt này không hỗ trợ ghi hình. Dùng Chrome hoặc Edge.'; return false; }
    const mime = pickMime();
    try {
      REC.mr = new MediaRecorder(S.stream, mime ? { mimeType: mime, videoBitsPerSecond: 4000000 } : { videoBitsPerSecond: 4000000 });
    } catch (e) { $('recst').textContent = 'Không bắt đầu ghi hình được: ' + e.message; REC.mr = null; return false; }
    REC.chunks = []; REC.ext = /mp4/.test(REC.mr.mimeType || mime) ? 'mp4' : 'webm';
    REC.mr.ondataavailable = (e) => { if (e.data && e.data.size) REC.chunks.push(e.data); };
    REC.mr.start(1000); REC.t0 = performance.now();
    $('recbtn').classList.add('on');
    REC.tm = setInterval(() => { const sec = Math.floor((performance.now() - REC.t0) / 1000); $('recbtn').textContent = '■ Dừng và lưu · ' + Math.floor(sec / 60) + ':' + pad(sec % 60); }, 500);
    $('recst').textContent = 'Đang ghi hình...';
    return true;
  }
  function recStop(save, name) {
    return new Promise((res) => {
      const mr = REC.mr; if (!mr) return res(false);
      clearInterval(REC.tm); REC.mr = null; $('recbtn').classList.remove('on'); $('recbtn').textContent = '● Ghi hình';
      mr.onstop = () => {
        if (save && REC.chunks.length) {
          const blob = new Blob(REC.chunks, { type: REC.ext === 'mp4' ? 'video/mp4' : 'video/webm' });
          const d = new Date(), stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
          const nm = (name || 'video').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'video';
          const a = document.createElement('a'); a.download = nm + '_' + stamp + '.' + REC.ext; a.href = URL.createObjectURL(blob); a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 10000);
          $('recst').textContent = 'Đã lưu video ' + a.download + ' (' + (blob.size / 1048576).toFixed(1) + ' MB) vào thư mục Downloads.';
        } else $('recst').textContent = '';
        res(true);
      };
      try { mr.stop(); } catch (e) { res(false); }
    });
  }
  $('recbtn').addEventListener('click', () => { if (REC.mr) recStop(true, $('name').value.trim()); else recStart(); });

  // ---------- Lớp 1: form + camera ----------
  function refreshL1() {
    $('xdl').textContent = 'Tải Excel (' + S.rows.length + ' người)';
    const hv = +$('height').value, miss = [];
    if (!$('name').value.trim()) miss.push('họ tên');
    if ($('height').value && !(hv >= 100 && hv <= 230)) miss.push('chiều cao 100–230 cm (hoặc để trống)');
    const ok = miss.length === 0;
    const ready = S.poseReady && (S.mode === 'live' ? S.camReady : !!S.file);
    $('go').disabled = !(ok && ready);
    $('go').textContent = !ok ? 'Còn thiếu: ' + miss.join(', ') : !ready ? (S.poseReady ? 'Hãy chọn file video' : 'Đang chuẩn bị...') : S.mode === 'file' ? 'Phân tích video' : 'Bắt đầu đo · ' + Math.round(CFG.total / 60 * 10) / 10 + ' phút';
    if (S.mode === 'live' && CFG.total < 100) $('go').textContent = 'Bắt đầu (thử ' + CFG.total + ' giây)';
  }
  // ---------- Cài đặt đo ----------
  const SETK = { s_mode: 'std', s_speed: 10, s_fps: 30, s_res: 720, s_clip: 15, s_rec: 50, s_total: 120 };
  (function () {
    try { const o = JSON.parse(localStorage.getItem('gait_set') || '{}'); for (const k in SETK) if (o[k] != null) $(k).value = o[k]; } catch (e) { /* bỏ qua */ }
    if (Q.get('clip')) $('s_clip').value = CFG.clip; if (Q.get('total')) $('s_total').value = CFG.total; if (Q.get('rec')) $('s_rec').value = CFG.rec;
    const clipSel = $('s_clip'); if (![...clipSel.options].some((o) => o.value === String(clipSel.value))) clipSel.add(new Option(clipSel.value, clipSel.value, true, true));
  })();
  try { $('s_auto').checked = localStorage.getItem('gait_auto') !== '0'; } catch (e) { /* bỏ qua */ }
  $('s_auto').addEventListener('change', () => { try { localStorage.setItem('gait_auto', $('s_auto').checked ? '1' : '0'); } catch (e) { /* bỏ qua */ } });
  const PRE = { std: [120, 50, 15], fast: [60, 20, 15], long: [150, 60, 30], full: [180, 70, 60] };   // tổng, bắt đầu thu, độ dài
  let lastCam = '';
  function applySettings(fromUser, src) {
    if (src === 's_mode' && PRE[$('s_mode').value]) { const p = PRE[$('s_mode').value]; $('s_total').value = p[0]; $('s_rec').value = p[1]; $('s_clip').value = p[2]; }
    else if (src && ['s_total', 's_rec', 's_clip'].includes(src)) $('s_mode').value = 'custom';
    const o = {}; for (const k in SETK) o[k] = $(k).value;
    try { localStorage.setItem('gait_set', JSON.stringify(o)); } catch (e) { /* bỏ qua */ }
    SPEED0 = (+$('s_speed').value || 10) / 3.6;
    CFG.fps = +$('s_fps').value; CFG.clip = Math.max(+$('s_clip').value || 15, 6); CFG.rec = Math.max(+$('s_rec').value || 50, 3);
    CFG.total = Math.max(+$('s_total').value || 120, 20); CFG.res = +$('s_res').value;
    const need = CFG.rec + CFG.clip + 6; let note = '';
    if (CFG.total < need) { CFG.total = need; note = 'Tổng thời gian được nâng lên ' + need + ' giây để đủ chỗ cho đoạn phân tích. '; }
    $('s_note').textContent = note + 'Máy chạy ' + (+$('s_speed').value || 10) + ' km/h. Đoạn phân tích ' + CFG.clip + ' giây bắt đầu ở giây ' + CFG.rec + '. FPS thực tế phụ thuộc tốc độ máy tính (xem dòng "Nhận diện … khung/giây" khi đang đo).';
    const key = CFG.res + '/' + CFG.fps;
    if (fromUser && key !== lastCam && typeof startCamera === 'function') startCamera($('camsel').value || undefined);
    lastCam = key;
    if (typeof refreshL1 === 'function') refreshL1();
  }
  ['s_mode', 's_speed', 's_fps', 's_res', 's_clip', 's_rec', 's_total'].forEach((i) => $(i).addEventListener('change', () => applySettings(true, i)));
  ['name', 'phone', 'height', 'pain'].forEach((i) => $(i).addEventListener('input', refreshL1));

  async function startCamera(deviceId) {
    try {
      if (S.stream) S.stream.getTracks().forEach((t) => t.stop());
      const o = $('orient').value, c = { audio: false, video: { width: { ideal: o === 'portrait' ? CFG.res * 9 / 16 : CFG.res * 16 / 9 }, height: { ideal: o === 'portrait' ? CFG.res * 16 / 9 : CFG.res }, frameRate: { ideal: CFG.fps } } };
      if (deviceId) c.video.deviceId = { exact: deviceId };
      S.stream = await navigator.mediaDevices.getUserMedia(c);
      $('v1').srcObject = S.stream; $('v2').srcObject = S.stream;
      const tr = S.stream.getVideoTracks()[0], st = tr.getSettings();
      const isP = st.height > st.width, want = $('orient').value;
      $('camst').textContent = (tr.label || 'Camera') + ' · ' + st.width + '×' + st.height + (isP ? ' (dọc)' : ' (ngang)') + ' · ' + Math.round(st.frameRate || 0) + ' fps' + (want === 'portrait' && !isP ? '. Camera này chỉ cho hình ngang: hãy đặt camera nằm dọc hoặc dùng camera hỗ trợ video dọc.' : want === 'landscape' && isP ? '. Camera đang cho hình dọc.' : '');
      const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      const sel = $('camsel'); sel.innerHTML = '';
      devs.forEach((d, i) => { const o = document.createElement('option'); o.value = d.deviceId; o.textContent = d.label || 'Camera ' + (i + 1); if (st.deviceId === d.deviceId) o.selected = true; sel.appendChild(o); });
      S.camReady = true;
    } catch (e) {
      S.camReady = false;
      $('camst').textContent = 'Không mở được camera: ' + e.message + (location.protocol === 'file:' ? ' (cần mở bằng https, ví dụ GitHub Pages)' : '');
    }
    refreshL1();
  }

  function setMode(m) {
    S.mode = m; if (m === 'file' && REC.mr) recStop(true, $('name').value.trim());
    $('recrow').style.display = m === 'file' ? 'none' : 'flex';
    $('mLive').classList.toggle('on', m === 'live'); $('mFile').classList.toggle('on', m === 'file');
    $('filebox').style.display = m === 'file' ? 'flex' : 'none';
    const v = $('v1');
    if (m === 'file') { v.srcObject = null; if (S.fileUrl) { v.src = S.fileUrl; v.controls = true; v.muted = true; } }
    else { v.removeAttribute('src'); v.controls = false; if (S.stream) { v.srcObject = S.stream; v.play().catch(() => {}); } }
    $('subt').textContent = m === 'file' ? 'Phân tích video quay sẵn: chọn file, chọn đoạn chạy ổn định rồi bấm phân tích.' : 'Phân tích dáng chạy bằng AI trong 2 phút trên máy chạy 10 km/h, đo cả hai chân.';
    refreshL1();
  }
  $('mLive').addEventListener('click', () => setMode('live'));
  $('mFile').addEventListener('click', () => setMode('file'));
  $('vfile').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (S.fileUrl) URL.revokeObjectURL(S.fileUrl);
    S.file = f; S.fileUrl = URL.createObjectURL(f);
    const v = $('v1'); v.srcObject = null; v.src = S.fileUrl; v.controls = true; v.muted = true;
    v.onloadedmetadata = async () => {
      await fixDur(v);
      $('vinfo').textContent = f.name + ' · ' + v.videoWidth + '×' + v.videoHeight + ' · ' + Math.round(v.duration) + ' giây';
      $('vstart').value = v.duration >= 70 ? 50 : 0;
    };
    refreshL1();
  });
  $('camsel').addEventListener('change', (e) => startCamera(e.target.value));
  try { const o = localStorage.getItem('gait_orient'); if (o) $('orient').value = o; } catch (e) { /* bỏ qua */ }
  $('orient').addEventListener('change', () => { try { localStorage.setItem('gait_orient', $('orient').value); } catch (e) { /* bỏ qua */ } startCamera($('camsel').value); });

  // ---------- MediaPipe ----------
  let poseWait = null;
  async function initPose() {
    try {
      const pose = new Pose({ locateFile: (f) => 'vendor/pose/' + f });
      pose.setOptions({ modelComplexity: CFG.cx, smoothLandmarks: true, enableSegmentation: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      pose.onResults((r) => { if (poseWait) { const w = poseWait; poseWait = null; w(r); } });
      await pose.initialize();
      S.pose = pose; S.poseReady = true;
    } catch (e) {
      $('msg1').textContent = 'Không tải được mô hình nhận diện: ' + e.message;
    }
    refreshL1();
  }
  function detect(video) {
    return new Promise((res) => { poseWait = res; S.pose.send({ image: video }).catch(() => res(null)); });
  }

  // ---------- Lớp 2: chạy + thu ----------
  const v2 = $('v2'), ov = $('ov'), octx = ov.getContext('2d');
  const grab = document.createElement('canvas'), gctx = grab.getContext('2d');

  function layout() {
    const dpr = window.devicePixelRatio || 1;
    ov.width = ov.clientWidth * dpr; ov.height = ov.clientHeight * dpr;
  }
  window.addEventListener('resize', layout);

  function drawLive(lm) {
    const W = ov.width, H = ov.height; octx.clearRect(0, 0, W, H);
    if (!lm || !v2.videoWidth) return;
    const sc = Math.min(W / v2.videoWidth, H / v2.videoHeight);
    const ox = (W - v2.videoWidth * sc) / 2, oy = (H - v2.videoHeight * sc) / 2;
    const p = (j) => [ox + lm[j].x * v2.videoWidth * sc, oy + lm[j].y * v2.videoHeight * sc];
    octx.lineWidth = Math.max(3, W / 500); octx.lineCap = 'round';
    for (const side of ['L', 'R']) {
      const ids = Gait.IDX[side]; octx.strokeStyle = side === 'L' ? BLUE : ORANGE; octx.fillStyle = octx.strokeStyle;
      for (const [a, b] of LINKS) { const A = p(ids[a]), B = p(ids[b]); octx.beginPath(); octx.moveTo(A[0], A[1]); octx.lineTo(B[0], B[1]); octx.stroke(); }
      for (const k of Object.keys(ids)) { const A = p(ids[k]); octx.beginPath(); octx.arc(A[0], A[1], Math.max(4, W / 380), 0, 7); octx.fill(); }
    }
  }

  const setPhase = (txt, cls) => { const e = $('ph'); e.textContent = txt; e.className = cls || ''; };
  const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + pad(s % 60); };

  // Nhận biết nhịp chạy ổn định: 3 đoạn 6 giây liên tiếp có nhịp lệch nhau không quá 7 bước/phút
  function stableCheck() {
    const B = S.hipBuf.filter((q) => !Number.isNaN(q.y)); if (B.length < 60) return { ok: false, cad: 0 };
    const tEnd = B[B.length - 1].t, cads = [];
    for (let w = 2; w >= 0; w--) {
      const t1 = tEnd - 6 * w, t0 = t1 - 6, seg = B.filter((q) => q.t >= t0 && q.t <= t1);
      if (seg.length < 6 * 12 || seg[0].t - t0 > 0.7 || t1 - seg[seg.length - 1].t > 0.7) return { ok: false, cad: cads.length ? cads[cads.length - 1] : 0 };
      const n = 6 * 60, y = new Float64Array(n); let k = 0;
      for (let i = 0; i < n; i++) { const t = t0 + (i / n) * 6; while (k < seg.length - 2 && seg[k + 1].t < t) k++; const a0 = seg[k], b0 = seg[k + 1], g = b0.t - a0.t; y[i] = a0.y + (b0.y - a0.y) * (g > 0 ? Math.max(0, Math.min(1, (t - a0.t) / g)) : 0); }
      let m = 0; for (let i = 0; i < n; i++) m += y[i]; m /= n;
      let sxy = 0, sxx = 0, mt = (n - 1) / 2; for (let i = 0; i < n; i++) { sxy += (i - mt) * (y[i] - m); sxx += (i - mt) * (i - mt); }
      const sl = sxy / sxx; for (let i = 0; i < n; i++) y[i] = y[i] - m - sl * (i - mt);
      const ac = (L) => { let s = 0; for (let i = 0; i + L < n; i++) s += y[i] * y[i + L]; return s / (n - L); };
      const a00 = ac(0); if (a00 <= 0) return { ok: false, cad: 0 };
      let bl = 0, bv = -1; const ar = {};
      for (let L = 17; L <= 31; L++) { ar[L] = ac(L); if (ar[L] > bv) { bv = ar[L]; bl = L; } }
      if (bv / a00 < 0.3 || bl <= 17 || bl >= 31) return { ok: false, cad: 0 };
      const y0 = ar[bl - 1], y1 = ar[bl], y2 = ar[bl + 1], den = y0 - 2 * y1 + y2, off = den !== 0 ? 0.5 * (y0 - y2) / den : 0;
      cads.push(60 * 60 / (bl + off));
    }
    const mx = Math.max(...cads), mn = Math.min(...cads);
    return { ok: mx - mn <= 7, cad: cads[2] };
  }
  async function startRun() {
    S.sub = { id: idStr(), name: titleCase($('name').value), phone: $('phone').value.trim(), height: +$('height').value || 165, pain: $('pain').value.trim() };
    if (REC.mr) { await recStop(true, $('name').value.trim()); }
    if ($('autorec').checked) recStart();
    if (S.stream) { v2.removeAttribute('src'); v2.srcObject = S.stream; v2.play().catch(() => {}); }
    document.querySelector('.cd em').textContent = 'CÒN LẠI';
    S.frames = []; S.late = []; S.nrec = 0; S.jobs = []; S.result = null; S.computing = false; S.abort = false; S.running = true;
    show('L2'); layout();
    $('who').textContent = S.sub.name; $('idl').textContent = '';
    S.t0 = performance.now() / 1000;
    let recStarted = false, recDone = false, shown = false; S.endNow = false;
    S.recAt = $('s_auto').checked ? null : CFG.rec; S.hipBuf = []; S.lastChk = 0; S.curCad = 0;
    const latest = Math.max(20, CFG.total - CFG.clip - 3);
    $('early').style.display = ''; $('early').disabled = true;

    const timer = setInterval(() => {
      const el = performance.now() / 1000 - S.t0;
      $('count').textContent = mmss(CFG.total - el);
      $('progf').style.width = Math.min(100, el / CFG.total * 100) + '%';
      if (S.recAt == null) {
        if (el - S.lastChk >= 1) { S.lastChk = el; const r = stableCheck(); S.curCad = r.cad; if (el >= 20 && r.ok) { S.recAt = el; S.recWhy = 'ổn định'; } }
        if (S.recAt == null && el >= latest) { S.recAt = el; S.recWhy = 'hết giờ chờ'; }
      }
      const RA = S.recAt == null ? Infinity : S.recAt;
      if (el < RA) { setPhase(S.recAt == null ? 'Chạy thoải mái · đang chờ nhịp chạy ổn định' + (S.curCad ? ' (nhịp ~' + Math.round(S.curCad) + ')' : '') : 'Chạy thoải mái · sắp thu hình sau ' + Math.ceil(RA - el) + ' giây', ''); }
      else if (el < RA + CFG.clip) { recStarted = true; setPhase('ĐANG THU HÌNH · ' + Math.ceil(RA + CFG.clip - el) + ' giây' + (S.recWhy === 'ổn định' ? ' · nhịp đã ổn định' : ''), 'rec'); }
      else {
        if (recStarted && !recDone) { recDone = true; analyse(); }
        if (!S.result && !S.error) setPhase('Đang tính kết quả...', 'wn');
        else if (S.result && el < CFG.total) setPhase('Đã đo xong · giữ nhịp chạy đến hết giờ', 'ok');
        else if (S.error) setPhase('Không đo được', 'wn');
      }
      $('early').disabled = !(S.result || S.error);
      if ((el >= CFG.total || S.endNow) && (S.result || S.error) && !shown) { shown = true; finish(); }
      if (S.abort) { clearInterval(timer); }
    }, 100);
    S.timer = timer;

    // vòng nhận diện
    const loop = async () => {
      let nfr = 0, tfps = performance.now();
      while (S.running && !S.abort) {
        if (v2.readyState < 2 || !v2.videoWidth) { await new Promise((r) => setTimeout(r, 30)); continue; }
        const t = performance.now() / 1000, el = t - S.t0;
        const r = await detect(v2);
        const vw = v2.videoWidth, vh = v2.videoHeight;
        const lm = r && r.poseLandmarks ? r.poseLandmarks : null;
        S.lastLm = lm; drawLive(lm);
        nfr++; if (performance.now() - tfps > 2000) { $('fpsb').textContent = 'Nhận diện ' + (nfr / ((performance.now() - tfps) / 1000)).toFixed(0) + ' khung/giây'; nfr = 0; tfps = performance.now(); }
        if (S.recAt == null) {
          const hy = lm ? (lm[23].visibility > 0.3 && lm[24].visibility > 0.3 ? (lm[23].y + lm[24].y) / 2 : lm[23].visibility >= lm[24].visibility ? lm[23].y : lm[24].y) : NaN;
          S.hipBuf.push({ t: el, y: hy });
        }
        const RA2 = S.recAt == null ? Infinity : S.recAt;
        if (el >= RA2 && el < RA2 + CFG.clip) {
          const rec = { t, lm: lm ? lm.map((q) => ({ x: q.x * vw, y: q.y * vh, v: q.visibility == null ? 1 : q.visibility })) : null, vw, vh, blob: null };
          S.nrec = (S.nrec || 0) + 1;
          if (lm && S.nrec % 3 === 0) {
            const sc = Math.min(1, 1280 / vw);
            grab.width = Math.round(vw * sc); grab.height = Math.round(vh * sc);
            gctx.drawImage(v2, 0, 0, grab.width, grab.height);
            rec.sc = sc;
            rec.job = new Promise((res) => grab.toBlob((b) => { rec.blob = b; res(); }, 'image/jpeg', 0.85));
            await rec.job;   // giữ đơn giản: chờ xong mới sang khung kế (grab dùng chung)
          }
          S.frames.push(rec);
        }
        if (el >= CFG.total - CFG.clip && S.recAt != null && el > S.recAt + CFG.clip + 5 && el < CFG.total) S.late.push({ t, lm: lm ? lm.map((q) => ({ x: q.x * vw, y: q.y * vh, v: q.visibility == null ? 1 : q.visibility })) : null });
        await new Promise((r) => requestAnimationFrame(r));
      }
    };
    loop();
  }


  // ---------- Chế độ video có sẵn ----------
  async function fixDur(v) {   // video webm do trình duyệt ghi thường báo độ dài vô hạn: ép tính lại
    if (isFinite(v.duration)) return;
    await new Promise((res) => { v.onseeked = () => { v.onseeked = null; v.currentTime = 0; res(); }; v.currentTime = 1e101; });
  }
  async function startVideo() {
    const km = +$('vspeed').value || 10; SPEED = km / 3.6;
    S.sub = { id: idStr(), name: titleCase($('name').value), phone: $('phone').value.trim(), height: +$('height').value || 165, pain: $('pain').value.trim() };
    S.frames = []; S.late = []; S.result = null; S.error = null; S.computing = false; S.abort = false; S.running = true; S.photosReady = false;
    show('L2'); layout(); $('early').style.display = 'none';
    $('who').textContent = S.sub.name; $('idl').textContent = '';
    document.querySelector('.cd em').textContent = 'TIẾN ĐỘ'; $('count').textContent = '0%'; $('progf').style.width = '0%'; $('fpsb').textContent = '';
    setPhase('Đang mở video...', 'wn');
    try {
      v2.srcObject = null; v2.src = S.fileUrl; v2.muted = true;
      await new Promise((res, rej) => { v2.onloadedmetadata = res; v2.onerror = () => rej(new Error('Không mở được video này (thử định dạng MP4).')); });
      v2.pause(); await fixDur(v2);
      const dur = v2.duration, vw = v2.videoWidth, vh = v2.videoHeight;
      const start = Math.max(0, Math.min(+$('vstart').value || 0, dur - 8));
      const sc = Math.min(1, 1280 / vw);
      const seek = (t) => new Promise((res) => {
        if (Math.abs(v2.currentTime - t) < 1e-3) return res();
        let done = false; const fin = () => { if (!done) { done = true; v2.removeEventListener('seeked', fin); res(); } };
        v2.addEventListener('seeked', fin); setTimeout(fin, 3000); v2.currentTime = t;
      });
      // Hệ số quay chậm k: 1 giây thực tế = k giây video
      let k = $('vslow').value === 'auto' ? 0 : +$('vslow').value;
      if (!k) {
        setPhase('Đang nhận biết video có quay chậm không...', 'wn');
        const np = Math.min(240, Math.floor((dur - start) * 20)), ys = [];
        for (let i = 0; i < np && !S.abort; i++) {
          await seek(start + i / 20);
          const r = await detect(v2), lm = r && r.poseLandmarks;
          ys.push(lm ? (lm[23].y + lm[24].y) / 2 : NaN);
          $('count').textContent = Math.round((i + 1) / np * 100) + '%'; $('progf').style.width = Math.round((i + 1) / np * 100) / 2 + '%';
        }
        k = guessSlow(ys, 20);
      }
      S.slow = k;
      const needVid = CFG.clip * k, avail = dur - start;
      const vclip = Math.min(needVid, avail);
      if (vclip / k < 6) throw new Error('Video quá ngắn: cần ít nhất ' + Math.ceil(6 * k) + ' giây video (= 6 giây thực tế) sau điểm bắt đầu' + (k > 1 ? ' vì video quay chậm gấp ' + k : '') + '.');
      const n = Math.floor(vclip / k * CFG.fps);
      const t0 = performance.now();
      for (let i = 0; i < n && !S.abort; i++) {
        await seek(start + i * k / CFG.fps);
        const r = await detect(v2);
        const lm = r && r.poseLandmarks ? r.poseLandmarks : null;
        drawLive(lm);
        const rec = { t: i / CFG.fps, lm: lm ? lm.map((q) => ({ x: q.x * vw, y: q.y * vh, v: q.visibility == null ? 1 : q.visibility })) : null, vw, vh, blob: null, sc };
        if (lm && i % 3 === 0) {
          grab.width = Math.round(vw * sc); grab.height = Math.round(vh * sc); gctx.drawImage(v2, 0, 0, grab.width, grab.height);
          await new Promise((res) => grab.toBlob((b) => { rec.blob = b; res(); }, 'image/jpeg', 0.85));
        }
        S.frames.push(rec);
        const pc = Math.round((i + 1) / n * 100);
        $('count').textContent = pc + '%'; $('progf').style.width = pc + '%';
        const left = Math.max(0, Math.round(((performance.now() - t0) / (i + 1)) * (n - i - 1) / 1000));
        setPhase('Đang phân tích video · còn khoảng ' + left + ' giây', 'rec');
      }
      if (S.abort) return;
      setPhase('Đang tính kết quả...', 'wn');
      analyse();
      let g = 0; while (!S.result && !S.error && g++ < 600) await new Promise((r) => setTimeout(r, 100));
      await finish();
    } catch (e) {
      S.running = false; show('L1'); $('msg1').textContent = e.message; refreshL1();
    }
  }
  $('early').addEventListener('click', () => { S.endNow = true; });
  $('cancel').addEventListener('click', () => { if (REC.mr) recStop(false); S.abort = true; S.running = false; clearInterval(S.timer); show('L1'); refreshL1(); });
  $('go').addEventListener('click', () => { $('msg1').textContent = ''; if (S.mode === 'file') startVideo(); else { SPEED = SPEED0; startRun(); } });

  // ---------- Phân tích ----------
  const titleCase = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|\s)(\S)/g, (m, p, q) => p + q.toUpperCase());
  // Kiểm tra độ tin cậy của lần đo: nếu có dấu hiệu sai thì không cho điểm và không kết luận
  function qualityCheck(frames, FPS, res, comb) {
    const why = [], ok = frames.filter((f) => f.lm).length, det = frames.length ? ok / frames.length : 0;
    if (S.mode !== 'file' && FPS < 15) why.push('máy chỉ nhận diện ' + FPS + ' khung/giây (cần từ 20)');
    if (det < 0.8) why.push('chỉ nhận diện được người ở ' + Math.round(det * 100) + '% số khung hình');
    const cad = comb.common.cadence; if (cad < 120 || cad > 230) why.push('nhịp chạy đo được ' + Math.round(cad) + ' bước/phút không hợp lý' + (S.mode === 'file' && cad < 120 ? ' (nếu là video quay chậm, hãy chọn đúng hệ số ở ô "Video quay chậm")' : ''));
    for (const s of ['L', 'R']) if (res[s]) {
      const e = res[s].extra, nm = s === 'L' ? 'trái' : 'phải';
      if (Math.abs(e.cadIC - e.cadFFT) > 0.15 * e.cadFFT) why.push('chân ' + nm + ': hai cách đo nhịp lệch nhau (' + Math.round(e.cadIC) + ' và ' + Math.round(e.cadFFT) + ')');
      if (Math.abs(res[s].metrics.overstride) > 40) why.push('chân ' + nm + ': vị trí đặt chân bất thường (' + Math.round(res[s].metrics.overstride) + ' cm), có thể nhận diện sai');
    }
    return { bad: why.length > 0, why, fps: FPS, det, frames: frames.length, slow: S.mode === 'file' ? S.slow : 1 };
  }
  // Đoán hệ số quay chậm từ chuyển động lên xuống của hông: chọn k để nhịp thực tế rơi vào 140–210 bước/phút
  function guessSlow(ys, rate) {
    const v = ys.filter((q) => !Number.isNaN(q)); if (v.length < ys.length * 0.6 || v.length < 60) return 1;
    const m = v.reduce((p, q) => p + q, 0) / v.length, n = ys.length, y = ys.map((q) => (Number.isNaN(q) ? 0 : q - m));
    let bf = 0, bp = -1;
    for (let f = 0.15; f <= 5; f += 0.01) {
      let re = 0, im = 0; const w = 2 * Math.PI * f / rate;
      for (let i = 0; i < n; i++) { const hw = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)); re += y[i] * hw * Math.cos(w * i); im -= y[i] * hw * Math.sin(w * i); }
      const p = re * re + im * im; if (p > bp) { bp = p; bf = f; }
    }
    let best = 1, bd = 1e9;
    for (const k of [1, 2, 4, 8]) { const cad = bf * k * 60; if (cad >= 140 && cad <= 210 && Math.abs(cad - 175) < bd) { bd = Math.abs(cad - 175); best = k; } }
    return best;
  }
  function effFps(frames) {   // tốc độ nhận diện thực tế (không vượt cài đặt)
    const ok = frames.filter((f) => f.lm); if (ok.length < 10) return CFG.fps;
    const r = (ok.length - 1) / (ok[ok.length - 1].t - ok[0].t);
    return Math.max(10, Math.min(CFG.fps, Math.round(r)));
  }
  function analyse() {
    S.computing = true; S.error = null; S.photosReady = false;
    setTimeout(() => {
      try {
        const frames = S.frames;
        const FPS = S.mode === 'file' ? CFG.fps : effFps(frames); S.fps = FPS;
        const { P, N, t0 } = Gait.resample(frames, FPS);
        const { res, errs } = Gait.computeBoth(P, FPS, S.sub.height, SPEED);
        const comb = Gait.combine(res, SPEED);
        let ex = null; try { ex = Gait.computeExtra(P, FPS, res, comb.common, SPEED); } catch (e) { ex = null; }
        S.result = { res, errs, comb, P, N, t0, sub: S.sub, ex, fat: null, q: qualityCheck(frames, FPS, res, comb) };
        S.photos = {};
        pickPhotos(frames, S.result).then(() => { S.photosReady = true; });
      } catch (e) { S.error = e.message; }
      S.computing = false;
    }, 50);
  }

  async function pickPhotos(frames, R) {
    const withImg = frames.filter((f) => f.blob);
    for (const s of Object.keys(R.res)) {
      const ic = R.res[s].arrays.ic; if (!ic.length) continue;
      // chọn lần chạm đất ở giữa đoạn thu
      const i = ic[Math.floor(ic.length / 2)];
      const tt = R.t0 + i / (S.fps || CFG.fps);
      let best = null, bd = 1e9;
      for (const f of withImg) { const d = Math.abs(f.t - tt); if (d < bd) { bd = d; best = f; } }
      if (!best) continue;
      const bmp = await createImageBitmap(best.blob);
      const lm = {};
      for (const k of Object.keys(Gait.IDX[s])) { const j = Gait.IDX[s][k]; lm[k] = [R.P.x[j][i], R.P.y[j][i]]; }
      const other = s === 'L' ? 'R' : 'L', lo = {};
      for (const k of Object.keys(Gait.IDX[other])) { const j = Gait.IDX[other][k]; lo[k] = [R.P.x[j][i], R.P.y[j][i]]; }
      S.photos[s] = { bmp, sc: best.sc, lm, lo, vw: best.vw, vh: best.vh };
    }
  }

  // ---------- Đánh giá ----------
  function rating(k, v) {
    const c = REF[k]; if (!c || c.lo == null || v == null || Number.isNaN(v)) return { txt: 'n/a', ok: true };
    const r = Gait.rateValue(v, c);
    return { txt: r, ok: r === 'trong khoảng' };
  }
  const f1 = (v) => (v == null || Number.isNaN(v) ? '–' : (Math.round(v * 10) / 10).toFixed(1));
  const f0 = (v) => (v == null || Number.isNaN(v) ? '–' : String(Math.round(v)));

  function summary(R) {
    const bad = [];
    const nm = { cadence: 'Cadence', vert_osc: 'Nhấp nhô', trunk: 'Nghiêng thân', overstride: 'Tiếp đất trước thân', knee_ic: 'Gối lúc chạm đất' };
    for (const k of ['cadence', 'vert_osc', 'trunk']) { const r = rating(k, R.comb.common[k]); if (!r.ok) bad.push(nm[k] + ' ' + r.txt); }
    for (const k of ['overstride', 'knee_ic']) {
      const parts = [];
      for (const s of ['L', 'R']) if (R.res[s]) { const r = rating(k, R.res[s].metrics[k]); if (!r.ok) parts.push((s === 'L' ? 'trái ' : 'phải ') + r.txt); }
      if (parts.length) bad.push(nm[k] + ' (' + parts.join(', ') + ')');
    }
    if (!bad.length) return 'Các chỉ số chính đều nằm trong khoảng tham chiếu.';
    return 'Cần chú ý: ' + bad.join(' · ') + '.';
  }

  // ---------- Vẽ ảnh kết quả ----------
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  function drawPhoto(c, ph, side, x, y, w, h, R) {
    c.save(); rr(c, x, y, w, h, 24); c.clip();
    c.fillStyle = '#1B2A34'; c.fillRect(x, y, w, h);
    const col = side === 'L' ? BLUE : ORANGE;
    if (ph) {
      // khung quanh hai chân: luôn lấy trọn cả hai chân, video dọc hay ngang đều không bị cắt mất chân
      const pts = []; for (const o of [ph.lm, ph.lo]) for (const k of ['hip', 'knee', 'ank', 'heel', 'toe']) pts.push(o[k]);
      const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
      const y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
      const m = Math.max(40, 0.3 * Math.max(x1 - x0, y1 - y0)), asp = w / h;
      let bw = x1 - x0 + 2 * m, bh = y1 - y0 + 2 * m;
      if (bw / bh < asp) bw = bh * asp; else bh = bw / asp;
      let sx = (x0 + x1) / 2 - bw / 2, sy = (y0 + y1) / 2 + bh * 0.06 - bh / 2;
      if (bw <= ph.vw) sx = Math.max(0, Math.min(ph.vw - bw, sx));
      if (bh <= ph.vh) sy = Math.max(0, Math.min(ph.vh - bh, sy));
      // phần khung nằm ngoài video để nền tối (không kéo giãn, không cắt chân)
      const ix0 = Math.max(sx, 0), iy0 = Math.max(sy, 0), ix1 = Math.min(sx + bw, ph.vw), iy1 = Math.min(sy + bh, ph.vh), kk = w / bw;
      c.drawImage(ph.bmp, ix0 * ph.sc, iy0 * ph.sc, (ix1 - ix0) * ph.sc, (iy1 - iy0) * ph.sc, x + (ix0 - sx) * kk, y + (iy0 - sy) * kk, (ix1 - ix0) * kk, (iy1 - iy0) * kk);
      const k = w / bw, P = (p) => [x + (p[0] - sx) * k, y + (p[1] - sy) * k];
      const draw = (o, color, lw, alpha) => {
        c.globalAlpha = alpha; c.strokeStyle = color; c.fillStyle = color; c.lineWidth = lw; c.lineCap = 'round';
        for (const [a, b] of LINKS) { const A = P(o[a]), B = P(o[b]); c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke(); }
        for (const kk of Object.keys(o)) { const A = P(o[kk]); c.beginPath(); c.arc(A[0], A[1], lw * 1.5, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); c.strokeStyle = color; c.lineWidth = lw; }
        c.globalAlpha = 1;
      };
      draw(ph.lo, side === 'L' ? ORANGE : BLUE, 4, 0.45);
      draw(ph.lm, col, 7, 1);
      // vòng sáng quanh bàn chân chạm đất
      const T = P(ph.lm.ank); c.strokeStyle = '#fff'; c.lineWidth = 3; c.setLineDash([8, 8]);
      c.beginPath(); c.arc(T[0], T[1], 46, 0, 7); c.stroke(); c.setLineDash([]);

      // chú thích trực quan: góc gối + khoảng cách bàn chân trước hông
      const pill = (txt, px, py, bg) => { c.font = '700 28px system-ui,"Segoe UI",Arial'; const tw = c.measureText(txt).width + 30; c.fillStyle = bg; rr(c, px - tw / 2, py - 24, tw, 48, 24); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, px, py + 1); c.textAlign = 'left'; c.textBaseline = 'alphabetic'; };
      const Hh = P(ph.lm.hip), Kk = P(ph.lm.knee), Aa = P(ph.lm.ank);
      const mm = R.res[side] && R.res[side].metrics;
      if (mm) {
        // 1) góc gối: kéo dài đùi (nét đứt) và vẽ cung tới cẳng chân
        let ex = Kk[0] - Hh[0], ey = Kk[1] - Hh[1]; const el = Math.hypot(ex, ey) || 1; ex /= el; ey /= el;
        const a0 = Math.atan2(ey, ex), a1 = Math.atan2(Aa[1] - Kk[1], Aa[0] - Kk[0]);
        let df = a1 - a0; while (df > Math.PI) df -= 2 * Math.PI; while (df < -Math.PI) df += 2 * Math.PI;
        c.setLineDash([7, 7]); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(Kk[0], Kk[1]); c.lineTo(Kk[0] + ex * 110, Kk[1] + ey * 110); c.stroke(); c.setLineDash([]);
        c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(Kk[0], Kk[1]); c.arc(Kk[0], Kk[1], 70, a0, a0 + df, df < 0); c.closePath(); c.fill();
        const am = a0 + df / 2; const dirx = (R.res[side].extra.d >= 0 ? 1 : -1); pill('Gối ' + f0(mm.knee_ic) + '°', Kk[0] + dirx * 130, Kk[1] - 6, 'rgba(14,36,51,.85)');
        // 2) bàn chân đặt trước/sau hông: đường dọc từ hông + thước ngang tới cổ chân
        const by = Math.min(Math.max(Aa[1], P(ph.lm.heel)[1], P(ph.lm.toe)[1]) + 40, y + h - 66);
        c.strokeStyle = '#fff'; c.lineWidth = 3; c.setLineDash([7, 7]); c.beginPath(); c.moveTo(Hh[0], Hh[1]); c.lineTo(Hh[0], by + 10); c.stroke(); c.setLineDash([]);
        c.lineWidth = 5; c.strokeStyle = mm.overstride > (REF.overstride ? REF.overstride.hi : 99) ? '#FFB84D' : '#5EE6B8';
        c.beginPath(); c.moveTo(Hh[0], by); c.lineTo(Aa[0], by); c.stroke();
        c.beginPath(); c.moveTo(Aa[0], by - 12); c.lineTo(Aa[0], by + 12); c.stroke();
        pill(f0(Math.abs(mm.overstride)) + ' cm', (Hh[0] + Aa[0]) / 2, by + 38, 'rgba(14,36,51,.85)');
      }
    } else {
      c.fillStyle = '#8FA3AE'; c.font = '28px system-ui'; c.textAlign = 'center';
      c.fillText('Chưa bắt được khung chạm đất', x + w / 2, y + h / 2); c.textAlign = 'left';
    }
    c.restore();
    // nhãn
    c.fillStyle = col; rr(c, x + 18, y + 16, 190, 46, 23); c.fill();
    c.fillStyle = '#fff'; c.font = '700 26px system-ui,Segoe UI,Arial'; c.textBaseline = 'middle';
    c.fillText(side === 'L' ? 'Chân trái' : 'Chân phải', x + 38, y + 40);
    c.textBaseline = 'alphabetic';
  }

  function cardData(R) {
    const cm = R.comb.common, r = R.res;
    const two = (k, fmt) => ['L', 'R'].map((s) => (r[s] ? { v: fmt(r[s].metrics[k]), ok: rating(k, r[s].metrics[k]).ok, t: rating(k, r[s].metrics[k]).txt } : { v: '–', ok: true, t: '' }));
    const cd = (k) => { const q = rating(k, cm[k]); return { v: k === 'cadence' ? f0(cm[k]) : f1(cm[k]), ok: q.ok, t: q.txt }; };
    return [
      { title: 'Cadence', unit: 'bước/phút', one: cd('cadence'), ref: REF.cadence },
      { title: 'Nhấp nhô', unit: 'cm', one: cd('vert_osc'), ref: REF.vert_osc },
      { title: 'Nghiêng thân', unit: '°', one: cd('trunk'), ref: REF.trunk },
      { title: 'Tiếp đất trước thân', unit: 'cm', two: two('overstride', f1), ref: REF.overstride },
      { title: 'Gập gối lúc chạm', unit: '°', two: two('knee_ic', f0), ref: REF.knee_ic },
      { title: 'Kiểu tiếp đất', unit: '', two: ['L', 'R'].map((s) => (r[s] ? { v: r[s].extra.strike, ok: true, t: '', small: true } : { v: '–', ok: true, t: '' })) },
    ];
  }

  // ---- báo cáo gọn: số to, vị trí đo trên ảnh, kết luận + lời khuyên ----
  const FFX = 'system-ui,"Segoe UI",Arial';
  function tile(c, x, y, w, h, o) {
    const q = o.key ? rating(o.key, o.v) : { ok: true, txt: '' }, col = q.ok ? GREEN : AMBER;
    c.save(); c.shadowColor = 'rgba(14,36,51,.08)'; c.shadowBlur = 10; c.shadowOffsetY = 2; c.fillStyle = '#fff'; rr(c, x, y, w, h, 16); c.fill(); c.restore();
    c.textAlign = 'left'; c.fillStyle = '#5B6B77'; c.font = '600 19px ' + FFX; c.fillText(o.label, x + 18, y + 30);
    c.fillStyle = o.key ? col : '#14202B';
    if (o.text) { c.font = '700 40px ' + FFX; c.fillText(o.text, x + 18, y + 86, w - 36); return; }
    c.font = '700 56px ' + FFX; c.fillText(o.val, x + 18, y + 88); const vw = c.measureText(o.val).width;
    c.fillStyle = '#6B7C88'; c.font = '22px ' + FFX; c.fillText(o.unit, x + 26 + vw, y + 88);
    // nhãn trạng thái
    const word = q.ok ? 'Tốt' : q.txt === 'cao' ? 'Cao' : 'Thấp';
    c.font = '700 18px ' + FFX; const tw = c.measureText(word).width + 26;
    c.fillStyle = q.ok ? '#DDF3EA' : '#FBEBCF'; rr(c, x + w - 18 - tw, y + 12, tw, 30, 15); c.fill();
    c.fillStyle = col; c.textAlign = 'center'; c.fillText(word, x + w - 18 - tw / 2, y + 33); c.textAlign = 'left';
    // thanh + khoảng bình thường
    const ref = o.ref, span = ref.hi - ref.lo, mn = ref.lo - span * 0.9, mx = ref.hi + span * 0.9, bx = x + 18, bw = w - 36, by = y + h - 30;
    const pos = (v) => bx + Math.max(0, Math.min(1, (v - mn) / (mx - mn))) * bw;
    c.fillStyle = '#E3EAEE'; rr(c, bx, by, bw, 10, 5); c.fill();
    c.fillStyle = '#BDE8D7'; c.fillRect(pos(ref.lo), by, pos(ref.hi) - pos(ref.lo), 10);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(pos(o.v), by + 5, 11, 0, 7); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(pos(o.v), by + 5, 8, 0, 7); c.fill();
    c.fillStyle = '#7A8791'; c.font = '16px ' + FFX; c.textAlign = 'right'; c.fillText('Bình thường ' + ref.lo + '–' + ref.hi, x + w - 18, y + 64); c.textAlign = 'left';
  }
  // kết luận + lời khuyên theo quy tắc đơn giản (bác sĩ nên rà lại nội dung)
  // ---------- Điểm dáng chạy (0-100) và bài tập gợi ý ----------
  // Điểm mỗi chỉ số = 100 nếu trong khoảng bình thường, giảm dần theo độ lệch (hết điểm khi lệch bằng một bề rộng khoảng). Chỉ tính 9 chỉ số chính.
  const SCORE_KEYS = ['cadence', 'vert_osc', 'trunk', 'knee_ic', 'shank_ic', 'overstride', 'knee_mid', 'hip_ext', 'knee_swing'];
  function mScore(k, v) {
    const c = REF[k]; if (!c || c.lo == null || v == null || Number.isNaN(v)) return null;
    const w = c.hi - c.lo, dist = v < c.lo ? c.lo - v : v > c.hi ? v - c.hi : 0;
    return Math.round(100 * (1 - Math.min(1, dist / w)));
  }
  function scores(R) {
    const out = { L: null, R: null, total: null };
    if (R.q && R.q.bad) return out;
    for (const s of ['L', 'R']) {
      if (!R.res[s]) continue;
      const v = SCORE_KEYS.map((k) => mScore(k, Gait.COMMON.includes(k) ? R.comb.common[k] : R.res[s].metrics[k])).filter((q) => q != null);
      if (v.length) out[s] = Math.round(v.reduce((x, y) => x + y, 0) / v.length);
    }
    const t = [out.L, out.R].filter((q) => q != null);
    if (t.length) out.total = Math.round(t.reduce((x, y) => x + y, 0) / t.length);
    return out;
  }
  const scoreCol = (v) => (v >= 80 ? GREEN : v >= 60 ? AMBER : '#D9503F');
  // Bài tập gợi ý (bản nháp, bác sĩ cần duyệt/chỉnh nội dung)
  const EXER = {
    cadence_low: ['Tăng nhịp bước (Cadence training)', 'Chạy nhẹ theo máy gõ nhịp (Metronome) 170–175 bước/phút, 3 buổi mỗi tuần, mỗi buổi 5–10 phút trong buổi chạy nhẹ. Tăng dần khoảng 5% mỗi tuần.'],
    vert_osc_high: ['Chạy lướt, bớt nảy (Reduce vertical oscillation)', 'Cue "chạy dưới trần thấp" (Run under a low ceiling): đẩy người về trước thay vì nhảy lên. Thêm nhảy dây (Jump rope) nhẹ 3 hiệp x 1 phút để quen bước nhẹ và ngắn.'],
    trunk_low: ['Nghiêng nhẹ từ cổ chân (Ankle lean drill)', 'Đứng sát tường, nghiêng cả người về trước từ cổ chân (Wall lean), không gập lưng, rồi chạy bước nhỏ. Lặp lại 5 lần x 20 giây trước buổi chạy.'],
    trunk_high: ['Giữ thân vững hơn (Core stability)', 'Plank 3 x 30–45 giây và Bird-dog 3 x 10 lần mỗi bên, 3 buổi mỗi tuần. Khi chạy nhìn xa, bụng gồng nhẹ.'],
    overstride_high: ['Đặt chân gần dưới thân (Reduce overstriding)', 'Chạy bước ngắn nhanh (Fast feet drill) 4 x 30 giây, chạm đất ngay dưới hông. Kết hợp tăng nhịp bước khoảng 5%.'],
    knee_ic_low: ['Mềm gối lúc chạm đất (Soft landing)', 'Nhảy xuống từ bục thấp (Box drop landing) rồi giữ gối mềm 3 x 8 lần; chạy chậm tập chạm đất nhẹ.'],
    knee_ic_high: ['Tăng sức mạnh đùi và mông (Quad and glute strength)', 'Squat 3 x 12, Step-up (bước lên bục) 3 x 10 mỗi chân, Glute bridge (cầu mông) 3 x 12; 2 buổi mỗi tuần.'],
    hip_ext_low: ['Mở hông ra sau (Hip extension)', 'Giãn cơ gập hông (Hip flexor stretch) 3 x 30 giây mỗi bên, tư thế quỳ một gối. Cầu mông một chân (Single-leg glute bridge) 3 x 10 mỗi bên. Thêm Standing hip extension (nâng chân ra sau khi đứng) 3 x 12.'],
    knee_mid_low: ['Tăng khả năng nhún khi chịu tải (Eccentric control)', 'Hạ người một chân chậm (Step-down) 3 x 8 mỗi chân, giữ gối thẳng hàng với bàn chân.'],
    knee_swing_low: ['Gót vung lên sau (Heel recovery)', 'Gót chạm mông (Butt kicks) 3 x 20 m và nâng gối cao (High knees) 3 x 20 m, 2 buổi mỗi tuần trước khi chạy.'],
    asym: ['Cân bằng hai chân (Single-leg training)', 'Đứng một chân giữ thăng bằng (Single-leg balance) 3 x 30 giây, Single-leg glute bridge 3 x 10, Step-up 3 x 10 mỗi bên. Nên kiểm tra thêm sức mạnh và linh hoạt hai bên.'],
  };
  function exercises(R) {
    const out = [], seen = new Set(), push = (key, why) => { if (EXER[key] && !seen.has(key)) { seen.add(key); out.push({ t: EXER[key][0], h: EXER[key][1], why }); } };
    const cm = R.comb.common, rs = (k, v) => rating(k, v).txt;
    const avg = (k) => { const v = ['L', 'R'].filter((s) => R.res[s]).map((s) => R.res[s].metrics[k]); return v.reduce((x, y) => x + y, 0) / v.length; };
    if (rs('cadence', cm.cadence) === 'thấp') push('cadence_low', 'Nhịp chạy ' + f0(cm.cadence) + ' bước/phút, thấp hơn khoảng bình thường');
    if (rs('overstride', avg('overstride')) === 'cao') push('overstride_high', 'Chân đặt trước hông ' + f0(avg('overstride')) + ' cm, xa hơn bình thường');
    if (rs('vert_osc', cm.vert_osc) === 'cao') push('vert_osc_high', 'Nảy lên xuống ' + f1(cm.vert_osc) + ' cm, cao hơn bình thường');
    if (rs('trunk', cm.trunk) === 'thấp') push('trunk_low', 'Thân nghiêng ' + f1(cm.trunk) + '°, thẳng hơn bình thường');
    if (rs('trunk', cm.trunk) === 'cao') push('trunk_high', 'Thân nghiêng ' + f1(cm.trunk) + '°, gập nhiều hơn bình thường');
    const kn = avg('knee_ic'); if (rs('knee_ic', kn) === 'thấp') push('knee_ic_low', 'Gối gập ' + f0(kn) + '° lúc chạm đất, gần thẳng'); else if (rs('knee_ic', kn) === 'cao') push('knee_ic_high', 'Gối gập ' + f0(kn) + '° lúc chạm đất, nhiều hơn bình thường');
    if (rs('hip_ext', avg('hip_ext')) === 'thấp') push('hip_ext_low', 'Duỗi hông ' + f0(avg('hip_ext')) + '°, hạn chế');
    if (rs('knee_mid', avg('knee_mid')) === 'thấp') push('knee_mid_low', 'Gối gập tối đa lúc đứng ' + f0(avg('knee_mid')) + '°, ít hơn bình thường');
    if (rs('knee_swing', avg('knee_swing')) === 'thấp') push('knee_swing_low', 'Gối gập tối đa lúc đưa chân ' + f0(avg('knee_swing')) + '°, thấp hơn bình thường');
    if (R.res.L && R.res.R && ['knee_ic', 'overstride'].some((k) => Math.abs(R.res.L.metrics[k] - R.res.R.metrics[k]) >= Gait.ASYM[k])) push('asym', 'Hai chân khác nhau rõ ở gối hoặc vị trí đặt chân');
    return out;
  }
  function conclusion(R) {
    if (R.q && R.q.bad) return { text: 'Chưa đủ tin cậy để kết luận.', adv: ['Lý do: ' + R.q.why.join('; ') + '.', 'Hãy đo lại: camera đặt ngang vuông góc, thấy cả người từ đầu đến chân, đủ sáng, và dòng "Nhận diện … khung/giây" khi đo nên từ 20 trở lên.'], bad: 1, unreliable: true };
    const cm = R.comb.common, r = R.res, flags = [], adv = [];
    const avg = (k) => { const v = ['L', 'R'].filter((s) => r[s]).map((s) => r[s].metrics[k]); return v.reduce((a, b) => a + b, 0) / v.length; };
    const st = { cadence: rating('cadence', cm.cadence).txt, vert_osc: rating('vert_osc', cm.vert_osc).txt, trunk: rating('trunk', cm.trunk).txt, overstride: rating('overstride', avg('overstride')).txt, knee_ic: rating('knee_ic', avg('knee_ic')).txt };
    const target = Math.min(180, Math.round(cm.cadence * 1.05));
    if (st.cadence === 'thấp') { flags.push('nhịp chạy chậm'); }
    if (st.overstride === 'cao') flags.push('đặt chân xa trước hông');
    if (st.vert_osc === 'cao') flags.push('nảy lên xuống nhiều');
    if (st.trunk === 'thấp') flags.push('thân quá thẳng hoặc ngả sau'); else if (st.trunk === 'cao') flags.push('thân gập trước nhiều');
    if (st.knee_ic === 'cao') flags.push('gối gập nhiều lúc chạm đất'); else if (st.knee_ic === 'thấp') flags.push('gối gần thẳng lúc chạm đất');
    const asy = []; for (const k of ['knee_ic', 'overstride']) if (r.L && r.R && Math.abs(r.L.metrics[k] - r.R.metrics[k]) >= Gait.ASYM[k]) asy.push(k);
    if (asy.length) flags.push('hai chân không đều');
    const text = flags.length ? 'Cần chỉnh: ' + flags.join('; ') + '.' : 'Dáng chạy tốt: các chỉ số chính nằm trong khoảng bình thường.';
    if (st.cadence === 'thấp' || st.overstride === 'cao') adv.push('Tăng nhịp chạy khoảng 5% (khoảng ' + target + ' bước/phút), bước ngắn lại và đặt chân gần dưới thân người.');
    if (st.vert_osc === 'cao') adv.push('Chạy "êm" hơn: đẩy người về phía trước thay vì nảy lên, giữ nhịp nhanh và bước nhẹ.');
    if (st.trunk === 'thấp') adv.push('Nghiêng nhẹ cả người về trước từ cổ chân (không gập lưng), mắt nhìn xa phía trước.');
    else if (st.trunk === 'cao') adv.push('Đứng thẳng hơn, giữ bụng gồng nhẹ, tránh gập người về trước.');
    if (st.knee_ic === 'cao') adv.push('Tăng sức mạnh đùi và mông (squat, bước lên bục) 2 buổi mỗi tuần.');
    else if (st.knee_ic === 'thấp') adv.push('Chạm đất nhẹ nhàng, giữ gối hơi mềm để giảm sốc.');
    if (asy.length) adv.push('Hai chân khác nhau rõ: nên kiểm tra thêm sức mạnh và độ linh hoạt hai bên.');
    if (!adv.length) adv.push('Giữ kỹ thuật hiện tại, tập sức mạnh 2 buổi mỗi tuần và đo lại sau 4–6 tuần.');
    const pain = (R.sub.pain || '').trim();
    const out = adv.slice(0, pain ? 2 : 3);
    if (pain) out.push('Bạn đang có đau (' + pain + '): nên được bác sĩ thăm khám trực tiếp.');
    return { text, adv: out, bad: flags.length };
  }
  function drawResult(R) {
    const cv = $('res'), c = cv.getContext('2d');
    c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    c.fillStyle = '#EEF2F4'; c.fillRect(0, 0, 1920, 1080);
    const g = c.createLinearGradient(0, 0, 1920, 0); g.addColorStop(0, '#0E2433'); g.addColorStop(1, '#0d4a46');
    c.fillStyle = g; c.fillRect(0, 0, 1920, 96);
    const sub = R.sub, d = new Date();
    c.fillStyle = '#fff'; c.font = '700 42px ' + FFX; c.fillText(sub.name, 48, 52);
    c.fillStyle = '#9fc7d6'; c.font = '20px ' + FFX;
    c.fillText('cao ' + sub.height + ' cm  ·  ' + (SPEED * 3.6).toFixed(0) + ' km/h  ·  ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(), 48, 80);
    c.textAlign = 'right'; c.fillStyle = '#7fe3c3'; c.font = '700 22px ' + FFX; c.fillText('CHẠY BỘ CÙNG BÁC SĨ KIÊN', 1872, 46);
    c.fillStyle = '#9fc7d6'; c.font = '19px ' + FFX; c.fillText('bacsikien.com', 1872, 76); c.textAlign = 'left';
    const sc = scores(R);
    // ---- khối điểm: to nhất, ngay dưới tiêu đề ----
    const card = (x, w, fill) => { c.save(); c.shadowColor = 'rgba(14,36,51,.10)'; c.shadowBlur = 14; c.shadowOffsetY = 3; c.fillStyle = fill || '#fff'; rr(c, x, 106, w, 190, 22); c.fill(); c.restore(); };
    const verdict = (v) => (v >= 90 ? 'Rất tốt' : v >= 80 ? 'Tốt' : v >= 60 ? 'Cần chỉnh một số điểm' : 'Nên được tư vấn trực tiếp');
    card(48, 720);
    if (sc.total != null) {
      c.fillStyle = scoreCol(sc.total); rr(c, 48, 106, 12, 190, 6); c.fill();
      c.fillStyle = '#5B6B77'; c.font = '700 22px ' + FFX; c.fillText('ĐIỂM DÁNG CHẠY', 90, 146);
      c.fillStyle = scoreCol(sc.total); c.font = '700 150px ' + FFX; c.fillText(String(sc.total), 86, 270);
      const nw = c.measureText(String(sc.total)).width;
      c.fillStyle = '#7A8791'; c.font = '700 40px ' + FFX; c.fillText('/100', 96 + nw, 270);
      c.fillStyle = scoreCol(sc.total); c.font = '700 30px ' + FFX; c.textAlign = 'right'; c.fillText(verdict(sc.total), 744, 146, 330); c.textAlign = 'left';
    } else {
      c.fillStyle = AMBER; rr(c, 48, 106, 12, 190, 6); c.fill();
      c.fillStyle = '#5B6B77'; c.font = '700 22px ' + FFX; c.fillText('ĐIỂM DÁNG CHẠY', 90, 146);
      c.fillStyle = AMBER; c.font = '700 46px ' + FFX; c.fillText('Chưa đủ tin cậy', 90, 210);
      c.fillStyle = '#5B6B77'; c.font = '20px ' + FFX; c.fillText('Xem lý do ở phần kết luận bên dưới', 90, 250);
    }
    [['L', 780, 'CHÂN TRÁI', BLUE], ['R', 1332, 'CHÂN PHẢI', ORANGE]].forEach(([s, x, lb, col]) => {
      card(x, 540);
      c.fillStyle = col; c.beginPath(); c.arc(x + 36, 146, 10, 0, 7); c.fill();
      c.fillStyle = '#5B6B77'; c.font = '700 22px ' + FFX; c.fillText('ĐIỂM ' + lb, x + 56, 154);
      const v = sc[s];
      c.fillStyle = v == null ? '#8A97A1' : scoreCol(v); c.font = '700 100px ' + FFX; c.fillText(v == null ? '–' : String(v), x + 28, 262);
      if (v != null) { const w2 = c.measureText(String(v)).width; c.fillStyle = '#7A8791'; c.font = '700 30px ' + FFX; c.fillText('/100', x + 38 + w2, 262); c.fillStyle = scoreCol(v); c.font = '600 22px ' + FFX; c.textAlign = 'right'; c.fillText(verdict(v), x + 520, 262, 240); c.textAlign = 'left'; }
    });
    const colX = { L: 48, R: 972 }, cw = 900;
    for (const s of ['L', 'R']) {
      const x = colX[s], m = R.res[s] && R.res[s].metrics;
      drawPhoto(c, S.photos && S.photos[s], s, x, 306, cw, 296, R);
      const tw = (cw - 24) / 3;
      if (m) {
        tile(c, x, 612, tw, 124, { label: 'Gối gập', key: 'knee_ic', v: m.knee_ic, val: f0(m.knee_ic), unit: '°', ref: REF.knee_ic });
        tile(c, x + tw + 12, 612, tw, 124, { label: 'Chân trước hông', key: 'overstride', v: m.overstride, val: f0(m.overstride), unit: 'cm', ref: REF.overstride });
        tile(c, x + 2 * (tw + 12), 612, tw, 124, { label: 'Kiểu tiếp đất', text: R.res[s].extra.strike });
      } else { c.fillStyle = '#8A97A1'; c.font = '22px ' + FFX; c.fillText('Không đo được chân này', x, 672); }
    }
    const cm = R.comb.common, tw3 = (1824 - 24) / 3;
    tile(c, 48, 746, tw3, 124, { label: 'Nhịp chạy', key: 'cadence', v: cm.cadence, val: f0(cm.cadence), unit: 'bước/phút', ref: REF.cadence });
    tile(c, 48 + tw3 + 12, 746, tw3, 124, { label: 'Nảy lên xuống', key: 'vert_osc', v: cm.vert_osc, val: f1(cm.vert_osc), unit: 'cm', ref: REF.vert_osc });
    tile(c, 48 + 2 * (tw3 + 12), 746, tw3, 124, { label: 'Nghiêng thân', key: 'trunk', v: cm.trunk, val: f1(cm.trunk), unit: '°', ref: REF.trunk });
    // kết luận + nên làm
    const cc = conclusion(R), good = cc.bad === 0;
    c.fillStyle = '#fff'; rr(c, 48, 880, 1824, 156, 18); c.fill();
    c.fillStyle = good ? GREEN : AMBER; rr(c, 48, 880, 10, 156, 5); c.fill();
    c.fillStyle = GREEN; c.font = '700 17px ' + FFX; c.fillText('KẾT LUẬN', 84, 912);
    c.fillStyle = '#14202B'; c.font = '700 26px ' + FFX; wrap(c, cc.text, 84, 948, 760, 34);
    c.fillStyle = GREEN; c.font = '700 17px ' + FFX; c.fillText('NÊN LÀM', 940, 912);
    c.font = '20px ' + FFX; let yy = 942;
    cc.adv.slice(0, 2).forEach((t, i) => {
      c.fillStyle = GREEN; c.beginPath(); c.arc(956, yy - 6, 12, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.font = '700 15px ' + FFX; c.textAlign = 'center'; c.fillText(String(i + 1), 956, yy - 1); c.textAlign = 'left';
      c.fillStyle = '#14202B'; c.font = '20px ' + FFX; yy = wrap(c, t, 982, yy, 860, 25) + 8;
    });
    c.fillStyle = '#7A8791'; c.font = '15px ' + FFX;
    c.fillText('Thanh xanh = khoảng bình thường. Sàng lọc 2D bằng AI, không thay thế khám lâm sàng. Chân xa camera kém tin cậy hơn.', 48, 1068);
  }

  function extraRows(R) {
    const out = [], ex = R.ex; if (!ex) return out;
    const one = (k, fmt) => { const c = REF[k]; const v = ex.common[k]; out.push({ label: c.label, unit: c.unit, a: v == null || Number.isNaN(v) ? '–' : fmt(v), b: '', ref: c.lo != null ? c.lo + '–' + c.hi : '', st: c.lo != null ? rating(k, v).txt : '', ok: rating(k, v).ok, common: true }); };
    const two = (k, fmt) => { const c = REF[k]; const g = (s) => (ex.per[s] && ex.per[s][k] != null && !Number.isNaN(ex.per[s][k]) ? ex.per[s][k] : NaN);
      const l = g('L'), r = g('R'); const sl = rating(k, l), sr = rating(k, r);
      out.push({ label: c.label, unit: c.unit, a: Number.isNaN(l) ? '–' : fmt(l), b: Number.isNaN(r) ? '–' : fmt(r), ref: c.lo != null ? c.lo + '–' + c.hi : '', st: c.lo != null ? sl.txt + ' / ' + sr.txt : '', ok: sl.ok && sr.ok }); };
    two('contact_ms', f0); one('flight_ms', f0); one('duty', f1); one('step_cv', f1); one('step_asym', f1); one('contact_asym', f1);
    two('hip_flex', f0); two('heel_kick', f1); two('arm_swing', f0); two('elbow', f0); two('head_fwd', f1);
    if (R.fat) {
      const sgn = (v, u) => (v > 0 ? '+' : '') + v.toFixed(1) + ' ' + u;
      out.push({ label: 'Cuối buổi so với đầu buổi: nhịp chạy', unit: '', a: sgn(R.fat.d_cadence, 'bước/phút'), b: '', ref: '', st: Math.abs(R.fat.d_cadence) > 6 ? 'thay đổi nhiều' : 'ổn định', ok: Math.abs(R.fat.d_cadence) <= 6, common: true });
      out.push({ label: 'Cuối buổi so với đầu buổi: nhấp nhô', unit: '', a: sgn(R.fat.d_vert, 'cm'), b: '', ref: '', st: Math.abs(R.fat.d_vert) > 1.5 ? 'thay đổi nhiều' : 'ổn định', ok: Math.abs(R.fat.d_vert) <= 1.5, common: true });
    }
    return out;
  }
  const EXL = ['contact_ms', 'hip_flex', 'heel_kick', 'arm_swing', 'elbow', 'head_fwd'];
  function detailHTML(R) {
    const keys = ['cadence', 'vert_osc', 'trunk', 'knee_ic', 'shank_ic', 'overstride', 'knee_mid', 'hip_ext', 'knee_swing'];
    const q = R.q ? '<p style="margin:0 0 8px;color:#5B6B77">Chẩn đoán: ' + R.q.fps + ' khung/giây phân tích · nhận diện ' + Math.round(R.q.det * 100) + '% khung hình (' + R.q.frames + ' khung)' + (R.q.slow > 1 ? ' · video quay chậm gấp ' + R.q.slow : '') + (R.q.bad ? ' · <b style="color:#D9503F">KHÔNG ĐÁNG TIN: ' + R.q.why.join('; ') + '</b>' : ' · đạt kiểm tra độ tin cậy') + '</p>' : '';
    const sc3 = scores(R);
    let h = '<p style="margin:0 0 8px;font-weight:700">Điểm: chung ' + (sc3.total != null ? sc3.total : '–') + ' · trái ' + (sc3.L != null ? sc3.L : '–') + ' · phải ' + (sc3.R != null ? sc3.R : '–') + ' (/100, tham khảo)</p>' + q + '<table><tr><th>Chỉ số</th><th>Trái</th><th>Phải</th><th>Tham chiếu</th><th>Đánh giá</th></tr>';
    for (const k of keys) {
      const c = REF[k] || { label: k, unit: '' }, common = Gait.COMMON.includes(k);
      const L = R.res.L ? R.res.L.metrics[k] : NaN, Rr = R.res.R ? R.res.R.metrics[k] : NaN;
      const val = common ? R.comb.common[k] : null;
      const cell = (v) => f1(v);
      const rt = common ? rating(k, val).txt : ['L', 'R'].map((s) => (R.res[s] ? rating(k, R.res[s].metrics[k]).txt : '–')).join(' / ');
      h += '<tr><td>' + c.label + ' (' + c.unit + ')</td><td>' + (common ? '<b>' + cell(val) + '</b>' : cell(L)) + '</td><td>' + (common ? '' : cell(Rr)) + '</td><td>' + (c.lo != null ? c.lo + '–' + c.hi : '') + '</td><td>' + rt + '</td></tr>';
    }
    for (const x of extraRows(R)) h += '<tr><td>' + x.label + (x.unit ? ' (' + x.unit + ')' : '') + '</td><td>' + x.a + '</td><td>' + x.b + '</td><td>' + x.ref + '</td><td>' + x.st + '</td></tr>';
    for (const s of ['L', 'R']) if (R.res[s]) h += '<tr><td>Chân ' + (s === 'L' ? 'trái' : 'phải') + ': số bước · độ tin cậy</td><td colspan="4">' + R.res[s].extra.nSteps + ' bước · vis ' + R.res[s].extra.vis.toFixed(2) + (R.res[s].extra.vis < 0.6 ? ' (thấp)' : '') + '</td></tr>';
    return h + '</table>';
  }

  // ---------- Lớp 3 ----------
  async function finish() {
    if (REC.mr) await recStop(true, S.sub && S.sub.name);
    S.running = false; clearInterval(S.timer);
    if (S.error) {
      show('L1'); $('msg1').textContent = 'Không đo được: ' + S.error + ' Hãy bấm Bắt đầu để đo lại.';
      refreshL1(); return;
    }
    let guard = 0; while (!S.photosReady && guard++ < 50) await new Promise((r) => setTimeout(r, 100));
    const R = S.result;
    try {
      if (S.late && S.late.length > 60) {
        const rs = Gait.resample(S.late, S.fps || CFG.fps), bb = Gait.computeBoth(rs.P, S.fps || CFG.fps, R.sub.height, SPEED);
        R.fat = Gait.fatigue(R, { comb: Gait.combine(bb.res, SPEED) });
      }
    } catch (e) { R.fat = null; }
    drawResult(R);
    $('detail').innerHTML = detailHTML(R); $('detail').style.display = 'none';
    show('L3');
    // ghi dòng vào bảng Excel
    const nowd = new Date();
    const row = { id: R.sub.id, time: pad(nowd.getDate()) + '/' + pad(nowd.getMonth() + 1) + '/' + nowd.getFullYear() + ' ' + pad(nowd.getHours()) + ':' + pad(nowd.getMinutes()), name: R.sub.name, phone: R.sub.phone, height_cm: R.sub.height, pain: R.sub.pain };
    for (const k of Gait.COMMON) row[k] = +R.comb.common[k].toFixed(2);
    for (const k of Gait.PERLEG) for (const s of ['L', 'R']) row[k + '_' + s] = R.res[s] ? +R.res[s].metrics[k].toFixed(2) : '';
    for (const s of ['L', 'R']) row['foot_strike_' + s] = R.res[s] ? R.res[s].extra.strike : '';
    if (R.ex) {
      for (const k of ['flight_ms', 'duty', 'step_cv', 'step_asym', 'contact_asym']) row[k] = R.ex.common[k] != null && !Number.isNaN(R.ex.common[k]) ? +R.ex.common[k].toFixed(2) : '';
      for (const k of EXL) for (const sd of ['L', 'R']) { const v = R.ex.per[sd] ? R.ex.per[sd][k] : NaN; row[k + '_' + sd] = v != null && !Number.isNaN(v) ? +v.toFixed(2) : ''; }
    }
    { const sc2 = scores(R); row.score_total = sc2.total != null ? sc2.total : ''; row.score_L = sc2.L != null ? sc2.L : ''; row.score_R = sc2.R != null ? sc2.R : ''; }
    if (R.fat) { row.fat_cad = +R.fat.d_cadence.toFixed(1); row.fat_vert = +R.fat.d_vert.toFixed(2); }
    for (const s of ['L', 'R']) row['steps_' + s] = R.res[s] ? R.res[s].extra.nSteps : '';
    const cc = conclusion(R); row.conclusion = cc.text; row.advice = cc.adv.join(' | ');
    S.rows.push(row); S.nextId++;
    try { localStorage.setItem('gait_rows', JSON.stringify(S.rows)); } catch (e) { /* bỏ qua */ }
    saveXlsx(true);
    if ($('autosave').checked) savePng();
  }

  function savePng() {
    const a = document.createElement('a'); const R = S.result;
    a.download = (R ? R.sub.id + '_' + R.sub.name.replace(/\s+/g, '_') : 'ketqua') + '.png';
    a.href = $('res').toDataURL('image/png'); a.click();
  }

  // ---------- PDF trả khách (2 trang: kết quả + giải thích) ----------
  const MEANING = {
    cadence: 'Số bước chân mỗi phút. Bước ngắn và nhanh hơn thường giúp giảm lực va đập lên gối và hông.',
    vert_osc: 'Mức hông nhấp nhô lên xuống mỗi bước. Càng ít thì càng tiết kiệm sức và đỡ va đập.',
    trunk: 'Độ nghiêng thân người về phía trước khi chạm đất. Nghiêng nhẹ từ hông là hợp lý.',
    overstride: 'Khoảng cách bàn chân đặt trước hông lúc chạm đất. Đặt quá xa trước người sẽ tạo lực phanh mỗi bước.',
    knee_ic: 'Độ gập của gối lúc bàn chân chạm đất. Gối hơi gập giúp giảm sốc cho khớp.',
    strike: 'Phần bàn chân chạm đất trước: gót, giữa bàn hoặc mũi chân. Không có kiểu đúng tuyệt đối; quan trọng là chạm đất gần dưới thân người.',
  };
  function wrap(c, text, x, y, maxW, lh) {
    const words = text.split(' '); let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (c.measureText(t).width > maxW && line) { c.fillText(line, x, y); y += lh; line = w; } else line = t;
    }
    if (line) { c.fillText(line, x, y); y += lh; }
    return y;
  }
  function drawPage2(R) {
    const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080;
    const c = cv.getContext('2d'), FF = 'system-ui,"Segoe UI",Arial';
    c.fillStyle = '#fff'; c.fillRect(0, 0, 1920, 1080);
    const g = c.createLinearGradient(0, 0, 1920, 0); g.addColorStop(0, '#0E2433'); g.addColorStop(1, '#0d4a46');
    c.fillStyle = g; c.fillRect(0, 0, 1920, 110);
    c.fillStyle = '#fff'; c.font = '700 40px ' + FF; c.fillText('Ý nghĩa các chỉ số của bạn', 48, 66);
    c.textAlign = 'right'; c.fillStyle = '#7fe3c3'; c.font = '700 22px ' + FF; c.fillText('CHẠY BỘ CÙNG BÁC SĨ KIÊN', 1872, 52);
    c.fillStyle = '#9fc7d6'; c.font = '19px ' + FF; c.fillText(R.sub.name, 1872, 84); c.textAlign = 'left';
    const rows = [
      { k: 'cadence', t: 'Cadence (nhịp chạy)' }, { k: 'vert_osc', t: 'Nhấp nhô' }, { k: 'trunk', t: 'Nghiêng thân' },
      { k: 'overstride', t: 'Tiếp đất trước thân', per: true }, { k: 'knee_ic', t: 'Gập gối lúc chạm đất', per: true }, { k: 'strike', t: 'Kiểu tiếp đất', per: true },
    ];
    const cm = R.comb.common, r = R.res;
    const f = (k, v) => (k === 'cadence' ? f0(v) : k === 'knee_ic' || k === 'trunk' ? (k === 'knee_ic' ? f0(v) : f1(v)) : f1(v));
    const unit = (k) => (REF[k] ? REF[k].unit : '');
    let y = 140; const rh = 128;
    rows.forEach((row, i) => {
      const yy = y + i * rh;
      c.fillStyle = i % 2 ? '#fff' : '#F5F8F9'; c.fillRect(48, yy, 1824, rh - 8);
      c.fillStyle = '#14202B'; c.font = '700 26px ' + FF; c.fillText(row.t, 68, yy + 40);
      c.fillStyle = '#5B6B77'; c.font = '21px ' + FF; wrap(c, MEANING[row.k], 68, yy + 74, 820, 28);
      // giá trị + đánh giá (cột phải)
      let val = '', st = [], ok = true;
      if (!row.per) { const q = rating(row.k, cm[row.k]); val = f(row.k, cm[row.k]) + ' ' + unit(row.k); ok = q.ok; st.push({ t: q.txt, ok: q.ok, k: row.k }); }
      else if (row.k === 'strike') { val = ['L', 'R'].map((s) => (r[s] ? (s === 'L' ? 'Trái: ' : 'Phải: ') + r[s].extra.strike : '')).filter(Boolean).join('   '); }
      else { val = ['L', 'R'].map((s) => (r[s] ? (s === 'L' ? 'Trái ' : 'Phải ') + f(row.k, r[s].metrics[row.k]) : '')).filter(Boolean).join('   ') + ' ' + unit(row.k); ['L', 'R'].forEach((s) => { if (r[s]) { const q = rating(row.k, r[s].metrics[row.k]); st.push({ t: q.txt, ok: q.ok, k: row.k, s }); if (!q.ok) ok = false; } }); }
      c.fillStyle = ok ? GREEN : AMBER; c.font = '700 30px ' + FF; c.fillText(val, 940, yy + 38, 920);
      // khoảng bình thường
      c.fillStyle = '#14202B'; c.font = '600 20px ' + FF;
      if (REF[row.k] && row.k !== 'strike') c.fillText('Khoảng bình thường: ' + REF[row.k].lo + '–' + REF[row.k].hi + ' ' + unit(row.k), 940, yy + 66, 920);
      else c.fillText('Khoảng bình thường: cả ba kiểu đều có thể gặp ở người chạy khỏe', 940, yy + 66, 920);
      if (REF[row.k] && row.k !== 'strike') {
        const bad = st.find((q) => !q.ok);
        const msg = !bad ? 'Chỉ số của bạn nằm trong khoảng bình thường.' : (bad.t === 'thấp' ? REF[row.k].low : REF[row.k].high) || 'Chỉ số ngoài khoảng bình thường.';
        c.font = '19px ' + FF; c.fillStyle = ok ? '#4a5a65' : '#8a5a10'; wrap(c, msg, 940, yy + 92, 920, 23);
      }
    });
    // ghi chú bác sĩ
    const note = ($('note').value || '').trim();
    const ny = y + rows.length * rh + 6;
    c.fillStyle = '#E7F5EF'; rr(c, 48, ny, 1824, 118, 14); c.fill();
    c.fillStyle = GREEN; c.font = '700 20px ' + FF; c.fillText('NHẬN XÉT CỦA BÁC SĨ', 72, ny + 34);
    c.fillStyle = '#14202B'; c.font = '24px ' + FF;
    if (note) wrap(c, note, 72, ny + 70, 1780, 30);
    c.fillStyle = '#7A8791'; c.font = '17px ' + FF;
    c.fillText('Kết quả sàng lọc 2D bằng AI trong 15 giây chạy, chỉ mang tính tham khảo, không thay thế khám và chẩn đoán lâm sàng. Nếu đang đau hoặc chấn thương, hãy gặp bác sĩ.', 48, 1040, 1824);
    c.textAlign = 'right'; c.fillStyle = GREEN; c.font = '700 20px ' + FF; c.fillText('Liên hệ: ' + CONTACT, 1872, 1068); c.textAlign = 'left';
    return cv;
  }
  function drawPage3(R) {
    const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080;
    const c = cv.getContext('2d'), FF = 'system-ui,"Segoe UI",Arial';
    c.fillStyle = '#fff'; c.fillRect(0, 0, 1920, 1080);
    const g = c.createLinearGradient(0, 0, 1920, 0); g.addColorStop(0, '#0E2433'); g.addColorStop(1, '#0d4a46');
    c.fillStyle = g; c.fillRect(0, 0, 1920, 110);
    c.fillStyle = '#fff'; c.font = '700 40px ' + FF; c.fillText('Bảng số đo chi tiết', 48, 66);
    c.textAlign = 'right'; c.fillStyle = '#7fe3c3'; c.font = '700 22px ' + FF; c.fillText('CHẠY BỘ CÙNG BÁC SĨ KIÊN', 1872, 52);
    c.fillStyle = '#9fc7d6'; c.font = '19px ' + FF; c.fillText(R.sub.name, 1872, 84); c.textAlign = 'left';
    const rows = [];
    const keys = ['cadence', 'vert_osc', 'trunk', 'knee_ic', 'shank_ic', 'overstride', 'knee_mid', 'hip_ext', 'knee_swing'];
    for (const k of keys) {
      const cf = REF[k], common = Gait.COMMON.includes(k);
      const L = R.res.L ? R.res.L.metrics[k] : NaN, Rr = R.res.R ? R.res.R.metrics[k] : NaN, v = common ? R.comb.common[k] : null;
      const st = common ? rating(k, v) : null, sl = R.res.L ? rating(k, L) : { ok: true, txt: '–' }, sr = R.res.R ? rating(k, Rr) : { ok: true, txt: '–' };
      rows.push({ label: cf.label, unit: cf.unit, a: common ? f1(v) : f1(L), b: common ? '' : f1(Rr), ref: cf.lo + '–' + cf.hi, st: common ? st.txt : sl.txt + ' / ' + sr.txt, ok: common ? st.ok : sl.ok && sr.ok, common });
    }
    rows.push({ label: 'Kiểu tiếp đất', unit: '', a: R.res.L ? R.res.L.extra.strike : '–', b: R.res.R ? R.res.R.extra.strike : '–', ref: '', st: '', ok: true });
    extraRows(R).forEach((x) => rows.push(x));
    const n = rows.length, top = 128, rh = Math.min(48, Math.floor((900) / (n + 1)));
    const X = [48, 760, 1000, 1240, 1500];
    c.fillStyle = '#14202B'; c.font = '700 22px ' + FF;
    ['Chỉ số', 'Chân trái', 'Chân phải', 'Bình thường', 'Đánh giá'].forEach((t, i) => c.fillText(t, X[i] + 10, top + 4));
    rows.forEach((r, i) => {
      const y = top + 14 + i * rh;
      c.fillStyle = i % 2 ? '#fff' : '#F5F8F9'; c.fillRect(48, y, 1824, rh - 2);
      const fs = Math.max(15, Math.min(22, rh - 22));
      c.font = fs + 'px ' + FF; c.fillStyle = '#14202B'; c.fillText(r.label + (r.unit ? ' (' + r.unit + ')' : ''), X[0] + 10, y + rh * 0.68, 690);
      c.font = '700 ' + fs + 'px ' + FF;
      if (r.common) { c.fillText(r.a, X[1] + 10, y + rh * 0.68, 480); } else { c.fillText(r.a, X[1] + 10, y + rh * 0.68, 230); c.fillText(r.b, X[2] + 10, y + rh * 0.68, 230); }
      c.font = fs + 'px ' + FF; c.fillStyle = '#5B6B77'; c.fillText(r.ref, X[3] + 10, y + rh * 0.68, 250);
      c.fillStyle = r.ok ? GREEN : AMBER; c.font = '700 ' + fs + 'px ' + FF; c.fillText(r.st, X[4] + 10, y + rh * 0.68, 370);
    });
    c.fillStyle = '#7A8791'; c.font = '16px ' + FF;
    c.fillText('Mốc thời gian chạm đất/bay ước lượng từ video 30 khung/giây (sai số khoảng ±33 ms). Các chỉ số không có khoảng bình thường chỉ để theo dõi. Chân xa camera kém tin cậy hơn.', 48, 1040, 1824);
    c.fillText('Không đo được từ camera ngang: gối vào trong, hông tụt, bàn chân xoay trong/ngoài, bước chéo, bề rộng bước (cần thêm camera sau). Chỉ mang tính tham khảo, không thay thế bác sĩ.', 48, 1064, 1824);
    return cv;
  }
  function drawPage4(R) {
    const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080;
    const c = cv.getContext('2d'), FF = 'system-ui,"Segoe UI",Arial';
    c.fillStyle = '#fff'; c.fillRect(0, 0, 1920, 1080);
    const g = c.createLinearGradient(0, 0, 1920, 0); g.addColorStop(0, '#0E2433'); g.addColorStop(1, '#0d4a46');
    c.fillStyle = g; c.fillRect(0, 0, 1920, 110);
    c.fillStyle = '#fff'; c.font = '700 40px ' + FF; c.fillText('Điểm dáng chạy và bài tập gợi ý', 48, 66);
    c.textAlign = 'right'; c.fillStyle = '#7fe3c3'; c.font = '700 22px ' + FF; c.fillText('CHẠY BỘ CÙNG BÁC SĨ KIÊN', 1872, 52);
    c.fillStyle = '#9fc7d6'; c.font = '19px ' + FF; c.fillText(R.sub.name, 1872, 84); c.textAlign = 'left';
    const sc = scores(R);
    const box = (x, label, v, big) => {
      c.fillStyle = '#F5F8F9'; rr(c, x, 134, big ? 520 : 400, 150, 16); c.fill();
      c.fillStyle = '#5B6B77'; c.font = '700 20px ' + FF; c.fillText(label, x + 24, 174);
      c.fillStyle = v == null ? '#8A97A1' : scoreCol(v); c.font = '700 80px ' + FF; c.fillText(v == null ? '–' : String(v), x + 24, 256);
      c.font = '700 80px ' + FF; const nw = c.measureText(v == null ? '–' : String(v)).width; c.fillStyle = '#5B6B77'; c.font = '26px ' + FF; c.fillText('/100', x + 24 + nw + 8, 256);
    };
    box(48, 'ĐIỂM CHUNG', sc.total, true); box(596, 'CHÂN TRÁI', sc.L); box(1024, 'CHÂN PHẢI', sc.R);
    c.fillStyle = '#5B6B77'; c.font = '17px ' + FF;
    wrap(c, 'Điểm cho biết bao nhiêu chỉ số chính nằm trong khoảng bình thường (90+ rất tốt, 80–89 tốt, 60–79 cần chỉnh một số điểm, dưới 60 nên được tư vấn trực tiếp). Đây là điểm tham khảo, không phải chẩn đoán.', 1460, 160, 410, 23);
    c.fillStyle = '#14202B'; c.font = '700 26px ' + FF; c.fillText('Bài tập gợi ý cho bạn', 48, 340);
    const ex = exercises(R).slice(0, 6);
    if (!ex.length) { c.fillStyle = '#4a5a65'; c.font = '24px ' + FF; wrap(c, 'Các chỉ số chính đều nằm trong khoảng bình thường. Hãy giữ kỹ thuật hiện tại, tập sức mạnh 2 buổi mỗi tuần và đo lại sau 4–6 tuần.', 48, 390, 1700, 34); }
    ex.forEach((e, i) => {
      const col = i % 2, row = Math.floor(i / 2), x = 48 + col * 924, y = 362 + row * 220;
      c.fillStyle = '#F5F8F9'; rr(c, x, y, 900, 204, 16); c.fill();
      c.fillStyle = GREEN; c.beginPath(); c.arc(x + 38, y + 40, 18, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.font = '700 20px ' + FF; c.textAlign = 'center'; c.fillText(String(i + 1), x + 38, y + 47); c.textAlign = 'left';
      c.fillStyle = '#14202B'; c.font = '700 26px ' + FF; c.fillText(e.t, x + 68, y + 48, 810);
      c.fillStyle = AMBER; c.font = '600 18px ' + FF; c.fillText(e.why, x + 24, y + 84, 850);
      c.fillStyle = '#4a5a65'; c.font = '21px ' + FF; wrap(c, e.h, x + 24, y + 120, 850, 28);
    });
    c.fillStyle = '#7A8791'; c.font = '17px ' + FF;
    c.fillText('Tên bài tập kèm thuật ngữ tiếng Anh để dễ tra cứu video hướng dẫn. Bài tập mang tính gợi ý chung, hãy dừng nếu thấy đau và hỏi bác sĩ hoặc huấn luyện viên trước khi tập nếu bạn đang chấn thương.', 48, 1040, 1824);
    c.textAlign = 'right'; c.fillStyle = GREEN; c.font = '700 20px ' + FF; c.fillText('Liên hệ: ' + CONTACT, 1872, 1068); c.textAlign = 'left';
    return cv;
  }
  function jpegBytes(cv) {
    const b = atob(cv.toDataURL('image/jpeg', 0.92).split(',')[1]); const u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u;
  }
  function buildPdf(pages) {   // pages: [{jpg, w, h}], khổ trang 960x540 pt (16:9)
    const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
    const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
    const obj = (id, fn) => { offs[id] = len; push(id + ' 0 obj\n'); fn(); push('\nendobj\n'); };
    push('%PDF-1.4\n');
    obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => push('<< /Type /Pages /Kids [' + pages.map((_, i) => (3 + i * 3) + ' 0 R').join(' ') + '] /Count ' + pages.length + ' >>'));
    pages.forEach((p, i) => {
      const pg = 3 + i * 3, ct = pg + 1, im = pg + 2, content = 'q 960 0 0 540 0 0 cm /Im0 Do Q';
      obj(pg, () => push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 960 540] /Resources << /XObject << /Im0 ' + im + ' 0 R >> >> /Contents ' + ct + ' 0 R >>'));
      obj(ct, () => push('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream'));
      obj(im, () => { push('<< /Type /XObject /Subtype /Image /Width ' + p.w + ' /Height ' + p.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.jpg.length + ' >>\nstream\n'); push(p.jpg); push('\nendstream'); });
    });
    const n = 3 + pages.length * 3, xr = len;
    let x = 'xref\n0 ' + n + '\n0000000000 65535 f \n';
    for (let i = 1; i < n; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
    push(x + 'trailer\n<< /Size ' + n + ' /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF');
    return new Blob(parts, { type: 'application/pdf' });
  }
  function savePdf() {
    const R = S.result; if (!R) return;
    const p2 = drawPage2(R);
    const blob = buildPdf([{ jpg: jpegBytes($('res')), w: 1920, h: 1080 }, { jpg: jpegBytes(p2), w: 1920, h: 1080 }, { jpg: jpegBytes(drawPage3(R)), w: 1920, h: 1080 }, { jpg: jpegBytes(drawPage4(R)), w: 1920, h: 1080 }]);
    const a = document.createElement('a'); a.download = R.sub.id + '_' + R.sub.name.replace(/\s+/g, '_') + '_chitiet.pdf';
    a.href = URL.createObjectURL(blob); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  $('savepdf').addEventListener('click', savePdf);
  $('savepng').addEventListener('click', savePng);
  $('tgdetail').addEventListener('click', () => { const d = $('detail'); d.style.display = d.style.display === 'block' ? 'none' : 'block'; });
  $('next').addEventListener('click', () => {
    ['name', 'phone', 'height', 'pain', 'note'].forEach((i) => ($(i).value = ''));
    $('msg1').textContent = ''; show('L1'); refreshL1();
  });

  // ---------- Xuất Excel (.xlsx) tự viết, không cần thư viện ----------
  const XCOLS = [
    ['id', 'Mã'], ['time', 'Thời gian'], ['name', 'Họ tên'], ['phone', 'SĐT/Zalo'], ['height_cm', 'Chiều cao (cm)'], ['pain', 'Đau/chấn thương'],
    ['cadence', 'Nhịp chạy (bước/phút)'], ['vert_osc', 'Nảy lên xuống (cm)'], ['trunk', 'Nghiêng thân (°)'],
    ['knee_ic_L', 'Gối lúc chạm - Trái (°)'], ['knee_ic_R', 'Gối lúc chạm - Phải (°)'],
    ['overstride_L', 'Chân trước hông - Trái (cm)'], ['overstride_R', 'Chân trước hông - Phải (cm)'],
    ['foot_strike_L', 'Kiểu tiếp đất - Trái'], ['foot_strike_R', 'Kiểu tiếp đất - Phải'],
    ['shank_ic_L', 'Góc cẳng chân - Trái (°)'], ['shank_ic_R', 'Góc cẳng chân - Phải (°)'],
    ['knee_mid_L', 'Gối tối đa lúc đứng - Trái (°)'], ['knee_mid_R', 'Gối tối đa lúc đứng - Phải (°)'],
    ['hip_ext_L', 'Duỗi hông - Trái (°)'], ['hip_ext_R', 'Duỗi hông - Phải (°)'],
    ['knee_swing_L', 'Gối tối đa lúc đưa chân - Trái (°)'], ['knee_swing_R', 'Gối tối đa lúc đưa chân - Phải (°)'],
    ['contact_ms_L', 'Thời gian chạm đất - Trái (ms)'], ['contact_ms_R', 'Thời gian chạm đất - Phải (ms)'], ['flight_ms', 'Thời gian bay (ms)'], ['duty', 'Tỉ lệ chạm đất (%)'],
    ['step_cv', 'Độ dao động nhịp bước (%)'], ['step_asym', 'Lệch nhịp trái-phải (%)'], ['contact_asym', 'Lệch chạm đất trái-phải (%)'],
    ['hip_flex_L', 'Nâng đùi - Trái (°)'], ['hip_flex_R', 'Nâng đùi - Phải (°)'], ['heel_kick_L', 'Gót hất sau - Trái (cm)'], ['heel_kick_R', 'Gót hất sau - Phải (cm)'],
    ['arm_swing_L', 'Vung tay - Trái (°)'], ['arm_swing_R', 'Vung tay - Phải (°)'], ['elbow_L', 'Gập khuỷu - Trái (°)'], ['elbow_R', 'Gập khuỷu - Phải (°)'],
    ['head_fwd_L', 'Đầu nghiêng trước - Trái (°)'], ['head_fwd_R', 'Đầu nghiêng trước - Phải (°)'],
    ['fat_cad', 'Mệt mỏi: đổi nhịp cuối buổi (bước/phút)'], ['fat_vert', 'Mệt mỏi: đổi nhấp nhô cuối buổi (cm)'],
    ['score_total', 'Điểm chung (/100)'], ['score_L', 'Điểm chân trái'], ['score_R', 'Điểm chân phải'],
    ['steps_L', 'Số bước - Trái'], ['steps_R', 'Số bước - Phải'], ['conclusion', 'Kết luận'], ['advice', 'Nên làm'],
  ];
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u) => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zipStore(files) {
    const enc = new TextEncoder(), parts = [], cd = []; let off = 0;
    const u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255], u16 = (v) => [v & 255, (v >>> 8) & 255];
    for (const f of files) {
      const name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
      const lh = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)]);
      parts.push(lh, name, data);
      cd.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
      off += lh.length + name.length + data.length;
    }
    let cdl = 0; cd.forEach((p) => { cdl += p.length; });
    const end = new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cdl), ...u32(off), 0, 0]);
    return new Blob([...parts, ...cd, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function xlsxBlob(rows) {
    const esc = (v) => String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const colName = (i) => { let n = '', k = i; do { n = String.fromCharCode(65 + (k % 26)) + n; k = Math.floor(k / 26) - 1; } while (k >= 0); return n; };
    const cell = (ri, ci, v, st) => {
      const ref = colName(ci) + (ri + 1);
      if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + (st ? ' s="' + st + '"' : '') + '><v>' + v + '</v></c>';
      if (v === '' || v == null) return '';
      return '<c r="' + ref + '" t="inlineStr"' + (st ? ' s="' + st + '"' : '') + '><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
    };
    let sd = '<row r="1">' + XCOLS.map((c, i) => cell(0, i, c[1], 1)).join('') + '</row>';
    rows.forEach((r, ri) => { sd += '<row r="' + (ri + 2) + '">' + XCOLS.map((c, i) => cell(ri + 1, i, r[c[0]], 0)).join('') + '</row>'; });
    const widths = XCOLS.map((c, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (c[0] === 'conclusion' || c[0] === 'advice' ? 60 : c[0] === 'name' || c[0] === 'pain' ? 24 : 18) + '" customWidth="1"/>').join('');
    const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    return zipStore([
      { name: '[Content_Types].xml', text: X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { name: '_rels/.rels', text: X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', text: X + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Ket qua" sheetId="1" r:id="rId1"/></sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', text: X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', text: X + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B7A5C"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf></cellXfs></styleSheet>' },
      { name: 'xl/worksheets/sheet1.xml', text: X + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane xSplit="3" ySplit="1" topLeftCell="D2" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols>' + widths + '</cols><sheetData>' + sd + '</sheetData></worksheet>' },
    ]);
  }
  const xstat = (t, bad) => { const e = $('xstat'); e.textContent = t; e.style.color = bad ? '#A3281A' : '#0B7A5C'; };
  function downloadXlsx() {
    const a = document.createElement('a'); a.download = 'tong_hop_workshop.xlsx'; a.href = URL.createObjectURL(xlsxBlob(S.rows)); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  async function saveXlsx(auto) {
    if (!S.rows.length) return;
    if (S.fh) {
      try { const w = await S.fh.createWritable(); await w.write(xlsxBlob(S.rows)); await w.close(); xstat('Đã lưu ' + S.rows.length + ' người vào file ' + S.fh.name + '.'); return; }
      catch (e) { xstat('Không ghi được file Excel (đang mở trong Excel?). Hãy đóng file rồi bấm "Tải Excel". Dữ liệu vẫn được giữ trong app.', true); return; }
    }
    if (auto && !window.showSaveFilePicker) { downloadXlsx(); xstat('Đã tải file Excel về thư mục Downloads (' + S.rows.length + ' người).'); }
    else if (auto) xstat('Chưa chọn file Excel nên chưa lưu tự động. Bấm "Chọn file Excel để lưu" hoặc "Tải Excel".', true);
  }
  $('xpick').addEventListener('click', async () => {
    if (!window.showSaveFilePicker) { xstat('Trình duyệt này không cho chọn file cố định. Dùng Chrome hoặc Edge, hoặc bấm "Tải Excel".', true); return; }
    try {
      S.fh = await window.showSaveFilePicker({ suggestedName: 'tong_hop_workshop.xlsx', types: [{ description: 'Excel', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }] });
      if (S.rows.length) await saveXlsx(false); else { const w = await S.fh.createWritable(); await w.write(xlsxBlob([])); await w.close(); xstat('Sẽ tự ghi vào file ' + S.fh.name + ' sau mỗi người.'); }
    } catch (e) { /* người dùng bỏ qua */ }
  });
  $('xdl').addEventListener('click', downloadXlsx);

  // thử nghiệm: window.__gait cho kiểm tra tự động
  window.__gait = { S, CFG, drawResult, xlsxBlob };

  show('L1'); refreshL1();
  applySettings(false);
  startCamera();
  initPose();
})();
