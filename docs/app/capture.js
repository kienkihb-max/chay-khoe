/* app/capture.js - (1) đặt tên file tải về: tên khách + SĐT + ngày; (2) quay lại màn đo (dải thông tin khách + logo, video + khung xương, cột thẻ số + đồ thị, viền xanh) để khách tải video.
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
  // Khung video tải về (giống màn đo L2 + dải thông tin như báo cáo): viền xanh thương hiệu bao ngoài; hàng trên là dải thông tin khách
  // (nền xanh đậm, nhãn xanh lá, logo đủ chữ góc phải); dưới là video + khung xương cạnh cột thẻ số, đồ thị và bảng Trái/Phải.
  // Chỉ lấy đúng phần hình video (#v2 hiện kiểu contain) nên không còn dải đen hai bên; cỡ canvas tính theo nội dung.
  const txt = (el) => (el ? el.textContent.trim() : '');
  const shown = (el) => !!el && !el.hidden && el.getClientRects().length > 0;
  function strip(c, x, y, w, u, dry) {
    const sub = S.sub || {}, d = new Date(), F = Themes.font, padX = 24 * u, lgD = 60 * u;
    const info = [['Mã khách', sub.id], ['Họ tên', sub.name], ['Chiều cao', sub.height ? sub.height + ' cm' : ''],
      ['Ngày đo', App.pad(d.getDate()) + '/' + App.pad(d.getMonth() + 1) + '/' + d.getFullYear()],
      ['Tốc độ máy', (App.SPEED * 3.6).toFixed(0) + ' km/h'], ['Góc quay', S.take === 'back' ? 'Sau' : S.take ? 'Ngang' : '–']];
    // xếp các mục từ trái sang, hết chỗ (chừa logo) thì xuống hàng
    const maxX = x + w - padX - lgD - 20 * u, RH = 50 * u, pos = [];
    let cx = x + padX, row = 0;
    for (const [k, v] of info) {
      const t = String(v || '–');
      c.font = '700 ' + 20 * u + 'px ' + F; let tw = Math.min(c.measureText(t).width, 300 * u);
      c.font = '700 ' + 13 * u + 'px ' + F; tw = Math.max(tw, c.measureText(k.toUpperCase()).width);
      if (cx > x + padX && cx + tw > maxX) { cx = x + padX; row++; }
      pos.push([k, t, cx, row]); cx += tw + 32 * u;
    }
    const h = Math.max(lgD + 20 * u, (row + 1) * RH + 22 * u);
    if (dry) return h;
    c.fillStyle = TC.brand; c.beginPath(); c.roundRect(x, y, w, h, 14 * u); c.fill();
    const y0 = y + (h - (row + 1) * RH) / 2;
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    for (const [k, t, px, rw] of pos) {
      const py = y0 + rw * RH;
      c.font = '700 ' + 13 * u + 'px ' + F; c.fillStyle = TC.accent; c.fillText(k.toUpperCase(), px, py + 16 * u);
      c.font = '700 ' + 20 * u + 'px ' + F; c.fillStyle = '#fff'; c.fillText(t, px, py + 42 * u, 300 * u);
    }
    const L = App.LOGO, lx = x + w - padX - lgD, ly = y + (h - lgD) / 2;
    if (L && L.complete && L.naturalWidth) { c.save(); c.fillStyle = '#fff'; c.beginPath(); c.arc(lx + lgD / 2, ly + lgD / 2, lgD / 2, 0, Math.PI * 2); c.fill(); c.clip(); c.drawImage(L, lx, ly, lgD, lgD); c.restore(); }
    return h;
  }
  // cột phải: thẻ số (#lvcards), đồ thị (#lvw: sóng góc gối + #lvtrend), bảng Trái/Phải (#lvtbl); chữ/màu lấy từ màn đo
  function column(c, x, y, w, u, dry) {
    const F = Themes.font, G = 10 * u; let yy = y;
    const panel = (h) => { c.fillStyle = 'rgba(255,255,255,.06)'; c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = Math.max(1, u); c.beginPath(); c.roundRect(x, yy, w, h, 14 * u); c.fill(); c.stroke(); };
    for (const el of document.querySelectorAll('#lvcards .lvc')) {
      const H = 64 * u;
      if (!dry) {
        panel(H); const st = cs(el); c.fillStyle = st.borderLeftColor; c.fillRect(x, yy + 8 * u, 5 * u, H - 16 * u);
        const em = el.querySelector('em'), b = el.querySelector('b'), sm = el.querySelector('small');
        c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        c.font = '600 ' + 14 * u + 'px ' + F; c.fillStyle = cs(em).color; c.fillText(txt(em), x + 18 * u, yy + 22 * u, w - 30 * u);
        c.font = '700 ' + 28 * u + 'px ' + F; c.fillStyle = cs(b).color; c.fillText(txt(b), x + 18 * u, yy + 54 * u);
        const bw = c.measureText(txt(b)).width;
        if (sm) { c.font = '400 ' + 13 * u + 'px ' + F; c.fillStyle = cs(sm).color; c.fillText(txt(sm), x + 26 * u + bw, yy + 54 * u, w - 44 * u - bw); }
      }
      yy += H + G;
    }
    const lw = $('lvw');
    if (shown(lw)) {
      const ip = 14 * u, iw = w - 2 * ip, items = [];
      const walk = (el) => {
        for (const ch of el.children) {
          if (!shown(ch)) continue;
          if (ch.id === 'lvtrend') walk(ch);
          else if (ch.tagName === 'CANVAS') items.push([ch, iw * ch.clientHeight / (ch.clientWidth || 1)]);
          else items.push([ch, 22 * u]);
        }
      };
      walk(lw);
      const H = ip * 2 + items.reduce((a, it) => a + it[1] + 4 * u, 0);
      if (!dry) {
        panel(H); let iy = yy + ip;
        for (const [el, h] of items) {
          if (el.tagName === 'CANVAS') { if (el.width) c.drawImage(el, x + ip, iy, iw, h); }
          else {
            const a = el.firstElementChild || el, z = el.lastElementChild || el;
            c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.font = '600 ' + 14 * u + 'px ' + F; c.fillStyle = cs(a).color; c.fillText(txt(a), x + ip, iy + 16 * u, iw * 0.6);
            if (z !== a) { c.textAlign = 'right'; c.font = (z.tagName === 'B' ? '700 ' + 18 : '400 ' + 12) * u + 'px ' + F; c.fillStyle = cs(z).color; c.fillText(txt(z), x + w - ip, iy + 16 * u, iw * 0.45); }
          }
          iy += h + 4 * u;
        }
      }
      yy += H + G;
    }
    const tb = $('lvtbl');
    if (shown(tb)) {
      const rows = [...tb.rows], ip = 14 * u, RH = 26 * u, H = ip * 2 + rows.length * RH, c1 = w * 0.62;
      if (!dry) {
        panel(H);
        rows.forEach((tr, i) => [...tr.cells].forEach((td, j) => {
          const ry = yy + ip + i * RH + 18 * u;
          c.textBaseline = 'alphabetic'; c.font = (i ? '500 ' + 15 : '700 ' + 13) * u + 'px ' + F; c.fillStyle = cs(td).color;
          if (!j) { c.textAlign = 'left'; c.fillText(txt(td), x + ip, ry, c1 - ip); } else { c.textAlign = 'center'; c.fillText(txt(td), x + c1 + (j - 0.5) * (w - c1 - ip) / 2, ry); }
        }));
      }
      yy += H + G;
    }
    return Math.max(0, yy - G - y);
  }
  function draw(r) {
    const L2 = $('L2'), box = L2.getBoundingClientRect(); if (!box.width) return;
    const v = App.v2, ov = App.ov || $('ov'), vw = v.videoWidth || box.width, vh = v.videoHeight || box.height;
    const k0 = Math.min(box.width / vw, box.height / vh), cw = vw * k0, ch = vh * k0, cx = (box.width - cw) / 2, cy = (box.height - ch) / 2;   // phần hình video trên màn đo
    const u = r.w / 1280, B = Math.round(8 * u), P = Math.round(16 * u), CW = Math.round(340 * u), c = r.ctx;
    const VW = Math.round(Math.min(r.w - 2 * B - 3 * P - CW, 600 * u * cw / ch)), VH = Math.round(VW * ch / cw);
    const W = 2 * B + 3 * P + VW + CW, SH = Math.round(strip(c, 0, 0, W - 2 * B - 2 * P, u, true)), BH = Math.max(VH, Math.round(column(c, 0, 0, CW, u, true)));
    const H = 2 * B + 3 * P + SH + BH;
    if (r.cv.width !== W || r.cv.height !== H) { r.cv.width = W; r.cv.height = H; }
    c.fillStyle = cs(L2).backgroundColor || '#08130B'; c.fillRect(0, 0, W, H);
    strip(c, B + P, B + P, W - 2 * B - 2 * P, u, false);
    const VX = B + P, VY = B + 2 * P + SH + Math.round((BH - VH) / 2);
    if (v.videoWidth) c.drawImage(v, VX, VY, VW, VH);
    const s = ov.width / box.width; if (ov.width) c.drawImage(ov, cx * s, cy * s, cw * s, ch * s, VX, VY, VW, VH);
    column(c, VX + VW + P, B + 2 * P + SH, CW, u, false);
    c.strokeStyle = cs(L2).getPropertyValue('--leaf').trim() || TC.accent || '#A9D69B'; c.lineWidth = B; c.strokeRect(B / 2, B / 2, W - B, H - B);
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
