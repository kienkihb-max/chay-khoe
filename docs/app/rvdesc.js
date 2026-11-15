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
  Object.assign(App, { RV_TXT, rvDiff, rvSentence });
})(window.App);
