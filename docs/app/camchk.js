/* app/camchk.js - kiểm tra góc máy ở màn đo, trạng thái CHỜ (trước khi bấm Quay), để kỹ thuật viên chỉnh máy (bác sĩ Kiên 25/11/2026).
 * Đo 2D nên máy đặt lệch là số đo lệch theo. Bảng #camchk (góc trên trái màn đo) báo 4 mục, mỗi mục đèn xanh / vàng / đỏ:
 *   1. Đặt chéo: máy không vuông góc với hướng chạy. Đo từ khung xương: bề ngang vai + hông so với chiều dài thân (w, cùng phép đo
 *      angle.js dùng để nhận góc ngang). Quay đúng ngang thì hai vai, hai hông gần chồng nhau (w nhỏ); quay chéo thì tách ra.
 *   2. Nghiêng ngang (máy bị xoay, mặt băng chạy trên hình không nằm ngang): đường nối các điểm bàn chân lúc chạm băng chạy trong
 *      vài giây gần nhất phải nằm ngang; độ dốc của đường đó = độ nghiêng của máy.
 *   3. Chếch lên / xuống (hoặc đặt cao / thấp hơn hông): máy ngang hông và nhìn thẳng thì hông nằm quanh giữa khung theo chiều dọc.
 *   4. Khoảng cách: người (mũi tới bàn chân) chiếm 50–90% chiều cao khung.
 * Có cảm biến nghiêng (máy tính bảng / điện thoại đang quay chính là máy chạy app) thì hiện thêm số đo từ cảm biến cho mục 2 và 3.
 * NGƯỠNG (CAM) đang tạm: đặt theo hình học và một video thật (Hồ Phương 14/11/2026: w trung vị 0,195, mặt băng nghiêng 0,4°);
 * cần chỉnh lại khi có thêm video. Một phần của app cũ; cách chia sẻ biến xem đầu app/core.js.
 */
