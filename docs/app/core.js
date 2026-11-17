/* app/core.js - hằng, cấu hình CFG, trạng thái S, $, nhận góc quay, ghi hình người chạy.
 * app.js cũ (2400 dòng) tách thành các file docs/app/*.js, nạp lần lượt bằng <script> trong screening.html (đúng thứ tự:
 * core, form, live, run, video, analyse, report, rview, result, save, pdf, sheet, list). Mỗi file là một hàm tự chạy, dùng chung biến qua một chỗ duy nhất: window.App (trong file gọi là App).
 * Đầu file: const { ... } = App lấy hàm/hằng của file nạp trước. Cuối file: Object.assign(App, { ... }) đưa ra cho file khác.
 * Hàm của file nạp SAU thì gọi qua App.tên (hàm chuyển tiếp ở đầu file), chỉ dùng được khi đã nạp đủ (trong sự kiện, không lúc nạp).
 * Biến bị gán lại ở nhiều file (SPEED0, SPEED) nằm thẳng trên App: đọc/ghi App.SPEED. Chạy hoàn toàn trong trình duyệt. */
window.App = {};
(function (App) {
  'use strict';
  // hàm ở file nạp sau: gọi qua App khi chạy
  function refreshL1(...a) { return App.refreshL1(...a); }
  function lvReset(...a) { return App.lvReset(...a); }
  function drawResult(...a) { return App.drawResult(...a); }
  function updateNoteBtn(...a) { return App.updateNoteBtn(...a); }
  function closeNote(...a) { return App.closeNote(...a); }
  // hàm của file này (khai báo function được nâng lên đầu nên đưa ra ngay)
  Object.assign(App, { angFeed, angShow, setTake, angStop, fixLR, recStart, recStop });
  const $ = (id) => document.getElementById(id);
  const Q = new URLSearchParams(location.search);
  const CFG = {
    total: +(Q.get('total') || 60),    // thời gian QUAY của một lần đo trực tiếp (giây), tính từ lúc kỹ thuật viên bấm Quay
    clip: Math.max(+(Q.get('clip') || 30), 6),  // đo trực tiếp: độ dài đoạn ổn định nhất được chọn để phân tích và xuất video (stable.js)
    vclip: Math.max(+(Q.get('clip') || 15), 6), // video tải lên: độ dài đoạn phân tích tính từ giây bắt đầu
    pace: +(Q.get('pace') || 6),       // phút/km
    cx: +(Q.get('cx') || 1),           // ?cx= ép mô hình: 0 lite, 1 full, 2 heavy (không có ?cx: video Heavy, trực tiếp Full)
    fps: 30,
    res: 720,
  };
  const LOGO = new Image(); LOGO.onload = () => { if (S.result && $('L3').classList.contains('show')) drawResult(S.result); }; LOGO.src = 'logo.png';   // logo trên ảnh kết quả
  const CONTACT = 'bacsikien.com  ·  0345 901 772';
  const ZALO = 'https://zalo.me/0345901772';   // Zalo bác sĩ: nút "Đặt lịch đánh giá chuyên sâu" và nút gửi thông tin dự phòng
  // Chế độ bác sĩ: mở link có ?bs=1 thì hiện "Thêm ghi chú" + "Chi tiết (bác sĩ)" và nhớ trong máy; ?bs=0 tắt.
  // Chỉ là ẩn nút cho gọn, KHÔNG phải bảo mật: ai biết link vẫn bật được.
  const DOCTOR = (() => {
    let v = null;
    try { v = localStorage.getItem('gait_bs'); } catch (e) { /* bỏ qua */ }
    const q = Q.get('bs');
    if (q === '1' || q === '0') { v = q; try { localStorage.setItem('gait_bs', q); } catch (e) { /* bỏ qua */ } }
    return v === '1';
  })();
  document.body.classList.toggle('bs', DOCTOR);   // in ở cuối trang 2 của PDF; sửa tại đây
  App.SPEED0 = 1000 / (CFG.pace * 60);
  App.SPEED = App.SPEED0;   // m/s
  const REF = (window.GAIT_REF || {}).metrics || {};
  // Bác sĩ chốt: nhịp dưới 130 bước/phút thì đề nghị đo lại (thường do máy không thấy rõ chân bên xa nên đếm thiếu một nửa số bước). App chỉ đo CHẠY, không có chế độ đi bộ nên không cần tách ngưỡng.
  const CAD_REDO = 130;
  const BACK_DETAIL = ['pelvic_drop', 'knee_valgus', 'foot_mid', 'step_width', 'lat_trunk'];   // bảng "Nhìn từ sau" (thứ tự hiện)
  const BLUE = '#2F6FEB', ORANGE = '#E8890C', GREEN = '#1F4D2B', AMBER = '#9A5F0A', TIER_RED = '#C73E2E';   // TIER_RED = --red trong screening.html (Bất thường, hạng Nguy cơ)
  const TC = Themes.cv;   // màu thương hiệu theo giao diện đang chọn (themes.js); GREEN/AMBER/BAR_IN là màu TRẠNG THÁI, giữ nguyên
  const LINKS = [['sh', 'hip'], ['hip', 'knee'], ['knee', 'ank'], ['ank', 'heel'], ['heel', 'toe'], ['ank', 'toe']];

  const S = {
    stream: null, pose: null, poseReady: false, camReady: false,
    nextId: 1, rows: [], busy: false, running: false,
    mode: 'live', file: null, fileUrl: null, sub: null, t0: 0, frames: [], jobs: [], result: null, computing: false, lastLm: null, abort: false,
    // Góc quay: take = góc tự nhận của lần quay đang chạy (null = chưa nhận, xem angle.js); sess = các góc đã chốt của người đang đo { sub, side:{R,photos}, back:{R,photos} }
    take: 'side', sess: null, angF: [], angMan: null,
  };
  const ANG_NAME = { side: 'bên', back: 'sau lưng' };
  // Góc sau lưng tạm ẩn: cờ duy nhất ở angle.js (Angle.BACK_ENABLED). false = không nhận/không chọn góc sau, điểm chỉ lấy góc ngang.
  const BACK_ON = !!(window.Angle && Angle.BACK_ENABLED);
  Score.setBackInScore(BACK_ON);
  if (!BACK_ON) {   // chữ hướng dẫn và nút chọn tay góc sau trên màn nhập
    const pb = document.querySelector('#angpick button[data-a="back"]'); if (pb) pb.hidden = true;
    const hn = $('angst') && $('angst').previousElementSibling; if (hn) hn.textContent = 'Tự nhận góc bên (ngang hông) khi bắt đầu đo. Góc sau lưng đang tạm ẩn.';
    if ($('vflab')) $('vflab').textContent = 'FILE VIDEO (quay ngang hông, thấy cả hai chân)';
  }
  // Không nhận ra góc: không đoán, dừng và không tính chỉ số
  const ANG_WAIT = 15;   // (cũ) giây chờ nhận góc; luồng mới không tự dừng ở màn chờ, giữ hằng cho file khác
  const angMsg = (why) => 'Chưa nhận ra góc quay' + (why ? ' (' + why + ')' : '') + '. Hãy đặt camera ngang hông (thấy cả hai chân)' + (BACK_ON ? ' hoặc ngay sau lưng người chạy' : '') + ' rồi đo lại.';
  // Gom đặc trưng góc từ khung xương thô (90 khung gần nhất); đủ khung và rõ ràng thì chốt góc cho lần quay này
  function angFeed(lm, vw, vh) {
    const f = Angle.feat(lm, vw, vh); if (!f) return null;
    S.angF.push(f); if (S.angF.length > 90) S.angF.shift();
    const d = Angle.decide(S.angF);
    if (d.angle) setTake(d.angle);
    return d;
  }
  // Nhãn góc ở màn đo + nút "Đổi" (chọn tay ghi đè góc tự nhận cho lần đo này; ẩn khi đã bắt đầu tính kết quả)
  function angShow(man) { $('idl').textContent = S.take ? (man ? 'Chọn tay: góc ' : 'Đã nhận: góc ') + ANG_NAME[S.take] : ''; $('angchg').hidden = !BACK_ON || !S.take || S.computing; }
  function setTake(a, man) { if (a === 'back' && !BACK_ON) return; S.take = a;S.late = []; lvReset(); angShow(man); }
  function angStop(why) {
    if (REC.mr) recStop(false);
    S.abort = true; S.running = false; clearInterval(S.timer); show('L1'); $('msg1').textContent = angMsg(why); $('angpick').hidden = false; refreshL1();
  }
  // Quay sau lưng: người chạy quay lưng về camera nên chân trái nằm bên TRÁI hình (camera không lật gương).
  // MediaPipe đặt tên trái/phải theo kiểu người nhìn thẳng vào camera, nên khi thấy hông "trái" nằm bên phải hông "phải" thì đổi tên mọi cặp điểm trái/phải.
  // Kết quả: L luôn là chân nằm bên trái hình = chân trái thật của người chạy.
  const LR_PAIRS = [[1, 4], [2, 5], [3, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [17, 18], [19, 20], [21, 22], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32]];
  function fixLR(lm) {
    if (!lm || !lm[23] || !lm[24] || !(lm[23].x > lm[24].x)) return lm;
    const o = lm.slice();
    for (const [a, b] of LR_PAIRS) { o[a] = lm[b]; o[b] = lm[a]; }
    return o;
  }
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
          const a = document.createElement('a'); a.download = App.fileName({ id: 'video', name, phone: $('phone').value }, REC.ext, nm + '_' + stamp); a.href = URL.createObjectURL(blob); a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 10000);
          $('recst').textContent = 'Đã lưu video ' + a.download + ' (' + (blob.size / 1048576).toFixed(1) + ' MB) vào thư mục Downloads.';
        } else $('recst').textContent = '';
        res(true);
      };
      try { mr.stop(); } catch (e) { res(false); }
    });
  }
  $('recbtn').addEventListener('click', () => { if (REC.mr) recStop(true, $('name').value.trim()); else recStart(); });

  Object.assign(App, { $, Q, CFG, LOGO, CONTACT, ZALO, REF, CAD_REDO, BACK_DETAIL, BLUE, ORANGE, GREEN, AMBER,
    TIER_RED, TC, LINKS, S, ANG_NAME, BACK_ON, ANG_WAIT, angMsg, show, pad, idStr, REC });
})(window.App);
