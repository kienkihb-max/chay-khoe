/* app/rview.js - màn kết quả dạng thẻ (#rview), drawResult. Một phần của app cũ; cách chia sẻ biến xem đầu app/core.js. */
(function (App) {
  'use strict';
  const { $, REF, AMBER, TIER_RED, TC, LINKS, S, pad, LEAF, LV_COL, lvLevel, LV_VIS_UP, f1, f0, excluded,
    cval, cadLow, escA, rr, drawPhoto, scores, tierOf, capWhy, unscored, groupLine, conclusion, improveTip,
    renderRedo, rvDiff, rvSentence } = App;
  // hàm ở file nạp sau: gọi qua App khi chạy
  function drawResultCv(...a) { return App.drawResultCv(...a); }
  // hàm của file này (khai báo function được nâng lên đầu nên đưa ra ngay)
  Object.assign(App, { rvData, rvCad, drawHero, rvSide, drawResult, pdfPage1 });
  // ---------- Màn kết quả dạng thẻ (#rview), theo docs/mockup/ket-qua.html ----------
  // Câu mô tả từng chỉ số: app/rvdesc.js (trung tính, không kết luận; bác sĩ 15/11/2026).
  // Thứ tự thẻ = thứ tự trên ảnh tải về; ảnh chỉ đủ chỗ 16 thẻ nên chỉ số phụ (khuỷu) để cuối.
  // VI thống nhất 'Nhịp bước'; đuôi NBSP để i18n dịch riêng ra 'Cadence' (cặp 'Nhịp bước' trần là 'Step timing' của biểu đồ trực tiếp)
  const CAD_LABEL = 'Nhịp bước ';
  const RV_KEYS = ['cadence', 'contact_ms', 'vert_osc', 'trunk', 'knee_ic', 'shank_ic', 'overstride', 'knee_mid', 'hip_ext', 'knee_swing', 'hip_flex', 'leg_asym', 'step_cv', 'step_asym', 'contact_asym', 'head_fwd', 'elbow'];
  // 5 chỉ số chính hiện trên màn (AC1, bác sĩ: "chỉ cần 5 chỉ số quan trọng nhất, có tương quan trái phải"): xếp theo WEIGHT
  // của score.js, ưu tiên chỉ số có hai chân: overstride 13, cadence 11 (giữ vì bác sĩ yêu cầu riêng nhịp bước), shank_ic 10,
  // hip_ext 8, knee_mid 8. trunk 8 là số chung nên nhường; knee_ic 6. Các chỉ số còn lại vẫn tính điểm, chỉ ẩn sau nút.
  const RV_TOP = ['overstride', 'cadence', 'shank_ic', 'hip_ext', 'knee_mid'];
  // Lấy từ R.ex (chỉ số bổ sung); cờ tin cậy đọc qua Score.evalMetric (R.ex.per[s].flags, R.ex.flags), cùng luật với điểm.
  const RV_EX_COMMON = ['step_cv', 'step_asym', 'contact_asym'], RV_EX_PER = ['contact_ms', 'hip_flex', 'elbow', 'head_fwd'];
  // Mức theo lvLevel (cùng ngưỡng với điểm): Tốt / Cần chú ý / Bất thường. Chỉ dùng cho thẻ vẽ trên ảnh tải về (#res); màn #rview không hiện mức từng chỉ số (bác sĩ 15/11/2026).
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
  // Đáp đất (gót / giữa bàn / mũi chân) mỗi chân, nằm chung thẻ Nhịp bước (bác sĩ 15/11/2026). Chân không đủ tin cậy (extra.lowConf) hoặc thiếu: '–'.
  function rvStrike(R) {
    const td = (s) => { const e = R.res[s] && R.res[s].extra, ok = e && e.strike && !e.lowConf; return '<td' + (ok ? '' : ' class="dim" title="chưa đủ tin cậy"') + '>' + (ok ? e.strike : '–') + '</td>'; };
    return '<h3 class="sh">Đáp đất</h3><table class="lr st"><tr><th class="L">Trái</th><th class="R">Phải</th></tr><tr>' + td('L') + td('R') + '</tr></table>' +
      '<p>Phần bàn chân chạm đất trước: gót, giữa bàn hoặc mũi chân. Chỉ mô tả, không kết luận.</p>';
  }
  // Một thẻ chỉ số (AC1/AC4/AC5): số đo (Trái | Phải | Lệch, hoặc một số chung) + một câu mô tả trung tính.
  // Không pill mức, không màu đánh giá, không câu khuyên; số mờ = chân chưa đủ tin cậy.
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
      const L = by('L'), Rr = by('R'), df = !L.dim && !Rr.dim ? rvDiff(unit, L.v, Rr.v) : null;
      num = '<table class="lr"><tr><th class="L">Trái</th><th class="R">Phải</th><th>Lệch</th></tr><tr>' +
        [L, Rr].map((l) => '<td' + (l.dim ? ' class="dim" title="chưa đủ tin cậy"' : '') + '>' + val(l) + '</td>').join('') +
        '<td>' + (df ? df.t : '–') + '</td></tr></table>';
    }
    const txt = redo ? 'Nhịp đo được chưa ổn định, cần đo lại.' : rvSentence(k, unit, common ? [] : legs);
    return '<div class="rc"><h3>' + label + '</h3>' + num + (txt ? '<p>' + txt + '</p>' : '') + (k === 'cadence' ? rvStrike(R) : '') + '</div>';
  }
  // Ảnh lớn toàn thân kiểu Ochy: khung xương phát sáng, cung góc gối, ô số góc. Số gối và thân lấy đúng số trên thẻ (knee_ic chân này, trunk chung);
  // đầu, khuỷu, cổ chân tính từ chính khung ảnh (chỉ số tham khảo, màu lá). Bản ghi cũ không có ph.up thì không vẽ đầu/tay.
  function drawHero(cv, ph, side, R, neutral) {
    const c = cv.getContext('2d'), W = cv.width, H = cv.height;
    c.fillStyle = '#1B2A34'; c.fillRect(0, 0, W, H);
    if (!ph) { c.fillStyle = '#8FA3AE'; c.font = '32px ' + Themes.font; c.textAlign = 'center'; c.fillText('Chưa bắt được khung chạm đất', W / 2, H / 2); c.textAlign = 'left'; return; }
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
    const mm = (R.res[side] && R.res[side].metrics) || {}, trunkV = R.comb ? cval(R, 'trunk') : NaN;
    const lev = (key, v) => (neutral ? LEAF : LV_COL[lvLevel(key, v)]);   // neutral: #rview không tô màu mức (AC5); ảnh tải về #res giữ màu
    const lw = Math.max(3, W / 170), rad = Math.max(4, W / 120);
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const [o, Uu, near] of [[ph.lo, Uo, false], [ph.lm, U, true]]) {
      const segs = LINKS.map(([a, b]) => [o[a], o[b], near && a === 'sh' ? lev('trunk', trunkV) : LEAF])
        .concat([['ear', null], ['elb', null], ['wri', 'elb']].filter(([a, b]) => seen(Uu[a]) && (b ? seen(Uu[b]) : true)).map(([a, b]) => [b ? Uu[b] : o.sh, Uu[a], LEAF]));
      const fa = near ? 1 : 0.45;
      for (const pass of [0, 1]) {
        c.globalAlpha = fa * (pass ? 1 : 0.22); c.lineWidth = pass ? lw : lw * 3.4;
        for (const [a, b, col] of segs) { const A = P(a), B = P(b); c.strokeStyle = col; c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke(); }
      }
      c.globalAlpha = fa;
      for (const key of Object.keys(o)) {
        const A = P(o[key]); c.fillStyle = near && key === 'knee' ? lev('knee_ic', mm.knee_ic) : near && key === 'sh' ? lev('trunk', trunkV) : LEAF;
        c.beginPath(); c.arc(A[0], A[1], rad, 0, 7); c.fill();
      }
      c.fillStyle = LEAF; for (const key of ['ear', 'elb', 'wri']) if (seen(Uu[key])) { const A = P(Uu[key]); c.beginPath(); c.arc(A[0], A[1], rad * 0.85, 0, 7); c.fill(); }
    }
    c.globalAlpha = 1;
    const deg = 180 / Math.PI, lm = ph.lm, d = Math.sign(lm.toe[0] - lm.heel[0]) || 1;
    const ang3 = (a, b, e) => { const u = [a[0] - b[0], a[1] - b[1]], w = [e[0] - b[0], e[1] - b[1]]; return Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1]) / (Math.hypot(u[0], u[1]) * Math.hypot(w[0], w[1]) + 1e-9)))) * deg; };
    const lean = (lo, hi) => Math.atan2((hi[0] - lo[0]) * d, lo[1] - hi[1]) * deg;
    const Hp = P(lm.hip), K = P(lm.knee), A2 = P(lm.ank), Sh = P(lm.sh);
    // cung góc gối (đùi kéo dài → cẳng chân) màu theo mức knee_ic
    const r = Math.max(18, Math.min(70, Math.hypot(K[0] - Hp[0], K[1] - Hp[1]) * 0.32)), a1 = Math.atan2(K[1] - Hp[1], K[0] - Hp[0]);
    let dd = Math.atan2(A2[1] - K[1], A2[0] - K[0]) - a1; while (dd > Math.PI) dd -= 2 * Math.PI; while (dd < -Math.PI) dd += 2 * Math.PI;
    const kc = lev('knee_ic', mm.knee_ic);
    c.fillStyle = kc; c.globalAlpha = 0.22; c.beginPath(); c.moveTo(K[0], K[1]); c.arc(K[0], K[1], r, a1, a1 + dd, dd < 0); c.closePath(); c.fill();
    c.globalAlpha = 1; c.strokeStyle = kc; c.lineWidth = Math.max(2, lw * 0.7); c.beginPath(); c.arc(K[0], K[1], r, a1, a1 + dd, dd < 0); c.stroke();
    // đường thẳng đứng nét đứt từ hông để thấy độ nghiêng thân
    c.setLineDash([8, 8]); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(Hp[0], Hp[1]); c.lineTo(Hp[0], Sh[1]); c.stroke(); c.setLineDash([]);
    const fs = Math.round(W / 28), bh2 = Math.round(fs * 1.45), placed = [];
    c.font = '700 ' + fs + 'px ' + Themes.font; c.textBaseline = 'middle'; c.textAlign = 'center';
    const tag = (J, val, col, dir) => {
      if (!J || !isFinite(val)) return;
      const txt = Math.round(val) + '°', bw2 = Math.round(c.measureText(txt).width + fs * 0.7);
      let x = J[0] + dir * (rad * 3.5 + bw2 / 2) - bw2 / 2, y = J[1] - bh2 / 2;
      x = Math.max(4, Math.min(W - bw2 - 4, x));
      for (let t = 0; t < 6 && placed.some((b) => x < b[0] + b[2] + 4 && b[0] < x + bw2 + 4 && y < b[1] + b[3] + 4 && b[1] < y + bh2 + 4); t++) y += bh2 + 5;
      y = Math.max(4, Math.min(H - bh2 - 4, y)); placed.push([x, y, bw2, bh2]);
      c.globalAlpha = 0.8; c.strokeStyle = col; c.lineWidth = 1.5; c.beginPath(); c.moveTo(J[0], J[1]); c.lineTo(dir > 0 ? x : x + bw2, y + bh2 / 2); c.stroke();
      c.globalAlpha = 1; c.fillStyle = 'rgba(8,19,11,.82)'; rr(c, x, y, bw2, bh2, 6); c.fill(); c.strokeStyle = col; c.lineWidth = 2; c.stroke();
      c.fillStyle = col; c.fillText(txt, x + bw2 / 2, y + bh2 / 2 + 1);
    };
    const away = (a, b, dflt) => Math.sign(P(a)[0] - P(b)[0]) || dflt;
    if (seen(U.ear)) tag(P(U.ear), lean(lm.sh, U.ear), LEAF, -d);
    tag([(Sh[0] + Hp[0]) / 2, (Sh[1] + Hp[1]) / 2], trunkV, lev('trunk', trunkV), -d);
    if (seen(U.elb) && seen(U.wri)) tag(P(U.elb), ang3(lm.sh, U.elb, U.wri), LEAF, away(U.elb, lm.sh, -d));
    tag(K, mm.knee_ic, kc, away(lm.knee, lm.hip, d));
    tag(A2, ang3(lm.knee, lm.ank, lm.toe), LEAF, away(lm.ank, lm.knee, d));
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  }
  // Chân cho ảnh lớn (CQ4): chân rõ hơn (extra.vis cao hơn); chân đó thiếu ảnh thì lấy chân còn lại.
  function rvSide(R, ph) {
    const legs = ['L', 'R'].filter((s) => R.res[s]);
    const vis = (s) => (R.res[s].extra && R.res[s].extra.vis) || 0;
    const best = legs.slice().sort((a, b) => vis(b) - vis(a))[0];
    return [best].concat(legs).find((s) => ph[s]) || best;
  }
  // Màu mức trên ảnh nền sáng (#res), khớp màu viền/pill thẻ #rview: --moss2 / --amber / --red / xám.
  const rvCol = (cls) => (cls === 'ok' ? TC.brand2 : cls === 'w' ? AMBER : cls === 'b' ? TIER_RED : '#8A97A1');
  function renderView(R) {
    let box = $('rview');
    if (!box) { box = document.createElement('section'); box.id = 'rview'; const rb = $('resbox'); rb.parentNode.insertBefore(box, rb); }
    // Chỉ quay góc sau: giữ màn cũ (#res). Có góc ngang: hiện #rview; chỉ góc ngang thì ẩn #res trên màn (vẫn vẽ để tải ảnh/PDF).
    const on = !!(R && R.comb && R.res);
    box.hidden = !on; $('resbox').classList.toggle('rvoff', on && !R.back);
    if (!on) { box.innerHTML = ''; return; }
    const sc = scores(R), tt = sc.total != null ? tierOf(sc.total) : unscored(sc), con = conclusion(R), ph = S.photos || {}, sub = R.sub || {};
    const side = rvSide(R, ph);
    const dt = R.when ? new Date(R.when) : new Date();
    const both = sc.side && sc.back;
    // Chỉ số ngoài 5 chỉ số chính chỉ hiện ở chế độ bác sĩ (body.bs, CSS .bsonly)
    const rest = RV_KEYS.filter((k) => !RV_TOP.includes(k)).map((k) => rvCard(R, k)).filter(Boolean);
    box.innerHTML = '<h1>' + escA(sub.name || '') + '</h1>' +
      '<div class="sub">Cao ' + escA(sub.height || '–') + ' cm · ' + ((R.speed || App.SPEED) * 3.6).toFixed(0) + ' km/h · Ngày đo ' + pad(dt.getDate()) + '/' + pad(dt.getMonth() + 1) + '/' + dt.getFullYear() + '</div>' +
      '<div class="hero"><div class="pic"><canvas id="rvhero" width="800" height="1120"></canvas><span class="cap">Khoảnh khắc chạm đất · ' + (side === 'L' ? 'Chân trái' : 'Chân phải') + '</span></div>' +
      '<div class="score"><div class="lb">Điểm dáng chạy</div><div class="big" style="color:' + (sc.total != null ? tt.col : '#8A97A1') + '">' + (sc.total != null ? sc.total : '–') + (sc.total != null ? '<span>/100</span>' : '') + '</div>' +
      '<span class="pl" style="background:' + tt.col + '">' + tt.label + '</span>' +
      (both ? '<div class="sub">Góc ngang ' + (sc.side.total != null ? sc.side.total : '–') + ' · Góc sau ' + (sc.back.total != null ? sc.back.total : '–') + '</div>' : '') +
      (sc.total != null && groupLine(sc.side) ? '<div class="sub grp">' + groupLine(sc.side) + '</div>' : '') +
      (sc.side && capWhy(sc.side.agg) ? '<div class="sub capwhy">' + capWhy(sc.side.agg) + '</div>' : '') +
      '<p>' + con.text + '</p>' +
      '<div class="minis">' + ['L', 'R'].map((s) => '<div class="mini ' + s + '"><canvas id="rvmini' + s + '" width="600" height="560"></canvas><span class="cap">' + (s === 'L' ? 'Đặt chân trái' : 'Đặt chân phải') + '</span></div>').join('') + '</div></div></div>' +
      '<h2>Chỉ số chính</h2><div class="cards">' + RV_TOP.map((k) => rvCard(R, k)).join('') + '</div>' +
      (rest.length ? '<div class="bsonly"><h2>Chỉ số khác (bác sĩ)</h2><div class="cards" id="rvrest">' + rest.join('') + '</div></div>' : '') +
      '<div class="note"><b>Nên cải thiện:</b> ' + improveTip(R) + '</div>' +
      '<div class="foot">Sàng lọc 2D bằng AI, chỉ mang tính tham khảo, không thay thế khám lâm sàng.</div>';
    drawHero($('rvhero'), ph[side], side, R, true);
    for (const s of ['L', 'R']) { const cv = $('rvmini' + s); drawPhoto(cv.getContext('2d'), ph[s], s, 0, 0, cv.width, cv.height, R, false, true, false, true); }
  }
  function drawResult(R) {
    renderRedo(R);
    renderView(R);
    drawResultCv(R, $('res'), true);
  }
  // Trang 1 của PDF giữ bố cục cũ: vẽ riêng ra canvas tạm (ảnh tải về #res chỉ góc ngang đã đổi sang bố cục thẻ).
  function pdfPage1(R) {
    if (!R.comb || R.back) return $('res');
    const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080;
    drawResultCv(R, cv, false); return cv;
  }
  Object.assign(App, { RV_KEYS, RV_TOP, RV_LV, rvNum, rvOk, rvRange, rvCol });
})(window.App);
