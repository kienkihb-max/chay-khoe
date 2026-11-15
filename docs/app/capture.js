/* app/capture.js - (1) đặt tên file tải về: tên khách + SĐT + ngày; (2) quay lại màn đo (camera + khung xương + số + khung viền + logo) để khách tải video.
   Video chỉ giữ trong bộ nhớ trang này (không lưu IndexedDB, không gửi Sheet/Drive). Một phần của app cũ; cách chia sẻ biến xem đầu app/core.js. */
(function (App) {
  'use strict';
  const { $, S, TC } = App;
  Object.assign(App, { fileName, capBlobs: () => parts() });

  // ---------- Tên file ----------
  const ascii = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  // Đủ tên + SĐT: Ten-Khach_0912345678_20261115[suffix].ext; thiếu một trong hai thì dùng fallback (mặc định Mã khách như cũ).
  function fileName(sub, ext, fallback, suffix) {
    sub = sub || {};
    const nm = sub.name === 'Khách ' + sub.id ? '' : ascii(sub.name), ph = String(sub.phone || '').replace(/\D/g, '');
    const d = new Date(), day = d.getFullYear() + App.pad(d.getMonth() + 1) + App.pad(d.getDate());
    const base = nm && ph ? nm + '_' + ph + '_' + day : (fallback != null ? fallback : ascii(sub.id) || 'file');
    return base + (suffix || '') + '.' + ext;
  }

  // ---------- Quay màn đo ----------
  const blobs = {};   // 'mã|góc' -> { blob, ext }
  let rec = null;
  const css = new WeakMap();
  const parts = () => { const R = S.result, id = R && R.sub && R.sub.id; return id ? Object.keys(blobs).filter((k) => k.split('|')[0] === id).map((k) => ({ side: k.split('|')[1], ...blobs[k] })) : []; };
  function pickMime() {
    for (const m of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
      try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { /* bỏ qua */ }
    }
    return '';
  }
  function cs(el) { let c = css.get(el); if (!c) { c = getComputedStyle(el); css.set(el, c); } return c; }
  function draw(r) {
    const L2 = $('L2'), box = L2.getBoundingClientRect(); if (!box.width) return;
    const W = r.w, s = W / box.width, H = Math.round(box.height * s), c = r.ctx;
    if (r.cv.width !== W || r.cv.height !== H) { r.cv.width = W; r.cv.height = H; }
    c.fillStyle = cs(L2).backgroundColor || '#0E2433'; c.fillRect(0, 0, W, H);
    const v = App.v2, vw = v.videoWidth, vh = v.videoHeight;
    if (vw && vh) { const k = Math.min(W / vw, H / vh); c.drawImage(v, (W - vw * k) / 2, (H - vh * k) / 2, vw * k, vh * k); }
    c.drawImage(App.ov || $('ov'), 0, 0, W, H);
    // thẻ số: vẽ lại đúng vị trí/chữ của các thẻ trên màn đo
    for (const el of document.querySelectorAll('#lvcards .lvc')) {
      const b = el.getBoundingClientRect(); if (!b.width) continue;
      const x = (b.left - box.left) * s, y = (b.top - box.top) * s;
      c.fillStyle = 'rgba(14,36,51,.78)'; c.beginPath(); c.roundRect(x, y, b.width * s, b.height * s, 14 * s); c.fill();
      c.fillStyle = TC.accent || '#A9D69B'; c.fillRect(x, y + 6 * s, 4 * s, b.height * s - 12 * s);
      for (const t of el.children) {
        const q = t.getBoundingClientRect(), st = cs(t); if (!q.width || !t.textContent) continue;
        c.font = st.fontWeight + ' ' + parseFloat(st.fontSize) * s + 'px ' + st.fontFamily; c.fillStyle = st.color; c.textBaseline = 'alphabetic';
        c.fillText(t.textContent, (q.left - box.left) * s, (q.bottom - box.top) * s - q.height * s * 0.22);
      }
    }
    // khung viền + logo
    const bw = 6 * s; c.strokeStyle = getComputedStyle(L2).getPropertyValue('--leaf').trim() || TC.accent || '#A9D69B';
    c.lineWidth = bw; c.strokeRect(bw / 2, bw / 2, W - bw, H - bw);
    const lg = $('l2logo'); if (lg && lg.complete && lg.naturalWidth) { const q = lg.getBoundingClientRect(); c.drawImage(lg, (q.left - box.left) * s, (q.top - box.top) * s, q.width * s, q.height * s); }
  }
  function begin() {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return;
    const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720;
    const r = { cv, ctx: cv.getContext('2d'), w: 1280, last: 0, chunks: [], chk: performance.now(), stop: false };
    const mime = pickMime();
    try { r.mr = new MediaRecorder(cv.captureStream(30), mime ? { mimeType: mime, videoBitsPerSecond: 5000000 } : { videoBitsPerSecond: 5000000 }); } catch (e) { return; }
    r.ext = /mp4/.test(r.mr.mimeType || mime) ? 'mp4' : 'webm';
    r.mr.ondataavailable = (e) => { if (e.data && e.data.size) r.chunks.push(e.data); };
    r.mr.start(1000); rec = r;
    const tick = (t) => {
      if (r.stop) return;
      if (t - r.last >= 33) { r.last = t; try { draw(r); } catch (e) { /* bỏ qua khung lỗi */ } }
      // nhận diện tụt dưới 10 khung/giây thì hạ độ phân giải ghi để không kéo chậm việc đo (chỉ có số này ở chế độ đo trực tiếp)
      if (t - r.chk > 2000) { r.chk = t; const m = /(\d+)/.exec($('fpsb').textContent || ''); if (m && +m[1] < 10 && r.w > 640) r.w = Math.max(640, Math.round(r.w * 0.75)); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  function end(keep) {
    const r = rec; if (!r) return; rec = null; r.stop = true;
    const R = S.result, id = R && R.sub && R.sub.id, side = R && R.angle === 'back' ? 'back' : 'side';
    r.mr.onstop = () => { if (keep && id && r.chunks.length) blobs[id + '|' + side] = { blob: new Blob(r.chunks, { type: r.ext === 'mp4' ? 'video/mp4' : 'video/webm' }), ext: r.ext }; };
    try { r.mr.stop(); } catch (e) { /* đã dừng */ }
  }
  setInterval(() => {
    const on = S.running && $('L2').classList.contains('show');
    if (on && !rec) begin();
    else if (!on && rec) end(!!S.result && !S.abort && !S.error);
    // nút Tải video ở màn kết quả
    const p = parts(), b = $('dlvid'), n = $('dlvidnote'); if (!b) return;
    b.hidden = !p.length; n.hidden = !p.length;
    if (p.length) n.textContent = p.some((x) => x.ext === 'webm') ? 'Trình duyệt này không ghi được .mp4 nên video là .webm (mở bằng Chrome, Edge hoặc VLC).' : '';
  }, 250);
  document.addEventListener('click', (e) => {
    if (!e.target.closest || !e.target.closest('#dlvid')) return;
    const p = parts(), R = S.result; if (!R) return;
    p.forEach((x, i) => setTimeout(() => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(x.blob);
      a.download = fileName(R.sub, x.ext, 'video-' + R.sub.id, p.length > 1 ? (x.side === 'back' ? '_sau' : '_ngang') : '');
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }, i * 400));
  });
})(window.App);
