/* app/run.js - chạy một lần đo trực tiếp: màn chờ, bấm Quay, đếm giờ, chọn đoạn ổn định, báo đo xong. Một phần của app cũ; cách chia sẻ biến xem đầu app/core.js. */
(function (App) {
  'use strict';
  const { $, CFG, S, BACK_ON, angFeed, angShow, fixLR, show, pad, idStr, REC, recStart,
    recStop, detect, v2, grab, gctx, layout, lvReset, lvRec, lvFeed, drawLive } = App;
  // hàm ở file nạp sau: gọi qua App khi chạy
  function titleCase(...a) { return App.titleCase(...a); }
  function analyse(...a) { return App.analyse(...a); }
  function finish(...a) { return App.finish(...a); }
  // hàm của file này (khai báo function được nâng lên đầu nên đưa ra ngay)
  Object.assign(App, { takeSub, startRun, recGo });
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
  // ---------- Báo hiệu bằng tiếng: bíp khi bắt đầu quay, 3 tiếng + lời "Đã đo xong" khi quay đủ ----------
  let actx = null;
  function audioOn() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { actx = null; } }
  function beep(freqs, len, gap) {
    if (!actx) return;
    try {
      freqs.forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * (len + gap);
        o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + len + 0.02);
      });
    } catch (e) { /* không có tiếng thì thôi, vẫn có bảng chữ */ }
  }
  function sayDone() {
    beep([880, 880, 1320], 0.28, 0.12);
    try {
      const en = document.documentElement.lang === 'en', want = en ? 'en' : 'vi';
      const v = (window.speechSynthesis ? speechSynthesis.getVoices() : []).find((x) => (x.lang || '').toLowerCase().startsWith(want));
      if (!v) return;   // máy không có giọng đọc đúng ngôn ngữ: chỉ bíp
      const u = new SpeechSynthesisUtterance(en ? 'Measurement complete. You can slow down and stop.' : 'Đã đo xong. Bạn có thể giảm tốc và dừng lại.');
      u.voice = v; u.lang = v.lang; setTimeout(() => { try { speechSynthesis.speak(u); } catch (e) { /* bỏ qua */ } }, 900);
    } catch (e) { /* bỏ qua */ }
  }

  const MIN_REC = 12;   // giây quay tối thiểu trước khi cho "Dừng quay sớm" (cần đủ bước để tính)
  const DONE_HOLD = 2.5; // giây giữ bảng "ĐÃ ĐO XONG" trên màn đo trước khi sang màn xem lại
  // Kỹ thuật viên bấm Quay ở màn đo (video.js nối nút #recgo vào đây)
  function recGo() {
    if (!S.running || S.recAt != null) return;
    audioOn(); beep([660], 0.18, 0);
    S.recAt = performance.now() / 1000 - S.t0; S.recT0 = performance.now() / 1000; S.frames = []; S.nrec = 0; S.recLive = true;
    if ($('autorec').checked) recStart();
    $('recgo').disabled = true; $('recgo').style.display = 'none'; $('early').style.display = '';
  }
  // Quay xong: báo dừng, chọn đoạn ổn định nhất (stable.js) rồi mới phân tích đúng đoạn đó
  function recEnd() {
    S.recLive = false; $('donebn').hidden = false; sayDone();
    const all = S.frames, w = Stable.pick(all, CFG.clip);
    S.win = w;
    if (w.cut) {
      S.frames = all.filter((f) => f.t >= w.t0 - 1e-6 && f.t <= w.t1 + 1e-6);
      for (const f of all) if (f.t < w.t0 || f.t > w.t1) f.blob = null;   // ảnh ngoài đoạn chọn không dùng nữa: trả bộ nhớ
    }
    analyse();
  }

  // Luồng đo trực tiếp (17/11/2026):
  //   1. Màn nhập: khách lên máy chạy thử, kỹ thuật viên nhập thông tin rồi bấm "Sang màn đo" khi khách lên tốc độ đo.
  //   2. Màn đo ở trạng thái CHỜ: có hình + khung xương + số liệu trực tiếp, CHƯA quay. Kỹ thuật viên tự xem ổn định rồi bấm "Quay".
  //   3. Quay CFG.total giây (mặc định 60). Hết giờ: bíp + bảng "ĐÃ ĐO XONG" để khách dừng.
  //   4. Máy chọn CFG.clip giây (mặc định 30) ổn định nhất để phân tích và cắt video trả khách (capture.js); kết quả hiện như cũ.
  async function startRun() {
    S.sub = takeSub();
    if (REC.mr) { await recStop(true, $('name').value.trim()); }
    if (S.stream) { v2.removeAttribute('src'); v2.srcObject = S.stream; v2.play().catch(() => {}); }
    S.lastLm = null; S.frames = []; S.late = []; S.nrec = 0; S.jobs = []; S.result = null; S.error = null; S.computing = false; S.abort = false; S.running = true;
    S.recAt = null; S.recLive = false; S.win = null; S.endNow = false; S.hipBuf = []; S.lastChk = 0; S.curCad = 0;
    show('L2'); layout(); lvReset();
    $('who').textContent = S.sub.name; angShow(true);
    S.t0 = performance.now() / 1000;
    let recDone = false, doneAt = 0, shown = false, stab = false;
    $('donebn').hidden = true; $('early').style.display = 'none'; $('early').disabled = true;
    $('recgo').style.display = ''; $('recgo').disabled = false; $('recgo').textContent = '● Quay ' + App.durTxt(CFG.total);
    document.querySelector('.cd em').textContent = 'SẴN SÀNG'; $('count').textContent = mmss(CFG.total); $('progf').style.width = '0%';

    const timer = setInterval(() => {
      if (S.abort) { clearInterval(timer); return; }
      const el = performance.now() / 1000 - S.t0;
      if (S.recAt == null) {   // CHỜ: chưa quay
        if (el - S.lastChk >= 1) { S.lastChk = el; const r = stableCheck(); S.curCad = r.cad; stab = r.ok; }
        lvRec(null);
        const cad = S.curCad ? ' (nhịp ~' + Math.round(S.curCad) + ')' : '';
        if (!S.lastLm) setPhase('CHƯA QUAY · chưa thấy người chạy trong khung hình', 'wn');
        else if (stab) setPhase('CHƯA QUAY · nhịp chạy đã ổn định' + cad + ' · bấm Quay khi sẵn sàng', 'ok');
        else setPhase('CHƯA QUAY · chờ khách chạy ổn định' + cad, '');
        return;
      }
      const re = el - S.recAt, left = CFG.total - re;
      if (!recDone) {
        document.querySelector('.cd em').textContent = 'CÒN LẠI';
        $('count').textContent = mmss(left); $('progf').style.width = Math.min(100, re / CFG.total * 100) + '%';
        lvRec(Math.max(0, Math.ceil(left)), Math.max(0, left / CFG.total));
        setPhase('ĐANG THU HÌNH · còn ' + Math.max(0, Math.ceil(left)) + ' giây', 'rec');
        $('early').disabled = re < MIN_REC;
        if (left <= 0 || (S.endNow && re >= MIN_REC)) { recDone = true; doneAt = el; $('early').disabled = true; lvRec(null); $('count').textContent = mmss(0); $('progf').style.width = '100%'; recEnd(); }
        return;
      }
      if (S.error) setPhase('Không đo được', 'wn'); else setPhase('ĐÃ ĐO XONG · khách có thể dừng' + (S.result ? '' : ' · đang tính kết quả...'), 'ok');
      if ((S.result || S.error) && el - doneAt >= DONE_HOLD && !shown) { shown = true; $('donebn').hidden = true; finish(); }
    }, 100);
    S.timer = timer;

    // vòng nhận diện: chạy suốt từ lúc vào màn đo (chờ lẫn quay); chỉ LƯU khung khi đang quay
    const loop = async () => {
      let nfr = 0, tfps = performance.now();
      while (S.running && !S.abort) {
        if (v2.readyState < 2 || !v2.videoWidth) { await new Promise((r) => setTimeout(r, 30)); continue; }
        const t = performance.now() / 1000, el = t - S.t0;
        const r = await detect(v2);
        const vw = v2.videoWidth, vh = v2.videoHeight;
        const lm0 = r && r.poseLandmarks ? r.poseLandmarks : null;
        if (!S.take && lm0) angFeed(lm0, vw, vh);   // chưa nhận ra góc thì cứ nhận tiếp; không tự thoát về màn nhập (khách có thể chưa đứng vào khung)
        const lm = S.take === 'back' ? fixLR(lm0) : lm0;
        S.lastLm = lm; lvFeed(el, lm); drawLive(lm);
        nfr++; if (performance.now() - tfps > 2000) { $('fpsb').textContent = 'Nhận diện ' + (nfr / ((performance.now() - tfps) / 1000)).toFixed(0) + ' khung/giây'; nfr = 0; tfps = performance.now(); }
        if (S.recAt == null) {   // số liệu cho dòng gợi ý "nhịp đã ổn định" ở trạng thái chờ; chỉ giữ ~40 giây gần nhất
          const hy = lm ? (lm[23].visibility >= Gait.VIS_MIN && lm[24].visibility >= Gait.VIS_MIN ? (lm[23].y + lm[24].y) / 2 : lm[23].visibility >= lm[24].visibility ? lm[23].y : lm[24].y) : NaN;
          S.hipBuf.push({ t: el, y: hy }); if (S.hipBuf.length > 2600) S.hipBuf.splice(0, 800);
        }
        if (S.recLive) {
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
          if (S.recLive) S.frames.push(rec);
        }
        await new Promise((r) => requestAnimationFrame(r));
      }
    };
    loop();
  }

  Object.assign(App, { setPhase });
})(window.App);
