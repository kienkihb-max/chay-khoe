/* app/stand.js - lấy TƯ THẾ ĐỨNG YÊN ngay ở màn nhập thông tin (bác sĩ Kiên 25/11/2026).
 * Vì sao: điểm gót và điểm mũi chân của phần mềm nhận diện không nằm đúng trên đế giày, nên đường gót–mũi lệch vài độ ngay cả khi
 * bàn chân đặt phẳng; độ lệch khác nhau theo từng đôi giày. Cách chuẩn (Altman & Davis 2012): góc bàn chân lúc chạm đất TRỪ góc bàn
 * chân lúc đứng yên; ngưỡng phân loại Gót > 8°, Mũi < −1,6° là ngưỡng của góc đã trừ này.
 * Cách làm: trong lúc kỹ thuật viên điền thông tin (màn L1, quay trực tiếp), khách đứng yên giữa băng chạy. App nhận diện trên khung
 * xem trước (#v1) khoảng 6 lần/giây; khi bàn chân, hông gần như không nhúc nhích liên tục 3 giây thì lấy trung vị góc bàn chân từng
 * bên làm "góc đứng" (S.stand). Lần đứng yên sau ghi đè lần trước. "Sang màn đo" thì gắn S.stand vào lần đo rồi xoá cho khách sau.
 * Không có tư thế đứng thì kết quả tính như cũ (góc so với mặt sàn trên hình). Một phần của app cũ; cách chia sẻ biến xem đầu app/core.js.
 */
(function (App) {
  'use strict';
  const { $, S } = App;
  const HOLD = 3, VIS = 0.5, STILL = 0.05;   // giây đứng yên; độ rõ tối thiểu; dao động tối đa (tỉ lệ chiều dài thân)
  const FEET = { L: { heel: 29, toe: 31, ank: 27 }, R: { heel: 30, toe: 32, ank: 28 } };
  let buf = [], busy = false, badge = null;

  function ui() {
    if (badge) return badge;
    const v = $('v1'); if (!v || !v.parentNode) return null;
    badge = document.createElement('div'); badge.id = 'standst'; v.parentNode.appendChild(badge);
    return badge;
  }
  const f1 = (v) => (v >= 0 ? '' : '−') + Math.abs(v).toFixed(1).replace('.', ',');
  function show(txt, cls) { const b = ui(); if (!b) return; b.textContent = txt; b.className = cls || ''; b.hidden = false; }
  function render() {
    if (S.stand) show('✓ Đã lấy tư thế đứng · bàn chân T ' + f1(S.stand.L) + '° · P ' + f1(S.stand.R) + '°  (đứng yên lại để lấy lại)', 'ok');
    else show('Bước đầu: mời khách đứng yên giữa băng chạy 3 giây, hai bàn chân đặt phẳng', '');
  }
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  function feed(lm, vw, vh, t) {
    const ok = (i) => lm && lm[i] && (lm[i].visibility == null || lm[i].visibility >= VIS);
    const need = [0, 23, 24, 11, 12, 27, 28, 29, 30, 31, 32];
    if (!need.every(ok)) { buf = []; return 'none'; }
    const P = (i) => [lm[i].x * vw, lm[i].y * vh];
    const hip = [(P(23)[0] + P(24)[0]) / 2, (P(23)[1] + P(24)[1]) / 2], sh = [(P(11)[0] + P(12)[0]) / 2, (P(11)[1] + P(12)[1]) / 2];
    const tor = Math.hypot(sh[0] - hip[0], sh[1] - hip[1]); if (!(tor > 1)) { buf = []; return 'none'; }
    const d = P(0)[0] - hip[0] >= 0 ? 1 : -1;   // hướng mặt = hướng chạy trên băng chạy
    const ang = (s) => { const h = P(FEET[s].heel), o = P(FEET[s].toe); return Math.atan2(h[1] - o[1], d * (o[0] - h[0])) * 180 / Math.PI; };
    buf.push({ t, tor, pts: [hip, P(27), P(28), P(29), P(30), P(31), P(32)], L: ang('L'), R: ang('R'), d });
    while (buf.length && buf[0].t < t - HOLD - 0.5) buf.shift();
    if (buf[buf.length - 1].t - buf[0].t < HOLD) return 'wait';
    const T = med(buf.map((b) => b.tor));
    for (let j = 0; j < 7; j++) {   // mọi điểm (hông, cổ chân, gót, mũi) dao động trong 3 giây phải nhỏ
      const xs = buf.map((b) => b.pts[j][0]), ys = buf.map((b) => b.pts[j][1]);
      if (Math.max(...xs) - Math.min(...xs) > STILL * T || Math.max(...ys) - Math.min(...ys) > STILL * T) return 'move';
    }
    // hai bàn chân cùng chạm sàn: cổ chân hai bên gần cùng độ cao
    if (Math.abs(med(buf.map((b) => b.pts[1][1] - b.pts[2][1]))) > 0.12 * T) return 'move';
    const gL = med(buf.map((b) => b.L)), gR = med(buf.map((b) => b.R));
    if (Math.abs(gL) > 12 || Math.abs(gR) > 12) return 'move';   // bàn chân đặt phẳng thì đường gót–mũi chỉ lệch vài độ: số lớn = chưa đứng phẳng hoặc nhận nhầm
    S.stand = { L: gL, R: gR, d: buf[0].d, at: Date.now() };
    buf = [];
    return 'got';
  }
  async function tick() {
    if (busy) return;
    const L1 = $('L1'), v = $('v1');
    const on = L1 && L1.classList.contains('show') && S.mode !== 'file' && !S.running && S.camReady && (S.poseReady || S.pose) && v && v.readyState >= 2 && v.videoWidth;
    const b = ui(); if (b) b.hidden = !(L1 && L1.classList.contains('show') && S.mode !== 'file');
    if (!on) return;
    busy = true;
    try {
      const r = await App.detect(v);
      const st = feed(r && r.poseLandmarks, v.videoWidth, v.videoHeight, performance.now() / 1000);
      if (st === 'wait' && !S.stand) show('Đang lấy tư thế đứng… giữ yên', 'wait');
      else render();
    } catch (e) { /* bỏ qua khung lỗi */ }
    busy = false;
  }
  setInterval(tick, 160);
  // "Sang màn đo": gắn tư thế đứng vào lần đo này, xoá để khách sau đứng lại
  function standTake() { const s = S.stand || null; S.stand = null; buf = []; return s; }
  // Trừ góc đứng vào góc bàn chân lúc chạm đất và phân loại lại kiểu đáp đất (ngưỡng Altman & Davis). gait.js đã xoay hệ trục khi máy
  // nghiêng (extra.tiltUsed): góc đứng đo trên hình nên cộng cùng phần xoay (d·tilt) trước khi trừ.
  function applyStand(res, stand) {
    if (!res || !stand) return;
    for (const s of ['L', 'R']) {
      const e = res[s] && res[s].extra; if (!e || !Number.isFinite(e.fsa) || !Number.isFinite(stand[s])) continue;
      const d = res[s].arrays && res[s].arrays.d ? res[s].arrays.d : stand.d || 1;
      const base = stand[s] + (e.tiltUsed && Number.isFinite(e.tilt) ? d * e.tilt : 0);
      e.fsaRaw = e.fsa; e.fsaStand = base; e.fsa = e.fsaRaw - base;
      e.strike = e.fsa > 8 ? 'Gót' : e.fsa < -1.6 ? 'Mũi chân' : 'Giữa bàn';
    }
  }
  Object.assign(App, { standTake, applyStand });
})(window.App);
