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
  let buf = [], busy = false, stState = 'none';
  const f1 = (v) => (v >= 0 ? '' : '−') + Math.abs(v).toFixed(1).replace('.', ',');
  // BƯỚC 1 gộp (bác sĩ Kiên 25/11/2026): một bảng trên khung camera ở màn nhập vừa kiểm tra góc máy (đặt chéo, chếch, khoảng cách;
  // nghiêng ngang nếu có cảm biến) vừa báo tư thế đứng yên. Độ nghiêng từ bàn chân chỉ đo được khi khách chạy (bảng ở màn đo).
  const chk = App.makeChk({
    parent: () => { const v = $('v1'); return v && v.parentNode; }, id: 'camchk1', key: 'camL1',
    mount: (box, par) => par.parentNode.insertBefore(box, par.nextSibling),   // ngay dưới khung camera, không che người
    title: 'BƯỚC 1 · ĐẶT MÁY VÀ ĐỨNG YÊN', noRoll: 'kiểm tra lại ở màn đo khi khách chạy',
    extra: () => [S.stand ? ['ok', 'Đứng yên 3 giây', '✓ của khách ' + S.stand.name + ' · bàn chân T ' + f1(S.stand.L) + '° · P ' + f1(S.stand.R) + '°']
      : !curName() ? ['mid', 'Đứng yên 3 giây', 'nhập tên khách trước, rồi mời khách đứng yên']
      : stState === 'wait' ? ['wait', 'Đứng yên 3 giây', 'đang lấy… giữ yên'] : ['mid', 'Đứng yên 3 giây', 'mời khách ' + curName() + ' đứng yên giữa băng chạy, hai bàn chân đặt phẳng']],
    foot: (bad, mid) => (bad ? 'Chỉnh máy theo dòng màu đỏ, rồi mời khách đứng yên 3 giây.' : !S.stand ? 'Máy ổn thì mời khách đứng yên 3 giây; xong bật máy chạy.' : mid ? 'Đã lấy tư thế đứng. Có thể chỉnh máy thêm cho chính xác.' : 'Xong bước 1: bật máy chạy, khởi động, rồi bấm Sang màn đo.'),
  });
  function render() { chk.render(); }
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const curName = () => { const e = $('name'); return e ? e.value.trim() : ''; };
  // Khách mới: đổi tên trên phiếu thì tư thế đứng của người trước bị xoá (bác sĩ Kiên 25/11/2026)
  function nameWatch() {
    const e = $('name'); if (!e || e.dataset.standW) return; e.dataset.standW = '1';
    e.addEventListener('input', () => { if (S.stand && S.stand.name !== curName()) { S.stand = null; buf = []; stState = 'none'; } });
  }
  function feed(lm, vw, vh, t) {
    if (!curName()) { buf = []; return 'noname'; }   // chưa có tên khách thì chưa lấy, để tư thế đứng luôn gắn với một phiếu
    const ok = (i) => lm && lm[i] && (lm[i].visibility == null || lm[i].visibility >= VIS);
    const need = [0, 23, 24, 11, 12, 27, 28, 29, 30, 31, 32];
    if (!need.every(ok)) { buf = []; return 'none'; }
    const P = (i) => [lm[i].x * vw, lm[i].y * vh];
    const hip = [(P(23)[0] + P(24)[0]) / 2, (P(23)[1] + P(24)[1]) / 2], sh = [(P(11)[0] + P(12)[0]) / 2, (P(11)[1] + P(12)[1]) / 2];
    const tor = Math.hypot(sh[0] - hip[0], sh[1] - hip[1]); if (!(tor > 1)) { buf = []; return 'none'; }
    const d = P(0)[0] - hip[0] >= 0 ? 1 : -1;   // hướng mặt = hướng chạy trên băng chạy
    const ang = (s) => { const h = P(FEET[s].heel), o = P(FEET[s].toe); return Math.atan2(h[1] - o[1], d * (o[0] - h[0])) * 180 / Math.PI; };
    // vóc dáng: (đùi + cẳng chân) / thân, trung bình hai chân, để so với người chạy trong video (cùng người thì gần bằng nhau)
    const leg = (h, k, a) => Math.hypot(P(h)[0] - P(k)[0], P(h)[1] - P(k)[1]) + Math.hypot(P(k)[0] - P(a)[0], P(k)[1] - P(a)[1]);
    const ratio = (ok(25) && ok(26) ? (leg(23, 25, 27) + leg(24, 26, 28)) / 2 : NaN) / tor;
    buf.push({ t, tor, pts: [hip, P(27), P(28), P(29), P(30), P(31), P(32)], L: ang('L'), R: ang('R'), d, ratio });
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
    const rs = buf.map((b) => b.ratio).filter(Number.isFinite);
    S.stand = { L: gL, R: gR, d: buf[0].d, at: Date.now(), name: curName(), ratio: rs.length ? med(rs) : NaN };
    buf = [];
    return 'got';
  }
  async function tick() {
    if (busy) return;
    const L1 = $('L1'), v = $('v1');
    const on = L1 && L1.classList.contains('show') && S.mode !== 'file' && !S.running && S.camReady && (S.poseReady || S.pose) && v && v.readyState >= 2 && v.videoWidth;
    chk.show(!!(L1 && L1.classList.contains('show') && S.mode !== 'file'));
    if (!on) return;
    busy = true;
    try {
      const r = await App.detect(v);
      const st = feed(r && r.poseLandmarks, v.videoWidth, v.videoHeight, performance.now() / 1000);
      nameWatch();
      stState = st === 'wait' ? 'wait' : st === 'got' ? 'got' : 'none';
      chk.feed(r && r.poseLandmarks, v.videoWidth, v.videoHeight, performance.now() / 1000);
    } catch (e) { /* bỏ qua khung lỗi */ }
    busy = false;
  }
  setInterval(tick, 160);
  // "Sang màn đo": gắn tư thế đứng vào lần đo này, xoá để khách sau đứng lại
  function standTake() { const s = S.stand || null; S.stand = null; buf = []; stState = 'none'; return s; }
  // cảm biến nghiêng (máy tính bảng / điện thoại): iOS cần xin quyền trong một cú chạm, xin ở lần chạm đầu tiên vào màn nhập
  document.addEventListener('pointerdown', () => App.camMotion(), { once: true });
  // Trừ góc đứng vào góc bàn chân lúc chạm đất và phân loại lại kiểu đáp đất (ngưỡng Altman & Davis). gait.js đã xoay hệ trục khi máy
  // nghiêng (extra.tiltUsed): góc đứng đo trên hình nên cộng cùng phần xoay (d·tilt) trước khi trừ.
  // Trước khi dùng: tư thế đứng phải còn mới (≤ STALE_MIN phút) và vóc dáng khớp người chạy trong video (lệch ≤ RATIO_TOL).
  // P: khung xương lần quay (P.x[j][i], P.y, P.v). Trả '' nếu dùng được, hoặc lý do không dùng (ghi vào kết quả).
  const STALE_MIN = 10, RATIO_TOL = 0.15;
  function standCheck(stand, P) {
    if (!stand) return 'chưa có tư thế đứng yên';
    if (Date.now() - stand.at > STALE_MIN * 60000) return 'tư thế đứng lấy quá ' + STALE_MIN + ' phút trước, chưa dùng';
    if (P && P.x && Number.isFinite(stand.ratio)) {
      const N = P.x[0].length, rs = [], v = (j, i) => P.v && P.v[j] ? P.v[j][i] >= VIS : true;
      const pt = (j, i) => [P.x[j][i], P.y[j][i]], D = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      for (let i = 0; i < N; i += 2) {
        if (![11, 12, 23, 24].every((j) => v(j, i) && Number.isFinite(P.x[j][i]))) continue;
        const legOk = (a, b, c) => [a, b, c].every((j) => v(j, i) && Number.isFinite(P.x[j][i]));
        const okL = legOk(23, 25, 27), okR = legOk(24, 26, 28); if (!okL && !okR) continue;   // lúc chạy chân xa hay bị che: lấy chân thấy rõ
        const sh = [(P.x[11][i] + P.x[12][i]) / 2, (P.y[11][i] + P.y[12][i]) / 2], hp = [(P.x[23][i] + P.x[24][i]) / 2, (P.y[23][i] + P.y[24][i]) / 2];
        const tor = D(sh, hp); if (!(tor > 1)) continue;
        // lúc chạy chân co duỗi nhưng độ dài đoạn xương không đổi: lấy tổng đùi + cẳng chân từng bên rồi trung bình
        const lg = (h, k, a) => D(pt(h, i), pt(k, i)) + D(pt(k, i), pt(a, i)), ls = [];
        if (okL) ls.push(lg(23, 25, 27)); if (okR) ls.push(lg(24, 26, 28));
        rs.push(ls.reduce((a, b) => a + b, 0) / ls.length / tor);
      }
      if (rs.length >= 20) { const r = med(rs); if (Math.abs(r / stand.ratio - 1) > RATIO_TOL) return 'tư thế đứng không khớp vóc dáng người chạy (có thể của người khác), chưa dùng'; }
    }
    return '';
  }
  function applyStand(res, stand, P) {
    if (!res || !stand) return 'chưa có tư thế đứng yên';
    const why = standCheck(stand, P); if (why) return why;
    for (const s of ['L', 'R']) {
      const e = res[s] && res[s].extra; if (!e || !Number.isFinite(e.fsa) || !Number.isFinite(stand[s])) continue;
      const d = res[s].arrays && res[s].arrays.d ? res[s].arrays.d : stand.d || 1;
      const base = stand[s] + (e.tiltUsed && Number.isFinite(e.tilt) ? d * e.tilt : 0);
      e.fsaRaw = e.fsa; e.fsaStand = base; e.fsa = e.fsaRaw - base;
      e.strike = e.fsa > 8 ? 'Gót' : e.fsa < -1.6 ? 'Mũi chân' : 'Giữa bàn';
    }
    return '';
  }
  Object.assign(App, { standTake, applyStand });
})(window.App);
