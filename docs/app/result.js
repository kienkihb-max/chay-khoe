/* app/result.js - ảnh kết quả #res (drawResultCv), bảng chi tiết bác sĩ. Một phần của app cũ; cách chia sẻ biến xem đầu app/core.js. */
(function (App) {
  'use strict';
  const { $, LOGO, REF, BACK_DETAIL, BLUE, ORANGE, GREEN, AMBER, TC, S, pad, lvLevel, LV_CARDS_BACK,
    LV_PERLEG_BACK, rating, BAR_IN, BAR_OUT, barScale, statInfo, barHTML, f1, f0, SPREAD_TIP, flagList, cval,
    cadLow, framePoor, flagged, flagItems, flagHTML, rr, drawPhoto, scores, tierOf, scoreCol, unscored, mainVal, backVal,
    improveTip, RV_KEYS, RV_LV, rvNum, rvOk, rvRange, rvData, drawHero, rvSide, rvCol } = App;
  // hàm ở file nạp sau: gọi qua App khi chạy
  function drawBackPhoto(...a) { return App.drawBackPhoto(...a); }
  function wrap(...a) { return App.wrap(...a); }
  // hàm của file này (khai báo function được nâng lên đầu nên đưa ra ngay)
  Object.assign(App, { drawResultCv, extraRows, poorFrameWarn, detailHTML, setDetail, resetDetail });
  // newLay: chỉ quay góc ngang thì vẽ bố cục mới (ảnh lớn + 2 ảnh đặt chân + điểm + thẻ số), giống màn #rview.
  function drawResultCv(R, cv, newLay) {
    const c = cv.getContext('2d'), INK = TC.ink, MUT = TC.mut;
    const font = (w, s) => { c.font = w + ' ' + s + 'px ' + Themes.font; };
    const fit = (txt, w, s, min, maxW) => { font(w, s); while (s > min && c.measureText(txt).width > maxW) { s -= 2; font(w, s); } };
    const card = (x, y, w, h) => { c.save(); c.shadowColor = TC.shadow; c.shadowBlur = 14; c.shadowOffsetY = 3; c.fillStyle = '#fff'; rr(c, x, y, w, h, 22); c.fill(); c.restore(); };
    const pill = (txt, x, y, h, bg, fg, size) => { font('700', size); const w = c.measureText(txt).width + h * 0.9; c.fillStyle = bg; rr(c, x, y, w, h, h / 2); c.fill(); c.fillStyle = fg; c.textBaseline = 'middle'; c.fillText(txt, x + h * 0.45, y + h / 2 + 1); c.textBaseline = 'alphabetic'; return w; };
    c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    c.fillStyle = TC.pale; c.fillRect(0, 0, 1920, 1080);
    // ---- đầu trang: tên, ngày đo, bacsikien.com ----
    const g = c.createLinearGradient(0, 0, 1920, 0); g.addColorStop(0, TC.brand); g.addColorStop(1, TC.brand2);
    c.fillStyle = g; c.fillRect(0, 0, 1920, 100);
    // logo.png có nền vuông hơi xám quanh vòng tròn: cắt theo hình tròn và phóng ảnh để vòng logo khít mép, không lộ góc vuông
    if (LOGO.complete && LOGO.naturalWidth) { c.save(); c.fillStyle = '#fff'; c.beginPath(); c.arc(68, 50, 30, 0, Math.PI * 2); c.fill(); c.clip(); c.drawImage(LOGO, 32, 14, 72, 72); c.restore(); }
    c.fillStyle = '#fff'; font('700', 34); c.fillText('Hanoi Running Lab', 112, 62);
    const d = R.when ? new Date(R.when) : new Date();   // mở lại người cũ: giữ ngày đo
    c.textAlign = 'right'; c.fillStyle = '#fff'; font('700', 30); c.fillText('Ngày đo ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(), 1872, 50);
    c.fillStyle = TC.accent; font('600', 24); c.fillText('bacsikien.com', 1872, 84); c.textAlign = 'left';
    // Góc đã quay: chỉ ngang (R.comb), chỉ sau (R.back), hoặc cả hai. Chỉ vẽ khối của góc đã quay.
    const sc = scores(R), sub = R.sub, hasSide = !!R.comb, hasBack = !!R.back, both = hasSide && hasBack;
    const ph = S.photos || {};
    if (newLay && hasSide && !hasBack) {
      // ---- trái: ảnh lớn toàn thân (đủ marker, cùng chân với #rview) + việc nên cải thiện ----
      const side = rvSide(R, ph), HX = 48, HY = 124, HW = 520, HH = 728;
      const hc = document.createElement('canvas'); hc.width = 800; hc.height = 1120; drawHero(hc, ph[side], side, R);
      card(HX, HY, HW, HH); c.save(); rr(c, HX, HY, HW, HH, 22); c.clip(); c.drawImage(hc, HX, HY, HW, HH); c.restore();
      const cap = (txt, x, y) => { font('700', 22); const w = c.measureText(txt).width + 28; c.fillStyle = 'rgba(8,19,11,.72)'; rr(c, x, y, w, 40, 20); c.fill(); c.fillStyle = '#fff'; c.fillText(txt, x + 14, y + 28); };
      cap('Khoảnh khắc chạm đất · ' + (side === 'L' ? 'Chân trái' : 'Chân phải'), HX + 16, HY + 16);
      card(HX, 876, HW, 148); c.fillStyle = TC.brand; rr(c, HX, 876, 12, 148, 6); c.fill();
      font('700', 22); c.fillText('NÊN CẢI THIỆN', HX + 32, 914);
      c.fillStyle = INK; font('600', 24); wrap(c, improveTip(R), HX + 32, 948, HW - 60, 30);
      // ---- giữa trên: tên, điểm, hạng ----
      card(592, 124, 560, 350);
      c.fillStyle = INK; fit(sub.name, '700', 48, 30, 496); c.fillText(sub.name, 624, 184, 496);
      c.fillStyle = MUT; font('400', 24); c.fillText('Cao ' + sub.height + ' cm  ·  ' + ((R.speed || App.SPEED) * 3.6).toFixed(0) + ' km/h', 624, 222);
      font('700', 24); c.fillText('ĐIỂM DÁNG CHẠY', 624, 268);
      const tt = sc.total != null ? tierOf(sc.total) : unscored(sc), st = sc.total != null ? String(sc.total) : '–';
      c.fillStyle = sc.total != null ? tt.col : '#8A97A1'; font('700', 130); c.fillText(st, 616, 392); const nw = c.measureText(st).width;
      if (sc.total != null) { c.fillStyle = '#7A8791'; font('700', 40); c.fillText('/100', 628 + nw, 392); }
      pill(tt.label, 624, 408, 50, tt.col, '#fff', 28);
      // ---- phải trên: hai ảnh đặt chân trái / phải ----
      ['L', 'R'].forEach((s, i) => {
        const x = 1176 + i * 356; card(x, 124, 340, 350);
        drawPhoto(c, ph[s], s, x, 124, 340, 350, R, false, true, true);
        cap(s === 'L' ? 'Đặt chân trái' : 'Đặt chân phải', x + 14, 138);
      });
      // ---- dưới: thẻ số (cùng dữ liệu, cùng mức với thẻ #rview) ----
      const Ds = RV_KEYS.map((k) => [k, rvData(R, k)]).filter(([, D]) => D), CW = 308, CH = 124;
      Ds.slice(0, 16).forEach(([k, D], i) => {
        const x = 592 + (i % 4) * (CW + 16), y = 498 + Math.floor(i / 4) * (CH + 10), col = rvCol(D.L.cls), u = D.unit;
        card(x, y, CW, CH); c.fillStyle = col; rr(c, x, y, 8, CH, 4); c.fill();
        font('700', 18); const pw = c.measureText(D.L.t).width + 26;
        c.fillStyle = col; rr(c, x + CW - 14 - pw, y + 12, pw, 30, 15); c.fill(); c.fillStyle = '#fff'; c.fillText(D.L.t, x + CW - 14 - pw + 13, y + 33);
        // tên chỉ số: tối đa 2 dòng cạnh pill (dịch trước rồi mới ngắt dòng, như wrap())
        const lw = CW - 50 - pw, words = (window.I18N ? I18N.t(D.label) : D.label).split(' ');
        let fs = 20, lines;
        for (; fs >= 15; fs--) {
          font('700', fs); lines = [''];
          for (const w of words) { const t = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w; if (c.measureText(t).width > lw && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = t; }
          if (lines.length <= 2) break;
        }
        c.fillStyle = INK; lines.slice(0, 2).forEach((t, j) => c.fillText(t, x + 24, y + 32 + j * 23, lw));
        const ry = y + 32 + Math.min(lines.length, 2) * 23 + 4;
        c.fillStyle = MUT; font('400', 17); c.fillText('Bình thường: ' + rvRange(D.ref) + (u === '°' ? '°' : ' ' + u) + (D.ref.tam ? ' (tạm)' : ''), x + 24, ry, CW - 40);
        let px = x + 24;
        const num = (v, dot) => {
          const ok = !D.redo && rvOk(v), lc = ok ? rvCol(RV_LV[lvLevel(k, v)].cls) : '#8A97A1';
          if (dot) { c.fillStyle = dot; c.beginPath(); c.arc(px + 7, y + CH - 24, 7, 0, 7); c.fill(); px += 20; }
          const t = ok ? rvNum(v, u) + (u === '°' ? '°' : '') : '–'; c.fillStyle = lc; font('800', dot ? 32 : 36); c.fillText(t, px, y + CH - 12); px += c.measureText(t).width + 4;
          if (ok && u !== '°') { c.fillStyle = MUT; font('600', 17); c.fillText(u, px, y + CH - 12); px += c.measureText(u).width; }
          px += 22;
        };
        for (const l of D.legs) { c.globalAlpha = l.dim ? 0.4 : 1; num(l.v, D.common ? null : l.s === 'L' ? BLUE : ORANGE); }
        c.globalAlpha = 1;
      });
      c.fillStyle = MUT; font('400', 20);
      c.fillText('Sàng lọc 2D bằng AI, chỉ mang tính tham khảo, không thay thế khám lâm sàng. Ngưỡng là tham khảo. Số mờ: chân chưa đủ tin cậy. Chấm xanh = chân trái, cam = chân phải.', 48, 1056, 1824);
      return;
    }

    // ---- tầng 1: tên, điểm tổng, hạng (đo cả hai góc: tổng = trung bình 50/50, ghi thêm điểm từng góc) ----
    card(48, 124, 600, 592);
    c.fillStyle = INK; fit(sub.name, '700', 60, 36, 536); c.fillText(sub.name, 80, 246, 536);
    c.fillStyle = MUT; font('400', 26);
    c.fillText('Cao ' + sub.height + ' cm  ·  ' + (hasSide ? ((R.speed || App.SPEED) * 3.6).toFixed(0) + ' km/h' : 'quay góc sau lưng'), 80, 290);
    font('700', 26); c.fillText('ĐIỂM DÁNG CHẠY', 80, 356);
    const tt = sc.total != null ? tierOf(sc.total) : unscored(sc);
    c.fillStyle = sc.total != null ? tt.col : '#8A97A1'; font('700', 220); const st = sc.total != null ? String(sc.total) : '–';
    c.fillText(st, 72, 538); const nw = c.measureText(st).width;
    if (sc.total != null) { c.fillStyle = '#7A8791'; font('700', 52); c.fillText('/100', 84 + nw, 538); }
    pill(tt.label, 80, 562, 68, tt.col, '#fff', 36);
    if (sc.side && sc.back) {   // điểm riêng từng góc (chỉ khi góc sau được tính điểm, Angle.BACK_ENABLED)
      let px = 80; const seg = (txt, col, w) => { c.fillStyle = col; font(w, 28); c.fillText(txt, px, 690); px += c.measureText(txt).width; };
      const one = (lb, o) => { const v = o ? o.total : null; seg(lb, MUT, '600'); seg(v != null ? String(v) : '–', v != null ? scoreCol(v) : '#8A97A1', '700'); };
      one('Góc ngang ', sc.side); seg('   ·   ', MUT, '600'); one('Góc sau ', sc.back);
    }

    // ---- tầng 2: ảnh từng góc, điểm từng chân bên dưới ----
    const scoreRow = (s, x, y, w) => {   // điểm một chân: số lớn + /100 + hạng (hạng co chữ nếu thẻ hẹp)
      const v = sc[s];
      if (v == null) { c.fillStyle = '#8A97A1'; font('600', 28); c.fillText((R.res && R.res[s]) || (R.back && R.back.per && R.back.per[s]) ? 'Chưa đủ tin cậy' : 'Không đo được chân này', x + 30, y - 8, w - 60); return; }
      c.fillStyle = scoreCol(v); font('700', 72); c.fillText(String(v), x + 28, y); const w2 = c.measureText(String(v)).width;
      c.fillStyle = '#7A8791'; font('700', 30); c.fillText('/100', x + 36 + w2, y); const end = x + 36 + w2 + c.measureText('/100').width;
      const lb = tierOf(v).label, avail = x + w - 28 - end - 16;
      c.fillStyle = scoreCol(v); fit(lb, '700', 30, 20, avail); c.textAlign = 'right'; c.fillText(lb, x + w - 28, y, avail); c.textAlign = 'left';
    };
    const legHead = (s, x, y) => {
      c.fillStyle = s === 'L' ? BLUE : ORANGE; c.beginPath(); c.arc(x + 40, y - 9, 11, 0, 7); c.fill();
      c.fillStyle = MUT; font('700', 26); c.fillText('ĐIỂM CHÂN ' + (s === 'L' ? 'TRÁI' : 'PHẢI'), x + 62, y);
    };
    if (hasSide) {
      const w = both ? 381 : 584;
      [['L', 680], ['R', both ? 1085 : 1288]].forEach(([s, x]) => {
        card(x, 124, w, 592);   // một khối liền: ảnh (bo góc trên) + thẻ điểm (bo góc dưới), chung viền và bóng
        drawPhoto(c, ph[s], s, x, 124, w, 438, R, true);
        legHead(s, x, 623); scoreRow(s, x, 698, w);
      });
    }
    if (both) {   // khối Nhìn từ sau: ảnh sau lưng + 3 chỉ số sau (chấm xanh = trái, cam = phải)
      const x = 1490, w = 382;
      card(x, 124, w, 592); drawBackPhoto(c, ph.B, x, 124, w, 438, true);
      LV_CARDS_BACK.forEach(([k, t], i) => {
        const y = 606 + i * 42; let px = x + 168;
        c.fillStyle = MUT; font('600', 24); c.fillText(t, x + 28, y, 132);
        const vals = LV_PERLEG_BACK.includes(k) ? ['L', 'R'].map((sd) => [sd, R.back.per && R.back.per[sd] ? R.back.per[sd][k] : NaN]) : [[null, R.back.common ? R.back.common[k] : NaN]];
        for (const [sd, v] of vals) {
          if (sd) { c.fillStyle = sd === 'L' ? BLUE : ORANGE; c.beginPath(); c.arc(px + 7, y - 8, 7, 0, 7); c.fill(); px += 20; }
          const si = statInfo(k, v), txt = f1(v) + '°'; c.fillStyle = si ? si.col : '#8A97A1'; font('700', 24); c.fillText(txt, px, y); px += c.measureText(txt).width + 22;
        }
      });
    } else if (hasBack) {   // chỉ góc sau: ảnh sau lưng + thẻ điểm hai chân
      card(680, 124, 584, 592); drawBackPhoto(c, ph.B, 680, 124, 584, 592);
      card(1288, 124, 584, 592);
      ['L', 'R'].forEach((s, i) => { legHead(s, 1288, 200 + i * 200); scoreRow(s, 1288, 290 + i * 200, 584); });
      c.fillStyle = MUT; font('400', 24); wrap(c, 'Chưa quay góc ngang nên chưa có nhịp chạy, gối và hông.', 1318, 640, 524, 32);
    }

    // ---- tầng 3: 3 chỉ số chính + 1 thẻ việc nên cải thiện / ghi chú ----
    let cardFlags = false;   // có thẻ mang cờ tin cậy (để ghi chú ở chân ảnh)
    const metricCard = (k, lb, unit, i, v, fmt) => {
      const x = 48 + i * 444, y = 740, w = 420, h = 260, q = v == null ? { ok: true, txt: '' } : rating(k, v);
      const col = v == null ? '#8A97A1' : q.ok ? GREEN : AMBER;
      card(x, y, w, h); c.fillStyle = col; rr(c, x, y, 12, h, 6); c.fill();
      c.fillStyle = MUT; font('700', 30); c.fillText(lb, x + 36, y + 46, w - 60);
      const val = v == null ? '–' : fmt(v), fl = v == null ? [] : flagItems(R, k, Gait.COMMON.includes(k)), dim = fl.some((it) => it.kind !== 'note'); if (dim) cardFlags = true;
      c.fillStyle = col; font('700', 96); c.fillText(val, x + 34, y + 136); const vw = c.measureText(val).width;
      c.fillStyle = MUT; font('600', 30); c.fillText(unit, x + 44 + vw, y + 136);
      if (k === 'cadence' && cadLow(R)) { c.fillStyle = AMBER; font('700', 30); c.fillText('Cần đo lại', x + 36, y + 190, w - 60); }   // số bị ẩn vì nghi đo thiếu bước
      if (v == null) return;   // không đo được: không chip, không thanh, không chấm
      if (dim) c.globalAlpha = 0.5;   // có cờ tin cậy: chip + thanh + chấm mờ, khớp bảng Chi tiết
      const pw = pill(q.ok ? 'Tốt' : q.txt === 'cao' ? 'Cao' : 'Thấp', x + 36, y + 148, 42, q.ok ? '#E3F1DC' : '#FBEBCF', col, 26);
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
      c.save(); c.shadowColor = 'rgba(31,77,43,.35)'; c.shadowBlur = 6; c.shadowOffsetY = 2;
      c.fillStyle = '#fff'; c.beginPath(); c.arc(dx, dy, 17, 0, 7); c.fill(); c.restore();
      c.fillStyle = col; c.beginPath(); c.arc(dx, dy, 11, 0, 7); c.fill();
      c.globalAlpha = 1;
      fl.slice(0, 2).forEach((it, j) => { c.fillStyle = AMBER; font('600', 22); c.fillText(it.short, x + 36, y + 228 + j * 24, w - 60); });
    };
    const tipCard = (head, col, text) => {
      card(1380, 740, 492, 260); c.fillStyle = col; rr(c, 1380, 740, 12, 260, 6); c.fill();
      c.fillStyle = col; font('700', 26); c.fillText(head, 1416, 790);
      c.fillStyle = INK; font('700', 28); wrap(c, text, 1416, 836, 428, 36);
      if ((sub.pain || '').trim()) { c.fillStyle = '#C73E2E'; font('600', 24); c.fillText('Có đau khi chạy: nên được bác sĩ khám trực tiếp', 1416, 986, 428); }
    };
    if (hasSide) {
      [['cadence', 'Nhịp chạy', 'bước/phút'], ['overstride', 'Chân đặt trước hông', 'cm'], ['knee_ic', 'Gối lúc chạm đất', '°']]
        .forEach(([k, lb, unit], i) => metricCard(k, lb, unit, i, k === 'cadence' && cadLow(R) ? null : mainVal(R, k), f0));
      tipCard('NÊN CẢI THIỆN', TC.brand, improveTip(R));
    } else {
      LV_CARDS_BACK.forEach(([k, lb, unit], i) => metricCard(k, lb, unit, i, backVal(R.back, k), f1));
      tipCard('GHI CHÚ', AMBER, 'Ngưỡng góc sau lưng đang tạm, chờ bác sĩ duyệt. Quay thêm góc ngang để có đánh giá đầy đủ.');
    }
    c.fillStyle = MUT; font('400', 22);
    c.fillText('Sàng lọc 2D bằng AI, chỉ mang tính tham khảo, không thay thế khám lâm sàng.' + (hasSide ? ' Chân xa camera kém tin cậy hơn.' + (cardFlags && !Score.countLow() ? ' Chân có cờ tin cậy không được tính vào điểm ở chỉ số đó.' : '') : '') + (hasBack ? ' Ngưỡng góc sau lưng đang tạm, chờ bác sĩ duyệt.' : ''), 48, 1052, 1824);
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
  // Cảnh báo 'Khung hình kém' (lý do tính ở analyse.js framePoor). Lần đo side mới: đọc R.q.poor, cùng nguồn với dòng "Chẩn đoán";
  // bản ghi cũ chưa có q.poor và góc sau (không có q) thì tính lại từ R. Trả '' nếu ổn.
  function poorFrameWarn(R) {
    const why = R && R.q && Array.isArray(R.q.poor) ? R.q.poor : framePoor(R);
    return why.length ? 'Khung hình kém: ' + why.join(', ') + '. Thử đo lại: đủ sáng, quay trọn người từ đầu đến chân, mặc quần áo khác màu nền.' : '';
  }
  const EXL = ['contact_ms', 'hip_flex', 'heel_kick', 'arm_swing', 'elbow', 'head_fwd'];
  function detailHTML(R) {
    const keys = ['cadence', 'vert_osc', 'trunk', 'knee_ic', 'shank_ic', 'overstride', 'knee_mid', 'hip_ext', 'knee_swing'];
    const q = R.q ? '<p style="margin:0 0 8px;color:#5B6B77">Chẩn đoán: ' + R.q.fps + ' khung/giây phân tích · nhận diện ' + Math.round(R.q.det * 100) + '% khung hình (' + R.q.frames + ' khung)' + (R.q.slow > 1 ? ' · video quay chậm gấp ' + R.q.slow : '') + (R.q.bad ? ' · <b style="color:#D9503F">KHÔNG ĐÁNG TIN: ' + R.q.why.join('; ') + '</b>' : poorFrameWarn(R) ? ' · <b style="color:' + AMBER + '">chưa đạt: khung hình kém</b>' : ' · đạt kiểm tra độ tin cậy') + '</p>' : '';
    const sc3 = scores(R), d = (v) => (v != null ? v : '–');
    // đo cả hai góc: điểm chung = trung bình 50/50 hai góc, ghi thêm điểm riêng từng góc
    const per = sc3.side && sc3.back ? ' · góc ngang ' + d(sc3.side.total) + ' · góc sau ' + d(sc3.back.total) : '';
    let h = '<p style="margin:0 0 8px;font-weight:700">Điểm: chung ' + d(sc3.total) + ' · trái ' + d(sc3.L) + ' · phải ' + d(sc3.R) + per + ' (/100, tham khảo)</p>' + (poorFrameWarn(R) ? '<p class="poorframe">' + poorFrameWarn(R) + '</p>' : '') + (R.comb ? q : '');
    const head = '<table><tr><th>Chỉ số</th><th>Trái</th><th>Phải</th><th>Tham chiếu</th><th>Đánh giá</th></tr>';
    // một dòng: n = số thực {c | L,R}; a/b = chữ hiện ở cột Trái/Phải; có tham chiếu thì tô màu số, vẽ thanh + chấm, chip Đánh giá
    const row = (label, k, n, a, b) => {
      const num = (txt, v, bold) => { const st = statInfo(k, v); return st ? '<span class="dv" style="color:' + st.col + ';background:' + st.bg + '">' + txt + '</span>' : (bold ? '<b>' + txt + '</b>' : txt); };
      const legs = n.c !== undefined ? [{ s: 'c', v: n.c }] : ['L', 'R'].filter((s) => !Number.isNaN(n[s]) && n[s] != null).map((s) => ({ s, v: n[s] }));
      const chips = legs.map((d) => { const st = statInfo(k, d.v); return st ? '<span class="chip' + (flagged(R, k, d.s) ? ' lowc' : '') + '" style="color:' + st.col + ';background:' + st.bg + '">' + (d.s === 'c' ? '' : (d.s === 'L' ? 'Trái ' : 'Phải ') ) + st.label + '</span>' : ''; }).join('');
      const bar = barHTML(k, legs.map((d) => ({ v: d.v, leg: d.s === 'c' ? null : d.s })), R);
      const src = REF[k] && REF[k].src;   // nguồn tham chiếu, chữ nhỏ dưới tên chỉ số
      return '<tr><td>' + label + (src ? '<div class="hint">' + String(src).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div>' : '') + flagHTML(R, k, n.c !== undefined) + '</td><td>' + (n.c !== undefined ? num(a, n.c, true) : num(a, n.L)) + '</td><td>' + (n.c !== undefined ? b : num(b, n.R)) + '</td><td class="rcell">' + bar + '</td><td>' + chips + '</td></tr>';
    };
    let anyTwo = false;
    if (R.comb) {
      if (R.back) h += '<h3 class="dsec">Nhìn ngang</h3>';
      h += head;
      for (const k of keys) {
        const c = REF[k] || { label: k, unit: '' }, common = Gait.COMMON.includes(k);
        const L = R.res.L ? R.res.L.metrics[k] : NaN, Rr = R.res.R ? R.res.R.metrics[k] : NaN;
        if (!common) anyTwo = true;
        if (k === 'cadence' && cadLow(R)) { h += '<tr><td>' + c.label + ' (' + c.unit + ')</td><td>–</td><td></td><td>' + c.lo + '–' + c.hi + '</td><td><span class="chip" style="color:' + AMBER + ';background:#FBEBCF">Cần đo lại</span></td></tr>'; continue; }
        h += row(c.label + ' (' + c.unit + ')', k, common ? { c: cval(R, k) } : { L, R: Rr }, common ? f1(cval(R, k)) : f1(L), common ? '' : f1(Rr));
      }
      for (const x of extraRows(R)) {
        const lbl = x.label + (x.unit ? ' (' + x.unit + ')' : '');
        if (x.k && x.n.L !== undefined) anyTwo = true;
        h += x.k ? row(lbl, x.k, x.n, x.a, x.b) : '<tr><td>' + lbl + '</td><td>' + x.a + '</td><td>' + x.b + '</td><td></td><td><span class="chip" style="color:' + (x.ok ? GREEN : AMBER) + ';background:' + (x.ok ? '#E3F1DC' : '#FBEBCF') + '">' + x.st + '</span></td></tr>';
      }
      for (const s of ['L', 'R']) if (R.res[s]) h += '<tr><td>Chân ' + (s === 'L' ? 'trái' : 'phải') + ': số bước · độ tin cậy</td><td colspan="4">' + R.res[s].extra.nSteps + ' bước · vis ' + R.res[s].extra.vis.toFixed(2) + (R.res[s].extra.vis < Gait.VIS_MIN ? ' (thấp)' : '') + '</td></tr>';
      h += '</table>';
    }
    if (R.back) {   // khối Nhìn từ sau: chỉ số từng chân + chỉ số chung; ngưỡng đang tạm
      const B = R.back, perK = Score.BACK_PERLEG;
      h += '<h3 class="dsec">Nhìn từ sau <span class="dtemp">ngưỡng góc sau đang tạm, chờ bác sĩ duyệt</span></h3>' + head;
      for (const k of BACK_DETAIL) {
        const c = REF[k] || { label: k, unit: '' }, lbl = c.label + ' (' + c.unit + ')';
        if (perK.includes(k)) {
          const L = B.per && B.per.L ? B.per.L[k] : NaN, Rr = B.per && B.per.R ? B.per.R[k] : NaN;
          anyTwo = true; h += row(lbl, k, { L, R: Rr }, f1(L), f1(Rr));
        } else { const v = B.common ? B.common[k] : NaN; h += row(lbl, k, { c: v }, f1(v), ''); }
      }
      const errs = B.errs ? Object.values(B.errs).filter(Boolean) : [];
      if (errs.length) h += '<tr><td>Lưu ý</td><td colspan="4">' + errs.join('; ') + '</td></tr>';
      h += '</table>';
    }
    const anyFlag = R.comb && [...keys, ...extraRows(R).map((x) => x.k).filter(Boolean)].some((k) => flagList(R, k).length);
    if (anyFlag) h += '<p class="rleg">' + SPREAD_TIP + (Score.countLow() ? '' : ' Chỉ số có cờ không được tính vào điểm; chip và chấm của chỉ số đó được làm mờ.') + '</p>';
    return h + (anyTwo ? '<p class="rleg"><b class="rdot L"></b> chân trái · <b class="rdot R"></b> chân phải · chấm tô màu theo đánh giá (xanh = tốt, vàng = thấp/cao) · thanh xám = ngoài khoảng bình thường</p>' : '');
  }
  // Chi tiết là một "màn" riêng: mở thì ẩn ảnh tổng quan, nút đổi thành "Tổng quan" để quay về
  function setDetail(open) {
    const d = $('detail'), b = $('tgdetail'), box = $('resbox'), rv = $('rview');
    d.style.display = open ? 'block' : 'none';
    if (box) box.style.display = open ? 'none' : '';
    if (rv) rv.style.display = open ? 'none' : '';
    $('l3cta').style.display = open ? 'none' : '';
    b.textContent = open ? 'Tổng quan' : 'Chi tiết (bác sĩ)';
    const sc = d.parentElement; if (sc) sc.scrollTop = 0; window.scrollTo(0, 0);
  }
  function resetDetail(R) { $('detail').innerHTML = detailHTML(R); setDetail(false); }

  Object.assign(App, { EXL });
})(window.App);
