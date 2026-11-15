/* app/rvdesc.js - câu mô tả trung tính cho từng chỉ số ở màn kết quả (#rview). Nạp trước app/rview.js.
 * Bác sĩ (15/11/2026): "chỉ đưa ra kết quả, mô tả kết quả, không kết luận ở mỗi chỉ số". Nên mỗi câu chỉ nói chỉ số đo gì
 * và số lớn/nhỏ nghĩa là gì; không có Tốt/Chú ý/Bất thường, không khuyên. Mỗi đoạn là một cặp dịch trong i18n.js
 * (mục "#rview: câu mô tả trung tính"), đổi chữ ở đây thì đổi cả cặp dịch. BÁC SĨ CẦN RÀ câu chữ.
 */
(function (App) {
  'use strict';
  // d: định nghĩa (đo gì, số nghĩa là gì). c: [phải LỚN hơn trái, phải NHỎ hơn trái], ghép với số lệch ở cuối.
  const RV_TXT = {
    cadence: { d: 'Số bước chạy mỗi phút, tính chung cả hai chân.' },
    vert_osc: { d: 'Độ nhấp nhô lên xuống của hông trong mỗi bước; số càng lớn thân nảy càng nhiều.' },
    trunk: { d: 'Góc thân so với phương thẳng đứng; số dương là thân nghiêng ra trước.' },
    leg_asym: { d: 'Mức chênh giữa hai chân gom từ các chỉ số góc và khoảng cách; 0 là hai chân như nhau, 1 là chênh bằng ngưỡng tham chiếu.' },
    step_cv: { d: 'Mức dao động thời gian giữa các bước; số càng nhỏ nhịp càng đều.' },
    step_asym: { d: 'Chênh thời gian bước giữa chân trái và chân phải, tính theo %.' },
    contact_asym: { d: 'Chênh thời gian chạm đất giữa chân trái và chân phải, tính theo %.' },
    overstride: { d: 'Khoảng cách ngang từ bàn chân đến hông lúc chạm đất; số dương là bàn chân đặt trước hông.', c: ['Chân phải đặt xa về trước hơn chân trái ', 'Chân phải đặt gần hông hơn chân trái '] },
    shank_ic: { d: 'Độ nghiêng cẳng chân so với phương thẳng đứng lúc chạm đất; số dương là cẳng chân chéo ra trước.', c: ['Cẳng chân phải nghiêng nhiều hơn chân trái ', 'Cẳng chân phải nghiêng ít hơn chân trái '] },
    knee_ic: { d: 'Độ gập gối lúc bàn chân chạm đất; số càng lớn gối càng gập.', c: ['Gối phải gập nhiều hơn gối trái ', 'Gối phải gập ít hơn gối trái '] },
    knee_mid: { d: 'Độ gập gối lớn nhất khi chân đang đỡ cơ thể; số càng lớn gối càng gập.', c: ['Gối phải gập nhiều hơn gối trái ', 'Gối phải gập ít hơn gối trái '] },
    knee_swing: { d: 'Độ gập gối lớn nhất khi chân đưa ra trước trên không; số càng lớn gót càng gần mông.', c: ['Gối phải gập nhiều hơn gối trái ', 'Gối phải gập ít hơn gối trái '] },
    hip_ext: { d: 'Độ duỗi hông ra sau lúc bàn chân rời đất; số càng lớn hông duỗi càng nhiều.', c: ['Hông phải duỗi nhiều hơn hông trái ', 'Hông phải duỗi ít hơn hông trái '] },
    hip_flex: { d: 'Độ nâng đùi ra trước lớn nhất khi đưa chân; số càng lớn đùi nâng càng cao.', c: ['Đùi phải nâng cao hơn đùi trái ', 'Đùi phải nâng thấp hơn đùi trái '] },
    contact_ms: { d: 'Thời gian bàn chân tiếp xúc mặt máy trong mỗi bước; số càng lớn chân chạm đất càng lâu.', c: ['Chân phải chạm đất lâu hơn chân trái ', 'Chân phải chạm đất ngắn hơn chân trái '] },
    elbow: { d: 'Góc gập khuỷu tay khi chạy; số càng nhỏ tay càng gập.', c: ['Khuỷu bên phải mở rộng hơn bên trái ', 'Khuỷu bên phải gập hơn bên trái '] },
    head_fwd: { d: 'Độ nghiêng đầu ra trước so với vai; số càng lớn đầu càng đưa ra trước.', c: ['Đo phía bên phải lớn hơn phía bên trái ', 'Đo phía bên phải nhỏ hơn phía bên trái '] },
  };
  const RV_SAME = 'Hai bên gần như bằng nhau.';
  const RV_ONE = 'Chỉ một bên đủ tin cậy nên chưa so hai bên.';
  // Lệch giữa hai chân (AC4): góc ra °, khoảng cách ra cm, thời gian ra % (so với trung bình hai chân). Chỉ số, không màu.
  // Trả {v: số đã làm tròn để hiện, t: chuỗi hiện} hoặc null khi không tính được.
  function rvDiff(unit, l, r) {
    if (!Number.isFinite(l) || !Number.isFinite(r)) return null;
    if (unit === 'ms') {
      const m = (Math.abs(l) + Math.abs(r)) / 2; if (!(m > 0)) return null;
      const v = Math.round((Math.abs(l - r) / m) * 100); return { v, t: v + '%' };
    }
    if (unit === 'cm') { const v = Math.round(Math.abs(l - r) * 10) / 10; return { v, t: v.toFixed(1) + ' cm' }; }
    const v = Math.round(Math.abs(l - r)); return { v, t: v + (unit === '°' ? '°' : ' ' + unit) };
  }
  // Câu mô tả một chỉ số: định nghĩa + (nếu có hai chân đủ tin cậy) một câu so phải với trái.
  function rvSentence(k, unit, legs) {
    const T = RV_TXT[k] || {}, out = T.d ? [T.d] : [];
    if (T.c && legs.length === 2) {
      const [L, R] = legs.map((l) => l.v);
      const ok = legs.every((l) => !l.dim && Number.isFinite(l.v)), df = rvDiff(unit, L, R);
      if (!ok || !df) out.push(RV_ONE);
      else if (df.v === 0) out.push(RV_SAME);
      else out.push(T.c[R > L ? 0 : 1] + df.t + '.');
    }
    return out.join(' ');
  }
  // ---------- 5 dòng bảng chính + kết luận tổng kết (mockup docs/mockup/ket-qua-v2.html) ----------
  // Nhãn, câu mô tả theo mockup; tham chiếu đọc từ reference.js (ref_txt/ref_src, display.strike), không đổi lo/hi/điểm.
  const RV_ROWS = [
    { k: 'cadence', nm: 'Nhịp bước', d: 'Số bước mỗi phút.' },
    { k: 'strike', nm: 'Đáp đất', d: 'Vùng bàn chân chạm đất trước.' },
    { k: 'shank_ic', nm: 'Góc cẳng chân lúc chạm đất', d: 'Độ nghiêng so với phương thẳng đứng.' },
    { k: 'vert_osc', nm: 'Nhấp nhô thân', d: 'Mức thân nhấp lên xuống mỗi bước.' },
    { k: 'knee_mid', nm: 'Gập gối giữa pha trụ', d: 'Mức gối gập khi thân đè lên một chân.' },
  ];
  const DASH = { t: '–', dim: true };
  const GREF = () => window.GAIT_REF || {};
  // Số liệu 5 dòng, dùng chung cho màn #rview và ảnh tải về/PDF (rvsheet.js). cells: [Trái, Phải] hoặc [chung] (wide).
  // v: số đã lọc tin cậy để so tham chiếu (L/R hoặc C); chân chưa đủ tin cậy hoặc nhịp cần đo lại thì null và ô hiện '–'.
  function rvRows(R) {
    const M = GREF().metrics || {}, DS = (GREF().display || {}).strike || {};
    return RV_ROWS.map((row) => {
      const ref = row.k === 'strike' ? DS : M[row.k] || {};
      const out = { k: row.k, nm: row.nm, d: row.d, wide: row.k === 'cadence' || row.k === 'vert_osc', cells: [DASH, DASH], rf: ref.ref_txt || '', src: ref.ref_src || '', v: {} };
      if (out.wide) out.cells = [DASH];
      if (row.k === 'strike') {
        out.cells = ['L', 'R'].map((s) => {
          const e = R.res[s] && R.res[s].extra, ok = e && e.strike && !e.lowConf;
          out.v[s] = ok ? String(e.strike).toLowerCase() : null; return ok ? { t: e.strike, dim: false } : DASH;
        });
        return out;
      }
      const D = App.rvData(R, row.k); if (!D) return out;
      out.redo = D.redo;
      const u = D.unit === '°' ? '°' : ' ' + D.unit;
      const cell = (v, dim) => (D.redo || dim || !Number.isFinite(v) ? DASH : { t: App.rvNum(v, D.unit) + u, dim: false });
      if (D.common) {
        const v = row.k === 'cadence' ? App.rvCad(R) : D.legs[0].v, dim = D.legs[0].dim;
        out.cells = [cell(v, dim)]; out.v.C = D.redo || dim || !Number.isFinite(v) ? null : v;
      } else {
        out.cells = ['L', 'R'].map((s) => {
          const l = D.legs.find((x) => x.s === s);
          out.v[s] = l && !l.dim && Number.isFinite(l.v) ? l.v : null; return l ? cell(l.v, l.dim) : DASH;
        });
      }
      return out;
    });
  }
  // Nhãn hạng và câu dưới điểm: nhẹ nhàng; hạng thấp nhất của score.js tên 'Nguy cơ' nên màn này hiện 'Nên chú ý thêm'.
  const RV_BADGE = { good: 'Tốt', fair: 'Khá', improve: 'Cần cải thiện', risk: 'Nên chú ý thêm' };
  function rvScoreLine(total) {
    if (total == null) return 'Chưa đủ dữ liệu để tính điểm; xem các chỉ số bên dưới.';
    if (total >= 85) return 'Dáng chạy khá cân đối; có thể giữ thói quen tập hiện tại.';
    if (total >= 70) return 'Dáng chạy ổn; vài điểm có thể thử điều chỉnh nhẹ, xem kết luận bên dưới.';
    return 'Có vài điểm nên chú ý thêm khi tập, xem kết luận bên dưới.';
  }
  // Kết luận tổng kết (3–4 ý): so số đo với ref_rng trong reference.js. Lời khuyên nhẹ ('Có thể thử…', 'Nên chú ý thêm…'),
  // không chẩn đoán. Ý lệch tham chiếu xếp trước, tối đa 3 ý + 1 dòng gợi ý chung. BÁC SĨ CẦN RÀ câu chữ.
  function rvAdvice(R, rows) {
    rows = rows || rvRows(R);
    const M = GREF().metrics || {}, by = (k) => rows.find((r) => r.k === k) || { v: {} };
    const rng = (k) => (M[k] || {}).ref_rng, rf = (k) => ((M[k] || {}).ref_txt || '').split(' (')[0].replace(' bước/phút', '');
    const out = [], focus = [];   // out: [1 = khác tham chiếu (xếp trước) | 0, câu]
    const cad = by('cadence'), cr = rng('cadence');
    if (cad.redo) out.push([1, 'Nhịp đo được chưa ổn định; nên đo lại để có số chính xác hơn.']);
    else if (cad.v.C != null && cr) {
      const v = Math.round(cad.v.C), t = 'Nhịp ' + v + ' bước/phút';
      if (v < cr[0]) { out.push([1, t + ' thấp hơn tham chiếu ' + rf('cadence') + '; có thể thử tăng nhịp nhẹ nhàng khi tập.']); focus.push('nhịp bước'); }
      else if (v > cr[1]) out.push([1, t + ' cao hơn tham chiếu ' + rf('cadence') + '; có thể giữ nhịp thoải mái, không cần tăng thêm.']);
      else out.push([0, t + ' gần với tham chiếu ' + rf('cadence') + '; có thể giữ nhịp này khi tập.']);
    }
    const sh = by('shank_ic'), sr = rng('shank_ic'), L = sh.v.L, Rv = sh.v.R;
    if ((L != null || Rv != null) && sr) {
      const parts = [], vals = [];
      if (L != null) { parts.push('trái ' + Math.round(L) + '°'); vals.push(L); }
      if (Rv != null) { parts.push('phải ' + Math.round(Rv) + '°'); vals.push(Rv); }
      const t = 'Góc cẳng chân lúc chạm đất ' + parts.join(', ');
      if (vals.some((v) => v > sr[1])) { out.push([1, t + ', lớn hơn tham chiếu ' + rf('shank_ic') + '; có thể thử đặt chân gần dưới thân hơn.']); focus.push('cách đặt chân'); }
      else if (L != null && Rv != null && Math.abs(L - Rv) >= 4) { out.push([1, t + '; nên chú ý thêm sự khác nhau giữa hai chân khi chạy.']); focus.push('cách đặt chân hai bên'); }
      else out.push([0, t + ', gần với tham chiếu ' + rf('shank_ic') + '.']);
    }
    const a = by('strike').v.L, b = by('strike').v.R;
    if (a && b && a !== b) out.push([1, 'Chân trái đáp bằng ' + a + ', chân phải đáp bằng ' + b + '; có thể quan sát thêm ở các buổi chạy sau.']);
    else if (a || b) out.push([0, (a && b ? 'Cả hai chân' : a ? 'Chân trái' : 'Chân phải') + ' đáp bằng ' + (a || b) + (/gót/.test(a || b) ? '; phần lớn người chạy phong trào cũng đáp gót.' : '; có thể quan sát thêm ở các buổi chạy sau.')]);
    const vo = by('vert_osc').v.C, vr = rng('vert_osc');
    if (vo != null && vr) {
      const t = 'Thân nhấp nhô ' + App.rvNum(vo, 'cm') + ' cm';
      if (vo > vr[1]) { out.push([1, t + ', nhiều hơn tham chiếu ' + rf('vert_osc') + '; có thể thử bước nhẹ và ngắn hơn một chút.']); focus.push('độ nhấp nhô'); }
      else out.push([0, t + (vo < vr[0] ? ', ít hơn' : ', gần với') + ' tham chiếu ' + rf('vert_osc') + '.']);
    }
    const list = out.map((x, i) => [x[0], i, x[1]]).sort((x, y) => y[0] - x[0] || x[1] - y[1]).slice(0, 3).sort((x, y) => x[1] - y[1]).map((x) => x[2]);
    list.push(focus.length ? 'Gợi ý nhẹ: có thể thử tập trung vào ' + focus.slice(0, 2).join(' và ') + ' khi tập.' : 'Gợi ý nhẹ: có thể giữ thói quen chạy hiện tại và đo lại sau vài tuần để so sánh.');
    return list;
  }
  Object.assign(App, { RV_TXT, rvDiff, rvSentence, RV_ROWS, rvRows, RV_BADGE, rvScoreLine, rvAdvice });
})(window.App);
