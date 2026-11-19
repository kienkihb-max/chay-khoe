/* app/pdf.js - các trang PDF trả khách. Một phần của app cũ; cách chia sẻ biến xem đầu app/core.js. */
(function (App) {
  'use strict';
  const { $, CONTACT, REF, BACK_DETAIL, GREEN, AMBER, TC, S, rating, f1, f0, cval, cadLow, cvals, rr, scores,
    scoreCol, tierText, exercises, conclusion, pdfPage1, extraRows, drawBackPhoto } = App;
  // hàm của file này (khai báo function được nâng lên đầu nên đưa ra ngay)
  Object.assign(App, { wrap, makePdf, pdfPages: (R) => [drawPage2(R), ...drawPage3(R), drawPage4(R)] });
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
    const words = (window.I18N ? I18N.t(text) : text).split(' '); let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (c.measureText(t).width > maxW && line) { c.fillText(line, x, y); y += lh; line = w; } else line = t;
    }
    if (line) { c.fillText(line, x, y); y += lh; }
    return y;
  }
  function drawPage2(R) {
    const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080;
    const c = cv.getContext('2d'), FF = Themes.font;
    c.fillStyle = '#fff'; c.fillRect(0, 0, 1920, 1080);
    const g = c.createLinearGradient(0, 0, 1920, 0); g.addColorStop(0, TC.brand); g.addColorStop(1, TC.brand2);
    c.fillStyle = g; c.fillRect(0, 0, 1920, 110);
    c.fillStyle = '#fff'; c.font = '700 40px ' + FF; c.fillText('Ý nghĩa các chỉ số của bạn', 48, 66);
    c.textAlign = 'right'; c.fillStyle = '#fff'; c.font = '700 24px ' + FF; c.fillText('Hanoi Running Lab', 1872, 52);
    c.fillStyle = TC.soft; c.font = '19px ' + FF; c.fillText(R.sub.name, 1872, 84); c.textAlign = 'left';
    const rows = [
      { k: 'cadence', t: 'Cadence (nhịp chạy)' }, { k: 'vert_osc', t: 'Nhấp nhô' }, { k: 'trunk', t: 'Nghiêng thân' },
      { k: 'overstride', t: 'Tiếp đất trước thân', per: true }, { k: 'knee_ic', t: 'Gập gối lúc chạm đất', per: true }, { k: 'strike', t: 'Kiểu tiếp đất', per: true },
    ];
    const cm = cvals(R), r = R.res;
    const f = (k, v) => (k === 'cadence' ? f0(v) : k === 'knee_ic' || k === 'trunk' ? (k === 'knee_ic' ? f0(v) : f1(v)) : f1(v));
    const unit = (k) => (REF[k] ? REF[k].unit : '');
    let y = 140; const rh = 128;
    rows.forEach((row, i) => {
      const yy = y + i * rh;
      c.fillStyle = i % 2 ? '#fff' : TC.pale; c.fillRect(48, yy, 1824, rh - 8);
      c.fillStyle = '#14202B'; c.font = '700 26px ' + FF; c.fillText(row.t, 68, yy + 40);
      c.fillStyle = '#5B6B77'; c.font = '21px ' + FF; wrap(c, MEANING[row.k], 68, yy + 74, 820, 28);
      // giá trị + đánh giá (cột phải)
      let val = '', st = [], ok = true;
      if (row.k === 'cadence' && cadLow(R)) { val = '– (cần đo lại)'; ok = false; st.push({ t: 'Cần đo lại', ok: false, k: row.k }); }
      else if (!row.per) { const q = rating(row.k, cm[row.k]); val = f(row.k, cm[row.k]) + ' ' + unit(row.k); ok = q.ok; st.push({ t: q.txt, ok: q.ok, k: row.k }); }
      else if (row.k === 'strike') { val = ['L', 'R'].map((s) => (r[s] ? (s === 'L' ? 'Trái: ' : 'Phải: ') + r[s].extra.strike : '')).filter(Boolean).join('   '); }
      else { val = ['L', 'R'].map((s) => (r[s] ? (s === 'L' ? 'Trái ' : 'Phải ') + f(row.k, r[s].metrics[row.k]) : '')).filter(Boolean).join('   ') + ' ' + unit(row.k); ['L', 'R'].forEach((s) => { if (r[s]) { const q = rating(row.k, r[s].metrics[row.k]); st.push({ t: q.txt, ok: q.ok, k: row.k, s }); if (!q.ok) ok = false; } }); }
      c.fillStyle = ok ? GREEN : AMBER; c.font = '700 30px ' + FF; c.fillText(val, 940, yy + 38, 920);
      // khoảng bình thường
      c.fillStyle = '#14202B'; c.font = '600 20px ' + FF;
      if (REF[row.k] && row.k !== 'strike') c.fillText('Khoảng bình thường: ' + REF[row.k].lo + '–' + REF[row.k].hi + ' ' + unit(row.k), 940, yy + 66, 920);
      else c.fillText('Khoảng bình thường: cả ba kiểu đều có thể gặp ở người chạy khỏe', 940, yy + 66, 920);
      if (REF[row.k] && row.k !== 'strike') {
        const bad = st.find((q) => !q.ok);
        const msg = !bad ? 'Chỉ số của bạn nằm trong khoảng bình thường.' : bad.t === 'Cần đo lại' ? 'Nhịp bước đo được thấp bất thường (có thể máy không thấy rõ chân bên xa), nên chưa ghi số. Hãy đo lại theo khuyến cáo.' : (bad.t === 'thấp' ? REF[row.k].low : REF[row.k].high) || 'Chỉ số ngoài khoảng bình thường.';
        c.font = '19px ' + FF; c.fillStyle = ok ? '#4a5a65' : '#8a5a10'; wrap(c, msg, 940, yy + 92, 920, 23);
      }
    });
    // ghi chú bác sĩ
    const note = ($('note').value || '').trim();
    const ny = y + rows.length * rh + 6;
    c.fillStyle = TC.soft; rr(c, 48, ny, 1824, 118, 14); c.fill();
    c.fillStyle = TC.brand; c.font = '700 20px ' + FF; c.fillText('NHẬN XÉT CỦA BÁC SĨ', 72, ny + 34);
    c.fillStyle = '#14202B'; c.font = '24px ' + FF;
    if (note) wrap(c, note, 72, ny + 70, 1780, 30);
    c.fillStyle = '#7A8791'; c.font = '17px ' + FF;
    c.fillText('Kết quả sàng lọc 2D bằng AI trong 15 giây chạy, chỉ mang tính tham khảo, không thay thế khám và chẩn đoán lâm sàng. Nếu đang đau hoặc chấn thương, hãy gặp bác sĩ.', 48, 1040, 1824);
    c.textAlign = 'right'; c.fillStyle = TC.brand; c.font = '700 20px ' + FF; c.fillText('Liên hệ: ' + CONTACT, 1872, 1068); c.textAlign = 'left';
    return cv;
  }
  function drawPage3(R) {
    const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080;
    const c = cv.getContext('2d'), FF = Themes.font;
    c.fillStyle = '#fff'; c.fillRect(0, 0, 1920, 1080);
    const g = c.createLinearGradient(0, 0, 1920, 0); g.addColorStop(0, TC.brand); g.addColorStop(1, TC.brand2);
    c.fillStyle = g; c.fillRect(0, 0, 1920, 110);
    c.fillStyle = '#fff'; c.font = '700 40px ' + FF; c.fillText('Bảng số đo chi tiết', 48, 66);
    c.textAlign = 'right'; c.fillStyle = '#fff'; c.font = '700 24px ' + FF; c.fillText('Hanoi Running Lab', 1872, 52);
    c.fillStyle = TC.soft; c.font = '19px ' + FF; c.fillText(R.sub.name, 1872, 84); c.textAlign = 'left';
    const rows = [];
    const keys = ['cadence', 'vert_osc', 'trunk', 'knee_ic', 'shank_ic', 'overstride', 'knee_mid', 'hip_ext', 'knee_swing'];
    for (const k of keys) {
      const cf = REF[k], common = Gait.COMMON.includes(k);
      const L = R.res.L ? R.res.L.metrics[k] : NaN, Rr = R.res.R ? R.res.R.metrics[k] : NaN, v = common ? cval(R, k) : null;
      const st = common ? rating(k, v) : null, sl = R.res.L ? rating(k, L) : { ok: true, txt: '–' }, sr = R.res.R ? rating(k, Rr) : { ok: true, txt: '–' };
      if (k === 'cadence' && cadLow(R)) { rows.push({ label: cf.label, unit: cf.unit, a: '–', b: '', ref: cf.lo + '–' + cf.hi, st: 'Cần đo lại', ok: false, common }); continue; }
      rows.push({ label: cf.label, unit: cf.unit, a: common ? f1(v) : f1(L), b: common ? '' : f1(Rr), ref: cf.lo + '–' + cf.hi, st: common ? st.txt : sl.txt + ' / ' + sr.txt, ok: common ? st.ok : sl.ok && sr.ok, common });
    }
    rows.push({ label: 'Kiểu tiếp đất', unit: '', a: R.res.L ? R.res.L.extra.strike : '–', b: R.res.R ? R.res.R.extra.strike : '–', ref: '', st: '', ok: true });
    extraRows(R).forEach((x) => rows.push(x));
    // Chữ to cho khách đọc (bác sĩ Kiên 19/11/2026): tách 2 trang. Trang 1 = chỉ số chính (đến Kiểu tiếp đất), trang 2 = chỉ số bổ sung.
    const nMain = keys.length + 1;
    return [sheet3(R, rows.slice(0, nMain), 'Bảng số đo chi tiết', false), sheet3(R, rows.slice(nMain), 'Bảng số đo chi tiết · chỉ số bổ sung', true)];
  }
  function sheet3(R, rows, title, notes) {
    const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080;
    const c = cv.getContext('2d'), FF = Themes.font;
    c.fillStyle = '#fff'; c.fillRect(0, 0, 1920, 1080);
    const g = c.createLinearGradient(0, 0, 1920, 0); g.addColorStop(0, TC.brand); g.addColorStop(1, TC.brand2);
    c.fillStyle = g; c.fillRect(0, 0, 1920, 110);
    c.fillStyle = '#fff'; c.font = '700 42px ' + FF; c.fillText(title, 48, 68);
    c.textAlign = 'right'; c.fillStyle = '#fff'; c.font = '700 24px ' + FF; c.fillText('Hanoi Running Lab', 1872, 52);
    c.fillStyle = TC.soft; c.font = '19px ' + FF; c.fillText(R.sub.name, 1872, 84); c.textAlign = 'left';
    // trạng thái hai chân giống nhau thì chỉ ghi một lần
    const stTxt = (t) => { const p = String(t || '').split(' / '); return p.length === 2 && p[0] === p[1] ? p[0] : t; };
    const top = 176, bottom = notes ? 980 : 1036, n = Math.max(rows.length, 1), rh = Math.min(84, Math.floor((bottom - top) / n));
    const X = [48, 770, 1000, 1230, 1470], FS = Math.max(24, Math.min(32, rh - 30));
    c.fillStyle = '#14202B'; c.font = '700 26px ' + FF;
    ['Chỉ số', 'Chân trái', 'Chân phải', 'Bình thường', 'Đánh giá'].forEach((t, i) => c.fillText(t, X[i] + 14, top - 18));
    rows.forEach((r, i) => {
      const y = top + i * rh, by = y + rh * 0.64;
      c.fillStyle = i % 2 ? '#fff' : TC.pale; c.fillRect(48, y, 1824, rh - 3);
      c.font = '500 ' + FS + 'px ' + FF; c.fillStyle = '#14202B'; c.fillText(r.label + (r.unit ? ' (' + r.unit + ')' : ''), X[0] + 14, by, X[1] - X[0] - 28);
      c.font = '800 ' + (FS + 4) + 'px ' + FF;
      if (r.common) c.fillText(r.a, X[1] + 14, by, X[3] - X[1] - 28); else { c.fillText(r.a, X[1] + 14, by, X[2] - X[1] - 24); c.fillText(r.b, X[2] + 14, by, X[3] - X[2] - 24); }
      c.font = FS + 'px ' + FF; c.fillStyle = '#5B6B77'; c.fillText(r.ref, X[3] + 14, by, X[4] - X[3] - 24);
      c.fillStyle = r.ok ? GREEN : AMBER; c.font = '700 ' + FS + 'px ' + FF; c.fillText(stTxt(r.st), X[4] + 14, by, 1872 - X[4] - 24);
    });
    if (notes) {
      c.fillStyle = '#5B6B77'; c.font = '20px ' + FF;
      wrap(c, 'Mốc thời gian chạm đất/bay ước lượng từ video 30 khung/giây (sai số khoảng ±33 ms). Các chỉ số không có khoảng bình thường chỉ để theo dõi. Chân xa camera kém tin cậy hơn. Không đo được từ camera ngang: gối vào trong, hông tụt, bàn chân xoay trong/ngoài, bước chéo, bề rộng bước (cần thêm camera sau). Chỉ mang tính tham khảo, không thay thế bác sĩ.', 48, 1012, 1824, 28);
    }
    return cv;
  }
  function drawPage4(R) {
    const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080;
    const c = cv.getContext('2d'), FF = Themes.font;
    c.fillStyle = '#fff'; c.fillRect(0, 0, 1920, 1080);
    const g = c.createLinearGradient(0, 0, 1920, 0); g.addColorStop(0, TC.brand); g.addColorStop(1, TC.brand2);
    c.fillStyle = g; c.fillRect(0, 0, 1920, 110);
    c.fillStyle = '#fff'; c.font = '700 40px ' + FF; c.fillText('Điểm dáng chạy và bài tập gợi ý', 48, 66);
    c.textAlign = 'right'; c.fillStyle = '#fff'; c.font = '700 24px ' + FF; c.fillText('Hanoi Running Lab', 1872, 52);
    c.fillStyle = TC.soft; c.font = '19px ' + FF; c.fillText(R.sub.name, 1872, 84); c.textAlign = 'left';
    const sc = scores(R);
    const box = (x, label, v, big) => {
      c.fillStyle = TC.pale; rr(c, x, 134, big ? 520 : 400, 150, 16); c.fill();
      c.fillStyle = '#5B6B77'; c.font = '700 20px ' + FF; c.fillText(label, x + 24, 174);
      c.fillStyle = v == null ? '#8A97A1' : scoreCol(v); c.font = '700 80px ' + FF; c.fillText(v == null ? '–' : String(v), x + 24, 256);
      c.font = '700 80px ' + FF; const nw = c.measureText(v == null ? '–' : String(v)).width; c.fillStyle = '#5B6B77'; c.font = '26px ' + FF; c.fillText('/100', x + 24 + nw + 8, 256);
    };
    const dd = (o) => (o && o.total != null ? o.total : '–');   // đo cả hai góc: điểm chung = 50/50, ghi điểm từng góc cạnh nhãn
    box(48, 'ĐIỂM CHUNG' + (sc.side && sc.back ? ' · góc ngang ' + dd(sc.side) + ' · góc sau ' + dd(sc.back) : ''), sc.total, true); box(596, 'CHÂN TRÁI', sc.L); box(1024, 'CHÂN PHẢI', sc.R);
    c.fillStyle = '#5B6B77'; c.font = '17px ' + FF;
    wrap(c, 'Điểm tổng hợp các chỉ số góc ngang theo nhóm và trọng số (' + tierText() + '). Đây là điểm tham khảo, không phải chẩn đoán.', 1460, 160, 410, 23);
    c.fillStyle = '#14202B'; c.font = '700 26px ' + FF; c.fillText('Bài tập gợi ý cho bạn', 48, 340);
    const ex = exercises(R).slice(0, 6);
    if (!ex.length) { c.fillStyle = '#4a5a65'; c.font = '24px ' + FF; wrap(c, (R.comb && conclusion(R).text.indexOf('có cờ tin cậy') >= 0 ? conclusion(R).text + ' ' : 'Các chỉ số chính đều nằm trong khoảng bình thường. ') + 'Hãy giữ kỹ thuật hiện tại, tập sức mạnh 2 buổi mỗi tuần và đo lại sau 4–6 tuần.', 48, 390, 1700, 34); }
    ex.forEach((e, i) => {
      const col = i % 2, row = Math.floor(i / 2), x = 48 + col * 924, y = 362 + row * 220;
      c.fillStyle = TC.pale; rr(c, x, y, 900, 204, 16); c.fill();
      c.fillStyle = TC.brand; c.beginPath(); c.arc(x + 38, y + 40, 18, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.font = '700 20px ' + FF; c.textAlign = 'center'; c.fillText(String(i + 1), x + 38, y + 47); c.textAlign = 'left';
      c.fillStyle = '#14202B'; c.font = '700 26px ' + FF; c.fillText(e.t, x + 68, y + 48, 810);
      c.fillStyle = AMBER; c.font = '600 18px ' + FF; c.fillText(e.why, x + 24, y + 84, 850);
      c.fillStyle = '#4a5a65'; c.font = '21px ' + FF; wrap(c, e.h, x + 24, y + 120, 850, 28);
    });
    c.fillStyle = '#7A8791'; c.font = '17px ' + FF;
    c.fillText('Tên bài tập kèm thuật ngữ tiếng Anh để dễ tra cứu video hướng dẫn. Bài tập mang tính gợi ý chung, hãy dừng nếu thấy đau và hỏi bác sĩ hoặc huấn luyện viên trước khi tập nếu bạn đang chấn thương.', 48, 1040, 1824);
    c.textAlign = 'right'; c.fillStyle = TC.brand; c.font = '700 20px ' + FF; c.fillText('Liên hệ: ' + CONTACT, 1872, 1068); c.textAlign = 'left';
    return cv;
  }
  // Trang "Nhìn từ sau lưng": ảnh sau lưng + 5 chỉ số góc sau (từng chân / chung), khoảng bình thường TẠM và giải thích
  function drawPageBack(R) {
    const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080;
    const c = cv.getContext('2d'), FF = Themes.font, B = R.back;
    c.fillStyle = '#fff'; c.fillRect(0, 0, 1920, 1080);
    const g = c.createLinearGradient(0, 0, 1920, 0); g.addColorStop(0, TC.brand); g.addColorStop(1, TC.brand2);
    c.fillStyle = g; c.fillRect(0, 0, 1920, 110);
    c.fillStyle = '#fff'; c.font = '700 40px ' + FF; c.fillText('Nhìn từ sau lưng', 48, 66);
    c.textAlign = 'right'; c.fillStyle = '#fff'; c.font = '700 24px ' + FF; c.fillText('Hanoi Running Lab', 1872, 52);
    c.fillStyle = TC.soft; c.font = '19px ' + FF; c.fillText(R.sub.name, 1872, 84); c.textAlign = 'left';
    drawBackPhoto(c, (S.photos || {}).B, 48, 134, 520, 860);
    const sc = scores(R), bs = sc.back ? sc.back.total : null;
    c.fillStyle = '#5B6B77'; c.font = '700 22px ' + FF; c.fillText('ĐIỂM GÓC SAU', 608, 166);
    c.fillStyle = bs == null ? '#8A97A1' : scoreCol(bs); c.font = '700 44px ' + FF; c.fillText(bs == null ? (Score.backInScore() ? '–' : 'Chưa chấm') : bs + '/100', 790, 170, 300);   // góc sau tạm ẩn khỏi điểm (Angle.BACK_ENABLED)
    c.fillStyle = AMBER; c.font = '700 20px ' + FF; c.fillText('Ngưỡng góc sau lưng đang TẠM, chờ bác sĩ duyệt', 1100, 164, 772);
    const X = [608, 1000, 1180, 1360, 1560], top = 214, rh = 158;
    c.fillStyle = '#14202B'; c.font = '700 22px ' + FF;
    ['Chỉ số', 'Chân trái', 'Chân phải', 'Bình thường (tạm)', 'Đánh giá'].forEach((t, i) => c.fillText(t, X[i] + 10, top));
    BACK_DETAIL.forEach((k, i) => {
      const cf = REF[k] || { label: k, unit: '' }, y = top + 16 + i * rh, per = Score.BACK_PERLEG.includes(k);
      const vals = per ? ['L', 'R'].map((s) => (B.per && B.per[s] ? B.per[s][k] : NaN)) : [B.common ? B.common[k] : NaN];
      const qs = vals.map((v) => rating(k, v)), ok = qs.every((q) => q.ok);
      c.fillStyle = i % 2 ? '#fff' : TC.pale; c.fillRect(608, y, 1264, rh - 8);
      c.fillStyle = '#14202B'; c.font = '700 22px ' + FF; c.fillText(cf.label + (cf.unit ? ' (' + cf.unit + ')' : ''), X[0] + 10, y + 36, 380);
      c.font = '700 24px ' + FF;   // mỗi số tô theo đánh giá của chính nó (khớp bảng Chi tiết)
      if (per) vals.forEach((v, j) => { c.fillStyle = qs[j].ok ? GREEN : AMBER; c.fillText(f1(v), X[1 + j] + 10, y + 36, 170); });
      else { c.fillStyle = ok ? GREEN : AMBER; c.fillText(f1(vals[0]) + '  (chung)', X[1] + 10, y + 36, 350); }
      c.fillStyle = '#5B6B77'; c.font = '22px ' + FF; c.fillText(cf.lo != null ? cf.lo + '–' + cf.hi : '', X[3] + 10, y + 36, 190);
      c.fillStyle = ok ? GREEN : AMBER; c.font = '700 22px ' + FF; c.fillText(per ? qs.map((q) => q.txt).join(' / ') : qs[0].txt, X[4] + 10, y + 36, 300);
      const bad = qs.find((q) => !q.ok);
      const msg = !bad ? 'Trong khoảng bình thường (tạm).' : (bad.txt === 'thấp' ? cf.low : cf.high) || 'Ngoài khoảng bình thường (tạm).';
      c.font = '19px ' + FF; c.fillStyle = ok ? '#4a5a65' : '#8a5a10'; wrap(c, msg, X[0] + 10, y + 74, 1230, 25);
    });
    c.fillStyle = '#7A8791'; c.font = '17px ' + FF;
    c.fillText('Chỉ số góc sau đo 2D từ video quay sau lưng; khoảng bình thường đang tạm, chờ bác sĩ duyệt. Chỉ mang tính tham khảo, không thay thế khám lâm sàng.', 48, 1040, 1824);
    c.textAlign = 'right'; c.fillStyle = TC.brand; c.font = '700 20px ' + FF; c.fillText('Liên hệ: ' + CONTACT, 1872, 1068); c.textAlign = 'left';
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
    // chỉ trang của góc đã quay: ngang = ý nghĩa + bảng chi tiết + điểm/bài tập; sau lưng = trang Nhìn từ sau
    const cvs = [pdfPage1(R)];
    if (R.comb) cvs.push(drawPage2(R), ...drawPage3(R));
    if (R.back) cvs.push(drawPageBack(R));
    if (R.comb) cvs.push(drawPage4(R));
    return buildPdf(cvs.map((cv) => ({ jpg: jpegBytes(cv), w: 1920, h: 1080 })));
  }
})(window.App);
