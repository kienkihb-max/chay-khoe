/* app/save.js - kết thúc đo, lưu, xem lại góc, IndexedDB, ghi chú, đăng ký, tải ảnh. Một phần của app cũ; cách chia sẻ biến xem đầu app/core.js. */
(function (App) {
  'use strict';
  const { $, CFG, ZALO, REF, CAD_REDO, BLUE, ORANGE, TC, S, ANG_NAME, show, pad, REC, recStop, refreshL1,
    lvLevel, LV_CARDS, LV_CARDS_BACK, LV_PERLEG_BACK, sideTxt, titleCase, f1, cval, cadLow, flagItems, rr,
    drawPhoto, scores, conclusion, drawResult, poorFrameWarn, EXL, resetDetail } = App;
  // hàm ở file nạp sau: gọi qua App khi chạy
  function makePdf(...a) { return App.makePdf(...a); }
  function sendRow(...a) { return App.sendRow(...a); }
  function go(...a) { return App.go(...a); }
  // hàm của file này (khai báo function được nâng lên đầu nên đưa ra ngay)
  Object.assign(App, { finish, saveResult, drawBackPhoto, openResult, updateNoteBtn, closeNote });
  // ---------- Lớp 3 ----------
  async function finish(seed) {   // seed = true: nạp dữ liệu mẫu, chỉ lưu vào danh sách và IndexedDB, không đổi màn, không gửi Sheet
    if (REC.mr) await recStop(true, S.sub && S.sub.name);
    S.running = false; clearInterval(S.timer);
    if (S.error) {
      show('L1'); $('msg1').textContent = 'Không đo được: ' + S.error + ' Hãy bấm Bắt đầu để đo lại.'; $('angpick').hidden = !/^Chưa nhận ra góc quay/.test(S.error);
      refreshL1(); return;
    }
    let guard = 0; while (!S.photosReady && guard++ < 50) await new Promise((r) => setTimeout(r, 100));
    const R = S.result;
    if (R.angle !== 'back') {
      try {
        if (S.late && S.late.length > 60) {
          const rs = Gait.resample(S.late, S.fps || CFG.fps), bb = Gait.computeBoth(rs.P, S.fps || CFG.fps, R.sub.height, App.SPEED);
          R.fat = Gait.fatigue(R, { comb: Gait.combine(bb.res, App.SPEED) });
        }
      } catch (e) { R.fat = null; }
    }
    R.when = Date.now(); R.speed = App.SPEED;
    if (seed) { await saveResult(R, S.photos || {}, true); return; }
    // quay xong một góc: xem lại rồi chốt, chưa lưu/gửi; kết quả chỉ xuất khi bấm "Quay xong · xuất kết quả"
    show('L1'); $('msg1').textContent = ''; refreshL1();
    openReview(R, S.photos || {});
  }

  // Lưu một kết quả (đã ghép các góc): vẽ màn Kết quả, thêm dòng danh sách, lưu IndexedDB. Trả về dòng để gửi Sheet.
  // Chỉ quay sau lưng: R.comb = null, các cột chỉ số nhìn ngang để trống.
  async function saveResult(R, photos, seed) {
    S.result = R; S.photos = photos;
    $('note').value = '';   // người mới: không mang ghi chú của kết quả vừa mở lại từ Danh sách
    if (!seed) {
      drawResult(R);
      resetDetail(R);
      resetReg(R);
      show('L3');
    }
    // dòng dữ liệu (danh sách + Google Sheet)
    const nowd = new Date(R.when);
    const row = { id: R.sub.id, time: pad(nowd.getDate()) + '/' + pad(nowd.getMonth() + 1) + '/' + nowd.getFullYear() + ' ' + pad(nowd.getHours()) + ':' + pad(nowd.getMinutes()), name: R.sub.name, phone: R.sub.phone, height_cm: R.sub.height, pain: R.sub.pain, note: '' };
    for (const k of Gait.COMMON) row[k] = R.comb ? +cval(R, k).toFixed(2) : '';
    if (cadLow(R)) row.cadence = '';   // nhịp bước dưới CAD_REDO nghi đo thiếu: không ghi số vào Sheet/danh sách, cột Cờ tin cậy ghi "cần đo lại"
    for (const k of Gait.PERLEG) for (const s of ['L', 'R']) row[k + '_' + s] = R.res[s] ? +R.res[s].metrics[k].toFixed(2) : '';
    for (const s of ['L', 'R']) row['foot_strike_' + s] = R.res[s] ? R.res[s].extra.strike : '';
    if (R.ex) {
      for (const k of ['flight_ms', 'duty', 'step_cv', 'step_asym', 'contact_asym']) row[k] = R.ex.common[k] != null && !Number.isNaN(R.ex.common[k]) ? +R.ex.common[k].toFixed(2) : '';
      for (const k of EXL) for (const sd of ['L', 'R']) { const v = R.ex.per[sd] ? R.ex.per[sd][k] : NaN; row[k + '_' + sd] = v != null && !Number.isNaN(v) ? +v.toFixed(2) : ''; }
    }
    if (R.back) {   // chỉ số góc sau lưng (chưa quay góc sau thì để trống)
      const n2 = (v) => (v != null && !Number.isNaN(v) ? +v.toFixed(2) : '');
      for (const k of Score.BACK_PERLEG) for (const sd of ['L', 'R']) row[k + '_' + sd] = n2(R.back.per && R.back.per[sd] ? R.back.per[sd][k] : NaN);
      for (const k of Score.BACK_COMMON) row[k] = n2(R.back.common ? R.back.common[k] : NaN);
    }
    { // điểm: một góc = điểm góc đó; hai góc = trung bình 50/50, lưu thêm điểm riêng từng góc
      const sc2 = scores(R), e = (v) => (v != null ? v : '');
      row.score_total = e(sc2.total); row.score_L = e(sc2.L); row.score_R = e(sc2.R);
      row.score_side = e(sc2.side && sc2.side.total); row.score_back = e(sc2.back && sc2.back.total);
    }
    if (R.fat) { row.fat_cad = +R.fat.d_cadence.toFixed(1); row.fat_vert = +R.fat.d_vert.toFixed(2); }
    for (const s of ['L', 'R']) row['steps_' + s] = R.res[s] ? R.res[s].extra.nSteps : '';
    { // cột cờ tin cậy: mỗi chỉ số có cờ một đoạn "Tên: Dưới ngưỡng tin cậy ±X / Nghi bắt sai mốc: lý do"; trống nếu không có cờ
      const parts = [];
      for (const k of Gait.COMMON.concat(Gait.PERLEG)) {
        const common = Gait.COMMON.includes(k);
        for (const it of flagItems(R, k, common)) parts.push(((REF[k] && REF[k].label) || k) + ' · ' + it.short + (it.kind === 'sus' ? ': ' + it.reason : ''));
      }
      if (cadLow(R)) parts.unshift('Nhịp bước: cần đo lại (dưới ' + CAD_REDO + ' bước/phút, số không ghi)');
      row.flags = parts.join(' | ');
    }
    try { row.short = App.shortResult ? App.shortResult(R, row) : ''; } catch (e) { row.short = ''; }   // cột 'Kết quả rút gọn' trên Google Sheet
    const cc = R.comb ? conclusion(R) : { text: '', adv: [] }; row.conclusion = cc.text; row.advice = cc.adv.join(' | ');
    S.rows.push(row); S.nextId++;
    try { localStorage.setItem('gait_rows', JSON.stringify(S.rows)); } catch (e) { /* bỏ qua */ }
    await saveDetail(row, R, photos);
    return row;
  }

  // ---------- Xem lại một lần quay: khung xương trên ảnh + vài số chính · Chốt góc này / Quay lại ----------
  // Số và nhãn dùng đúng bộ thẻ của lớp số trực tiếp (LV_CARDS / LV_CARDS_BACK), màu theo lvLevel như thẻ live.
  function reviewVal(R, k, s) {
    if (R.angle === 'back') return s ? (R.back.per[s] ? R.back.per[s][k] : NaN) : R.back.common[k];
    return s ? (R.res[s] ? R.res[s].metrics[k] : NaN) : cval(R, k);
  }
  function openReview(R, photos) {
    let el = $('rv');
    if (!el) { el = document.createElement('div'); el.id = 'rv'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'rvt'); document.body.appendChild(el); }
    const back = R.angle === 'back', list = back ? LV_CARDS_BACK : LV_CARDS, perLeg = back ? LV_PERLEG_BACK : ['knee_ic'];
    const ok = (v) => v != null && !Number.isNaN(v);
    const fmt = (k, v) => (!ok(v) ? '–' : k === 'cadence' ? String(Math.round(v)) : f1(v));
    const cell = (k, t, u, v, leg) => '<div class="rvn" data-lv="' + (ok(v) ? lvLevel(k, v) : 'none') + '"><em>' + t + '</em><b>' + fmt(k, v) + (u === '°' && ok(v) ? '°' : '') + '</b><small>' + (leg ? sideTxt(leg) : u === '°' ? '' : u) + '</small></div>';
    let nums = '';
    for (const [k, t, u] of list) {
      if (perLeg.includes(k)) for (const sd of ['L', 'R']) nums += cell(k, t, u, reviewVal(R, k, sd), sd);
      else if (k === 'cadence' && cadLow(R)) nums += '<div class="rvn" data-lv="none"><em>' + t + '</em><b>–</b><small>Cần đo lại</small></div>';
      else nums += cell(k, t, u, reviewVal(R, k, null), null);
    }
    const errs = Object.values((back ? R.back.errs : R.errs) || {}).filter(Boolean);
    if (!back && R.q && R.q.bad) errs.unshift('Không đáng tin: ' + R.q.why.join('; '));
    el.innerHTML = '<div class="rvcard"><h2 id="rvt"></h2>' +
      '<canvas id="rvc" width="' + (back ? 640 : 1188) + '" height="' + (back ? 640 : 438) + '"></canvas>' +
      '<div class="rvnums">' + nums + '</div>' +
      (errs.length ? '<div class="rvw"></div>' : '') + (poorFrameWarn(R) ? '<div class="poorframe" id="rvpoor"></div>' : '') +
      '<p class="rvq"><b>Kiểm tra nhanh:</b> khung xương trên ảnh có bám đúng hông, gối, cổ chân, gót và mũi chân của khách không? Nếu lệch khỏi người, lẫn chân trái và phải, hoặc có cảnh báo màu cam, hãy bấm Quay lại để đo lại.</p>' +
      '<div class="rvbtn"><button class="alt" id="rvback">Sai · Quay lại</button><button class="go" id="rvok">Đúng · Chốt kết quả</button></div></div>';
    $('rvt').textContent = 'Kiểm tra nhanh góc ' + ANG_NAME[R.angle] + ' · ' + R.sub.name;
    if (errs.length) el.querySelector('.rvw').textContent = errs.join(' · ');
    if (poorFrameWarn(R)) $('rvpoor').textContent = poorFrameWarn(R);
    const c = $('rvc').getContext('2d');
    if (back) drawBackPhoto(c, photos.B, 0, 0, 640, 640);
    else { drawPhoto(c, photos.L, 'L', 0, 0, 584, 438, R); drawPhoto(c, photos.R, 'R', 604, 0, 584, 438, R); }
    el.hidden = false;
    // Quay lại: bỏ lần quay này, về màn chuẩn bị để quay lại góc đang chọn
    $('rvback').onclick = () => { el.hidden = true; S.result = null; refreshL1(); $('go').focus(); };
    // Chốt: giữ lần quay vào phiên của người này (quay lại góc đã chốt thì ghi đè)
    $('rvok').onclick = () => {
      S.sess = S.sess || {}; S.sess.sub = R.sub; S.sess[R.angle] = { R, photos };
      el.hidden = true; S.result = null; refreshL1(); $('done').focus();
    };
    $('rvok').focus();
  }
  // Ảnh xem lại góc sau lưng: cắt quanh vai–hông–gối–cổ chân hai bên; chân trái xanh dương, chân phải cam (giống ảnh kết quả)
  function drawBackPhoto(c, ph, x, y, w, h, flatBottom) {   // flatBottom: đáy vuông để dính liền phần chữ bên dưới (ảnh Kết quả)
    c.save(); rr(c, x, y, w, h, flatBottom ? [22, 22, 0, 0] : 24); c.clip();
    c.fillStyle = '#1B2A34'; c.fillRect(x, y, w, h);
    if (ph && ph.lm) {
      const pts = []; for (const sd of ['L', 'R']) for (const k of ['sh', 'hip', 'knee', 'ank']) pts.push(ph.lm[sd][k]);
      const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
      const y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
      const m = Math.max(40, 0.2 * Math.max(x1 - x0, y1 - y0)), asp = w / h;
      let bw = x1 - x0 + 2 * m, bh = y1 - y0 + 2 * m;
      if (bw / bh < asp) bw = bh * asp; else bh = bw / asp;
      let sx = (x0 + x1) / 2 - bw / 2, sy = (y0 + y1) / 2 - bh / 2;
      if (bw <= ph.vw) sx = Math.max(0, Math.min(ph.vw - bw, sx));
      if (bh <= ph.vh) sy = Math.max(0, Math.min(ph.vh - bh, sy));
      const ix0 = Math.max(sx, 0), iy0 = Math.max(sy, 0), ix1 = Math.min(sx + bw, ph.vw), iy1 = Math.min(sy + bh, ph.vh), k = w / bw;
      c.drawImage(ph.bmp, ix0 * ph.sc, iy0 * ph.sc, (ix1 - ix0) * ph.sc, (iy1 - iy0) * ph.sc, x + (ix0 - sx) * k, y + (iy0 - sy) * k, (ix1 - ix0) * k, (iy1 - iy0) * k);
      const P = (p) => [x + (p[0] - sx) * k, y + (p[1] - sy) * k];
      const seg = (a, b, col, lw) => { const A = P(a), B = P(b); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke(); };
      seg(ph.lm.L.hip, ph.lm.R.hip, '#fff', 4); seg(ph.lm.L.sh, ph.lm.R.sh, '#fff', 4);
      for (const sd of ['L', 'R']) {
        const o = ph.lm[sd], col = sd === 'L' ? BLUE : ORANGE;
        seg(o.sh, o.hip, col, 7); seg(o.hip, o.knee, col, 7); seg(o.knee, o.ank, col, 7);
        for (const kk of ['sh', 'hip', 'knee', 'ank']) { const A = P(o[kk]); c.fillStyle = col; c.beginPath(); c.arc(A[0], A[1], 10, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); }
        const A = P(o.ank), txt = sd === 'L' ? 'Trái' : 'Phải';
        c.font = '700 26px ' + Themes.font; const tw = c.measureText(txt).width + 28;
        c.fillStyle = col; rr(c, A[0] - tw / 2, A[1] + 22, tw, 42, 21); c.fill();
        c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, A[0], A[1] + 44); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      }
    } else {
      c.fillStyle = '#8FA3AE'; c.font = '28px ' + Themes.font; c.textAlign = 'center';
      c.fillText('Chưa bắt được khung hình', x + w / 2, y + h / 2); c.textAlign = 'left';
    }
    c.restore();
    c.fillStyle = TC.brand; rr(c, x + 18, y + 16, 190, 46, 23); c.fill();
    c.fillStyle = '#fff'; c.font = '700 26px ' + Themes.font; c.textBaseline = 'middle';
    c.fillText('Nhìn từ sau', x + 38, y + 40); c.textBaseline = 'alphabetic';
  }
  // Quay xong · xuất kết quả: ghép các góc đã chốt thành một kết quả, ngày đo = hôm nay
  $('done').addEventListener('click', async () => {
    const ss = S.sess; if (S.running || !ss || !(ss.side || ss.back)) return;
    $('done').disabled = true;
    let R, photos;
    if (ss.side) {
      R = ss.side.R; photos = Object.assign({}, ss.side.photos);
      R.back = ss.back ? ss.back.R.back : null;
      if (ss.back && ss.back.photos.B) photos.B = ss.back.photos.B;
    } else {
      const b = ss.back.R;
      R = { angle: 'back', res: {}, errs: b.back.errs, comb: null, ex: null, fat: null, q: null, back: b.back, speed: b.speed };
      photos = { B: ss.back.photos.B };
    }
    R.sub = ss.sub; R.when = Date.now();
    S.sess = null;
    const row = await saveResult(R, photos, false);
    sendRow(row);
    go('#/result/' + encodeURIComponent(R.sub.id));
  });

  // ---------- Lưu kết quả chi tiết từng người (IndexedDB, theo mã người) để mở lại từ Danh sách ----------
  // Chỉ lưu phần cần để vẽ lại (drawResult, detailHTML, PDF, điểm, kết luận); bỏ R.P và res[s].arrays (rất nặng).
  // IndexedDB giữ nguyên NaN/Infinity và Blob (không qua JSON), nên chỉ số NaN vẫn hiện '–' như lúc vừa đo.
  const DB = { name: 'gait', store: 'results' };
  function idbOpen() {
    return new Promise((ok, no) => {
      if (!window.indexedDB) { no(new Error('Trình duyệt không có IndexedDB')); return; }
      const q = indexedDB.open(DB.name, 1);
      q.onupgradeneeded = () => q.result.createObjectStore(DB.store);
      q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error);
    });
  }
  async function idbDo(mode, fn) {
    const db = await idbOpen();
    try {
      return await new Promise((ok, no) => {
        const tx = db.transaction(DB.store, mode), rq = fn(tx.objectStore(DB.store));
        tx.oncomplete = () => ok(rq.result); tx.onerror = () => no(tx.error); tx.onabort = () => no(tx.error);
      });
    } finally { db.close(); }
  }
  async function saveDetail(row, R, ph) {
    try {
      const res = {};
      for (const s of Object.keys(R.res)) res[s] = R.res[s] ? { metrics: R.res[s].metrics, extra: R.res[s].extra } : R.res[s];
      const photos = {};
      for (const s of ['L', 'R', 'B']) { const p = ph[s]; if (p && p.blob) photos[s] = { blob: p.blob, sc: p.sc, lm: p.lm, lo: p.lo, up: p.up, vw: p.vw, vh: p.vh }; }
      const note = S.result === R ? $('note').value : '';
      const rec = { id: row.id, time: row.time, name: row.name, note, photos, R: { res, comb: R.comb, sub: R.sub, ex: R.ex, fat: R.fat, q: R.q, when: R.when, speed: R.speed, back: R.back || null } };
      await idbDo('readwrite', (st) => st.put(rec, row.id));
    } catch (e) { console.warn('Không lưu được kết quả chi tiết để mở lại:', e); }
  }
  async function openResult(id) {
    const row = S.rows.find((r) => r.id === id), want = location.hash;
    let rec = null;
    if (row) { try { rec = await idbDo('readonly', (st) => st.get(id)); } catch (e) { rec = null; } }
    if (location.hash !== want) return;   // trong lúc đọc, người dùng đã chuyển màn khác
    // bản ghi phải khớp đúng dòng (cùng giờ đo, cùng tên): tránh mở nhầm người khi danh sách bị xoá rồi đánh mã lại
    if (!rec || !rec.R || rec.time !== row.time || rec.name !== row.name) {
      history.replaceState(null, '', '#/');   // 8/11: màn danh sách đã ẩn
      show('L1'); refreshL1();
      $('msg1').textContent = row ? 'Không có dữ liệu chi tiết của ' + row.id + ' · ' + row.name + ' (người này đo trước khi app lưu kết quả chi tiết), nên không mở lại được màn kết quả. Thông tin tóm tắt vẫn có trong Google Sheet.' : 'Không tìm thấy mã ' + id + '.';
      return;
    }
    const photos = {};
    for (const s of ['L', 'R', 'B']) {
      const p = rec.photos && rec.photos[s];
      if (p && p.blob) { try { photos[s] = Object.assign({}, p, { bmp: await createImageBitmap(p.blob) }); } catch (e) { /* ảnh hỏng: ô ảnh để nền tối như khi không có ảnh */ } }
    }
    if (location.hash !== want) return;
    S.result = rec.R; S.photos = photos; S.photosReady = true;
    drawResult(S.result);
    resetDetail(S.result);
    resetReg(S.result);
    $('note').value = rec.note || '';
    show('L3');
  }
  // Ghi chú bác sĩ: lưu cùng kết quả mỗi khi gõ (người dùng chọn), mở lại thấy ghi chú cũ và PDF in giống lần đầu
  async function saveNote(id, v) {
    try {
      await idbDo('readwrite', (st) => { const g = st.get(id); g.onsuccess = () => { if (g.result) st.put(Object.assign(g.result, { note: v }), id); }; return g; });
    } catch (e) { console.warn('Không lưu được ghi chú:', e); }
  }
  // Ghi chú bác sĩ: #note (input ẩn) giữ bản ĐÃ LƯU; sửa trong drawer (#notetxt), bấm Lưu mới ghi + gửi lại cả dòng + PDF (cùng Mã nên Sheet ghi đè đúng dòng)
  const noteDirty = () => $('notetxt').value !== $('note').value;
  function updateNoteBtn() { $('notebtn').textContent = ($('note').value || '').trim() ? 'Sửa ghi chú' : 'Thêm ghi chú'; }
  function noteAsk(on) { $('noteask').style.display = on ? 'flex' : 'none'; }
  function openNote() {
    const R = S.result; if (!R) return;
    $('notetitle').textContent = 'Ghi chú bác sĩ · ' + R.sub.name;
    $('notetxt').value = $('note').value; $('notemsg').textContent = ''; noteAsk(false);
    $('notedrawer').classList.add('open'); $('notedrawer').setAttribute('aria-hidden', 'false'); $('notetxt').focus();
  }
  function closeNote(force) {
    if (!$('notedrawer').classList.contains('open')) return;
    if (!force && noteDirty()) { noteAsk(true); return; }   // chưa lưu: hỏi ngay trong drawer
    noteAsk(false); $('notedrawer').classList.remove('open'); $('notedrawer').setAttribute('aria-hidden', 'true'); $('notebtn').focus();
  }
  let noteSaving = false;
  async function saveNoteNow() {
    const R = S.result; if (!R || noteSaving) return;
    noteSaving = true; $('notesave').disabled = true;
    try {
      const id = R.sub.id, v = $('notetxt').value, row = S.rows.find((r) => r.id === id);
      $('note').value = v; updateNoteBtn();
      if (row) { row.note = v; try { localStorage.setItem('gait_rows', JSON.stringify(S.rows)); } catch (e) { /* bỏ qua */ } }
      const pdf = row ? makePdf(R) : null;
      await saveNote(id, v);
      let r = 'Đã lưu';
      if (row) r = await Promise.race([sendRow(row, pdf), new Promise((ok) => setTimeout(() => ok('Chờ gửi'), 4000))]);
      $('notemsg').textContent = r; noteAsk(false);
      await new Promise((ok) => setTimeout(ok, 800));
      closeNote(true);
    } finally { noteSaving = false; $('notesave').disabled = false; }
  }
  $('notebtn').addEventListener('click', openNote);

  // ---------- Khách: tải ảnh chỉ số cơ bản · đặt lịch qua Zalo · đăng ký nhận báo cáo chi tiết ----------
  // Báo cáo chi tiết (PDF) không cho khách tải: chỉ đi lên Drive qua sendRow, bác sĩ gửi riêng qua Zalo.
  const vnPhone = (v) => { const d = (v || '').replace(/[\s.\-()]/g, ''); return /^(0|\+?84)(3|5|7|8|9)\d{8}$/.test(d) ? d : ''; };
  function regMsg(t, ok) { $('regmsg').textContent = t; $('regmsg').classList.toggle('ok', !!ok); }
  function resetReg(R) {
    const sub = (R && R.sub) || {};
    $('regname').value = sub.name && sub.name !== 'Khách ' + sub.id ? sub.name : titleCase($('name').value || '');
    $('regphone').value = sub.phone || $('phone').value.trim();
    $('regok').checked = false; $('regsend').disabled = false;
    $('regfb').hidden = true; $('regcopy').textContent = ''; regMsg('');
  }
  let regSending = false;
  async function sendReg(ev) {
    ev.preventDefault();
    const R = S.result; if (!R || regSending) return;
    const name = titleCase($('regname').value), phone = vnPhone($('regphone').value);
    if (!name) { regMsg('Vui lòng nhập họ tên.'); $('regname').focus(); return; }
    if (!phone) { regMsg('Số điện thoại chưa đúng. Nhập số di động Việt Nam 10 số, ví dụ 0912 345 678.'); $('regphone').focus(); return; }
    if (!$('regok').checked) { regMsg('Vui lòng đánh dấu ô đồng ý để gửi kết quả cho bác sĩ.'); $('regok').focus(); return; }
    regSending = true; $('regsend').disabled = true; $('regfb').hidden = true; $('regcopy').textContent = ''; regMsg('Đang gửi…', true);
    let r = '';
    try {
      const id = R.sub.id, row = S.rows.find((x) => x.id === id);
      if (row) {
        // tên/SĐT vừa đăng ký thay cho bản ở form đo: danh sách, IndexedDB (để mở lại khớp tên), ảnh + PDF gửi kèm
        R.sub.name = name; R.sub.phone = phone; row.name = name; row.phone = phone;
        $('regname').value = name; $('regphone').value = phone;
        try { localStorage.setItem('gait_rows', JSON.stringify(S.rows)); } catch (e) { /* bỏ qua */ }
        try {
          await idbDo('readwrite', (st) => { const g = st.get(id); g.onsuccess = () => { if (g.result) { g.result.name = name; if (g.result.R && g.result.R.sub) Object.assign(g.result.R.sub, { name, phone }); st.put(g.result, id); } }; return g; });
        } catch (e) { console.warn('Không lưu được tên đăng ký để mở lại:', e); }
        drawResult(R);
        r = await Promise.race([sendRow(row, makePdf(R)), new Promise((ok) => setTimeout(() => ok('Chờ gửi'), 6000))]);
      }
    } catch (e) { console.warn('Chưa gửi được đăng ký:', e); }
    finally { regSending = false; $('regsend').disabled = false; }
    if (r === 'Đã gửi') { regMsg('Đã đăng ký. Bác sĩ sẽ liên hệ qua Zalo để gửi báo cáo chi tiết.', true); return; }
    regMsg(r === 'Chờ gửi' ? 'Chưa gửi được ngay (mạng yếu), máy sẽ tự gửi lại. Để chắc chắn, hãy gửi thông tin qua Zalo.' : 'Chưa gửi được đăng ký. Hãy gửi thông tin qua Zalo.');
    $('regfb').hidden = false;
  }
  $('regf').addEventListener('submit', sendReg);
  for (const k of ['regname', 'regphone', 'regok']) $(k).addEventListener('input', () => { if (!$('regmsg').classList.contains('ok')) regMsg(''); });
  // dự phòng khi chưa gửi được: chép Mã + họ tên + SĐT để khách dán vào Zalo bác sĩ
  $('regzalo').addEventListener('click', async () => {
    const R = S.result;
    const txt = 'Đăng ký nhận báo cáo chi tiết\nMã: ' + (R ? R.sub.id : '') + '\nHọ tên: ' + titleCase($('regname').value) + '\nSĐT/Zalo: ' + $('regphone').value.trim();
    let ok = false;
    try { await navigator.clipboard.writeText(txt); ok = true; } catch (e) { /* trình duyệt chặn sao chép */ }
    $('regcopy').textContent = ok ? 'Đã sao chép, dán vào Zalo' : 'Không sao chép được, hãy gõ mã kết quả và họ tên vào Zalo';
    window.open(ZALO, '_blank', 'noopener');
  });
  $('dlimg').addEventListener('click', () => {
    const R = S.result; if (!R) return;
    $('res').toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a'), u = URL.createObjectURL(b);
      a.href = u; a.download = App.fileName(R.sub, 'png', 'ket-qua-' + R.sub.id);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 4000);
    }, 'image/png');
  });
  $('notesave').addEventListener('click', saveNoteNow);
  $('noteclose').addEventListener('click', () => closeNote(false));
  $('notebg').addEventListener('click', () => closeNote(false));
  $('notekeep').addEventListener('click', () => { noteAsk(false); $('notetxt').focus(); });
  $('notediscard').addEventListener('click', () => closeNote(true));
  $('notetxt').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveNoteNow(); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('notedrawer').classList.contains('open')) closeNote(false); });

})(window.App);
