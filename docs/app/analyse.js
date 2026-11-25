/* app/analyse.js - phân tích lần đo, kiểm tra độ tin cậy, cờ tin cậy. Một phần của app cũ; cách chia sẻ biến xem đầu app/core.js. */
(function (App) {
  'use strict';
  const { $, CFG, REF, CAD_REDO, BACK_DETAIL, GREEN, AMBER, TIER_RED, S, angMsg, setTake, fixLR, LV_XI } = App;
  // hàm của file này (khai báo function được nâng lên đầu nên đưa ra ngay)
  Object.assign(App, { framePoor, guessSlow, analyse, rating, statInfo, barHTML, flagList, flagItems });
  // ---------- Phân tích ----------
  const titleCase = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|\s)(\S)/g, (m, p, q) => p + q.toUpperCase());
  // Kiểm tra độ tin cậy của lần đo: nếu có dấu hiệu sai thì không cho điểm và không kết luận
  function qualityCheck(frames, FPS, res, comb) {
    const why = [], ok = frames.filter((f) => f.lm).length, det = frames.length ? ok / frames.length : 0;
    if (S.mode !== 'file' && FPS < 15) why.push('máy chỉ nhận diện ' + FPS + ' khung/giây (cần từ 20)');
    if (det < 0.8) why.push('chỉ nhận diện được người ở ' + Math.round(det * 100) + '% số khung hình');
    const cad = comb.common.cadence;
    if (cad < CAD_REDO) why.push('nhịp bước đo được thấp bất thường, cần đo lại' + (S.mode === 'file' ? ' (nếu là video quay chậm, hãy chọn đúng hệ số ở ô "Video quay chậm")' : ''));
    else if (cad > 230) why.push('nhịp chạy đo được ' + Math.round(cad) + ' bước/phút không hợp lý');
    for (const s of ['L', 'R']) if (res[s]) {
      const e = res[s].extra, nm = s === 'L' ? 'trái' : 'phải';
      if (Math.abs(e.cadIC - e.cadFFT) > 0.15 * e.cadFFT) why.push('chân ' + nm + ': hai cách đo nhịp lệch nhau (' + Math.round(e.cadIC) + ' và ' + Math.round(e.cadFFT) + ')');
      if (Math.abs(res[s].metrics.overstride) > 40) why.push('chân ' + nm + ': vị trí đặt chân bất thường (' + Math.round(res[s].metrics.overstride) + ' cm), có thể nhận diện sai');
    }
    // poor: lý do 'Khung hình kém' (cảnh báo, không chặn điểm). Lưu chung trong q để mọi chỗ hiện độ tin cậy đọc cùng một nguồn.
    return { bad: why.length > 0, why, poor: framePoor({ res }), fps: FPS, det, frames: frames.length, slow: S.mode === 'file' ? S.slow : 1 };
  }
  // Lý do 'Khung hình kém': quá nhiều khung có điểm mờ (dưới Gait.VIS_MIN) bị bỏ, hoặc còn quá ít bước. Trả [] nếu ổn.
  // "Nhận diện N% khung hình" chỉ đếm khung thấy người; điểm mờ là khung thấy người nhưng khớp chân không rõ, nên hai số có thể cùng lúc 100% và kém.
  function framePoor(R) {
    const ex = R && (R.back ? [R.back.extra] : ['L', 'R'].filter((s) => R.res && R.res[s]).map((s) => R.res[s].extra));
    if (!ex || !ex.length) return [];
    const bf = Math.max(...ex.map((e) => (e.badFrac == null ? 0 : e.badFrac)));
    const steps = R.back ? Math.min(...['L', 'R'].map((s) => (R.back.extra.steps && R.back.extra.steps[s] != null ? R.back.extra.steps[s] : Infinity))) : Math.min(...ex.map((e) => e.nSteps));
    const why = [];
    if (bf > Gait.BAD_FRAC_MAX) why.push('nhiều khung hình có điểm mờ');   // không nêu tỷ lệ %: con số lấy theo chân xa camera nên dễ gây hiểu lầm
    if (steps < Gait.MIN_STEPS) why.push('chỉ còn ' + steps + ' bước');
    return why;
  }
  // Đoán hệ số quay chậm từ chuyển động lên xuống của hông: chọn k để nhịp thực tế rơi vào 140–210 bước/phút
  function guessSlow(ys, rate) {
    const v = ys.filter((q) => !Number.isNaN(q)); if (v.length < ys.length * 0.6 || v.length < 60) return 1;
    const m = v.reduce((p, q) => p + q, 0) / v.length, n = ys.length, y = ys.map((q) => (Number.isNaN(q) ? 0 : q - m));
    let bf = 0, bp = -1;
    for (let f = 0.15; f <= 5; f += 0.01) {
      let re = 0, im = 0; const w = 2 * Math.PI * f / rate;
      for (let i = 0; i < n; i++) { const hw = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)); re += y[i] * hw * Math.cos(w * i); im -= y[i] * hw * Math.sin(w * i); }
      const p = re * re + im * im; if (p > bp) { bp = p; bf = f; }
    }
    let best = 1, bd = 1e9;
    for (const k of [1, 2, 4, 8]) { const cad = bf * k * 60; if (cad >= 140 && cad <= 210 && Math.abs(cad - 175) < bd) { bd = Math.abs(cad - 175); best = k; } }
    return best;
  }
  function effFps(frames) {   // tốc độ nhận diện thực tế (không vượt cài đặt)
    const ok = frames.filter((f) => f.lm); if (ok.length < 10) return CFG.fps;
    const r = (ok.length - 1) / (ok[ok.length - 1].t - ok[0].t);
    return Math.max(10, Math.min(CFG.fps, Math.round(r)));
  }
  function analyse() {
    S.computing = true; S.error = null; S.photosReady = false; $('angchg').hidden = true;
    setTimeout(() => {
      try {
        const frames = S.frames;
        // khung lưu toạ độ thô: chưa nhận góc thì nhận trên đoạn quay; vẫn không chắc thì báo lỗi, không tính chỉ số
        if (!S.take) {
          const d = Angle.decide(frames.map((f) => f.lm && Angle.feat(f.lm)));
          if (!d.angle) throw new Error(angMsg(d.why));
          setTake(d.angle);
        }
        if (S.take === 'back') frames.forEach((f) => { f.lm = fixLR(f.lm); });
        const FPS = S.mode === 'file' ? CFG.fps : effFps(frames); S.fps = FPS;
        const { P, N, t0 } = Gait.resample(frames, FPS);
        if (S.take === 'back') {   // góc sau lưng: chỉ số nhìn từ sau, lưu ở R.back
          const b = Gait.computeBack(P, FPS, S.sub.height);
          S.result = { angle: 'back', back: { per: b.per, common: b.common, errs: b.errs, extra: b.extra }, arrays: b.arrays, P, N, t0, sub: S.sub };
          S.photos = {};
          pickBackPhoto(frames, S.result).then(() => { S.photosReady = true; });
          S.computing = false; return;
        }
        // PF = P đã ghi lại theo chân thật (findSteps gỡ chỗ MediaPipe tráo nhãn trái/phải). Ảnh minh hoạ phải vẽ bằng PF,
        // vẽ bằng P thô thì ở khung bị tráo nhãn khung xương "chân trái" nằm trên chân phải hoặc ghép gối chân này với bàn chân kia.
        const { res, errs, P: PF } = Gait.computeBoth(P, FPS, S.sub.height, App.SPEED);
        const stand = S.recAt != null ? S.standRun || null : null;   // tư thế đứng lấy ở màn nhập (stand.js), chỉ cho lần quay trực tiếp
        if (stand) App.applyStand(res, stand);
        const comb = Gait.combine(res, App.SPEED);
        let ex = null; try { ex = Gait.computeExtra(P, FPS, res, comb.common, App.SPEED); } catch (e) { ex = null; }
        S.result = { angle: 'side', res, errs, comb, P: PF || P, N, t0, sub: S.sub, ex, fat: null, q: qualityCheck(frames, FPS, res, comb), cam: S.recAt != null ? S.camAt || null : null, stand };   // cam: số đo góc máy lúc bấm Quay (camchk.js)
        S.photos = {};
        pickPhotos(frames, S.result).then(() => { S.photosReady = true; });
      } catch (e) { S.error = e.message; }
      S.computing = false;
    }, 50);
  }

  async function pickPhotos(frames, R) {
    const withImg = frames.filter((f) => f.blob);
    for (const s of Object.keys(R.res)) {
      const ic = R.res[s].arrays.ic; if (!ic.length) continue;
      // Chỉ 1/3 số khung có lưu ảnh. Chọn lần chạm đất gần giữa đoạn thu nhất mà ĐÚNG khung đó có ảnh, để khung xương khớp hình.
      // Không có lần nào trùng thì lấy lần ở giữa và vẽ khung xương của chính khung có ảnh (lệch tối đa 1 khung so với lúc chạm đất).
      const fps = S.fps || CFG.fps, mid = Math.floor(ic.length / 2);
      const near = (i) => { const tt = R.t0 + i / fps; let best = null, bd = 1e9; for (const f of withImg) { const d = Math.abs(f.t - tt); if (d < bd) { bd = d; best = f; } } return { best, bd }; };
      let i = ic[mid], pk = near(i);
      // Ảnh đẹp nhất (bác sĩ Kiên 25/11/2026): trong các lần chạm đất có ảnh đúng khung, chọn lần máy thấy rõ chân đó nhất
      // (độ rõ trung bình hông–gối–cổ chân–gót–mũi, landmark gốc của khung); bằng nhau thì lấy lần gần giữa đoạn thu.
      const legVis = (f) => { const raw = f.lm; if (!raw) return 0; const js = ['hip', 'knee', 'ank', 'heel', 'toe'].map((k) => Gait.IDX[s][k]).filter((j) => j != null && raw[j]);
        return js.length ? js.reduce((a, j) => a + (raw[j].v != null ? raw[j].v : 1), 0) / js.length : 0; };
      let bestV = -1;
      for (const c of ic.slice().sort((p, q) => Math.abs(p - ic[mid]) - Math.abs(q - ic[mid]))) { const n = near(c); if (n.best && n.bd < 0.5 / fps) { const v = legVis(n.best); if (v > bestV + 0.02) { bestV = v; i = c; pk = n; } } }
      const best = pk.best;
      if (!best) continue;
      if (pk.bd >= 0.5 / fps) i = Math.max(0, Math.min(R.N - 1, Math.round((best.t - R.t0) * fps)));
      const bmp = await createImageBitmap(best.blob);
      const lm = {};
      for (const k of Object.keys(Gait.IDX[s])) { const j = Gait.IDX[s][k]; lm[k] = [R.P.x[j][i], R.P.y[j][i]]; }
      const other = s === 'L' ? 'R' : 'L', lo = {};
      for (const k of Object.keys(Gait.IDX[other])) { const j = Gait.IDX[other][k]; lo[k] = [R.P.x[j][i], R.P.y[j][i]]; }
      // vai, tai, khuỷu, cổ tay hai bên (kèm độ rõ) cho ảnh lớn ở màn kết quả (drawHero): lấy landmark GỐC của chính khung có ảnh (best.lm),
      // không lấy R.P đã lấy mẫu lại (đo camera trực tiếp thì R.P nội suy giữa 2 khung, tay vung nhanh bị lệch khỏi hình). Chân vẫn dùng R.P đã gỡ tráo nhãn.
      const up = {}, raw = best.lm;
      for (const sd of ['L', 'R']) {
        up[sd] = {};
        for (const [k, j] of Object.entries(Object.assign({ sh: Gait.IDX[sd].sh }, LV_XI[sd]))) {
          if (raw && raw[j]) up[sd][k] = [raw[j].x, raw[j].y, raw[j].v];
          else if (R.P.x[j]) up[sd][k] = [R.P.x[j][i], R.P.y[j][i], R.P.v && R.P.v[j] ? R.P.v[j][i] : 1];
        }
      }
      S.photos[s] = { bmp, blob: best.blob, sc: best.sc, lm, lo, up, vw: best.vw, vh: best.vh };
    }
  }

  // Ảnh góc sau lưng: khung có hình gần lần trụ ở giữa đoạn thu của chân có nhiều bước hơn; lưu điểm vai/hông/gối/cổ chân của cả hai chân
  async function pickBackPhoto(frames, R) {
    const ev = R.arrays.ev, s = ev.L.length >= ev.R.length ? 'L' : 'R', list = ev[s];
    if (!list.length) return;
    const i = list[Math.floor(list.length / 2)], tt = R.t0 + i / (S.fps || CFG.fps);
    let best = null, bd = 1e9;
    for (const f of frames) if (f.blob) { const d = Math.abs(f.t - tt); if (d < bd) { bd = d; best = f; } }
    if (!best) return;
    const bmp = await createImageBitmap(best.blob), lm = {};
    for (const side of ['L', 'R']) { lm[side] = {}; for (const k of ['sh', 'hip', 'knee', 'ank']) { const j = Gait.IDX[side][k]; lm[side][k] = [R.P.x[j][i], R.P.y[j][i]]; } }
    S.photos.B = { bmp, blob: best.blob, sc: best.sc, lm, vw: best.vw, vh: best.vh };
  }

  // ---------- Đánh giá ----------
  function rating(k, v) {
    const c = REF[k]; if (!c || c.lo == null || v == null || Number.isNaN(v)) return { txt: 'n/a', ok: true };
    const r = Gait.rateValue(v, c);
    // lv: mức theo thang mới (Score.level: ok | mid = vùng Chú ý từ warn | bad); null khi chỉ số chưa có warn (góc sau lưng)
    return { txt: r, ok: r === 'trong khoảng', lv: Score.level(k, v) };
  }
  // Màu trạng thái dùng chung canvas (thẻ chỉ số) và bảng Chi tiết: Tốt = xanh, Thấp/Cao = hổ phách; thanh: giữa xanh, hai bên xám
  const BAR_IN = '#A9D69B', BAR_OUT = '#D5DCE1', BAR_PAD = 0.75;
  const barScale = (ref) => { const pd = (ref.hi - ref.lo) * BAR_PAD; return [ref.lo - pd, ref.hi + pd]; };
  function statInfo(k, v) {   // null = không có tham chiếu hoặc không đo được
    const c = REF[k]; if (!c || c.lo == null || v == null || Number.isNaN(v)) return null;
    const r = rating(k, v);
    const bad = r.lv === 'bad';   // Bất thường (ngoài vùng Chú ý) = đỏ như hạng Nguy cơ; Chú ý = hổ phách
    return { ok: r.ok, col: r.ok ? GREEN : bad ? TIER_RED : AMBER, bg: r.ok ? '#E3F1DC' : bad ? '#F7DEDA' : '#FBEBCF', label: r.ok ? 'Tốt' : r.txt === 'cao' ? 'Cao' : 'Thấp' };
  }
  function barHTML(k, dots, R) {   // dots: [{v, leg: 'L'|'R'|null}]; ghim mép khi ngoài thang như canvas
    const ref = REF[k]; if (!ref || ref.lo == null) return '';
    const [s0, s1] = barScale(ref), p = (t) => Math.max(0, Math.min(1, (t - s0) / (s1 - s0))) * 100;
    let h = '<div class="rbar" style="background:' + BAR_OUT + '"><i class="rin" style="left:' + p(ref.lo) + '%;width:' + (p(ref.hi) - p(ref.lo)) + '%;background:' + BAR_IN + '"></i>' +
      '<span class="rlb" style="left:' + p(ref.lo) + '%">' + ref.lo + '</span><span class="rlb" style="left:' + p(ref.hi) + '%">' + ref.hi + '</span>';
    for (const d of dots) { const st = statInfo(k, d.v); if (st) h += '<b class="rdot' + (d.leg ? ' ' + d.leg : '') + '" style="left:' + p(d.v) + '%;background:' + st.col + (R && flagged(R, k, d.leg || 'c') ? ';opacity:.45' : '') + '" title="' + (d.leg === 'L' ? 'Trái ' : d.leg === 'R' ? 'Phải ' : '') + f1(d.v) + '"></b>'; }
    return h + '</div>';
  }
  const f1 = (v) => (v == null || Number.isNaN(v) ? '–' : (Math.round(v * 10) / 10).toFixed(1).replace('.', ','));
  const f0 = (v) => (v == null || Number.isNaN(v) ? '–' : String(Math.round(v)));

  // ---------- Cờ tin cậy: "Dưới ngưỡng tin cậy ±X" và "Nghi bắt sai mốc" (đọc qua Score.flagOf, chịu được trường thiếu) ----------
  // Chỉ số có cờ thì KHÔNG tính vào điểm (khi COUNT_LOWCONF = false, xem Score.skipped); số vẫn hiện, chip/chấm/thẻ mờ đi cho khớp.
  // Chỉ áp cho chỉ số góc ngang (R.res); chỉ số góc sau không có cờ.
  const SPREAD_TIP = '±X là độ dao động giữa các bước (nửa khoảng tứ phân vị), không phải sai số đã kiểm chứng.';
  function flagList(R, k) {   // [{s: 'L'|'R', f: {lowConf, conf, spread, suspect, reason}}] chỉ các chân có cờ
    if (!R || !R.res || BACK_DETAIL.includes(k)) return [];
    return ['L', 'R'].filter((s) => R.res[s]).map((s) => ({ s, f: Score.flagOf(R.res[s], k) })).filter((x) => x.f.lowConf || x.f.suspect);
  }
  // Chỉ số bị bỏ khỏi lời kết luận/gợi ý/bài tập: có cờ và COUNT_LOWCONF=false (cùng quy tắc Score.skipped, dùng chung Score.countLow)
  // Luật theo chân ở Score.usableLegs: chỉ số riêng chân có cờ ở một chân thì dùng chân còn lại; hai chân đều có cờ mới bỏ hẳn.
  const excluded = (R, k) => !Score.usableLegs(R, k).length;
  const legName = (s) => (s === 'L' ? 'trái' : 'phải');
  const legNote = (R, k) => { const u = Score.usableLegs(R, k), n = ['L', 'R'].filter((s) => R.res[s]); return u.length && u.length < n.length ? ' (dựa trên chân ' + legName(u[0]) + '; chân ' + legName(n.find((s) => !u.includes(s))) + ' chưa đủ tin cậy)' : ''; };
  // Giá trị chỉ số chung HIỂN THỊ = giá trị dùng để tính điểm (Score.commonVal); cả hai chân có cờ (bị bỏ khỏi điểm) thì hiện số ghép hai chân, mờ.
  const cval = (R, k) => { const v = Score.commonVal(R, k); return v == null ? R.comb.common[k] : v; };
  // Lần đo (góc ngang) có cadence dưới CAD_REDO: không hiện số như kết quả thường, hiện "Cần đo lại" + khối Đề nghị đo lại
  const cadLow = (R) => { const v = R && R.comb && R.angle !== 'back' ? cval(R, 'cadence') : NaN; return Number.isFinite(v) && v < CAD_REDO; };
  const cvals = (R) => ({ cadence: cval(R, 'cadence'), vert_osc: cval(R, 'vert_osc'), trunk: cval(R, 'trunk') });
  // s = 'c' (chỉ số chung): chỉ mờ khi không còn chân nào dùng được; đã dùng chân không cờ thì không mờ (ghi "dựa trên chân X")
  const flagged = (R, k, s) => flagList(R, k).some((x) => (s === 'c' ? !Score.usableLegs(R, k).length : x.s === s));
  // Các dòng cờ để hiện: [{kind: 'low'|'sus', text, tip}]. common = chỉ số chung hai chân (không ghi tên chân).
  function flagItems(R, k, common) {
    const fl = flagList(R, k), unit = (REF[k] && REF[k].unit) || '', out = [];
    if (!fl.length) return out;
    const note = common && legNote(R, k).trim().slice(1, -1);   // bỏ cặp ngoặc đơn của legNote
    if (note) { const t = note; return [{ kind: 'note', short: t, text: t.charAt(0).toUpperCase() + t.slice(1), tip: 'Chân có cờ tin cậy không được tính vào chỉ số này.' }]; }
    const skip = Score.countLow() ? '' : ' Chỉ số này không được tính vào điểm.';
    const groups = common ? [{ pre: '', xs: fl }] : fl.map((x) => ({ pre: (x.s === 'L' ? 'Trái' : 'Phải') + ': ', xs: [x] }));
    for (const g of groups) {
      const low = g.xs.filter((x) => x.f.lowConf), sus = g.xs.filter((x) => x.f.suspect);
      if (low.length) {
        const sp = low.map((x) => x.f.spread).filter((v) => v != null), cf = low.map((x) => x.f.conf).filter((v) => v != null);
        const base = g.pre + 'Dưới ngưỡng tin cậy' + (sp.length ? ' ±' + f1(Math.max(...sp)) + (unit ? ' ' + unit : '') : '');
        out.push({ kind: 'low', short: base, text: base + (cf.length ? ' · tin cậy ' + Math.round(Math.min(...cf) * 100) + '%' : ''), tip: SPREAD_TIP + skip });
      }
      if (sus.length) out.push({ kind: 'sus', short: g.pre + 'Nghi bắt sai mốc', text: g.pre + 'Nghi bắt sai mốc', tip: sus[0].f.reason + '.' + skip, reason: sus[0].f.reason });
    }
    return out;
  }
  const escA = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const flagHTML = (R, k, common) => flagItems(R, k, common).map((it) => '<div class="tflag" title="' + escA(it.tip) + '"><span class="chip">' + escA(it.text) + '</span>' + (it.kind === 'sus' ? ' <span class="why">' + escA(it.reason) + '</span>' : '') + '</div>').join('');

  function summary(R) {
    const bad = [];
    const nm = { cadence: 'Cadence', vert_osc: 'Nhấp nhô', trunk: 'Nghiêng thân', overstride: 'Tiếp đất trước thân', knee_ic: 'Gối lúc chạm đất' };
    for (const k of ['cadence', 'vert_osc', 'trunk']) { const r = rating(k, cval(R, k)); if (!r.ok) bad.push(nm[k] + ' ' + r.txt); }
    for (const k of ['overstride', 'knee_ic']) {
      const parts = [];
      for (const s of ['L', 'R']) if (R.res[s]) { const r = rating(k, R.res[s].metrics[k]); if (!r.ok) parts.push((s === 'L' ? 'trái ' : 'phải ') + r.txt); }
      if (parts.length) bad.push(nm[k] + ' (' + parts.join(', ') + ')');
    }
    if (!bad.length) return 'Các chỉ số chính đều nằm trong khoảng tham chiếu.';
    return 'Cần chú ý: ' + bad.join(' · ') + '.';
  }

  Object.assign(App, { titleCase, BAR_IN, BAR_OUT, barScale, f1, f0, SPREAD_TIP, excluded, legName, legNote,
    cval, cadLow, cvals, flagged, escA, flagHTML });
})(window.App);
