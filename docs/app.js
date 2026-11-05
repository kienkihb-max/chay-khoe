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

  const NAV_OF = { L1: '#/', L3: '#/list', L4: '#/list' };   // màn nào tô mục nào trên thanh điều hướng (L2 không có thanh)
  const show = (id) => {
    ['L1', 'L2', 'L3', 'L4'].forEach((x) => $(x).classList.toggle('show', x === id));
    document.body.classList.toggle('hasnav', id !== 'L2'); document.body.classList.toggle('onL3', id === 'L3');
    $('listcnt').textContent = S.rows.length; updateNoteBtn(); if (id !== 'L3') closeNote(true);
    document.querySelectorAll('#topnav button[data-nav]').forEach((b) => b.classList.toggle('on', b.dataset.nav === NAV_OF[id]));
  };
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

  // Camera giả (mock): vẽ người que đang chạy lên canvas rồi lấy stream; dùng khi máy không có camera hoặc thêm ?mock=1
  function mockStream(w, h, fps) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); let t0 = performance.now();
    const draw = () => {
      const t = (performance.now() - t0) / 1000, ph = t * 2 * Math.PI * 2.8, s = h / 480;
      g.fillStyle = '#20242b'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#343a44'; g.fillRect(0, h * 0.85, w, h * 0.15);
      const cx = w / 2, hip = h * 0.5 + Math.abs(Math.sin(ph)) * -6 * s, L = 85 * s;
      const leg = (a) => { const k = a + 0.6 + 0.5 * Math.sin(a - 0.5); const kx = cx + Math.sin(a) * L, ky = hip + Math.cos(a) * L; return [kx, ky, kx - Math.sin(a - Math.max(0, Math.sin(ph + (a > 0 ? 0 : Math.PI))) * 1.2) * L, ky + Math.cos(a - Math.max(0, Math.sin(ph + (a > 0 ? 0 : Math.PI))) * 1.2) * L]; };
      g.strokeStyle = '#e8eaed'; g.lineWidth = 8 * s; g.lineCap = 'round';
      const sh = [cx + 8 * s, hip - 130 * s];
      g.beginPath(); g.moveTo(cx, hip); g.lineTo(sh[0], sh[1]); g.stroke();
      g.beginPath(); g.arc(sh[0] + 6 * s, sh[1] - 26 * s, 20 * s, 0, 7); g.stroke();
      [Math.sin(ph) * 0.8, Math.sin(ph + Math.PI) * 0.8].forEach((a) => { const p = leg(a); g.beginPath(); g.moveTo(cx, hip); g.lineTo(p[0], p[1]); g.lineTo(p[2], p[3]); g.stroke(); });
      [Math.sin(ph + Math.PI) * 0.7, Math.sin(ph) * 0.7].forEach((a) => { g.beginPath(); g.moveTo(sh[0], sh[1]); g.lineTo(sh[0] + Math.sin(a) * 50 * s, sh[1] + 45 * s); g.lineTo(sh[0] + Math.sin(a) * 80 * s, sh[1] + 30 * s); g.stroke(); });
      g.fillStyle = '#ffb020'; g.font = (16 * s) + 'px sans-serif'; g.fillText('CAMERA GIẢ (MOCK)', 12, 26 * s);
    };
    draw(); setInterval(draw, 1000 / Math.max(fps || 30, 10));
    return cv.captureStream(fps || 30);
  }

  async function startCamera(deviceId) {
    try {
      if (S.stream) S.stream.getTracks().forEach((t) => t.stop());
      const o = $('orient').value;
      if (Q.get('mock') === '1' || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) || !(await navigator.mediaDevices.enumerateDevices()).some((d) => d.kind === 'videoinput')) {
        const mw = o === 'portrait' ? CFG.res * 9 / 16 : CFG.res * 16 / 9, mh = o === 'portrait' ? CFG.res * 16 / 9 : CFG.res;
        S.stream = mockStream(Math.round(mw), Math.round(mh), CFG.fps);
        $('v1').srcObject = S.stream; $('v2').srcObject = S.stream;
        $('v1').play().catch(() => {}); $('v2').play().catch(() => {});
        $('camst').textContent = 'Camera giả (mock) – máy không có camera thật · ' + Math.round(mw) + '×' + Math.round(mh);
        $('camsel').innerHTML = '<option>Camera giả (mock)</option>';
        S.camReady = true; refreshL1(); return;
      }
      const c ={ audio: false, video: { width: { ideal: o === 'portrait' ? CFG.res * 9 / 16 : CFG.res * 16 / 9 }, height: { ideal: o === 'portrait' ? CFG.res * 16 / 9 : CFG.res }, frameRate: { ideal: CFG.fps } } };
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
    $('early').style.display = ''; $('early').disabled = true; $('nowbtn').style.display = ''; $('nowbtn').disabled = true;

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
      $('nowbtn').disabled = !(S.recAt == null || el < S.recAt);
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
    show('L2'); layout(); $('early').style.display = 'none'; $('nowbtn').style.display = 'none';
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
  $('nowbtn').addEventListener('click', () => { S.recAt = performance.now() / 1000 - S.t0; S.recWhy = 'đo ngay'; });
  $('cancel').addEventListener('click', () => { if (!confirm('Dừng đo và không lưu kết quả của lần này?')) return; if (REC.mr) recStop(false); S.abort = true; S.running = false; clearInterval(S.timer); show('L1'); refreshL1(); });
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
      S.photos[s] = { bmp, blob: best.blob, sc: best.sc, lm, lo, vw: best.vw, vh: best.vh };
    }
  }

  // ---------- Đánh giá ----------
  function rating(k, v) {
    const c = REF[k]; if (!c || c.lo == null || v == null || Number.isNaN(v)) return { txt: 'n/a', ok: true };
    const r = Gait.rateValue(v, c);
    return { txt: r, ok: r === 'trong khoảng' };
  }
  // Màu trạng thái dùng chung canvas (thẻ chỉ số) và bảng Chi tiết: Tốt = xanh, Thấp/Cao = hổ phách; thanh: giữa xanh, hai bên xám
  const BAR_IN = '#5FCFA6', BAR_OUT = '#D5DCE1', BAR_PAD = 0.75;
  const barScale = (ref) => { const pd = (ref.hi - ref.lo) * BAR_PAD; return [ref.lo - pd, ref.hi + pd]; };
  function statInfo(k, v) {   // null = không có tham chiếu hoặc không đo được
    const c = REF[k]; if (!c || c.lo == null || v == null || Number.isNaN(v)) return null;
    const r = rating(k, v);
    return { ok: r.ok, col: r.ok ? GREEN : AMBER, bg: r.ok ? '#DDF3EA' : '#FBEBCF', label: r.ok ? 'Tốt' : r.txt === 'cao' ? 'Cao' : 'Thấp' };
  }
  function barHTML(k, dots) {   // dots: [{v, leg: 'L'|'R'|null}]; ghim mép khi ngoài thang như canvas
    const ref = REF[k]; if (!ref || ref.lo == null) return '';
    const [s0, s1] = barScale(ref), p = (t) => Math.max(0, Math.min(1, (t - s0) / (s1 - s0))) * 100;
    let h = '<div class="rbar" style="background:' + BAR_OUT + '"><i class="rin" style="left:' + p(ref.lo) + '%;width:' + (p(ref.hi) - p(ref.lo)) + '%;background:' + BAR_IN + '"></i>' +
      '<span class="rlb" style="left:' + p(ref.lo) + '%">' + ref.lo + '</span><span class="rlb" style="left:' + p(ref.hi) + '%">' + ref.hi + '</span>';
    for (const d of dots) { const st = statInfo(k, d.v); if (st) h += '<b class="rdot' + (d.leg ? ' ' + d.leg : '') + '" style="left:' + p(d.v) + '%;background:' + st.col + '" title="' + (d.leg === 'L' ? 'Trái ' : d.leg === 'R' ? 'Phải ' : '') + f1(d.v) + '"></b>'; }
    return h + '</div>';
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
  // r: số (bo đều) hoặc [trên-trái, trên-phải, dưới-phải, dưới-trái]
  function rr(c, x, y, w, h, r) { const [a, b, d, e] = Array.isArray(r) ? r : [r, r, r, r]; c.beginPath(); c.moveTo(x + a, y); c.arcTo(x + w, y, x + w, y + h, b); c.arcTo(x + w, y + h, x, y + h, d); c.arcTo(x, y + h, x, y, e); c.arcTo(x, y, x + w, y, a); c.closePath(); }

  function drawPhoto(c, ph, side, x, y, w, h, R, flatBottom) {   // flatBottom: đáy vuông để dính liền thẻ điểm bên dưới
    c.save(); rr(c, x, y, w, h, flatBottom ? [22, 22, 0, 0] : 24); c.clip();
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
  // Hạng theo điểm tổng. BÁC SĨ CẦN RÀ ngưỡng; sửa tại đây là đủ: màu điểm (scoreCol), huy hiệu ở ảnh kết quả
  // và câu giải thích ở PDF trang 4 đều đọc từ bảng này. Màu lấy theo :root (--teal, --teal2, --amber, --red).
  const TIERS = [
    { min: 85, label: 'XUẤT SẮC', col: GREEN },
    { min: 70, label: 'TỐT', col: '#12A07A' },
    { min: 55, label: 'KHÁ', col: AMBER },
    { min: 0, label: 'CẦN CẢI THIỆN', col: '#D9503F' },
  ];
  const tierOf = (v) => TIERS.find((t) => v >= t.min) || TIERS[TIERS.length - 1];
  const scoreCol = (v) => tierOf(v).col;
  const tierText = () => TIERS.map((t, i) => (i === 0 ? t.min + '+ ' : t.min === 0 ? 'dưới ' + TIERS[i - 1].min + ' ' : t.min + '–' + (TIERS[i - 1].min - 1) + ' ') + t.label.toLowerCase()).join(', ');
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
    const out = [], seen = new Set(), push = (key, why) => { if (EXER[key] && !seen.has(key)) { seen.add(key); out.push({ key, t: EXER[key][0], h: EXER[key][1], why }); } };
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
  // ---- Ảnh kết quả (chiếu TV, người chạy chụp lại): 3 tầng chính/phụ ----
  // Việc nên cải thiện nhất, giọng tích cực; khóa = khóa EXER (lấy mục đầu của exercises(R)). Bản nháp, BÁC SĨ CẦN RÀ.
  const IMPROVE = {
    overstride_high: 'Bước ngắn lại một chút, đặt chân gần dưới hông sẽ nhẹ gối hơn',
    vert_osc_high: 'Đẩy người về phía trước thay vì nảy lên sẽ chạy êm và đỡ mệt hơn',
    trunk_low: 'Nghiêng nhẹ cả người về trước từ cổ chân sẽ giúp bước chạy trôi hơn',
    trunk_high: 'Giữ thân thẳng hơn một chút, gồng bụng nhẹ sẽ giúp lưng thoải mái hơn',
    knee_ic_low: 'Giữ gối hơi mềm khi chạm đất sẽ giảm sốc cho khớp',
    knee_ic_high: 'Tập thêm sức mạnh đùi và mông sẽ giúp gối vững hơn khi tiếp đất',
    hip_ext_low: 'Giãn cơ gập hông đều đặn sẽ giúp sải chân ra sau thoải mái hơn',
    knee_mid_low: 'Tập hạ người chậm trên một chân sẽ giúp gối nhún chịu lực tốt hơn',
    knee_swing_low: 'Tập gót chạm mông nhẹ nhàng sẽ giúp vung chân gọn và nhanh hơn',
    asym: 'Tập thêm bài một chân sẽ giúp hai chân đều nhau hơn',
  };
  const legVals = (R, k) => ['L', 'R'].filter((s) => R.res[s]).map((s) => R.res[s].metrics[k]);
  const mainVal = (R, k) => { const v = Gait.COMMON.includes(k) ? [R.comb.common[k]] : legVals(R, k), a = v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; return a == null || Number.isNaN(a) ? null : a; };   // NaN = không đo được: hiện "–", không gắn nhãn
  function improveTip(R) {
    if (R.q && R.q.bad) return 'Đo lại với camera đặt ngang, thấy rõ cả người để có kết quả chính xác hơn';
    const ex = exercises(R), k = ex.length ? ex[0].key : null;
    if (k === 'cadence_low') return 'Tăng nhịp lên khoảng ' + Math.min(180, Math.round(R.comb.common.cadence * 1.05)) + ' bước/phút sẽ giúp chạy nhẹ nhàng hơn';
    return (k && IMPROVE[k]) || 'Giữ phong độ này! Tập sức mạnh 2 buổi mỗi tuần và đo lại sau 4–6 tuần';
  }
  function drawResult(R) {
    const cv = $('res'), c = cv.getContext('2d'), INK = '#14202B', MUT = '#5B6B77';
    const font = (w, s) => { c.font = w + ' ' + s + 'px ' + FFX; };
    const fit = (txt, w, s, min, maxW) => { font(w, s); while (s > min && c.measureText(txt).width > maxW) { s -= 2; font(w, s); } };
    const card = (x, y, w, h) => { c.save(); c.shadowColor = 'rgba(14,36,51,.10)'; c.shadowBlur = 14; c.shadowOffsetY = 3; c.fillStyle = '#fff'; rr(c, x, y, w, h, 22); c.fill(); c.restore(); };
    const pill = (txt, x, y, h, bg, fg, size) => { font('700', size); const w = c.measureText(txt).width + h * 0.9; c.fillStyle = bg; rr(c, x, y, w, h, h / 2); c.fill(); c.fillStyle = fg; c.textBaseline = 'middle'; c.fillText(txt, x + h * 0.45, y + h / 2 + 1); c.textBaseline = 'alphabetic'; return w; };
    c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    c.fillStyle = '#EEF2F4'; c.fillRect(0, 0, 1920, 1080);
    // ---- đầu trang: logo, ngày đo, bacsikien.com ----
    const g = c.createLinearGradient(0, 0, 1920, 0); g.addColorStop(0, '#0E2433'); g.addColorStop(1, '#0d4a46');
    c.fillStyle = g; c.fillRect(0, 0, 1920, 100);
    const lg = c.createLinearGradient(48, 18, 112, 82); lg.addColorStop(0, '#12A07A'); lg.addColorStop(1, '#7fe3c3');
    c.fillStyle = lg; rr(c, 48, 18, 64, 64, 14); c.fill();
    c.fillStyle = '#06352a'; font('800', 38); c.textAlign = 'center'; c.fillText('K', 80, 64); c.textAlign = 'left';
    c.fillStyle = '#bfe9dc'; font('700', 30); c.fillText('CHẠY BỘ CÙNG BÁC SĨ KIÊN', 132, 62);
    const d = R.when ? new Date(R.when) : new Date();   // mở lại người cũ: giữ ngày đo
    c.textAlign = 'right'; c.fillStyle = '#fff'; font('700', 30); c.fillText('Ngày đo ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(), 1872, 50);
    c.fillStyle = '#7fe3c3'; font('600', 24); c.fillText('bacsikien.com', 1872, 84); c.textAlign = 'left';

    // ---- tầng 1: tên, điểm tổng, hạng ----
    const sc = scores(R), sub = R.sub;
    card(48, 124, 600, 592);
    c.fillStyle = INK; fit(sub.name, '700', 60, 36, 536); c.fillText(sub.name, 80, 246, 536);
    c.fillStyle = MUT; font('400', 26); c.fillText('Cao ' + sub.height + ' cm  ·  ' + ((R.speed || SPEED) * 3.6).toFixed(0) + ' km/h', 80, 290);
    font('700', 26); c.fillText('ĐIỂM DÁNG CHẠY', 80, 356);
    const tt = sc.total != null ? tierOf(sc.total) : { label: 'CHƯA ĐỦ TIN CẬY', col: AMBER };
    c.fillStyle = sc.total != null ? tt.col : '#8A97A1'; font('700', 220); const st = sc.total != null ? String(sc.total) : '–';
    c.fillText(st, 72, 538); const nw = c.measureText(st).width;
    if (sc.total != null) { c.fillStyle = '#7A8791'; font('700', 52); c.fillText('/100', 84 + nw, 538); }
    pill(tt.label, 80, 562, 68, tt.col, '#fff', 36);

    // ---- tầng 2: hai ảnh 4:3 (khung xương + góc gối), điểm từng chân bên dưới ----
    [['L', 680, 'CHÂN TRÁI', BLUE], ['R', 1288, 'CHÂN PHẢI', ORANGE]].forEach(([s, x, lb, col]) => {
      card(x, 124, 584, 592);   // một khối liền: ảnh (bo góc trên) + thẻ điểm (bo góc dưới), chung viền và bóng
      drawPhoto(c, S.photos && S.photos[s], s, x, 124, 584, 438, R, true);
      c.fillStyle = col; c.beginPath(); c.arc(x + 40, 614, 11, 0, 7); c.fill();
      c.fillStyle = MUT; font('700', 26); c.fillText('ĐIỂM ' + lb, x + 62, 623);
      const v = sc[s];
      if (v == null) { c.fillStyle = '#8A97A1'; font('600', 28); c.fillText(R.res[s] ? 'Chưa đủ tin cậy' : 'Không đo được chân này', x + 30, 690); return; }
      c.fillStyle = scoreCol(v); font('700', 72); c.fillText(String(v), x + 28, 698); const w2 = c.measureText(String(v)).width;
      c.fillStyle = '#7A8791'; font('700', 30); c.fillText('/100', x + 36 + w2, 698);
      c.fillStyle = scoreCol(v); font('700', 30); c.textAlign = 'right'; c.fillText(tierOf(v).label, x + 556, 698); c.textAlign = 'left';
    });

    // ---- tầng 3: 3 chỉ số chính + 1 việc nên cải thiện nhất ----
    const MAIN = [
      ['cadence', 'Nhịp chạy', 'bước/phút'],
      ['overstride', 'Chân đặt trước hông', 'cm'],
      ['knee_ic', 'Gối lúc chạm đất', '°'],
    ];
    MAIN.forEach(([k, lb, unit], i) => {
      const x = 48 + i * 444, y = 740, w = 420, h = 260, v = mainVal(R, k), q = v == null ? { ok: true, txt: '' } : rating(k, v);
      const col = v == null ? '#8A97A1' : q.ok ? GREEN : AMBER;
      card(x, y, w, h); c.fillStyle = col; rr(c, x, y, 12, h, 6); c.fill();
      c.fillStyle = MUT; font('700', 30); c.fillText(lb, x + 36, y + 46, w - 60);
      const val = v == null ? '–' : f0(v);
      c.fillStyle = col; font('700', 96); c.fillText(val, x + 34, y + 136); const vw = c.measureText(val).width;
      c.fillStyle = MUT; font('600', 30); c.fillText(unit, x + 44 + vw, y + 136);
      if (v == null) return;   // không đo được: không chip, không thanh, không chấm
      const pw = pill(q.ok ? 'Tốt' : q.txt === 'cao' ? 'Cao' : 'Thấp', x + 36, y + 148, 42, q.ok ? '#DDF3EA' : '#FBEBCF', col, 26);
      // thanh vị trí: giữa = vùng bình thường (xanh), hai bên = ngoài vùng (xám); chấm (màu trạng thái) = giá trị đo, ghim ở mép nếu ngoài thang
      const ref = REF[k], bx = x + 36 + pw + 24, bw = x + w - 44 - bx, by = y + 169 - 9, bh = 18, [s0, s1] = barScale(ref);
      const px = (t) => bx + bw * Math.max(0, Math.min(1, (t - s0) / (s1 - s0)));
      c.save(); rr(c, bx, by, bw, bh, bh / 2); c.clip();
      c.fillStyle = BAR_OUT; c.fillRect(bx, by, bw, bh);
      c.fillStyle = BAR_IN; c.fillRect(px(ref.lo), by, px(ref.hi) - px(ref.lo), bh);
      c.restore();
      c.fillStyle = MUT; font('600', 22); c.textAlign = 'center';
      c.fillText(String(ref.lo), px(ref.lo), by + bh + 26); c.fillText(String(ref.hi), px(ref.hi), by + bh + 26); c.textAlign = 'left';
      const dx = px(v), dy = by + bh / 2;
      c.save(); c.shadowColor = 'rgba(14,36,51,.35)'; c.shadowBlur = 6; c.shadowOffsetY = 2;
      c.fillStyle = '#fff'; c.beginPath(); c.arc(dx, dy, 17, 0, 7); c.fill(); c.restore();
      c.fillStyle = col; c.beginPath(); c.arc(dx, dy, 11, 0, 7); c.fill();
    });
    card(1380, 740, 492, 260); c.fillStyle = GREEN; rr(c, 1380, 740, 12, 260, 6); c.fill();
    c.fillStyle = GREEN; font('700', 26); c.fillText('NÊN CẢI THIỆN', 1416, 790);
    c.fillStyle = INK; font('700', 28); wrap(c, improveTip(R), 1416, 836, 428, 36);
    if ((sub.pain || '').trim()) { c.fillStyle = '#D9503F'; font('600', 24); c.fillText('Có đau khi chạy: nên được bác sĩ khám trực tiếp', 1416, 986, 428); }
    c.fillStyle = MUT; font('400', 22);
    c.fillText('Sàng lọc 2D bằng AI, chỉ mang tính tham khảo, không thay thế khám lâm sàng. Chân xa camera kém tin cậy hơn.', 48, 1052);
  }

  function extraRows(R) {
    const out = [], ex = R.ex; if (!ex) return out;
    const one = (k, fmt) => { const c = REF[k]; const v = ex.common[k]; out.push({ label: c.label, unit: c.unit, a: v == null || Number.isNaN(v) ? '–' : fmt(v), b: '', ref: c.lo != null ? c.lo + '–' + c.hi : '', st: c.lo != null ? rating(k, v).txt : '', ok: rating(k, v).ok, common: true, k, n: { c: v } }); };
    const two = (k, fmt) => { const c = REF[k]; const g = (s) => (ex.per[s] && ex.per[s][k] != null && !Number.isNaN(ex.per[s][k]) ? ex.per[s][k] : NaN);
      const l = g('L'), r = g('R'); const sl = rating(k, l), sr = rating(k, r);
      out.push({ label: c.label, unit: c.unit, a: Number.isNaN(l) ? '–' : fmt(l), b: Number.isNaN(r) ? '–' : fmt(r), ref: c.lo != null ? c.lo + '–' + c.hi : '', st: c.lo != null ? sl.txt + ' / ' + sr.txt : '', ok: sl.ok && sr.ok, k, n: { L: l, R: r } }); };
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
    // một dòng: n = số thực {c | L,R}; a/b = chữ hiện ở cột Trái/Phải; có tham chiếu thì tô màu số, vẽ thanh + chấm, chip Đánh giá
    const row = (label, k, n, a, b) => {
      const num = (txt, v, bold) => { const st = statInfo(k, v); return st ? '<span class="dv" style="color:' + st.col + ';background:' + st.bg + '">' + txt + '</span>' : (bold ? '<b>' + txt + '</b>' : txt); };
      const legs = n.c !== undefined ? [{ s: 'c', v: n.c }] : ['L', 'R'].filter((s) => !Number.isNaN(n[s]) && n[s] != null).map((s) => ({ s, v: n[s] }));
      const chips = legs.map((d) => { const st = statInfo(k, d.v); return st ? '<span class="chip" style="color:' + st.col + ';background:' + st.bg + '">' + (d.s === 'c' ? '' : (d.s === 'L' ? 'Trái ' : 'Phải ') ) + st.label + '</span>' : ''; }).join('');
      const bar = barHTML(k, legs.map((d) => ({ v: d.v, leg: d.s === 'c' ? null : d.s })));
      return '<tr><td>' + label + '</td><td>' + (n.c !== undefined ? num(a, n.c, true) : num(a, n.L)) + '</td><td>' + (n.c !== undefined ? b : num(b, n.R)) + '</td><td class="rcell">' + bar + '</td><td>' + chips + '</td></tr>';
    };
    let anyTwo = false;
    for (const k of keys) {
      const c = REF[k] || { label: k, unit: '' }, common = Gait.COMMON.includes(k);
      const L = R.res.L ? R.res.L.metrics[k] : NaN, Rr = R.res.R ? R.res.R.metrics[k] : NaN;
      if (!common) anyTwo = true;
      h += row(c.label + ' (' + c.unit + ')', k, common ? { c: R.comb.common[k] } : { L, R: Rr }, common ? f1(R.comb.common[k]) : f1(L), common ? '' : f1(Rr));
    }
    for (const x of extraRows(R)) {
      const lbl = x.label + (x.unit ? ' (' + x.unit + ')' : '');
      if (x.k && x.n.L !== undefined) anyTwo = true;
      h += x.k ? row(lbl, x.k, x.n, x.a, x.b) : '<tr><td>' + lbl + '</td><td>' + x.a + '</td><td>' + x.b + '</td><td></td><td><span class="chip" style="color:' + (x.ok ? GREEN : AMBER) + ';background:' + (x.ok ? '#DDF3EA' : '#FBEBCF') + '">' + x.st + '</span></td></tr>';
    }
    for (const s of ['L', 'R']) if (R.res[s]) h += '<tr><td>Chân ' + (s === 'L' ? 'trái' : 'phải') + ': số bước · độ tin cậy</td><td colspan="4">' + R.res[s].extra.nSteps + ' bước · vis ' + R.res[s].extra.vis.toFixed(2) + (R.res[s].extra.vis < 0.6 ? ' (thấp)' : '') + '</td></tr>';
    return h + '</table>' + (anyTwo ? '<p class="rleg"><b class="rdot L"></b> chân trái · <b class="rdot R"></b> chân phải · chấm tô màu theo đánh giá (xanh = tốt, vàng = thấp/cao) · thanh xám = ngoài khoảng bình thường</p>' : '');
  }
  // Chi tiết là một "màn" riêng: mở thì ẩn ảnh tổng quan, nút đổi thành "Tổng quan" để quay về
  function setDetail(open) {
    const d = $('detail'), b = $('tgdetail'), box = $('resbox');
    d.style.display = open ? 'block' : 'none';
    if (box) box.style.display = open ? 'none' : '';
    b.textContent = open ? 'Tổng quan' : 'Chi tiết (bác sĩ)';
    const sc = d.parentElement; if (sc) sc.scrollTop = 0; window.scrollTo(0, 0);
  }
  function resetDetail(R) { $('detail').innerHTML = detailHTML(R); setDetail(false); }

  // ---------- Lớp 3 ----------
  async function finish(seed) {   // seed = true: nạp dữ liệu mẫu, chỉ lưu vào danh sách và IndexedDB, không đổi màn, không gửi Sheet
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
    R.when = Date.now(); R.speed = SPEED;
    $('note').value = '';   // người mới: không mang ghi chú của kết quả vừa mở lại từ Danh sách
    if (!seed) {
      drawResult(R);
      resetDetail(R);
      show('L3');
    }
    // dòng dữ liệu (danh sách + Google Sheet)
    const nowd = new Date(R.when);
    const row = { id: R.sub.id, time: pad(nowd.getDate()) + '/' + pad(nowd.getMonth() + 1) + '/' + nowd.getFullYear() + ' ' + pad(nowd.getHours()) + ':' + pad(nowd.getMinutes()), name: R.sub.name, phone: R.sub.phone, height_cm: R.sub.height, pain: R.sub.pain, note: '' };
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
    await saveDetail(row, R, S.photos || {});
    if (seed) return;
    sendRow(row);
    go('#/result/' + encodeURIComponent(R.sub.id));
  }

  // ---------- Lưu kết quả chi tiết từng người (IndexedDB, theo mã người) để mở lại từ Danh sách ----------
  // Chỉ lưu phần cần để vẽ lại (drawResult, detailHTML, PDF, điểm, kết luận); bỏ R.P và res[s].arrays (rất nặng).
  // IndexedDB giữ nguyên NaN/Infinity và Blob (không qua JSON), nên chỉ số NaN vẫn hiện '–' như lúc vừa đo.
  const DB = { name: 'gait', store: 'results' };
  function idbOpen() {
    return new Promise((ok, no) => {
      if (!window.indexedDB) { no(new Error('Trình duyệt không có IndexedDB')); return; }
      const q = indexedDB.open(DB.name, 1);
      q.onupgradeneeded = () => q.result.createObjectStore(DB.store);
      q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error);
    });
  }
  async function idbDo(mode, fn) {
    const db = await idbOpen();
    try {
      return await new Promise((ok, no) => {
        const tx = db.transaction(DB.store, mode), rq = fn(tx.objectStore(DB.store));
        tx.oncomplete = () => ok(rq.result); tx.onerror = () => no(tx.error); tx.onabort = () => no(tx.error);
      });
    } finally { db.close(); }
  }
  async function saveDetail(row, R, ph) {
    try {
      const res = {};
      for (const s of Object.keys(R.res)) res[s] = R.res[s] ? { metrics: R.res[s].metrics, extra: R.res[s].extra } : R.res[s];
      const photos = {};
      for (const s of ['L', 'R']) { const p = ph[s]; if (p && p.blob) photos[s] = { blob: p.blob, sc: p.sc, lm: p.lm, lo: p.lo, vw: p.vw, vh: p.vh }; }
      const note = S.result === R ? $('note').value : '';
      const rec = { id: row.id, time: row.time, name: row.name, note, photos, R: { res, comb: R.comb, sub: R.sub, ex: R.ex, fat: R.fat, q: R.q, when: R.when, speed: R.speed } };
      await idbDo('readwrite', (st) => st.put(rec, row.id));
    } catch (e) { console.warn('Không lưu được kết quả chi tiết để mở lại:', e); }
  }
  async function openResult(id) {
    const row = S.rows.find((r) => r.id === id), want = location.hash;
    let rec = null;
    if (row) { try { rec = await idbDo('readonly', (st) => st.get(id)); } catch (e) { rec = null; } }
    if (location.hash !== want) return;   // trong lúc đọc, người dùng đã chuyển màn khác
    // bản ghi phải khớp đúng dòng (cùng giờ đo, cùng tên): tránh mở nhầm người khi danh sách bị xoá rồi đánh mã lại
    if (!rec || !rec.R || rec.time !== row.time || rec.name !== row.name) {
      history.replaceState(null, '', '#/list');
      $('listq').value = ''; renderList(); show('L4');
      listMsg(row ? 'Không có dữ liệu chi tiết của ' + row.id + ' · ' + row.name + ' (người này đo trước khi app lưu kết quả chi tiết), nên không mở lại được màn kết quả. Thông tin tóm tắt vẫn có trong danh sách và Google Sheet.' : 'Không tìm thấy mã ' + id + ' trong danh sách.');
      return;
    }
    const photos = {};
    for (const s of ['L', 'R']) {
      const p = rec.photos && rec.photos[s];
      if (p && p.blob) { try { photos[s] = Object.assign({}, p, { bmp: await createImageBitmap(p.blob) }); } catch (e) { /* ảnh hỏng: ô ảnh để nền tối như khi không có ảnh */ } }
    }
    if (location.hash !== want) return;
    S.result = rec.R; S.photos = photos; S.photosReady = true;
    drawResult(S.result);
    resetDetail(S.result);
    $('note').value = rec.note || '';
    show('L3');
  }
  // Ghi chú bác sĩ: lưu cùng kết quả mỗi khi gõ (người dùng chọn), mở lại thấy ghi chú cũ và PDF in giống lần đầu
  async function saveNote(id, v) {
    try {
      await idbDo('readwrite', (st) => { const g = st.get(id); g.onsuccess = () => { if (g.result) st.put(Object.assign(g.result, { note: v }), id); }; return g; });
    } catch (e) { console.warn('Không lưu được ghi chú:', e); }
  }
  // Ghi chú bác sĩ: #note (input ẩn) giữ bản ĐÃ LƯU; sửa trong drawer (#notetxt), bấm Lưu mới ghi + gửi lại cả dòng + PDF (cùng Mã nên Sheet ghi đè đúng dòng)
  const noteDirty = () => $('notetxt').value !== $('note').value;
  function updateNoteBtn() { $('notebtn').textContent = ($('note').value || '').trim() ? 'Sửa ghi chú' : 'Thêm ghi chú'; }
  function noteAsk(on) { $('noteask').style.display = on ? 'flex' : 'none'; }
  function openNote() {
    const R = S.result; if (!R) return;
    $('notetitle').textContent = 'Ghi chú bác sĩ · ' + R.sub.name;
    $('notetxt').value = $('note').value; $('notemsg').textContent = ''; noteAsk(false);
    $('notedrawer').classList.add('open'); $('notedrawer').setAttribute('aria-hidden', 'false'); $('notetxt').focus();
  }
  function closeNote(force) {
    if (!$('notedrawer').classList.contains('open')) return;
    if (!force && noteDirty()) { noteAsk(true); return; }   // chưa lưu: hỏi ngay trong drawer
    noteAsk(false); $('notedrawer').classList.remove('open'); $('notedrawer').setAttribute('aria-hidden', 'true'); $('notebtn').focus();
  }
  let noteSaving = false;
  async function saveNoteNow() {
    const R = S.result; if (!R || noteSaving) return;
    noteSaving = true; $('notesave').disabled = true;
    try {
      const id = R.sub.id, v = $('notetxt').value, row = S.rows.find((r) => r.id === id);
      $('note').value = v; updateNoteBtn();
      if (row) { row.note = v; try { localStorage.setItem('gait_rows', JSON.stringify(S.rows)); } catch (e) { /* bỏ qua */ } }
      const pdf = row ? makePdf(R) : null;
      await saveNote(id, v);
      let r = 'Đã lưu';
      if (row) r = await Promise.race([sendRow(row, pdf), new Promise((ok) => setTimeout(() => ok('Chờ gửi'), 4000))]);
      $('notemsg').textContent = r; noteAsk(false);
      await new Promise((ok) => setTimeout(ok, 800));
      closeNote(true);
    } finally { noteSaving = false; $('notesave').disabled = false; }
  }
  $('notebtn').addEventListener('click', openNote);
  $('notesave').addEventListener('click', saveNoteNow);
  $('noteclose').addEventListener('click', () => closeNote(false));
  $('notebg').addEventListener('click', () => closeNote(false));
  $('notekeep').addEventListener('click', () => { noteAsk(false); $('notetxt').focus(); });
  $('notediscard').addEventListener('click', () => closeNote(true));
  $('notetxt').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveNoteNow(); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('notedrawer').classList.contains('open')) closeNote(false); });

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
    wrap(c, 'Điểm cho biết bao nhiêu chỉ số chính nằm trong khoảng bình thường (' + tierText() + '). Đây là điểm tham khảo, không phải chẩn đoán.', 1460, 160, 410, 23);
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
  function makePdf(R) {
    return buildPdf([{ jpg: jpegBytes($('res')), w: 1920, h: 1080 }, { jpg: jpegBytes(drawPage2(R)), w: 1920, h: 1080 }, { jpg: jpegBytes(drawPage3(R)), w: 1920, h: 1080 }, { jpg: jpegBytes(drawPage4(R)), w: 1920, h: 1080 }]);
  }
  // Gửi một người lên Google Sheet + Drive (PDF 4 trang + ảnh kết quả). Không lưu gì về máy.
  async function sendRow(row, pdf) {
    try {
      const R = S.result;
      pdf = pdf || (R ? makePdf(R) : null);
      const pngBlob = await new Promise((ok) => $('res').toBlob(ok, 'image/png'));
      const files = [];
      if (pdf) files.push({ name: row.id + '.pdf', mime: 'application/pdf', blob: pdf });
      if (pngBlob) files.push({ name: row.id + '.png', mime: 'image/png', blob: pngBlob });
      const p = Sync.push(SHEET_COLS.map((c) => c[0]), SHEET_COLS.map((c) => c[1](row) ?? ''), files);
      showSync(); await p;
    } catch (e) { console.warn('Chưa gửi được lên Google Sheet:', e); }
    showSync();
    return Sync.pending() > 0 ? 'Chờ gửi' : 'Đã gửi';
  }
  function showSync() {
    const n = Sync.pending(), e = $('syncst');
    e.style.display = n ? '' : 'none';
    e.textContent = n ? 'Chưa gửi ' + n + ' người · tự gửi lại' : '';
  }
  setInterval(showSync, 3000);
  $('datalink').addEventListener('click', () => window.open(SHEET_URL, '_blank', 'noopener'));
  $('tgdetail').addEventListener('click', () => setDetail($('detail').style.display !== 'block'));

  // ---------- Cột gửi lên Google Sheet ----------
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1HbknKhSQ1VpO6J11HzoLZMF1TYDDXtCsnUzV2dYw-0U/edit';
  // Code.gs tự thêm cột PDF và Ảnh kết quả ở cuối. Mã phải đứng đầu: là khóa ghi đè dòng.
  // Thời gian/Điểm/Kết luận lấy đúng trường như renderList; Hạng theo tierOf(điểm chung) như huy hiệu canvas Kết quả.
  const SHEET_COLS = [
    ['Mã', (r) => r.id], ['Thời gian', (r) => r.time], ['Họ tên', (r) => r.name], ['SĐT/Zalo', (r) => r.phone],
    ['Điểm', (r) => r.score_total], ['Hạng', (r) => (r.score_total === '' || r.score_total == null ? '' : tierOf(r.score_total).label)],
    ['Điểm trái', (r) => r.score_L], ['Điểm phải', (r) => r.score_R], ['Đau/chấn thương', (r) => r.pain],
    ['Kết luận', (r) => r.conclusion], ['Ghi chú bác sĩ', (r) => r.note],
  ];
  // ---------- Màn danh sách người đã đo ----------
  function renderList() {
    const q = $('listq').value.trim().toLowerCase(), esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const rows = S.rows.slice().reverse().filter((r) => !q || (String(r.name) + ' ' + r.phone).toLowerCase().includes(q));
    const th = 'style="text-align:left;padding:10px 12px;border-bottom:1px solid #DCE4E8;background:#F6F9FA;position:sticky;top:0"', td = 'style="padding:10px 12px;border-bottom:1px solid #EEF2F4;vertical-align:top"';
    $('listbody').innerHTML = rows.length ? '<table style="width:100%;border-collapse:collapse;font-size:14px"><tr><th ' + th + '>Mã</th><th ' + th + '>Thời gian</th><th ' + th + '>Họ tên</th><th ' + th + '>SĐT/Zalo</th><th ' + th + '>Điểm</th><th ' + th + '>Kết luận</th></tr>' +
      rows.map((r) => '<tr data-id="' + esc(r.id) + '" style="cursor:pointer"><td ' + td + '>' + esc(r.id) + '</td><td ' + td + '>' + esc(r.time) + '</td><td ' + td + '><b>' + esc(r.name) + '</b></td><td ' + td + '>' + esc(r.phone) + '</td><td ' + td + '><b>' + esc(r.score_total) + '</b></td><td ' + td + '>' + esc(r.conclusion) + '</td></tr>').join('') + '</table>'
      : '<div style="padding:40px;text-align:center;color:#5B6B77">' + (S.rows.length ? 'Không có kết quả khớp.' : 'Chưa có ai được đo.') + '</div>';
  }
  const listMsg = (t) => { const e = $('listmsg'); e.textContent = t; e.style.display = t ? 'block' : 'none'; };
  $('tolist').addEventListener('click', () => go('#/list'));
  document.querySelectorAll('#topnav button[data-nav]').forEach((b) => b.addEventListener('click', () => {
    // Từ màn Kết quả bấm "Đo mới": xoá form người trước (việc trước đây của nút "Đo người tiếp theo")
    if (b.dataset.nav === '#/' && $('L3').classList.contains('show')) { ['name', 'phone', 'height', 'pain', 'note'].forEach((i) => ($(i).value = '')); $('msg1').textContent = ''; }
    go(b.dataset.nav);
  }));
  $('listbody').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) go('#/result/' + encodeURIComponent(tr.dataset.id)); });

  // ---------- Đường dẫn (hash): #/ trang chính · #/list danh sách · #/result/<mã> kết quả một người ----------
  // Màn đang đo (L2) không có đường dẫn: tải lại giữa lúc đo thì về trang chính.
  function route() {
    if (S.running) return;   // đang đo: bỏ qua Back/Forward, đo xong sẽ tự sang #/result/<mã>
    const h = location.hash, m = /^#\/result\/([^/]+)$/.exec(h);
    if (m) {
      const id = decodeURIComponent(m[1]);
      if (S.result && S.result.sub.id === id && $('L3').classList.contains('show')) return;   // vừa đo xong, đã vẽ sẵn
      openResult(id); return;
    }
    if (h === '#/list') { listMsg(''); $('listq').value = ''; renderList(); show('L4'); return; }
    show('L1'); refreshL1();
  }
  function go(h) { if (location.hash === h) route(); else location.hash = h; }
  window.addEventListener('hashchange', route);
  $('listq').addEventListener('input', renderList);

  // ---------- Dữ liệu mẫu (chỉ khi ?mock=1): chạy đúng đường tính như lúc đo thật trên chuỗi người que sinh sẵn ----------
  if (Q.get('mock') === '1' && window.MockData) {
    // Không còn nút trên giao diện; test gọi từ console: await window.__seed()
    window.__seed = async () => {
      if (S.running) return;
      const keep = { mode: S.mode, sp: SPEED };
      try {
        S.running = true; S.mode = 'file'; S.slow = 1; SPEED = SPEED0;   // 'file': bỏ kiểm tra tốc độ khung hình của camera
        for (let i = 0; i < MockData.PEOPLE.length; i++) {
          const p = MockData.PEOPLE[i];
          S.sub = { id: idStr(), name: p.name, phone: p.phone, height: p.height, pain: p.pain };
          S.frames = await MockData.frames(p, CFG.clip, CFG.fps); S.late = []; S.result = null; S.error = null; S.photosReady = false;
          analyse();
          let g = 0; while (!S.result && !S.error && g++ < 600) await new Promise((r) => setTimeout(r, 100));
          if (S.error) { alert('Không tạo được ' + p.name + ': ' + S.error); break; }
          await finish(true);
        }
      } finally { S.running = false; S.mode = keep.mode; SPEED = keep.sp; S.result = null; }
      go('#/list');
    };
  }

  // thử nghiệm: window.__gait cho kiểm tra tự động
  window.__gait = { S, CFG, drawResult };

  route();
  applySettings(false);
  startCamera();
  initPose();
})();
