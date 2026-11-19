/* app/rvsheet.js - bố cục mới của ảnh tải về #res và trang 1 PDF khi chỉ quay góc ngang (mockup docs/mockup/ket-qua-v2.html):
 * dải thông tin khách, ô điểm to, ảnh khung xương (drawHero), 5 thẻ chỉ số số to + thanh so sánh, ô "Bạn có biết?", ghi chú bác sĩ (nếu có).
 * Kết luận tổng kết chỉ còn trên màn hình và PDF (19/11/2026). Số liệu dùng chung với màn #rview (rvRows, rvAdvice ở rvdesc.js) để hai nơi luôn khớp.
 * Gọi từ drawResultCv (result.js) sau khi đã vẽ nền và dải đầu trang (cao 100). Một phần của app cũ; cách chia sẻ biến xem đầu app/core.js.
 */
(function (App) {
  'use strict';
  const { $, TC, S, pad, rr, scores, tierOf } = App;   // eslint-disable-line no-unused-vars
  function wrap(...a) { return App.wrap(...a); }
  Object.assign(App, { drawSheet });
  function drawSheet(R, c) {
    const INK = TC.ink, MUT = TC.mut;
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
    // ---- bố cục số to (bác sĩ Kiên 19/11/2026): trái = ô điểm + ảnh khung xương (+ ghi chú bác sĩ nếu có); phải = 5 thẻ chỉ số + "Bạn có biết?" ----
    const lines = (txt, f, w) => { font(f[0], f[1]); let n = 1, ln = ''; for (const wd of (window.I18N ? I18N.t(txt) : txt).split(' ')) { const t = ln ? ln + ' ' + wd : wd; if (c.measureText(t).width > w && ln) { n++; ln = wd; } else ln = t; } return n; };
    const LX = 48, LW = 540, TOP = 196, BOT = 1044;
    // ô điểm
    const SH = 268, st = sc.total != null ? String(sc.total) : '–';
    const g = c.createLinearGradient(LX, TOP, LX + LW, TOP + SH); g.addColorStop(0, TC.brand); g.addColorStop(1, '#2f6b3f');
    c.fillStyle = g; rr(c, LX, TOP, LW, SH, 24); c.fill(); c.strokeStyle = TC.accent; c.lineWidth = 4; c.stroke();
    c.fillStyle = '#d6ecc9'; font('700', 20); c.fillText('ĐIỂM DÁNG CHẠY', LX + 30, TOP + 44);
    c.fillStyle = sc.total != null ? '#fff' : '#d6ecc9'; font('800', sc.total != null ? 150 : 72); c.fillText(st, LX + 22, TOP + 186);
    const sw = c.measureText(st).width;
    if (sc.total != null) { c.fillStyle = '#d6ecc9'; font('700', 40); c.fillText('/100', LX + 32 + sw, TOP + 186); }
    if (tt) { const b = App.RV_BADGE[tt.key] || tt.name; font('800', 26); const bw = c.measureText(b).width + 44; c.fillStyle = TC.accent; rr(c, LX + 30, TOP + 206, bw, 46, 23); c.fill(); c.fillStyle = TC.brand; c.fillText(b, LX + 52, TOP + 239); }
    else { c.fillStyle = '#eaf5e3'; font('500', 20); wrap(c, App.rvScoreLine(sc.total), LX + 30, TOP + 222, LW - 60, 26); }
    // ảnh khung xương: lấp phần còn lại, cắt giữa ảnh 3:4
    const note = ($('note').value || '').trim(), NH = note ? 128 : 0, PY = TOP + SH + 18, PH = BOT - PY - (note ? NH + 16 : 0);
    const hc = document.createElement('canvas'); hc.width = 900; hc.height = 1200; App.drawHero(hc, ph[side], side, R);
    const k2 = Math.min(LW / 900, PH / 1200), dw = 900 * k2, dh = 1200 * k2;   // vừa khung, không cắt: luôn thấy đủ người từ đầu tới bàn chân
    card(LX, PY, LW, PH); c.save(); rr(c, LX, PY, LW, PH, 22); c.clip(); c.fillStyle = '#1c2430'; c.fillRect(LX, PY, LW, PH);
    c.drawImage(hc, LX + (LW - dw) / 2, PY + (PH - dh) / 2, dw, dh); c.restore();
    const cap = (side === 'L' ? 'Chân trái' : 'Chân phải') + ' · Chạm đất';
    font('700', 22); const cw = c.measureText(cap).width + 28; c.fillStyle = 'rgba(8,19,11,.72)'; rr(c, LX + 16, PY + 16, cw, 40, 20); c.fill(); c.fillStyle = '#fff'; c.fillText(cap, LX + 30, PY + 44);
    if (note) {
      const NY = BOT - NH; card(LX, NY, LW, NH); c.fillStyle = TC.brand; font('700', 22); c.fillText('Ghi chú của bác sĩ', LX + 24, NY + 36);
      c.fillStyle = INK; font('400', 20); c.save(); c.beginPath(); c.rect(LX, NY + 44, LW, NH - 50); c.clip(); wrap(c, note, LX + 24, NY + 70, LW - 48, 26); c.restore();
    }
    // thẻ chỉ số
    const tiles = App.rvTiles(R), fact = App.rvFact(R), RX = 620, RW = 1252, GP = 22, TW = (RW - 2 * GP) / 3, TH = (BOT - TOP - GP) / 2;
    const COL = { ok: ['#2E9E4F', '#E4F5E7'], lo: ['#D98A00', '#FFF2D6'], hi: ['#D98A00', '#FFF2D6'], bad: ['#D3412F', '#FDE6E2'], nb: [TC.brand2, '#E4F5E7'] };
    const STT = { ok: 'Trong khoảng tham chiếu', lo: 'Thấp hơn khoảng tham chiếu', hi: 'Cao hơn khoảng tham chiếu', nb: 'Để tham khảo' };
    const pct = (v, a) => Math.max(0, Math.min(1, (v - a[0]) / (a[1] - a[0])));
    const fit = (txt, w, wt, s0) => { let sz = s0; font(wt, sz); while (sz > 28 && c.measureText(txt).width > w) { sz -= 2; font(wt, sz); } return sz; };
    const DIM = '#9AA59D', LC = '#2F7DE1', RC = '#F07A1A', muted = (v) => v.dim && !/\*$/.test(v.t);   // như rvMuted ở rview.js
    const slots = tiles.slice(0, fact ? 5 : 6);
    slots.forEach((t, i) => {
      const x = RX + (i % 3) * (TW + GP), y = TOP + Math.floor(i / 3) * (TH + GP), col = COL[t.sev === 'bad' ? 'bad' : t.st] || COL.ok, P = 26;
      card(x, y, TW, TH); c.save(); rr(c, x, y, TW, TH, 22); c.clip(); c.fillStyle = col[0]; c.fillRect(x, y, TW, 12); c.restore();
      c.fillStyle = INK; font('800', 28); c.fillText(t.h, x + P, y + 56, TW - 2 * P);
      c.fillStyle = MUT; font('500', 18); c.fillText(t.d, x + P, y + 84, TW - 2 * P);
      const vy = y + 222;   // đường chân số to
      if (t.kind === 'one') {
        c.fillStyle = muted(t.one) ? DIM : INK; const sz = fit(t.one.t, TW - 2 * P - 120, '800', 118); c.fillText(t.one.t, x + P - 4, vy);
        const nw = c.measureText(t.one.t).width; c.fillStyle = MUT; font('700', 26); c.fillText(t.unit, x + P + nw + 8, vy, TW - 2 * P - nw - 8);
      } else if (t.kind === 'word') {
        [['TRÁI', t.L, LC, vy - 62], ['PHẢI', t.R, RC, vy]].forEach(([lb, v, cc, yy]) => {
          c.fillStyle = cc; font('800', 18); c.fillText(lb, x + P, yy - 8);
          c.fillStyle = muted(v) ? DIM : INK; fit(v.t, TW - 2 * P - 74, '800', 46); c.fillText(v.t, x + P + 72, yy);
        });
      } else {
        const hw = (TW - 2 * P) / 2;
        [['TRÁI', t.L, LC, 0], ['PHẢI', t.R, RC, 1]].forEach(([lb, v, cc, k]) => {
          const xx = x + P + k * hw; c.fillStyle = cc; font('800', 18); c.fillText(lb, xx, vy - 96);
          c.fillStyle = muted(v) ? DIM : INK; fit(v.t, hw - 10, '800', 92); c.fillText(v.t, xx - 3, vy);
        });
      }
      let ry = vy + 44;
      if (t.sc) {   // thanh: nền xám, khoảng xanh = khoảng Tốt, chấm = số đo (xanh dương trái, cam phải)
        const gx = x + P + 8, gw = TW - 2 * P - 16, gy = vy + 30;
        c.fillStyle = '#E3E9E1'; rr(c, gx, gy, gw, 22, 11); c.fill();
        const b0 = pct(t.band[0], t.sc), b1 = pct(t.band[1], t.sc); c.fillStyle = '#9ED8A9'; rr(c, gx + b0 * gw, gy, Math.max(8, (b1 - b0) * gw), 22, 11); c.fill();
        const dot = (v, cc) => { if (!v || v.n == null) return; const cx = gx + pct(v.n, t.sc) * gw; c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, gy + 11, 17, 0, 7); c.fill(); c.fillStyle = cc; c.beginPath(); c.arc(cx, gy + 11, 12, 0, 7); c.fill(); };
        if (t.kind === 'one') dot(t.one, INK); else { dot(t.L, LC); dot(t.R, RC); }
        ry = gy + 56;
      }
      c.fillStyle = MUT; font('500', 17); const rt = 'Tham chiếu: ' + t.ref + (t.src ? ' · ' + t.src : '');
      c.save(); c.beginPath(); c.rect(x, ry - 20, TW, 50); c.clip(); wrap(c, rt, x + P, ry, TW - 2 * P, 23); c.restore();
      const sl = STT[t.st]; font('800', 20); const bw = c.measureText(sl).width + 36, by = y + TH - 26 - 40;
      c.fillStyle = col[1]; rr(c, x + P, by, bw, 40, 20); c.fill(); c.fillStyle = col[0]; c.fillText(sl, x + P + 18, by + 27);
    });
    if (fact) {
      const x = RX + 2 * (TW + GP), y = TOP + TH + GP, P = 28;
      c.fillStyle = TC.brand; rr(c, x, y, TW, TH, 22); c.fill(); c.save(); rr(c, x, y, TW, TH, 22); c.clip(); c.fillStyle = TC.accent; c.fillRect(x, y, TW, 12); c.restore();
      c.fillStyle = TC.accent; font('800', 22); c.fillText('BẠN CÓ BIẾT?', x + P, y + 58);
      let fs = 28; while (fs > 20 && lines(fact.t, ['600', fs], TW - 2 * P) * fs * 1.38 > TH - 150) fs -= 1;
      c.fillStyle = '#EAF5E3'; font('600', fs); wrap(c, fact.t, x + P, y + 108, TW - 2 * P, Math.round(fs * 1.38));
      c.fillStyle = '#CFE8C2'; font('italic 400', 19); c.fillText(fact.src, x + P, y + TH - 30, TW - 2 * P);
    }
    const foot = App.rvFoot(R, App.rvRows(R));
    if (foot) { c.fillStyle = MUT; font('italic 400', 18); c.textAlign = 'right'; c.fillText(foot, RX + RW, 1068); c.textAlign = 'left'; }
    c.fillStyle = MUT; font('400', 18); c.fillText('Kết quả chỉ mang tính tham khảo.', 48, 1068);
  }
})(window.App);
