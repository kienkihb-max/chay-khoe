/* app/form.js - màn nhập (L1), cài đặt đo, camera, chọn chế độ. Một phần của app cũ; cách chia sẻ biến xem đầu app/core.js. */
(function (App) {
  'use strict';
  const { $, Q, CFG, S, ANG_NAME, REC, recStop } = App;
  // hàm ở file nạp sau: gọi qua App khi chạy
  function initPose(...a) { return App.initPose(...a); }
  function fixDur(...a) { return App.fixDur(...a); }
  // hàm của file này (khai báo function được nâng lên đầu nên đưa ra ngay)
  Object.assign(App, { refreshL1, applySettings, startCamera, durTxt: (x) => durTxt(x) });
  // ---------- Lớp 1: form + camera ----------
  function refreshL1() {
    const hv = +$('height').value, miss = [];
    if ($('height').value && !(hv >= 100 && hv <= 230)) miss.push('chiều cao 100–230 cm (hoặc để trống)');
    const ok = miss.length === 0;
    const ready = S.poseReady && (S.mode === 'live' ? S.camReady : !!S.file);
    $('go').disabled = !(ok && ready);
    $('go').textContent = !ok ? 'Còn thiếu: ' + miss.join(', ') : !ready ? (S.poseReady ? 'Hãy chọn file video' : 'Đang chuẩn bị...') : S.mode === 'file' ? 'Phân tích video' : 'Sang màn đo';
    $('gohint').style.display = S.mode === 'file' ? 'none' : '';
    // Góc quay tự nhận; "Quay xong" chỉ bấm được khi đã chốt ít nhất 1 góc
    const ss = S.sess || {}, got = ['side', 'back'].filter((a) => ss[a]);
    $('angst').textContent = got.length ? 'Đã chốt góc ' + got.map((a) => ANG_NAME[a]).join(' và ') + (ss.sub ? ' cho ' + ss.sub.name : '') + '. Quay lại một góc đã chốt sẽ thay lần quay cũ.' : '';
    $('done').disabled = !got.length || S.running;
  }
  // ---------- Cài đặt đo ----------
  // Chỉ còn: tốc độ máy, FPS, độ phân giải, thời gian quay. Đã bỏ các kiểu chạy đặt sẵn (Chuẩn/Nhanh/Kỹ/Đầy đủ), giây bắt đầu thu và tự chờ ổn định:
  // kỹ thuật viên tự bấm Quay ở màn đo; máy chọn CFG.clip giây ổn định nhất trong lần quay (stable.js).
  const SETK = { s_speed: 10, s_fps: 30, s_res: 720, s_total: 60 };
  const durTxt = (sec) => (sec % 60 === 0 ? sec / 60 + ' phút' : sec === 90 ? '1,5 phút' : sec + ' giây');
  (function () {
    try {
      let o = JSON.parse(localStorage.getItem('gait_set2') || 'null');
      if (!o) { o = JSON.parse(localStorage.getItem('gait_set') || '{}'); delete o.s_total; }   // lần đầu sau khi đổi luồng: giữ tốc độ/FPS/độ phân giải cũ, thời gian quay về mặc định 1 phút
      for (const k in SETK) if (o[k] != null) $(k).value = o[k];
      localStorage.removeItem('gait_set'); localStorage.removeItem('gait_auto');
    } catch (e) { /* bỏ qua */ }
    const tot = $('s_total'); if (Q.get('total')) { if (![...tot.options].some((o) => o.value === String(CFG.total))) tot.add(new Option(durTxt(CFG.total), CFG.total)); tot.value = CFG.total; }
    if (!tot.value) tot.value = 60;
  })();
  let lastCam = '';
  function applySettings(fromUser, src) {
    const o = {}; for (const k in SETK) o[k] = $(k).value;
    try { localStorage.setItem('gait_set2', JSON.stringify(o)); } catch (e) { /* bỏ qua */ }
    App.SPEED0 = (+$('s_speed').value || 10) / 3.6;
    CFG.fps = +$('s_fps').value; CFG.total = Math.max(+$('s_total').value || 60, 10); CFG.res = +$('s_res').value;
    $('s_note').textContent = 'Máy chạy ' + (+$('s_speed').value || 10) + ' km/h. Quay ' + durTxt(CFG.total) + ', máy chọn ' + Math.min(CFG.clip, CFG.total) + ' giây ổn định nhất để phân tích. FPS thực tế phụ thuộc tốc độ máy tính.';
    $('recgo').textContent = '● Quay ' + durTxt(CFG.total);
    const key = CFG.res + '/' + CFG.fps;
    if (fromUser && key !== lastCam && typeof startCamera === 'function') startCamera($('camsel').value || undefined);
    lastCam = key;
    if (window.Chips) Chips.sync();   // preset/localStorage ghi .value không phát sự kiện: cập nhật chip
    if (typeof refreshL1 === 'function') refreshL1();
  }
  ['s_speed', 's_fps', 's_res', 's_total'].forEach((i) => $(i).addEventListener('change', () => applySettings(true, i)));
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

  const PORTRAIT = window.matchMedia('(orientation: portrait)');
  // Khung video co theo đúng tỉ lệ hình nguồn (dọc hay ngang); camera.css dùng data-ar và --ar
  function fitVid(v) {
    const w = v.videoWidth, h = v.videoHeight;
    if (w && h) { v.dataset.ar = h > w ? 'p' : 'l'; v.style.setProperty('--ar', w + ' / ' + h); }
    else { delete v.dataset.ar; v.style.removeProperty('--ar'); }
  }
  for (const id of ['v1', 'v2']) for (const ev of ['loadedmetadata', 'resize', 'emptied']) $(id).addEventListener(ev, () => fitVid($(id)));
  async function startCamera(deviceId) {
    // điện thoại: Screening đã tắt (khung #phonegate), không xin quyền camera
    if (matchMedia('(max-width:767.98px),(pointer:coarse) and (max-height:500px)').matches) return;
    try {
      if (S.stream) S.stream.getTracks().forEach((t) => t.stop());
      // Tự nhận hướng: xin hình dọc khi màn hình đang dọc, hình ngang khi màn hình đang ngang (không cần chọn tay)
      const o = PORTRAIT.matches ? 'portrait' : 'landscape';
      if (Q.get('mock') === '1' || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) || !(await navigator.mediaDevices.enumerateDevices()).some((d) => d.kind === 'videoinput')) {
        const mw = o === 'portrait' ? CFG.res : CFG.res * 16 / 9, mh = o === 'portrait' ? CFG.res * 16 / 9 : CFG.res;
        S.stream = mockStream(Math.round(mw), Math.round(mh), CFG.fps);
        $('v1').srcObject = S.stream; $('v2').srcObject = S.stream;
        $('v1').play().catch(() => {}); $('v2').play().catch(() => {});
        $('camst').textContent = 'Camera giả (mock) – máy không có camera thật · ' + Math.round(mw) + '×' + Math.round(mh);
        $('camsel').innerHTML = '<option>Camera giả (mock)</option>';
        S.camReady = true; refreshL1(); return;
      }
      const c ={ audio: false, video: { width: { ideal: o === 'portrait' ? CFG.res : CFG.res * 16 / 9 }, height: { ideal: o === 'portrait' ? CFG.res * 16 / 9 : CFG.res }, frameRate: { ideal: CFG.fps } } };
      if (deviceId) c.video.deviceId = { exact: deviceId };
      S.stream = await navigator.mediaDevices.getUserMedia(c);
      $('v1').srcObject = S.stream; $('v2').srcObject = S.stream;
      const tr = S.stream.getVideoTracks()[0], st = tr.getSettings();
      const isP = st.height > st.width;   // hướng thật camera gửi về; khung video tự co theo (fitVid)
      $('camst').textContent = (tr.label || 'Camera') + ' · ' + st.width + '×' + st.height + (isP ? ' (dọc)' : ' (ngang)') + ' · ' + Math.round(st.frameRate || 0) + ' fps';
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

  function mockWarn(on) {   // ?mock=1 + chế độ video: khung xương là hình giả
    let e = $('mockwarn');
    if (!e) { e = document.createElement('div'); e.id = 'mockwarn'; e.style.cssText = 'margin:0 0 10px;font-size:14px;font-weight:600;color:var(--amber)'; e.textContent = 'Đang chế độ thử (mock): khung xương là hình giả'; $('msg1').parentNode.insertBefore(e, $('msg1')); }
    e.style.display = on ? 'block' : 'none';
  }
  function setMode(m) {
    S.mode = m; if (m === 'file' && REC.mr) recStop(true, $('name').value.trim());
    $('recrow').style.display = m === 'file' ? 'none' : 'flex';
    $('mLive').classList.toggle('on', m === 'live'); $('mFile').classList.toggle('on', m === 'file');
    $('filebox').style.display = m === 'file' ? 'flex' : 'none';
    const v = $('v1');
    if (m === 'file') { v.srcObject = null; if (S.fileUrl) { v.src = S.fileUrl; v.controls = true; v.muted = true; } }
    else { v.removeAttribute('src'); v.controls = false; if (S.stream) { v.srcObject = S.stream; v.play().catch(() => {}); } }
    $('subt').textContent = m === 'file' ? 'Phân tích video quay sẵn: chọn file, chọn đoạn chạy ổn định rồi bấm phân tích.' : 'Phân tích chuyển động bằng AI, đánh giá cân bằng hai chân. Quay ' + durTxt(CFG.total) + ', máy chọn ' + Math.min(CFG.clip, CFG.total) + ' giây ổn định nhất để phân tích.';
    mockWarn(m === 'file' && Q.get('mock') === '1');
    refreshL1();
    initPose();   // video tải lên dùng Heavy, quay trực tiếp dùng Full
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
      $('vstart').value = v.duration >= 70 ? 50 : 0; if (window.Chips) Chips.sync();
    };
    refreshL1();
  });
  $('camsel').addEventListener('change', (e) => {
    startCamera(e.target.value);
  });
  // Xoay máy khi đang ở màn chuẩn bị: tự mở lại camera theo hướng mới. Đang đo thì không mở lại, khung hình tự co theo hình camera gửi về.
  PORTRAIT.addEventListener('change', () => { if (!S.running && S.mode !== 'file' && S.stream) startCamera($('camsel').value); });
  try { localStorage.removeItem('gait_orient'); } catch (e) { /* bỏ qua */ }   // dọn lựa chọn hướng cũ (đã bỏ ô chọn)

})(window.App);
