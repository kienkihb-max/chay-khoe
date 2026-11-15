/* app/run.js - chạy một lần đo trực tiếp: đếm giờ, ổn định, thu hình. Một phần của app cũ; cách chia sẻ biến xem đầu app/core.js. */
(function (App) {
  'use strict';
  const { $, CFG, S, BACK_ON, ANG_WAIT, angFeed, angShow, angStop, fixLR, show, pad, idStr, REC, recStart,
    recStop, detect, v2, grab, gctx, layout, lvReset, lvRec, lvFeed, drawLive } = App;
  // hàm ở file nạp sau: gọi qua App khi chạy
  function titleCase(...a) { return App.titleCase(...a); }
  function analyse(...a) { return App.analyse(...a); }
  function finish(...a) { return App.finish(...a); }
  // hàm của file này (khai báo function được nâng lên đầu nên đưa ra ngay)
  Object.assign(App, { takeSub, startRun });
  const setPhase = (txt, cls) => { const e = $('ph'); e.textContent = txt; e.className = cls || ''; };
  const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + pad(s % 60); };

  // Nhận biết nhịp chạy ổn định: 3 đoạn 6 giây liên tiếp có nhịp lệch nhau không quá 7 bước/phút
  function stableCheck() {
    const B = S.hipBuf.filter((q) => !Number.isNaN(q.y)); if (B.length < 60) return { ok: false, cad: 0 };
    const tEnd = B[B.length - 1].t, cads = [];
    for (let w = 2; w >= 0; w--) {
      const t1 = tEnd - 6 * w, t0 = t1 - 6, seg = B.filter((q) => q.t >= t0 && q.t <= t1);
      if (seg.length < 6 * 12 || seg[0].t - t0 > 0.7 || t1 - seg[seg.length - 1].t > 0.7) return { ok: false, cad: cads.length ? cads[cads.length - 1] : 0 };
      const n = 6 * 60, y = new Float64Array(n); let k = 0;
      for (let i = 0; i < n; i++) { const t = t0 + (i / n) * 6; while (k < seg.length - 2 && seg[k + 1].t < t) k++; const a0 = seg[k], b0 = seg[k + 1], g = b0.t - a0.t; y[i] = a0.y + (b0.y - a0.y) * (g > 0 ? Math.max(0, Math.min(1, (t - a0.t) / g)) : 0); }
      let m = 0; for (let i = 0; i < n; i++) m += y[i]; m /= n;
      let sxy = 0, sxx = 0, mt = (n - 1) / 2; for (let i = 0; i < n; i++) { sxy += (i - mt) * (y[i] - m); sxx += (i - mt) * (i - mt); }
      const sl = sxy / sxx; for (let i = 0; i < n; i++) y[i] = y[i] - m - sl * (i - mt);
      const ac = (L) => { let s = 0; for (let i = 0; i + L < n; i++) s += y[i] * y[i + L]; return s / (n - L); };
      const a00 = ac(0); if (a00 <= 0) return { ok: false, cad: 0 };
      let bl = 0, bv = -1; const ar = {};
      for (let L = 17; L <= 31; L++) { ar[L] = ac(L); if (ar[L] > bv) { bv = ar[L]; bl = L; } }
      if (bv / a00 < 0.3 || bl <= 17 || bl >= 31) return { ok: false, cad: 0 };
      const y0 = ar[bl - 1], y1 = ar[bl], y2 = ar[bl + 1], den = y0 - 2 * y1 + y2, off = den !== 0 ? 0.5 * (y0 - y2) / den : 0;
      cads.push(60 * 60 / (bl + off));
    }
    const mx = Math.max(...cads), mn = Math.min(...cads);
    return { ok: mx - mn <= 7, cad: cads[2] };
  }
  // Người đang đo: đã chốt góc nào thì giữ mã cũ (các góc cùng một người, cùng một kết quả); tên/SĐT/chiều cao lấy lại từ form
  function takeSub() {
    const id = S.sess ? S.sess.sub.id : idStr();
    S.take = S.angMan === 'back' && !BACK_ON ? null : S.angMan || null; S.angMan = null; S.angF = [];
    return { id, name: titleCase($('name').value) || 'Khách ' + id, phone: $('phone').value.trim(), height: +$('height').value || 165, pain: $('pain').value.trim() };
  }
  async function startRun() {
    S.sub = takeSub();
    if (REC.mr) { await recStop(true, $('name').value.trim()); }
    if ($('autorec').checked) recStart();
    if (S.stream) { v2.removeAttribute('src'); v2.srcObject = S.stream; v2.play().catch(() => {}); }
    document.querySelector('.cd em').textContent = 'CÒN LẠI';
    S.lastLm = null; S.frames = []; S.late = []; S.nrec = 0; S.jobs = []; S.result = null; S.computing = false; S.abort = false; S.running = true;
    show('L2'); layout(); lvReset();
    $('who').textContent = S.sub.name; angShow(true);
    S.t0 = performance.now() / 1000;
    let recStarted = false, recDone = false, shown = false; S.endNow = false;
    S.recAt = $('s_auto').checked ? null : CFG.rec; S.hipBuf = []; S.lastChk = 0; S.curCad = 0;
    const latest = Math.max(20, CFG.total - CFG.clip - 3);
    $('early').style.display = ''; $('early').disabled = true; $('nowbtn').style.display = ''; $('nowbtn').disabled = true;

    const timer = setInterval(() => {
      const el = performance.now() / 1000 - S.t0;
      $('count').textContent = mmss(CFG.total - el);
      $('progf').style.width = Math.min(100, el / CFG.total * 100) + '%';
      if (S.recAt == null) {
        if (el - S.lastChk >= 1) { S.lastChk = el; const r = stableCheck(); S.curCad = r.cad; if (el >= 20 && r.ok) { S.recAt = el; S.recWhy = 'ổn định'; } }
        if (S.recAt == null && el >= latest) { S.recAt = el; S.recWhy = 'hết giờ chờ'; }
      }
      const RA = S.recAt == null ? Infinity : S.recAt;
      lvRec(el >= RA && el < RA + CFG.clip ? Math.ceil(RA + CFG.clip - el) : null, (RA + CFG.clip - el) / CFG.clip);
      if (el < RA) { setPhase(S.recAt == null ? 'Chạy thoải mái · đang chờ nhịp chạy ổn định' + (S.curCad ? ' (nhịp ~' + Math.round(S.curCad) + ')' : '') : 'Chạy thoải mái · sắp thu hình sau ' + Math.ceil(RA - el) + ' giây', ''); }
      else if (el < RA + CFG.clip) { recStarted = true; setPhase('ĐANG THU HÌNH · ' + Math.ceil(RA + CFG.clip - el) + ' giây' + (S.recWhy === 'ổn định' ? ' · nhịp đã ổn định' : ''), 'rec'); }
      else {
        if (recStarted && !recDone) { recDone = true; analyse(); }
        if (!S.result && !S.error) setPhase('Đang tính kết quả...', 'wn');
        else if (S.result && el < CFG.total) setPhase('Đã đo xong · giữ nhịp chạy đến hết giờ', 'ok');
        else if (S.error) setPhase('Không đo được', 'wn');
      }
      $('early').disabled = !(S.result || S.error);
      $('nowbtn').disabled = !(S.recAt == null || el < S.recAt);
      if ((el >= CFG.total || S.endNow) && (S.result || S.error) && !shown) { shown = true; finish(); }
      if (S.abort) { clearInterval(timer); }
    }, 100);
    S.timer = timer;

    // vòng nhận diện
    const loop = async () => {
      let nfr = 0, tfps = performance.now();
      while (S.running && !S.abort) {
        if (v2.readyState < 2 || !v2.videoWidth) { await new Promise((r) => setTimeout(r, 30)); continue; }
        const t = performance.now() / 1000, el = t - S.t0;
        const r = await detect(v2);
        const vw = v2.videoWidth, vh = v2.videoHeight;
        const lm0 = r && r.poseLandmarks ? r.poseLandmarks : null;
        if (!S.take && lm0) angFeed(lm0, vw, vh);
        if (!S.take && el > ANG_WAIT && !(S.recAt != null && el >= S.recAt)) { angStop(Angle.decide(S.angF).why); return; }
        const lm = S.take === 'back' ? fixLR(lm0) : lm0;
        S.lastLm = lm; lvFeed(el, lm); drawLive(lm);
        nfr++; if (performance.now() - tfps > 2000) { $('fpsb').textContent = 'Nhận diện ' + (nfr / ((performance.now() - tfps) / 1000)).toFixed(0) + ' khung/giây'; nfr = 0; tfps = performance.now(); }
        if (S.recAt == null) {
          const hy = lm ? (lm[23].visibility >= Gait.VIS_MIN && lm[24].visibility >= Gait.VIS_MIN ? (lm[23].y + lm[24].y) / 2 : lm[23].visibility >= lm[24].visibility ? lm[23].y : lm[24].y) : NaN;
          S.hipBuf.push({ t: el, y: hy });
        }
        const RA2 = S.recAt == null ? Infinity : S.recAt;
        if (el >= RA2 && el < RA2 + CFG.clip) {
          const rec = { t, lm: lm0 ? lm0.map((q) => ({ x: q.x * vw, y: q.y * vh, v: q.visibility == null ? 1 : q.visibility })) : null, vw, vh, blob: null };
          S.nrec = (S.nrec || 0) + 1;
          if (lm && S.nrec % 3 === 0) {
            const sc = Math.min(1, 1280 / vw);
            grab.width = Math.round(vw * sc); grab.height = Math.round(vh * sc);
            gctx.drawImage(v2, 0, 0, grab.width, grab.height);
            rec.sc = sc;
            rec.job = new Promise((res) => grab.toBlob((b) => { rec.blob = b; res(); }, 'image/jpeg', 0.85));
            await rec.job;   // giữ đơn giản: chờ xong mới sang khung kế (grab dùng chung)
          }
          S.frames.push(rec);
        }
        if (el >= CFG.total - CFG.clip && S.recAt != null && el > S.recAt + CFG.clip + 5 && el < CFG.total) S.late.push({ t, lm: lm ? lm.map((q) => ({ x: q.x * vw, y: q.y * vh, v: q.visibility == null ? 1 : q.visibility })) : null });
        await new Promise((r) => requestAnimationFrame(r));
      }
    };
    loop();
  }


  Object.assign(App, { setPhase });
})(window.App);
