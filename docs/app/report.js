/* app/report.js - vẽ ảnh người chạy, điểm, kết luận, bài tập, khối đo lại. Một phần của app cũ; cách chia sẻ biến xem đầu app/core.js. */
(function (App) {
  'use strict';
  const { $, REF, CAD_REDO, BLUE, ORANGE, GREEN, AMBER, TIER_RED, LINKS, S, show, refreshL1, rating, f1, f0,
    excluded, legName, legNote, cval, cadLow, cvals } = App;
  // hàm của file này (khai báo function được nâng lên đầu nên đưa ra ngay)
  Object.assign(App, { rr, drawPhoto, scores, exercises, conclusion, improveTip, renderRedo });
  // ---------- Vẽ ảnh kết quả ----------
  // r: số (bo đều) hoặc [trên-trái, trên-phải, dưới-phải, dưới-trái]
  function rr(c, x, y, w, h, r) { const [a, b, d, e] = Array.isArray(r) ? r : [r, r, r, r]; c.beginPath(); c.moveTo(x + a, y); c.arcTo(x + w, y, x + w, y + h, b); c.arcTo(x + w, y + h, x, y + h, d); c.arcTo(x, y + h, x, y, e); c.arcTo(x, y, x + w, y, a); c.closePath(); }

  function drawPhoto(c, ph, side, x, y, w, h, R, flatBottom, noLabel, fit, neutral) {   // neutral: không tô màu mức (ảnh nhỏ #rview, bác sĩ 15/11/2026: không kết luận từng chỉ số)
    // fit: kẹp nhãn Gối/cm nằm trọn trong ảnh (ảnh nhỏ ở #res); flatBottom: đáy vuông để dính liền thẻ điểm bên dưới; noLabel: bỏ nhãn chân (ảnh nhỏ #rview có nhãn HTML riêng)
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
      const pill = (txt, px, py, bg) => { c.font = '700 28px ' + Themes.font; const tw = c.measureText(txt).width + 30; if (fit) { px = Math.min(Math.max(px, x + tw / 2 + 6), x + w - tw / 2 - 6); py = Math.min(Math.max(py, y + 30), y + h - 30); } c.fillStyle = bg; rr(c, px - tw / 2, py - 24, tw, 48, 24); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, px, py + 1); c.textAlign = 'left'; c.textBaseline = 'alphabetic'; };
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
        c.lineWidth = 5; c.strokeStyle = !neutral && mm.overstride > (REF.overstride ? REF.overstride.hi : 99) ? '#FFB84D' : '#5EE6B8';
        c.beginPath(); c.moveTo(Hh[0], by); c.lineTo(Aa[0], by); c.stroke();
        c.beginPath(); c.moveTo(Aa[0], by - 12); c.lineTo(Aa[0], by + 12); c.stroke();
        pill(f0(Math.abs(mm.overstride)) + ' cm', (Hh[0] + Aa[0]) / 2, by + 38, 'rgba(14,36,51,.85)');
      }
    } else {
      c.fillStyle = '#8FA3AE'; c.font = '28px ' + Themes.font; c.textAlign = 'center';
      c.fillText('Chưa bắt được khung chạm đất', x + w / 2, y + h / 2); c.textAlign = 'left';
    }
    c.restore();
    if (noLabel) return;
    // nhãn
    c.fillStyle = col; rr(c, x + 18, y + 16, 190, 46, 23); c.fill();
    c.fillStyle = '#fff'; c.font = '700 26px ' + Themes.font; c.textBaseline = 'middle';
    c.fillText(side === 'L' ? 'Chân trái' : 'Chân phải', x + 38, y + 40);
    c.textBaseline = 'alphabetic';
  }

  function cardData(R) {
    const cm = cvals(R), r = R.res;
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
  // kết luận + lời khuyên theo quy tắc đơn giản (bác sĩ nên rà lại nội dung)
  // ---------- Điểm dáng chạy (0-100) và bài tập gợi ý ----------
  // Logic điểm nằm ở score.js (window.Score): mỗi chỉ số 100 nếu trong khoảng bình thường, giảm dần theo độ lệch.
  // Chỉ đo 1 góc: điểm của góc đó. Đo cả 2 góc: trái/phải/tổng = trung bình 50/50 hai góc (Score.combine).
  const mScore = Score.mScore;
  function scores(R) {
    const side = R && R.comb ? Score.side(R) : null;
    const back = R && R.back ? Score.back(R.back) : null;
    return Score.combine({ side, back });
  }
  // Hạng theo điểm tổng: mốc và tên hạng ở score.js (Score.TIERS, Score.tierOf; bác sĩ duyệt 15/11/2026, 6A).
  // Ở đây chỉ gán màu theo key: Tốt xanh, Khá xanh nhạt, Cần cải thiện vàng, Nguy cơ đỏ (màu theo :root --teal, --teal2, --amber, --red).
  // Màu điểm (scoreCol), huy hiệu ảnh kết quả, câu giải thích PDF trang 4, cột Sheet "Hạng" đều đọc qua tierOf này.
  const TIER_COL = { good: GREEN, fair: '#3E9A4F', improve: AMBER, risk: TIER_RED };
  const TIER_CLS = { good: 'ok', fair: 'ok', improve: 'mid', risk: 'bad' };   // lớp màu ở thẻ HTML (cùng bộ ok/mid/bad của chỉ số)
  const tierOf = (v) => { const t = Score.tierOf(v == null || v === '' ? null : +v); return t && { key: t.key, min: t.min, name: t.label, label: t.label.toUpperCase(), col: TIER_COL[t.key], cls: TIER_CLS[t.key] }; };
  const scoreCol = (v) => { const t = tierOf(v); return t ? t.col : '#8A97A1'; };
  const tierText = () => Score.TIERS.map((t, i, T) => (i === 0 ? t.min + '+ ' : t.min === 0 ? 'dưới ' + T[i - 1].min + ' ' : t.min + '–' + (T[i - 1].min - 1) + ' ') + t.label.toLowerCase()).join(', ');
  // Lý do chốt trần (agg của Score.side): một câu ngắn; không chốt thì ''.
  const capWhy = (a) => (!a || a.score == null || a.raw == null || a.cap >= 100 || Math.round(a.raw) <= a.cap ? ''
    : 'Điểm tối đa ' + a.cap + ' vì ' + (a.nBad ? a.nBad + ' chỉ số chính ở mức bất thường' : (a.nBad + a.nMid) + ' chỉ số chính ở mức chú ý') + ' (chưa chốt: ' + Math.round(a.raw) + ').');
  // Nhãn khi chưa có điểm tổng: góc ngang thiếu nhiều chỉ số (Score.side insufficient) / bản lưu cũ chỉ có góc sau (góc sau đang tạm ẩn) / còn lại.
  const unscored = (sc) => ({ label: sc && sc.side && sc.side.insufficient ? 'KHÔNG ĐỦ DỮ LIỆU ĐỂ CHẤM' : sc && !sc.side ? 'CHƯA CHẤM' : 'CHƯA ĐỦ TIN CẬY', col: AMBER });
  // Dòng điểm nhóm gọn (Score.side groups), vd "Tiếp đất & nhịp 82 · Hông 64"; nhóm không đủ số thì '–'.
  const groupLine = (sd) => (sd && sd.groups ? sd.groups.map((g) => g.label + ' ' + (g.score != null ? Math.round(g.score) : '–')).join(' · ') : '');
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
    const out = [], seen = new Set(), push = (key, why, mk) => { if (EXER[key] && !seen.has(key)) { seen.add(key); out.push({ key, t: EXER[key][0], h: EXER[key][1], why: why + (mk ? legNote(R, mk) : ''), note: mk ? legNote(R, mk) : '' }); } };
    const cm = { cadence: Score.commonVal(R, 'cadence'), vert_osc: Score.commonVal(R, 'vert_osc'), trunk: Score.commonVal(R, 'trunk') }, rs = (k, v) => (excluded(R, k) ? '' : rating(k, v).txt);
    const avg = (k) => { const v = Score.usableLegs(R, k).map((s) => R.res[s].metrics[k]); return v.reduce((x, y) => x + y, 0) / v.length; };   // chỉ lấy chân đủ tin cậy
    if (rs('cadence', cm.cadence) === 'thấp') push('cadence_low', 'Nhịp chạy ' + f0(cm.cadence) + ' bước/phút, thấp hơn khoảng bình thường', 'cadence');
    if (rs('overstride', avg('overstride')) === 'cao') push('overstride_high', 'Chân đặt trước hông ' + f0(avg('overstride')) + ' cm, xa hơn bình thường', 'overstride');
    if (rs('vert_osc', cm.vert_osc) === 'cao') push('vert_osc_high', 'Nảy lên xuống ' + f1(cm.vert_osc) + ' cm, cao hơn bình thường', 'vert_osc');
    if (rs('trunk', cm.trunk) === 'thấp') push('trunk_low', 'Thân nghiêng ' + f1(cm.trunk) + '°, thẳng hơn bình thường', 'trunk');
    if (rs('trunk', cm.trunk) === 'cao') push('trunk_high', 'Thân nghiêng ' + f1(cm.trunk) + '°, gập nhiều hơn bình thường', 'trunk');
    const kn = avg('knee_ic'); if (rs('knee_ic', kn) === 'thấp') push('knee_ic_low', 'Gối gập ' + f0(kn) + '° lúc chạm đất, gần thẳng', 'knee_ic'); else if (rs('knee_ic', kn) === 'cao') push('knee_ic_high', 'Gối gập ' + f0(kn) + '° lúc chạm đất, nhiều hơn bình thường', 'knee_ic');
    if (rs('hip_ext', avg('hip_ext')) === 'thấp') push('hip_ext_low', 'Duỗi hông ' + f0(avg('hip_ext')) + '°, hạn chế', 'hip_ext');
    if (rs('knee_mid', avg('knee_mid')) === 'thấp') push('knee_mid_low', 'Gối gập tối đa lúc đứng ' + f0(avg('knee_mid')) + '°, ít hơn bình thường', 'knee_mid');
    if (rs('knee_swing', avg('knee_swing')) === 'thấp') push('knee_swing_low', 'Gối gập tối đa lúc đưa chân ' + f0(avg('knee_swing')) + '°, thấp hơn bình thường', 'knee_swing');
    if (R.res.L && R.res.R && ['knee_ic', 'overstride'].some((k) => Score.usableLegs(R, k).length === 2 && Math.abs(R.res.L.metrics[k] - R.res.R.metrics[k]) >= Gait.ASYM[k])) push('asym', 'Hai chân khác nhau rõ ở gối hoặc vị trí đặt chân');
    return out;
  }
  const OK_PARTIAL = (n) => 'Các chỉ số đủ tin cậy nằm trong khoảng bình thường (' + n + ' chỉ số có cờ tin cậy, không đưa vào kết luận).';
  function conclusion(R) {
    if (R.q && R.q.bad) return { text: 'Chưa đủ tin cậy để kết luận.', adv: ['Lý do: ' + R.q.why.join('; ') + '.', 'Hãy đo lại: camera đặt ngang vuông góc, thấy cả người từ đầu đến chân, đủ sáng, và dòng "Nhận diện … khung/giây" khi đo nên từ 20 trở lên.'], bad: 1, unreliable: true };
    const cm = { cadence: Score.commonVal(R, 'cadence'), vert_osc: Score.commonVal(R, 'vert_osc'), trunk: Score.commonVal(R, 'trunk') }, r = R.res, flags = [], adv = [];
    const avg = (k) => { const v = Score.usableLegs(R, k).map((s) => r[s].metrics[k]); return v.reduce((a, b) => a + b, 0) / v.length; };
    const rt = (k, v) => (excluded(R, k) ? '' : rating(k, v).txt);   // chỉ số có cờ: không đưa vào kết luận/lời khuyên
    const st = { cadence: rt('cadence', cm.cadence), vert_osc: rt('vert_osc', cm.vert_osc), trunk: rt('trunk', cm.trunk), overstride: rt('overstride', avg('overstride')), knee_ic: rt('knee_ic', avg('knee_ic')) };
    const target = Math.min(180, Math.round((cm.cadence != null ? cm.cadence : R.comb.common.cadence) * 1.05));
    if (st.cadence === 'thấp') { flags.push('nhịp chạy chậm'); }
    if (st.overstride === 'cao') flags.push('đặt chân xa trước hông');
    if (st.vert_osc === 'cao') flags.push('nảy lên xuống nhiều');
    if (st.trunk === 'thấp') flags.push('thân quá thẳng hoặc ngả sau'); else if (st.trunk === 'cao') flags.push('thân gập trước nhiều');
    if (st.knee_ic === 'cao') flags.push('gối gập nhiều lúc chạm đất'); else if (st.knee_ic === 'thấp') flags.push('gối gần thẳng lúc chạm đất');
    const asy = []; for (const k of ['knee_ic', 'overstride']) if (Score.usableLegs(R, k).length === 2 && r.L && r.R && Math.abs(r.L.metrics[k] - r.R.metrics[k]) >= Gait.ASYM[k]) asy.push(k);
    if (asy.length) flags.push('hai chân không đều');
    const part = ['L', 'R'].map((miss) => {   // gom một câu theo chân: "Chân trái chưa đủ tin cậy: N chỉ số dựa trên chân phải"
      const n = ['cadence', 'vert_osc', 'trunk', 'overstride', 'knee_ic'].filter((k) => { const u = Score.usableLegs(R, k); return u.length === 1 && u[0] !== miss && R.res[miss]; }).length;
      return n ? 'Chân ' + legName(miss) + ' chưa đủ tin cậy: ' + n + ' chỉ số dựa trên chân ' + legName(miss === 'L' ? 'R' : 'L') : '';
    }).filter(Boolean).join('; ');
    const nEx = ['cadence', 'vert_osc', 'trunk', 'overstride', 'knee_ic'].filter((k) => excluded(R, k)).length;   // chỉ số có cờ bị bỏ: không khẳng định "tốt" cho chúng
    const text = flags.length ? 'Cần chỉnh: ' + flags.join('; ') + '.' : nEx ? OK_PARTIAL(nEx) : 'Dáng chạy tốt: các chỉ số chính nằm trong khoảng bình thường.';
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
    if (part) out.push('Lưu ý: ' + part + '.');
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
  const legVals = (R, k) => { const u = Score.usableLegs(R, k); return (u.length ? u : ['L', 'R'].filter((s) => R.res[s])).map((s) => R.res[s].metrics[k]); };   // chỉ lấy chân dùng được (cùng số với điểm); không chân nào thì lấy cả hai, thẻ mờ
  const mainVal = (R, k) => { const v = Gait.COMMON.includes(k) ? [cval(R, k)] : legVals(R, k), a = v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; return a == null || Number.isNaN(a) ? null : a; };   // NaN = không đo được: hiện "–", không gắn nhãn
  // Chỉ số góc sau: chỉ số từng chân lấy trung bình hai chân (như mainVal), chỉ số chung lấy thẳng
  const backVal = (B, k) => { const v = Score.BACK_PERLEG.includes(k) ? ['L', 'R'].filter((s) => B.per && B.per[s]).map((s) => B.per[s][k]) : [B.common ? B.common[k] : null]; const ok = v.filter((x) => x != null && !Number.isNaN(x)); return ok.length ? ok.reduce((x, y) => x + y, 0) / ok.length : null; };
  function improveTip(R) {
    if (R.q && R.q.bad) return 'Đo lại với camera đặt ngang, thấy rõ cả người để có kết quả chính xác hơn';
    const ex = exercises(R), k = ex.length ? ex[0].key : null;
    if (k === 'cadence_low') return 'Tăng nhịp lên khoảng ' + Math.min(180, Math.round(Score.commonVal(R, 'cadence') * 1.05)) + ' bước/phút sẽ giúp chạy nhẹ nhàng hơn';
    if (k) return IMPROVE[k] + ex[0].note;
    return 'Giữ phong độ này! Tập sức mạnh 2 buổi mỗi tuần và đo lại sau 4–6 tuần';
  }
  // Khối "Đề nghị đo lại" (đầu màn kết quả) khi nhịp bước dưới CAD_REDO; khuyến cáo của bác sĩ
  function renderRedo(R) {
    let box = $('redo');
    if (!box) {
      box = document.createElement('section'); box.id = 'redo'; box.className = 'redo';
      const rb = $('resbox'); rb.parentNode.insertBefore(box, rb);
    }
    const low = cadLow(R);
    box.hidden = !low;
    if (!low) { box.innerHTML = ''; return; }
    const g = (t, items) => '<div class="redog"><h4>' + t + '</h4><ul>' + items.map((x) => '<li>' + x + '</li>').join('') + '</ul></div>';
    box.innerHTML = '<h3>Đề nghị đo lại</h3>' +
      '<p>Nhịp bước đo được thấp bất thường (dưới ' + CAD_REDO + ' bước/phút), có thể do máy không nhìn rõ chân bên xa nên đếm thiếu bước. Vì vậy kết quả chưa ghi số nhịp bước. Bạn nên đo lại theo các khuyến cáo sau.</p>' +
      '<div class="redogs">' +
      g('Trang phục', ['Mặc đồ ôm, quần ngắn hoặc quần bó để thấy rõ đầu gối và cổ chân.', 'Màu quần áo tương phản với nền và với thảm chạy.', 'Giày khác màu với sàn và mặt băng tải.']) +
      g('Ánh sáng', ['Đủ sáng.', 'Ánh sáng chiếu từ phía trước hoặc bên hông.', 'Không ngược sáng (không để cửa sổ sau lưng người chạy).', 'Tránh bóng đổ.']) +
      g('Đặt máy', ['Đặt máy ngang tầm hông, vuông góc với hướng chạy, cách 2–3 m.', 'Thấy toàn thân từ đầu đến chân.', 'Thanh tay vịn của thảm chạy không che bàn chân.', 'Máy cố định, không rung.']) +
      g('Kiểm tra tốc độ máy chạy', ['Chạy ổn định ít nhất 30 giây rồi mới quay.', 'So tốc độ hiển thị trên máy chạy với tốc độ đã nhập.', 'Đếm bước trong 15 giây, lặp 4 lần, rồi đem so với kết quả.']) +
      '</div><button type="button" class="btn redo-btn" id="redoBtn">Đo lại</button>';
    $('redoBtn').onclick = () => { S.result = null; show('L1'); refreshL1(); $('msg1').textContent = ''; };
  }
  Object.assign(App, { mScore, tierOf, scoreCol, tierText, capWhy, unscored, groupLine, mainVal, backVal });
})(window.App);
