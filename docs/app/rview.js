/* app/rview.js - màn kết quả dạng thẻ (#rview), drawResult. Một phần của app cũ; cách chia sẻ biến xem đầu app/core.js. */
(function (App) {
  'use strict';
  const { $, REF, AMBER, TIER_RED, TC, LINKS, S, pad, LV_VIS_UP, f1, f0, excluded, cval, cadLow, escA, rr, scores, tierOf,
    lvLevel, renderRedo, rvSentence } = App;
  // hàm ở file nạp sau: gọi qua App khi chạy
  function drawResultCv(...a) { return App.drawResultCv(...a); }
  // hàm của file này (khai báo function được nâng lên đầu nên đưa ra ngay)
  Object.assign(App, { rvData, rvCad, drawHero, rvSide, drawResult, pdfPage1, renderView });
  // ---------- Màn kết quả dạng thẻ (#rview), theo docs/mockup/ket-qua.html ----------
  // Câu mô tả từng chỉ số: app/rvdesc.js (trung tính, không kết luận; bác sĩ 15/11/2026).
  // Thứ tự thẻ = thứ tự trên ảnh tải về; ảnh chỉ đủ chỗ 16 thẻ nên chỉ số phụ (khuỷu) để cuối.
  // VI thống nhất 'Nhịp bước'; đuôi NBSP để i18n dịch riêng ra 'Cadence' (cặp 'Nhịp bước' trần là 'Step timing' của biểu đồ trực tiếp)
  const CAD_LABEL = 'Nhịp bước ';
  const RV_KEYS = ['cadence', 'contact_ms', 'vert_osc', 'trunk', 'knee_ic', 'shank_ic', 'overstride', 'knee_mid', 'hip_ext', 'knee_swing', 'hip_flex', 'leg_asym', 'step_cv', 'step_asym', 'contact_asym', 'head_fwd', 'elbow'];
  // 5 chỉ số chính ở bảng (mockup ket-qua-v2, bác sĩ duyệt): nhịp bước, đáp đất, góc cẳng chân lúc chạm, nhấp nhô thân, gập gối giữa
  // pha trụ. Dòng bảng dựng ở rvdesc.js (rvRows). Các chỉ số còn lại vẫn tính điểm, chỉ hiện ở chế độ bác sĩ.
  const RV_TOP = ['cadence', 'strike', 'shank_ic', 'vert_osc', 'knee_mid'];
  // Lấy từ R.ex (chỉ số bổ sung); cờ tin cậy đọc qua Score.evalMetric (R.ex.per[s].flags, R.ex.flags), cùng luật với điểm.
  const RV_EX_COMMON = ['step_cv', 'step_asym', 'contact_asym'], RV_EX_PER = ['contact_ms', 'hip_flex', 'elbow', 'head_fwd'];
  // Mức theo lvLevel (cùng ngưỡng với điểm). Chỉ còn dùng ở ảnh bố cục cũ (có góc sau); màn #rview và bố cục mới không hiện mức từng chỉ số (bác sĩ 15/11/2026).
  const RV_LV = { ok: { t: 'Tốt', cls: 'ok' }, mid: { t: 'Cần chú ý', cls: 'w' }, bad: { t: 'Bất thường', cls: 'b' }, none: { t: 'Chưa đủ tin cậy', cls: 'n' } };
  const RV_RANK = { none: -1, ok: 0, mid: 1, bad: 2 };
  const rvNum = (v, u) => (u === 'cm' || u === '%' || u === '× ngưỡng' ? f1(v) : f0(v));
  const rvOk = (v) => v != null && !Number.isNaN(v);
  // Khoảng 'Bình thường' khớp cách chấm (ref.side): chỉ phạt phía thấp thì ghi '≥ lo', chỉ phạt phía cao thì '≤ hi' (vd nhấp nhô 5.9 cm vẫn Tốt).
  const rvRange = (ref) => (ref.side === 'low' ? '≥ ' + ref.lo : ref.side === 'high' ? '≤ ' + ref.hi : ref.lo + ' – ' + ref.hi);
  // Số liệu một thẻ chỉ số, dùng chung cho thẻ HTML (#rview) và thẻ vẽ trên ảnh tải về (#res). null = không hiện thẻ.
  function rvData(R, k) {
    const ref = REF[k]; if (!ref || ref.lo == null) return null;
    const exC = RV_EX_COMMON.includes(k), exP = RV_EX_PER.includes(k), common = exC || k === 'leg_asym' || Gait.COMMON.includes(k);
    if ((exC || exP) && !R.ex) return null;
    const unit = ref.unit || '', redo = k === 'cadence' && cadLow(R), label = k === 'cadence' ? CAD_LABEL : ref.label;
    let legs;   // [{s, v, dim}]: dim = chân/chỉ số chưa đủ tin cậy (không tính mức, số mờ)
    if (k === 'leg_asym') { const a = Score.legAsym(R); legs = [{ s: 'c', v: a.v, dim: false }]; }
    else if (common) legs = [{ s: 'c', v: exC ? (R.ex.common || {})[k] : cval(R, k), dim: exC ? Score.evalMetric(R, k).excl === 'flag' : excluded(R, k) }];
    else {
      const em = exP ? Score.evalMetric(R, k) : null, use = exP ? ['L', 'R'].filter((s) => em.legs && em.legs[s] && em.legs[s].used) : Score.usableLegs(R, k);
      legs = ['L', 'R'].filter((s) => R.res[s]).map((s) => ({ s, v: exP ? ((R.ex.per || {})[s] || {})[k] : R.res[s].metrics[k], dim: !use.includes(s) }));
    }
    if (!legs.some((l) => rvOk(l.v))) return null;
    const good = legs.filter((l) => !l.dim && rvOk(l.v));
    let lv = 'none', worst = null;
    for (const l of good) { const q = lvLevel(k, l.v); if (RV_RANK[q] > RV_RANK[lv]) { lv = q; worst = l.v; } }
    return { ref, label, unit, redo, common, legs, worst, L: redo ? { t: 'Cần đo lại', cls: 'w' } : RV_LV[lv] };
  }
  // Nhịp bước hiện MỘT số chung (AC3, bác sĩ: "nhịp bước để 1 cái chính xác hơn"): cadFFT (tần số nảy hông trên cả đoạn, không
  // phụ thuộc đếm khung từng bước) trung bình các chân có cadFFT khớp cadIC trong 15% (cùng ngưỡng qualityCheck); không chân nào
  // khớp thì lấy nhịp chung đang dùng để chấm (cval). Chỉ để hiện: điểm và luật đo lại (cadLow < CAD_REDO) vẫn dùng cval.
  function rvCad(R) {
    const f = ['L', 'R'].map((s) => R.res && R.res[s] && R.res[s].extra).filter((e) => e && Number.isFinite(e.cadFFT) && Number.isFinite(e.cadIC) && Math.abs(e.cadIC - e.cadFFT) <= 0.15 * e.cadFFT).map((e) => e.cadFFT);
    return f.length ? f.reduce((x, y) => x + y, 0) / f.length : cval(R, 'cadence');
  }
  // Thẻ chỉ số phụ (chế độ bác sĩ): số Trái | Phải (hoặc một số chung) + một câu mô tả trung tính. Không cột Lệch, không màu mức.
  function rvCard(R, k) {
    const D = rvData(R, k); if (!D) return '';
    const { label, unit, redo, common } = D;
    const legs = k === 'cadence' ? [Object.assign({}, D.legs[0], { v: rvCad(R) })] : D.legs;
    const u = unit === '°' ? '°' : '<small>' + unit + '</small>';
    const val = (l) => (redo || !rvOk(l.v) ? '–' : rvNum(l.v, unit) + u);
    let num;
    if (common) num = '<div class="v' + (legs[0].dim ? ' dim' : '') + '">' + val(legs[0]) + '</div>';
    else {
      const by = (s) => legs.find((l) => l.s === s) || { v: NaN, dim: true };
      num = '<table class="lr"><tr><th>Trái</th><th>Phải</th></tr><tr>' +
        [by('L'), by('R')].map((l) => '<td' + (l.dim ? ' class="dim" title="chưa đủ tin cậy"' : '') + '>' + val(l) + '</td>').join('') + '</tr></table>';
    }
    const txt = redo ? 'Nhịp đo được chưa ổn định, cần đo lại.' : rvSentence(k, unit, common ? [] : legs);
    return '<div class="rc"><h3>' + label + '</h3>' + num + (txt ? '<p>' + txt + '</p>' : '') + '</div>';
  }
  // Ảnh lớn toàn thân, khung xương đậm kiểu Ochy (mockup ket-qua-v2): xương nét 7 trên viền tối 11, đầu tròn; chân trái xanh dương,
  // chân phải cam, thân/tay/đầu trắng ngà; khớp tròn trắng viền tối; ô số nền rêu đậm viền lá chữ trắng đậm. Mọi kích thước nhân s
  // theo bề rộng ảnh (s = 1 khi rộng 600). Ô số: góc cẳng chân lúc chạm (shank_ic) ở cổ chân, gập gối giữa pha trụ (knee_mid) ở gối,
  // lấy đúng số trên bảng (rvRows: chân chưa đủ tin cậy thì không vẽ ô). Không tô màu mức (bác sĩ 15/11/2026).
  const SK = { out: '#0b1a10', L: '#3DA5FF', R: '#FF8A3D', body: '#F4FFF0', box: '#0f3d22', boxLine: '#A9D69B' };
  function drawHero(cv, ph, side, R) {
    const c = cv.getContext('2d'), W = cv.width, H = cv.height, s = W / 600;
    c.fillStyle = '#1B2A34'; c.fillRect(0, 0, W, H);
    if (!ph) { c.fillStyle = '#8FA3AE'; c.font = Math.round(26 * s) + 'px ' + Themes.font; c.textAlign = 'center'; c.fillText('Chưa bắt được khung chạm đất', W / 2, H / 2); c.textAlign = 'left'; return; }
    const other = side === 'L' ? 'R' : 'L', up = ph.up || {}, U = up[side] || {}, Uo = up[other] || {};
    const seen = (p) => p && !(p[2] < LV_VIS_UP);
    const pts = []; for (const o of [ph.lm, ph.lo]) for (const k of Object.keys(o)) pts.push(o[k]);
    for (const o of [U, Uo]) for (const k of ['ear', 'elb', 'wri']) if (seen(o[k])) pts.push(o[k]);
    let x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0])), y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
    const torso = Math.hypot(ph.lm.sh[0] - ph.lm.hip[0], ph.lm.sh[1] - ph.lm.hip[1]);
    y0 -= seen(U.ear) ? torso * 0.25 : torso * 0.55;   // chừa đỉnh đầu (trên tai), không có tai thì chừa cả đầu
    const m = 0.08 * Math.max(x1 - x0, y1 - y0), asp = W / H;
    let bw = x1 - x0 + 2 * m, bh = y1 - y0 + 2 * m;
    if (bw / bh < asp) bw = bh * asp; else bh = bw / asp;
    let sx = (x0 + x1) / 2 - bw / 2, sy = (y0 + y1) / 2 - bh / 2;
    if (bw <= ph.vw) sx = Math.max(0, Math.min(ph.vw - bw, sx));
    if (bh <= ph.vh) sy = Math.max(0, Math.min(ph.vh - bh, sy));
    const k = W / bw, ix0 = Math.max(sx, 0), iy0 = Math.max(sy, 0), ix1 = Math.min(sx + bw, ph.vw), iy1 = Math.min(sy + bh, ph.vh);
    c.drawImage(ph.bmp, ix0 * ph.sc, iy0 * ph.sc, (ix1 - ix0) * ph.sc, (iy1 - iy0) * ph.sc, (ix0 - sx) * k, (iy0 - sy) * k, (ix1 - ix0) * k, (iy1 - iy0) * k);
    const P = (p) => [(p[0] - sx) * k, (p[1] - sy) * k];
    c.lineCap = 'round'; c.lineJoin = 'round';
    // chân xa (lo) vẽ trước để chân gần (lm) đè lên
    for (const [o, Uu, leg] of [[ph.lo, Uo, other], [ph.lm, U, side]]) {
      const segs = LINKS.map(([a, b]) => [o[a], o[b], a === 'sh' ? SK.body : SK[leg]])
        .concat([['ear', null], ['elb', null], ['wri', 'elb']].filter(([a, b]) => seen(Uu[a]) && (b ? seen(Uu[b]) : true)).map(([a, b]) => [b ? Uu[b] : o.sh, Uu[a], SK.body]));
      for (const pass of [0, 1]) {
        c.lineWidth = (pass ? 7 : 11) * s;
        for (const [a, b, col] of segs) { const A = P(a), B = P(b); c.strokeStyle = pass ? col : SK.out; c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke(); }
      }
      const joints = Object.keys(o).map((key) => o[key]).concat(['ear', 'elb', 'wri'].filter((key) => seen(Uu[key])).map((key) => Uu[key]));
      c.fillStyle = '#fff'; c.strokeStyle = SK.out; c.lineWidth = 3 * s;
      for (const j of joints) { const A = P(j); c.beginPath(); c.arc(A[0], A[1], 8 * s, 0, 7); c.fill(); c.stroke(); }
    }
    const rows = App.rvRows(R), val = (key) => ((rows.find((r) => r.k === key) || { v: {} }).v[side]);
    const fs = Math.round(24 * s), bh2 = Math.round(fs * 1.6), placed = [], d = Math.sign(ph.lm.toe[0] - ph.lm.heel[0]) || 1;
    c.font = '700 ' + fs + 'px ' + Themes.font; c.textBaseline = 'middle'; c.textAlign = 'center';
    const tag = (J, txt, dir) => {
      const bw2 = Math.round(c.measureText(txt).width + fs * 0.9);
      let x = J[0] + dir * (22 * s + bw2 / 2) - bw2 / 2, y = J[1] - bh2 / 2;
      x = Math.max(6 * s, Math.min(W - bw2 - 6 * s, x));
      for (let t = 0; t < 6 && placed.some((b) => x < b[0] + b[2] + 6 && b[0] < x + bw2 + 6 && y < b[1] + b[3] + 6 && b[1] < y + bh2 + 6); t++) y += bh2 + 6 * s;
      y = Math.max(6 * s, Math.min(H - bh2 - 6 * s, y)); placed.push([x, y, bw2, bh2]);
      c.strokeStyle = SK.boxLine; c.lineWidth = 2.5 * s; c.beginPath(); c.moveTo(J[0], J[1]); c.lineTo(dir > 0 ? x : x + bw2, y + bh2 / 2); c.stroke();
      c.fillStyle = SK.box; rr(c, x, y, bw2, bh2, 8 * s); c.fill(); c.strokeStyle = SK.boxLine; c.lineWidth = 3 * s; c.stroke();
      c.fillStyle = '#fff'; c.fillText(txt, x + bw2 / 2, y + bh2 / 2 + 1);
    };
    const sh = val('shank_ic'), kn = val('knee_mid');
    if (sh != null) tag(P(ph.lm.ank), 'Cẳng chân ' + Math.round(sh) + '°', d);
    if (kn != null) tag(P(ph.lm.knee), 'Gập gối ' + Math.round(kn) + '°', -d);
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  }
  // Chân cho ảnh lớn (CQ4): chân rõ hơn (extra.vis cao hơn); chân đó thiếu ảnh thì lấy chân còn lại.
  function rvSide(R, ph) {
    const legs = ['L', 'R'].filter((s) => R.res[s]);
    const vis = (s) => (R.res[s].extra && R.res[s].extra.vis) || 0;
    const best = legs.slice().sort((a, b) => vis(b) - vis(a))[0];
    return [best].concat(legs).find((s) => ph[s]) || best;
  }
  // Màu mức trên ảnh nền sáng, chỉ còn dùng ở bố cục cũ (góc sau).
  const rvCol = (cls) => (cls === 'ok' ? TC.brand2 : cls === 'w' ? AMBER : cls === 'b' ? TIER_RED : '#8A97A1');
  // Phóng to ảnh lớn (bấm ảnh), Esc hoặc bấm nền để đóng. Một khung dùng chung cho mọi lần vẽ lại.
  function rvZoom(cv) {
    let lb = $('rvlb');
    if (!lb) {
      lb = document.createElement('div'); lb.id = 'rvlb'; lb.hidden = true; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-label', 'Ảnh phóng to');
      lb.innerHTML = '<img alt="Ảnh chạm đất phóng to"><button type="button" class="x" aria-label="Đóng">✕</button>';
      lb.addEventListener('click', () => { lb.hidden = true; });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lb.hidden) { lb.hidden = true; e.stopPropagation(); } }, true);
      document.body.appendChild(lb);
    }
    lb.querySelector('img').src = cv.toDataURL('image/jpeg', 0.92); lb.hidden = false; lb.querySelector('.x').focus();
  }
  // Ô ghi chú bác sĩ: hiện ghi chú ĐÃ LƯU (#note); sửa qua ngăn ghi chú sẵn có (#notebtn) để không có hai chỗ nhập dễ mất chữ.
  // updateNoteBtn (save.js) đổi chữ #notebtn mỗi lần lưu/nạp, nên theo dõi nút đó để làm mới ô.
  function rvNote() {
    const p = document.querySelector('#rview .doc p'); if (!p) return;
    const t = ($('note').value || '').trim(); p.textContent = t || 'Chưa có ghi chú.'; p.classList.toggle('empty', !t);
  }
  let noteObs = null;
  function renderView(R) {
    let box = $('rview');
    if (!box) { box = document.createElement('section'); box.id = 'rview'; const rb = $('resbox'); rb.parentNode.insertBefore(box, rb); }
    // Chỉ quay góc sau: giữ màn cũ (#res). Có góc ngang: hiện #rview; chỉ góc ngang thì ẩn #res trên màn (vẫn vẽ để tải ảnh/PDF).
    const on = !!(R && R.comb && R.res);
    box.hidden = !on; $('resbox').classList.toggle('rvoff', on && !R.back);
    if (!on) { box.innerHTML = ''; return; }
    const sc = scores(R), tt = sc.total != null ? tierOf(sc.total) : null, ph = S.photos || {}, sub = R.sub || {};
    const side = rvSide(R, ph), rows = App.rvRows(R), dt = R.when ? new Date(R.when) : new Date();
    const view = R.back ? 'Ngang + sau' : 'Ngang';
    const dl = [['Mã khách', sub.id], ['Họ tên', sub.name], ['Chiều cao', sub.height ? sub.height + ' cm' : ''], ['Ngày đo', pad(dt.getDate()) + '/' + pad(dt.getMonth() + 1) + '/' + dt.getFullYear()],
      ['Tốc độ máy', ((R.speed || App.SPEED) * 3.6).toFixed(0) + ' km/h'], ['Góc quay', view]];
    const cell = (x, l) => '<span class="c' + (x.dim ? ' dim' : '') + '" data-l="' + l + '">' + escA(x.t) + '</span>';
    const tr = (r) => '<div class="r"><div class="nm"><b>' + r.nm + '</b><span>' + r.d + '</span></div>' +
      (r.wide ? '<span class="c wide' + (r.cells[0].dim ? ' dim' : '') + '" data-l="Hai chân">' + escA(r.cells[0].t) + '</span>' : cell(r.cells[0], 'Trái') + cell(r.cells[1], 'Phải')) +
      '<div class="rf">' + escA(r.rf || '–') + (r.src ? '<em>' + escA(r.src) + '</em>' : '') + '</div></div>';
    // Chỉ số ngoài 5 chỉ số chính chỉ hiện ở chế độ bác sĩ (body.bs, CSS .bsonly)
    const rest = RV_KEYS.filter((k) => !RV_TOP.includes(k)).map((k) => rvCard(R, k)).filter(Boolean);
    box.innerHTML = '<header class="strip"><h1>Báo cáo dáng chạy</h1><dl>' + dl.map(([a, b]) => '<div><dt>' + a + '</dt><dd>' + escA(b || '–') + '</dd></div>').join('') + '</dl></header>' +
      '<div class="main"><div class="left"><button type="button" class="ph" aria-label="Phóng to ảnh"><canvas id="rvhero" width="900" height="1200"></canvas>' +
      '<span class="cap">' + (side === 'L' ? 'Chân trái' : 'Chân phải') + ' · Chạm đất</span></button></div>' +
      '<div class="right"><div class="score"><div class="lb">Điểm dáng chạy</div><div class="n' + (sc.total != null ? '' : ' na') + '">' + (sc.total != null ? sc.total + '<small>/100</small>' : '–') + '</div>' +
      (tt ? '<span class="badge">' + (App.RV_BADGE[tt.key] || tt.name) + '</span>' : '') + '<p>' + App.rvScoreLine(sc.total) + '</p></div>' +
      '<div class="tb" role="table"><div class="r hd"><span>Chỉ số</span><span>Trái</span><span>Phải</span><span>Tham chiếu</span></div>' + rows.map(tr).join('') + '</div>' +
      '<div class="kl"><h2>Kết luận tổng kết</h2><ul>' + App.rvAdvice(R, rows).map((t) => '<li>' + escA(t) + '</li>').join('') + '</ul></div>' +
      '<div class="doc"><h2>Ghi chú của bác sĩ</h2><p></p><button type="button" class="alt">Viết / sửa ghi chú</button></div></div></div>' +
      (rest.length ? '<div class="bsonly"><h2>Chỉ số khác (bác sĩ)</h2><div class="cards" id="rvrest">' + rest.join('') + '</div></div>' : '') +
      '<div class="foot">Kết quả chỉ mang tính tham khảo.</div>';
    const cv = $('rvhero'); drawHero(cv, ph[side], side, R);
    box.querySelector('.ph').onclick = () => rvZoom(cv);
    box.querySelector('.doc button').onclick = () => $('notebtn').click();
    rvNote();
    if (!noteObs) { noteObs = new MutationObserver(rvNote); noteObs.observe($('notebtn'), { childList: true, characterData: true, subtree: true }); }
  }
  function drawResult(R) {
    renderRedo(R);
    renderView(R);
    drawResultCv(R, $('res'), true);
  }
  // Trang 1 của PDF: chỉ góc ngang thì dùng đúng bố cục mới (ảnh xương đậm + điểm + bảng 5 chỉ số có tham chiếu + kết luận),
  // vẽ ra canvas tạm để có cả ghi chú bác sĩ mới nhất; có góc sau thì giữ ảnh #res như cũ.
  function pdfPage1(R) {
    if (!R.comb || R.back) return $('res');
    const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080;
    drawResultCv(R, cv, true); return cv;
  }
  Object.assign(App, { RV_KEYS, RV_TOP, RV_LV, rvNum, rvOk, rvRange, rvCol, SK });
})(window.App);