(function (App) {
  'use strict';
  const { $, S } = App;
  const CAM = {
    WIN: 4,                    // giây dữ liệu gần nhất dùng để tính
    YAW: [0.27, 0.35],         // w (vai + hông / thân): trên 0,27 = hơi chéo (khoảng 8–10°), trên 0,35 = chéo nhiều (khoảng 15°)
    ROLL: [2, 3.5],            // độ nghiêng mặt băng chạy trên hình (độ); phép đo từ bàn chân dao động khoảng ±1° nên ngưỡng rộng hơn cảm biến
    VPOS: [0.08, 0.15],        // hông lệch khỏi giữa khung theo chiều dọc (tỉ lệ chiều cao khung)
    SIZE: [0.5, 0.9],          // người chiếm bao nhiêu chiều cao khung
    SROLL: [1.5, 3], SPITCH: [3, 6],   // cảm biến: nghiêng ngang, chếch lên/xuống (độ)
  };
  const VIS = 0.5;
  let grav = null, gravAt = 0, motionOn = false;
  // Cảm biến trọng lực (máy chạy app cũng là máy quay). iOS cần xin quyền trong cú bấm: gọi camMotion() từ nút "Sang màn đo".
  function camMotion() {
    if (motionOn || typeof window.DeviceMotionEvent === 'undefined' || !('ontouchstart' in window)) return;
    const on = () => { motionOn = true; window.addEventListener('devicemotion', (e) => { const g = e.accelerationIncludingGravity; if (g && g.x != null) { grav = [g.x, g.y, g.z]; gravAt = performance.now(); } }); };
    try { if (typeof DeviceMotionEvent.requestPermission === 'function') DeviceMotionEvent.requestPermission().then((r) => { if (r === 'granted') on(); }).catch(() => {}); else on(); } catch (e) { /* không có cảm biến */ }
  }
  // Một bảng kiểm tra = một "máy đo" riêng (dữ liệu, ô hiển thị). Hai bảng: L1 (màn nhập, lúc khách đứng yên — bước 1 gộp đặt máy +
  // đứng yên, bác sĩ Kiên 25/11/2026) và L2 (màn đo lúc chờ, khách đang chạy: đo thêm được độ nghiêng từ bàn chân).
  // o.parent(): nơi gắn bảng; o.id; o.key: tên biến trong S giữ số đo gần nhất; o.title; o.extra(): các dòng thêm [mức, tên, chữ];
  // o.noRoll: chữ hiện ở dòng Nghiêng ngang khi chưa đo được (vd lúc đứng yên); o.foot(bad, mid): câu cuối bảng.
  function makeChk(o) {
  let buf = [], rollH = [], last = 0, box = null;
  function ui() {
    if (box) return box;
    const par = o.parent(); if (!par) return null;
    box = document.createElement('div'); box.id = o.id; box.className = 'camchk'; box.hidden = true;
    box.innerHTML = '<h4>' + o.title + '</h4><ul></ul><p></p>';
    if (o.mount) o.mount(box, par); else par.appendChild(box);
    return box;
  }
  function reset() { buf = []; rollH = []; last = 0; const b = ui(); if (b) b.hidden = true; }
  function setShow(on) { const b = ui(); if (b) b.hidden = !on; }
  // lm: 33 điểm chuẩn hoá 0–1 (MediaPipe); t: giây
  function feed(lm, vw, vh, t) {
    if (!lm || !vw) { if (t - last >= 0.5) { last = t; render(); } return; }
    const P = (i) => [lm[i].x * vw, lm[i].y * vh], ok = (i) => lm[i] && (lm[i].visibility == null || lm[i].visibility >= VIS);
    const o = { t };
    if ([11, 12, 23, 24].every(ok)) {
      const s1 = P(11), s2 = P(12), h1 = P(23), h2 = P(24);
      const tor = Math.hypot((s1[0] + s2[0] - h1[0] - h2[0]) / 2, (s1[1] + s2[1] - h1[1] - h2[1]) / 2);
      if (tor > 1) { o.tor = tor; o.w = (Math.abs(s1[0] - s2[0]) + Math.abs(h1[0] - h2[0])) / 2 / tor; o.hy = (h1[1] + h2[1]) / 2 / vh; }
    }
    o.feet = [29, 30, 31, 32].filter(ok).map((i) => [i, ...P(i)]);
    const ys = o.feet.map((f) => f[2]); if (ok(0) && ys.length) o.size = (Math.max(...ys) - P(0)[1]) / vh;
    buf.push(o); while (buf.length && buf[0].t < t - CAM.WIN) buf.shift();
    if (t - last >= 0.5) { last = t; render(); }
  }
  function measure() {
    const r = {}, ws = buf.map((o) => o.w).filter((v) => v != null), tors = buf.map((o) => o.tor).filter(Boolean);
    if (ws.length >= 20) r.w = med(ws);
    const hy = buf.map((o) => o.hy).filter((v) => v != null); if (hy.length >= 20) r.hy = med(hy);
    const sz = buf.map((o) => o.size).filter((v) => v != null); if (sz.length >= 20) r.size = med(sz);
    // mặt băng chạy: lúc chạm băng chạy, các điểm bàn chân (gót 29/30, mũi 31/32) là điểm THẤP NHẤT trên hình. Bắt đầu bằng đường ngang
    // qua mức thấp nhất, lấy các điểm sát đường đó, kẻ lại đường thẳng qua chúng, lặp vài lần cho đường "bám" theo mặt băng chạy.
    // Độ dốc cuối cùng = độ nghiêng của máy. Thử trên video thật xoay giả 0 / ±3 / 4°: sai lệch khoảng ±1°.
    const tor = med(tors);
    if (tor > 0) {
      const pts = []; for (const o of buf) for (const f of o.feet) pts.push([f[1], f[2]]);
      if (pts.length >= 40) {
        let A = 0, B = pts.map((q) => q[1]).sort((u, v) => u - v)[Math.floor(pts.length * 0.97)], okFit = true;
        for (let it = 0; it < 6 && okFit; it++) {
          const res = pts.map((q) => q[1] - (A * q[0] + B)), top = res.slice().sort((u, v) => u - v)[Math.floor(res.length * 0.97)];
          const sel = pts.filter((q, j) => res[j] >= top - 0.06 * tor), xs = sel.map((q) => q[0]);
          if (sel.length < 8 || Math.max(...xs) - Math.min(...xs) < 0.4 * tor) { okFit = false; break; }
          const n = sel.length, mx = xs.reduce((u, v) => u + v, 0) / n, my = sel.reduce((u, q) => u + q[1], 0) / n;
          let sxy = 0, sxx = 0; for (const q of sel) { sxy += (q[0] - mx) * (q[1] - my); sxx += (q[0] - mx) ** 2; }
          if (!(sxx > 0)) { okFit = false; break; }
          A = sxy / sxx; B = my - A * mx;
        }
        if (okFit) { rollH.push(Math.atan(A) * 180 / Math.PI); if (rollH.length > 9) rollH.shift(); r.roll = med(rollH); }   // trung vị vài lần đo gần nhất cho số đỡ nhảy
      }
    }
    // cảm biến: trọng lực đổi về hệ toạ độ màn hình theo hướng xoay máy; nghiêng = góc trọng lực lệch khỏi trục dọc của hình,
    // chếch = góc giữa trọng lực và mặt phẳng màn hình (máy dựng thẳng thì 0°)
    if (grav && performance.now() - gravAt < 1500) {
      const a = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * Math.PI / 180;
      const gx = grav[0] * Math.cos(a) + grav[1] * Math.sin(a), gy = -grav[0] * Math.sin(a) + grav[1] * Math.cos(a), gz = grav[2];
      r.sroll = Math.atan2(gx, Math.abs(gy)) * 180 / Math.PI;
      r.spitch = Math.atan2(gz, Math.hypot(gx, gy)) * 180 / Math.PI;
    }
    return r;
  }
  function render() {
    const b = ui(); if (!b || b.hidden) return;
    const r = measure(), rows = [];
    const row = (st, k, txt) => rows.push('<li data-lv="' + st + '"><i></i><b>' + k + '</b><span>' + txt + '</span></li>');
    if (r.w == null) row('na', 'Đặt chéo', 'chưa thấy rõ vai, hông');
    else { const st = lv(r.w, CAM.YAW); row(st, 'Đặt chéo', st === 'ok' ? 'vuông góc, tốt' : st === 'mid' ? 'hơi chéo · xoay máy cho vuông góc với hướng chạy' : 'chéo nhiều · xoay máy vuông góc với hướng chạy'); }
    const sroll = r.sroll != null ? ' · cảm biến ' + f1(Math.abs(r.sroll)) + '°' : '';
    if (r.roll == null && r.sroll == null) row('na', 'Nghiêng ngang', o.noRoll || 'chờ thêm vài bước chạy');
    else {
      const v = r.roll != null ? Math.abs(r.roll) : Math.abs(r.sroll), st = r.roll != null ? lv(v, CAM.ROLL) : lv(v, CAM.SROLL);
      row(st, 'Nghiêng ngang', (r.roll != null ? 'mặt băng chạy nghiêng ' + f1(v) + '°' : 'cảm biến ' + f1(v) + '°') + (r.roll != null ? sroll : '') + (st === 'ok' ? '' : ' · chỉnh chân máy cho cân'));
    }
    const sp = r.spitch != null ? ' · cảm biến chếch ' + f1(Math.abs(r.spitch)) + '°' : '';
    if (r.hy == null) row('na', 'Chếch lên / xuống', 'chưa thấy rõ hông' + sp);
    else {
      const d = r.hy - 0.5; let st = lv(Math.abs(d), CAM.VPOS);
      if (r.spitch != null) { const s2 = lv(Math.abs(r.spitch), CAM.SPITCH); if (s2 === 'bad' || (s2 === 'mid' && st === 'ok')) st = s2; }
      row(st, 'Chếch lên / xuống', st === 'ok' ? 'máy ngang hông, nhìn thẳng' + sp : (d < 0 ? 'máy thấp hơn hông hoặc chúc xuống · nâng máy ngang hông' : 'máy cao hơn hông hoặc ngửa lên · hạ máy ngang hông') + sp);
    }
    if (r.size == null) row('na', 'Khoảng cách', 'chưa thấy đủ người');
    else { const st = r.size < CAM.SIZE[0] ? (r.size < CAM.SIZE[0] - 0.1 ? 'bad' : 'mid') : r.size > CAM.SIZE[1] ? 'bad' : 'ok';
      row(st, 'Khoảng cách', st === 'ok' ? 'vừa khung' : r.size > CAM.SIZE[1] ? 'sát quá, dễ mất đầu / bàn chân · lùi máy ra' : 'xa quá, người nhỏ · tiến máy lại gần'); }
    if (o.extra) for (const [st, k, txt] of o.extra()) row(st, k, txt);
    b.querySelector('ul').innerHTML = rows.join('');
    const bad = rows.some((x) => /data-lv="bad"/.test(x)), mid = rows.some((x) => /data-lv="(mid|wait)"/.test(x));
    b.dataset.lv = bad ? 'bad' : mid ? 'mid' : 'ok';
    b.querySelector('p').textContent = o.foot ? o.foot(bad, mid) : bad ? 'Nên chỉnh máy trước khi bấm Quay: số đo có thể lệch.' : mid ? 'Có thể quay, nhưng chỉnh lại sẽ chính xác hơn.' : 'Góc máy tốt.';
    S[o.key] = r;   // giữ số đo gần nhất (L2: lúc bấm Quay) để xem lại
  }
  return { reset, show: setShow, feed, render, box: () => box };
  }
  const med = (a) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const lv = (v, th) => (v <= th[0] ? 'ok' : v <= th[1] ? 'mid' : 'bad');
  const f1 = (v) => v.toFixed(1).replace('.', ',');
  // Bảng màn đo (L2): khách đang chạy
  const chk2 = makeChk({ parent: () => $('L2'), id: 'camchk', key: 'cam', title: 'KIỂM TRA GÓC MÁY' });
  const camReset = chk2.reset, camShow = chk2.show, camFeed = chk2.feed;
  // Lỗi góc máy MỨC ĐỎ trong số đo lúc bấm Quay (R.cam), để ghi cảnh báo "kết quả kém tin cậy do góc máy" vào kết quả.
  function camIssues(cam) {
    if (!cam) return [];
    const out = [];
    if (cam.w != null && cam.w > CAM.YAW[1]) out.push('máy đặt chéo');
    const roll = cam.roll != null ? Math.abs(cam.roll) : cam.sroll != null ? Math.abs(cam.sroll) : null;
    if (roll != null && roll > (cam.roll != null ? CAM.ROLL[1] : CAM.SROLL[1])) out.push('máy nghiêng ' + f1(roll) + '°');
    if (cam.hy != null && Math.abs(cam.hy - 0.5) > CAM.VPOS[1]) out.push(cam.hy < 0.5 ? 'máy thấp hoặc chúc xuống' : 'máy cao hoặc ngửa lên');
    if (cam.size != null && (cam.size < CAM.SIZE[0] - 0.1 || cam.size > CAM.SIZE[1])) out.push(cam.size > CAM.SIZE[1] ? 'người sát khung' : 'người quá nhỏ trong khung');
    return out;
  }
  Object.assign(App, { CAM, makeChk, camReset, camShow, camFeed, camMotion, camIssues });
})(window.App);
