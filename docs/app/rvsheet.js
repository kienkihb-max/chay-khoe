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
    const RX = 620, RW = 1252, fact = App.rvFact(R); let SH = 196;   // SH: cao ô điểm; có fact thì cao thêm cho dòng "Bạn có biết?"
    // đo trước: dòng nhận xét điểm có thể xuống 2 dòng, fact 2–3 dòng; ô điểm cao theo nội dung
    const lines = (txt, f, w) => { font(f[0], f[1]); let n = 1, ln = ''; for (const wd of (window.I18N ? I18N.t(txt) : txt).split(' ')) { const t = ln ? ln + ' ' + wd : wd; if (c.measureText(t).width > w && ln) { n++; ln = wd; } else ln = t; } return n; };
    const st = sc.total != null ? String(sc.total) : '–';
    font('800', sc.total != null ? 120 : 64); let nx = RX + 30 + c.measureText(st).width + 10;
    if (sc.total != null) { font('700', 34); nx += c.measureText('/100').width; }
    nx = Math.max(nx + 40, RX + 380);
    const TW = RX + RW - 36 - nx, sy = tt ? 316 : 290, sl = App.rvScoreLine(sc.total), sn = lines(sl, ['500', 26], TW);
    // fact chạy hết bề ngang ô điểm, dưới số điểm: 1–2 dòng
    const FX = RX + 36, FW = RW - 72; font('800', 17); const lw = c.measureText('BẠN CÓ BIẾT?').width + 14, ftx = fact ? fact.t + ' (' + fact.src + ')' : '';
    const sep = Math.max(380, sy + (sn - 1) * 34 + 22), fy = sep + 30, fn = fact ? lines(ftx, ['400', 19], FW - lw) : 0;
    SH = fact ? fy + (fn - 1) * 25 + 20 - 196 : 196;
    const g = c.createLinearGradient(RX, 196, RX + RW, 196 + SH); g.addColorStop(0, TC.brand); g.addColorStop(1, '#2f6b3f');
    c.fillStyle = g; rr(c, RX, 196, RW, SH, 22); c.fill(); c.strokeStyle = TC.accent; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#d6ecc9'; font('700', 20); c.fillText('ĐIỂM DÁNG CHẠY', RX + 36, 238);
    c.fillStyle = sc.total != null ? '#fff' : '#d6ecc9'; font('800', sc.total != null ? 120 : 64); c.fillText(st, RX + 30, 358);
    if (sc.total != null) { c.fillStyle = '#d6ecc9'; font('700', 34); const w0 = (font('800', 120), c.measureText(st).width); font('700', 34); c.fillText('/100', RX + 40 + w0, 358); }
    if (tt) {
      const b = App.RV_BADGE[tt.key] || tt.name; font('800', 24); const bw = c.measureText(b).width + 40;
      c.fillStyle = TC.accent; rr(c, nx, 228, bw, 44, 22); c.fill(); c.fillStyle = TC.brand; c.fillText(b, nx + 20, 259);
    }
    c.fillStyle = '#eaf5e3'; font('500', 26); wrap(c, sl, nx, sy, TW, 34);
    if (fact) {   // "Bạn có biết?": một fact có nghiên cứu gắn với chỉ số lệch nhất (facts.js, chọn ở rview.js rvFact)
      c.strokeStyle = 'rgba(214,236,201,.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(FX, sep); c.lineTo(FX + FW, sep); c.stroke();
      c.fillStyle = TC.accent; font('800', 17); c.fillText('BẠN CÓ BIẾT?', FX, fy);
      c.fillStyle = '#eaf5e3'; font('400', 19); wrap(c, ftx, FX + lw, fy, FW - lw, 25);
    }
    // ---- bảng 5 chỉ số, hai nhóm: Chỉ số chung (Giá trị | Tham chiếu) và So sánh chân (Trái | Phải | Tham chiếu); '*' = số mờ chưa đủ tin cậy ----
    const TY = 196 + SH + 20, RH = fact ? 58 : 64, HH2 = fact ? 36 : 40, GAP = 10, cols = [RX, RX + 430, RX + 640, RX + 850], CW = [430, 210, 210, RW - 850];
    const groups = App.rvGroups(rows), foot = App.rvFoot(R, rows), FH = foot ? 30 : 0;
    card(RX, TY, RW, groups.length * HH2 + RH * rows.length + GAP * (groups.length - 1) + FH + 6);
    let gy = TY;
    groups.forEach((g, gi) => {
      if (gi) { c.strokeStyle = LINE; c.lineWidth = 3; c.beginPath(); c.moveTo(RX + 16, gy + GAP / 2); c.lineTo(RX + RW - 16, gy + GAP / 2); c.stroke(); gy += GAP; }
      const one = g.key === 'C', mid = cols[1] + (CW[1] + CW[2]) / 2;
      font('800', 19); c.fillStyle = TC.brand; c.textAlign = 'left'; c.fillText(g.title, cols[0] + 24, gy + 28);
      font('700', 18); c.fillStyle = MUT; c.textAlign = 'center';
      if (one) c.fillText('GIÁ TRỊ', mid, gy + 28); else { c.fillText('TRÁI', cols[1] + CW[1] / 2, gy + 28); c.fillText('PHẢI', cols[2] + CW[2] / 2, gy + 28); }
      c.textAlign = 'left'; c.fillText('THAM CHIẾU', cols[3] + 24, gy + 28);
      g.rows.forEach((r, i) => {
        const y = gy + HH2 + i * RH;
        c.strokeStyle = LINE; c.lineWidth = 1.5; c.beginPath(); c.moveTo(RX + 16, y); c.lineTo(RX + RW - 16, y); c.stroke();
        c.fillStyle = INK; font('700', 24); c.fillText(r.nm, cols[0] + 24, y + 28, CW[0] - 40);
        c.fillStyle = MUT; font('400', 18); c.fillText(r.d, cols[0] + 24, y + 52, CW[0] - 40);
        font('700', 30); c.textAlign = 'center';
        if (one) { c.fillStyle = App.rvMuted(r.cells[0]) ? '#9AA59D' : TC.brand; c.fillText(r.cells[0].t, mid, y + 42, CW[1] + CW[2] - 20); }
        else r.cells.forEach((cl, j) => { c.fillStyle = App.rvMuted(cl) ? '#9AA59D' : TC.brand; c.fillText(cl.t, cols[1 + j] + CW[1 + j] / 2, y + 42, CW[1 + j] - 20); });
        c.textAlign = 'left'; c.fillStyle = INK; font('600', 22); c.fillText(r.rf || '–', cols[3] + 24, y + 30, CW[3] - 40);
        if (r.src) { c.fillStyle = MUT; font('italic 400', 17); c.fillText(r.src, cols[3] + 24, y + 54, CW[3] - 40); }
      });
      gy += HH2 + RH * g.rows.length;
    });
    if (foot) { c.fillStyle = MUT; font('italic 400', 19); c.textAlign = 'left'; c.fillText(foot, RX + 24, gy + 24, RW - 48); }
    // ---- kết luận tổng kết ----
    const KY = gy + FH + 6 + 16, KH = 1044 - KY;
    card(RX, KY, RW, KH); c.fillStyle = TC.brand; font('700', 24); c.fillText('Kết luận tổng kết', RX + 28, KY + 38);
    c.save(); c.beginPath(); c.rect(RX, KY, RW, KH - 6); c.clip();
    let y = KY + 72; font('400', 21);
    for (const t of App.rvAdvice(R, rows)) { c.fillStyle = TC.brand2; c.beginPath(); c.arc(RX + 36, y - 7, 5, 0, 7); c.fill(); c.fillStyle = INK; y = wrap(c, t, RX + 52, y, RW - 84, 27) + 2; }
    c.restore();
    c.fillStyle = MUT; font('400', 18); c.fillText('Kết quả chỉ mang tính tham khảo.', 48, 1068);
  }
})(window.App);
