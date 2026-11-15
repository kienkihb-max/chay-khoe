/* app/rvsheet.js - bố cục mới của ảnh tải về #res và trang 1 PDF khi chỉ quay góc ngang (mockup docs/mockup/ket-qua-v2.html):
 * dải thông tin khách, ảnh lớn khung xương đậm (drawHero), ô điểm, bảng 5 chỉ số Trái | Phải | Tham chiếu, kết luận tổng kết,
 * ghi chú bác sĩ. Số liệu dùng chung với màn #rview (rvRows, rvAdvice ở rvdesc.js) để hai nơi luôn khớp.
 * Gọi từ drawResultCv (result.js) sau khi đã vẽ nền và dải đầu trang (cao 100). Một phần của app cũ; cách chia sẻ biến xem đầu app/core.js.
 */
(function (App) {
  'use strict';
  const { $, TC, S, pad, rr, scores, tierOf } = App;
  function wrap(...a) { return App.wrap(...a); }
  Object.assign(App, { drawSheet });
  function drawSheet(R, c) {
    const INK = TC.ink, MUT = TC.mut, LINE = '#DCE6D8';
    const font = (w, s) => { c.font = w + ' ' + s + 'px ' + Themes.font; };
    const card = (x, y, w, h) => { c.save(); c.shadowColor = TC.shadow; c.shadowBlur = 14; c.shadowOffsetY = 3; c.fillStyle = '#fff'; rr(c, x, y, w, h, 18); c.fill(); c.restore(); };
    const sub = R.sub || {}, ph = S.photos || {}, sc = scores(R), tt = sc.total != null ? tierOf(sc.total) : null;
    const side = App.rvSide(R, ph), rows = App.rvRows(R), d = R.when ? new Date(R.when) : new Date();
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    // ---- dải thông tin khách (một hàng) ----
    const info = [['Mã khách', sub.id], ['Họ tên', sub.name], ['Chiều cao', sub.height ? sub.height + ' cm' : ''], ['Ngày đo', pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear()],
      ['Tốc độ máy', ((R.speed || App.SPEED) * 3.6).toFixed(0) + ' km/h'], ['Góc quay', 'Ngang']];
    let x = 48;
    for (const [k, v] of info) {
      font('600', 18); c.fillStyle = MUT; c.fillText(k.toUpperCase(), x, 140);
      font('700', 28); c.fillStyle = INK; const t = String(v || '–'); c.fillText(t, x, 174, 420);
      x += Math.max(160, Math.min(420, c.measureText(t).width) + 56);
    }
    // ---- trái: ảnh lớn (3:4) + ghi chú bác sĩ ----
    const HX = 48, HY = 196, HW = 540, HH = 720;
    const hc = document.createElement('canvas'); hc.width = 900; hc.height = 1200; App.drawHero(hc, ph[side], side, R);
    card(HX, HY, HW, HH); c.save(); rr(c, HX, HY, HW, HH, 18); c.clip(); c.drawImage(hc, HX, HY, HW, HH); c.restore();
    const cap = (side === 'L' ? 'Chân trái' : 'Chân phải') + ' · Chạm đất';
    font('700', 22); const cw = c.measureText(cap).width + 28; c.fillStyle = 'rgba(8,19,11,.72)'; rr(c, HX + 16, HY + 16, cw, 40, 20); c.fill(); c.fillStyle = '#fff'; c.fillText(cap, HX + 30, HY + 44);
    const note = ($('note').value || '').trim();
    card(HX, 932, HW, 112); c.fillStyle = TC.brand; font('700', 22); c.fillText('Ghi chú của bác sĩ', HX + 24, 966);
    c.fillStyle = note ? INK : MUT; font('400', 20);
    c.save(); c.beginPath(); c.rect(HX, 972, HW, 66); c.clip(); wrap(c, note || 'Chưa có ghi chú.', HX + 24, 998, HW - 48, 26); c.restore();
    // ---- phải: ô điểm ----
    const RX = 620, RW = 1252;
    const g = c.createLinearGradient(RX, 196, RX + RW, 396); g.addColorStop(0, TC.brand); g.addColorStop(1, '#2f6b3f');
    c.fillStyle = g; rr(c, RX, 196, RW, 196, 22); c.fill(); c.strokeStyle = TC.accent; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#d6ecc9'; font('700', 20); c.fillText('ĐIỂM DÁNG CHẠY', RX + 36, 238);
    c.fillStyle = sc.total != null ? '#fff' : '#d6ecc9'; font('800', sc.total != null ? 120 : 64); const st = sc.total != null ? String(sc.total) : '–'; c.fillText(st, RX + 30, 358);
    let nx = RX + 30 + c.measureText(st).width + 10;
    if (sc.total != null) { c.fillStyle = '#d6ecc9'; font('700', 34); c.fillText('/100', nx, 358); nx += c.measureText('/100').width; }
    nx = Math.max(nx + 40, RX + 380);
    if (tt) {
      const b = App.RV_BADGE[tt.key] || tt.name; font('800', 24); const bw = c.measureText(b).width + 40;
      c.fillStyle = TC.accent; rr(c, nx, 228, bw, 44, 22); c.fill(); c.fillStyle = TC.brand; c.fillText(b, nx + 20, 259);
    }
    c.fillStyle = '#eaf5e3'; font('500', 26); wrap(c, App.rvScoreLine(sc.total), nx, tt ? 316 : 290, RX + RW - 36 - nx, 34);
    // ---- bảng 5 chỉ số: Chỉ số | Trái | Phải | Tham chiếu (nguồn dòng nhỏ) ----
    const TY = 412, RH = 78, cols = [RX, RX + 430, RX + 640, RX + 850], CW = [430, 210, 210, RW - 850];
    card(RX, TY, RW, 44 + RH * rows.length);
    c.fillStyle = MUT; font('700', 18);
    ['CHỈ SỐ', 'TRÁI', 'PHẢI', 'THAM CHIẾU'].forEach((t, i) => c.fillText(t, cols[i] + 24, TY + 30));
    rows.forEach((r, i) => {
      const y = TY + 44 + i * RH;
      c.strokeStyle = LINE; c.lineWidth = 1.5; c.beginPath(); c.moveTo(RX + 16, y); c.lineTo(RX + RW - 16, y); c.stroke();
      c.fillStyle = INK; font('700', 25); c.fillText(r.nm, cols[0] + 24, y + 34, CW[0] - 40);
      c.fillStyle = MUT; font('400', 18); c.fillText(r.d, cols[0] + 24, y + 60, CW[0] - 40);
      font('700', 30);
      if (r.wide) { c.fillStyle = r.cells[0].dim ? '#9AA59D' : TC.brand; c.textAlign = 'center'; c.fillText(r.cells[0].t, cols[1] + (CW[1] + CW[2]) / 2, y + 50); }
      else r.cells.forEach((cl, j) => { c.fillStyle = cl.dim ? '#9AA59D' : TC.brand; c.textAlign = 'center'; c.fillText(cl.t, cols[1 + j] + CW[1 + j] / 2, y + 50, CW[1 + j] - 20); });
      c.textAlign = 'left'; c.fillStyle = INK; font('600', 22); c.fillText(r.rf || '–', cols[3] + 24, y + 36, CW[3] - 40);
      if (r.src) { c.fillStyle = MUT; font('italic 400', 17); c.fillText(r.src, cols[3] + 24, y + 62, CW[3] - 40); }
    });
    // ---- kết luận tổng kết ----
    const KY = TY + 44 + RH * rows.length + 16, KH = 1044 - KY;
    card(RX, KY, RW, KH); c.fillStyle = TC.brand; font('700', 24); c.fillText('Kết luận tổng kết', RX + 28, KY + 38);
    c.save(); c.beginPath(); c.rect(RX, KY, RW, KH - 6); c.clip();
    let y = KY + 72; font('400', 21);
    for (const t of App.rvAdvice(R, rows)) { c.fillStyle = TC.brand2; c.beginPath(); c.arc(RX + 36, y - 7, 5, 0, 7); c.fill(); c.fillStyle = INK; y = wrap(c, t, RX + 52, y, RW - 84, 27) + 2; }
    c.restore();
    c.fillStyle = MUT; font('400', 18); c.fillText('Kết quả chỉ mang tính tham khảo.', 48, 1068);
  }
})(window.App);
