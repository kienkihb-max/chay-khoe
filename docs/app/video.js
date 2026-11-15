/* app/video.js - chế độ chọn file video, các nút trên màn đo. Một phần của app cũ; cách chia sẻ biến xem đầu app/core.js. */
(function (App) {
  'use strict';
  const { $, CFG, S, BACK_ON, angMsg, angFeed, angShow, setTake, fixLR, show, REC, recStop, refreshL1,
    plFresh, detect, v2, grab, gctx, layout, lvReset, lvRec, lvFeed, drawLive, setPhase, takeSub, startRun } = App;
  // hàm ở file nạp sau: gọi qua App khi chạy
  function guessSlow(...a) { return App.guessSlow(...a); }
  function analyse(...a) { return App.analyse(...a); }
  function finish(...a) { return App.finish(...a); }
  // hàm của file này (khai báo function được nâng lên đầu nên đưa ra ngay)
  Object.assign(App, { fixDur });
  // ---------- Chế độ video có sẵn ----------
  async function fixDur(v) {   // video webm do trình duyệt ghi thường báo độ dài vô hạn: ép tính lại
    if (isFinite(v.duration)) return;
    await new Promise((res) => { v.onseeked = () => { v.onseeked = null; v.currentTime = 0; res(); }; v.currentTime = 1e101; });
  }
  async function startVideo() {
    const km = +$('vspeed').value || 10; App.SPEED = km / 3.6;
    S.sub = takeSub();
    S.lastLm = null; S.frames = []; S.late = []; S.result = null; S.error = null; S.computing = false; S.abort = false; S.running = true; S.photosReady = false;
    show('L2'); layout(); lvReset(); $('early').style.display = 'none'; $('nowbtn').style.display = 'none';
    $('who').textContent = S.sub.name; angShow(true);
    document.querySelector('.cd em').textContent = 'TIẾN ĐỘ'; $('count').textContent = '0%'; $('progf').style.width = '0%'; $('fpsb').textContent = '';
    setPhase('Đang mở video...', 'wn');
    try {
      v2.srcObject = null; v2.src = S.fileUrl; v2.muted = true;
      await new Promise((res, rej) => { v2.onloadedmetadata = res; v2.onerror = () => rej(new Error('Không mở được video này (thử định dạng MP4).')); });
      v2.pause(); await fixDur(v2);
      const dur = v2.duration, vw = v2.videoWidth, vh = v2.videoHeight;
      const start = Math.max(0, Math.min(+$('vstart').value || 0, dur - 8));
      const sc = Math.min(1, 1280 / vw);
      // Tua tới t; trả false nếu sau 3 giây vẫn chưa tua xong (khung đó coi là lỗi, không lấy khung đang hiện).
      const seek = (t) => new Promise((res) => {
        if (Math.abs(v2.currentTime - t) < 1e-3) return res(true);
        let done = false; const fin = (ok) => { if (!done) { done = true; v2.removeEventListener('seeked', onOk); res(ok); } }, onOk = () => fin(true);
        v2.addEventListener('seeked', onOk); setTimeout(() => fin(false), 3000); v2.currentTime = t;
      });
      // Hệ số quay chậm k: 1 giây thực tế = k giây video
      let k = $('vslow').value === 'auto' ? 0 : +$('vslow').value;
      if (!k) {
        setPhase('Đang nhận biết video có quay chậm không...', 'wn');
        const np = Math.min(240, Math.floor((dur - start) * 20)), ys = [];
        await plFresh();
        for (let i = 0; i < np && !S.abort; i++) {
          const r = (await seek(start + i / 20)) ? await detect(v2, i * 50) : null, lm = r && r.poseLandmarks;
          ys.push(lm ? (lm[23].y + lm[24].y) / 2 : NaN);
          $('count').textContent = Math.round((i + 1) / np * 100) + '%'; $('progf').style.width = Math.round((i + 1) / np * 100) / 2 + '%';
        }
        k = guessSlow(ys, 20);
      }
      S.slow = k;
      const needVid = CFG.clip * k, avail = dur - start;
      const vclip = Math.min(needVid, avail);
      if (vclip / k < 6) throw new Error('Video quá ngắn: cần ít nhất ' + Math.ceil(6 * k) + ' giây video (= 6 giây thực tế) sau điểm bắt đầu' + (k > 1 ? ' vì video quay chậm gấp ' + k : '') + '.');
      const n = Math.floor(vclip / k * CFG.fps);
      await plFresh();
      const t0 = performance.now();
      for (let i = 0; i < n && !S.abort; i++) {
        const r = (await seek(start + i * k / CFG.fps)) ? await detect(v2, i * k * 1000 / CFG.fps) : null;
        const lm0 = r && r.poseLandmarks ? r.poseLandmarks : null;
        if (!S.take && lm0 && angFeed(lm0, vw, vh) && !S.take && S.angF.length >= 90) throw new Error(angMsg(Angle.decide(S.angF).why));
        const lm = S.take === 'back' ? fixLR(lm0) : lm0;
        S.lastLm = lm; lvFeed(i / CFG.fps, lm); drawLive(lm);
        const rec = { t: i / CFG.fps, lm: lm0 ? lm0.map((q) => ({ x: q.x * vw, y: q.y * vh, v: q.visibility == null ? 1 : q.visibility })) : null, vw, vh, blob: null, sc };
        if (lm && i % 3 === 0) {
          grab.width = Math.round(vw * sc); grab.height = Math.round(vh * sc); gctx.drawImage(v2, 0, 0, grab.width, grab.height);
          await new Promise((res) => grab.toBlob((b) => { rec.blob = b; res(); }, 'image/jpeg', 0.85));
        }
        S.frames.push(rec);
        const pc = Math.round((i + 1) / n * 100);
        $('count').textContent = pc + '%'; $('progf').style.width = pc + '%';
        const left = Math.max(0, Math.round(((performance.now() - t0) / (i + 1)) * (n - i - 1) / 1000));
        setPhase('Đang phân tích video · còn khoảng ' + left + ' giây', 'rec'); lvRec(left, (n - i - 1) / n);
      }
      lvRec(null);
      if (S.abort) return;
      setPhase('Đang tính kết quả...', 'wn');
      analyse();
      let g = 0; while (!S.result && !S.error && g++ < 600) await new Promise((r) => setTimeout(r, 100));
      await finish();
    } catch (e) {
      S.running = false; show('L1'); $('msg1').textContent = e.message; $('angpick').hidden = !/^Chưa nhận ra góc quay/.test(e.message); refreshL1();
    }
  }
  $('early').addEventListener('click', () => { S.endNow = true; });
  $('nowbtn').addEventListener('click', () => { S.recAt = performance.now() / 1000 - S.t0; S.recWhy = 'đo ngay'; });
  $('cancel').addEventListener('click', () => { if (!confirm('Dừng đo và không lưu kết quả của lần này?')) return; if (REC.mr) recStop(false); S.abort = true; S.running = false; clearInterval(S.timer); show('L1'); refreshL1(); });
  // Chọn tay góc quay (đổi giữa lần đo, hoặc khi app không nhận được góc thì đo lại với góc đã chọn)
  $('angchg').addEventListener('click', () => { if (BACK_ON && S.running && S.take && !S.computing && !S.result) setTake(S.take === 'back' ? 'side' : 'back', true); });
  $('angpick').addEventListener('click', (e) => { const b = e.target.closest('button[data-a]'); if (!b || $('go').disabled) return; S.angMan = b.dataset.a; $('go').click(); });
  $('go').addEventListener('click', () => { $('msg1').textContent = ''; $('angpick').hidden = true; if (S.mode === 'file') startVideo(); else { App.SPEED = App.SPEED0; startRun(); } });

})(window.App);
