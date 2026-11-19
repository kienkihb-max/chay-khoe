/* facts.js - "Bạn có biết?": mỗi màn kết quả kèm MỘT fact có nghiên cứu, gắn với chỉ số gần nhất đã đo.
 * Nội dung bác sĩ duyệt 17/11/2026. Sửa câu chữ ngay trong FACTS. Không phụ thuộc DOM (chạy được trong Node).
 *
 * Cách chọn (Facts.pick):
 *   1. Xét các chỉ số theo thứ tự ORDER; lấy mức xấu nhất của chỉ số đó ('bad' > 'mid'), chỉ xét chân/giá trị đủ tin cậy.
 *   2. Fact chỉ hợp với MỘT phía (when: 'low' | 'high'): chỉ dùng khi chỉ số lệch đúng phía đó
 *      (vd. "nghiêng thân thêm giảm áp lực gối" không được hiện cho người đã nghiêng thân quá nhiều).
 *   3. Ưu tiên chỉ số khách THẤY trong bảng chính (VISIBLE); trong cùng nhóm chọn lệch nặng nhất, bằng nhau thì theo thứ tự ORDER.
 *   4. Không chỉ số nào lệch: hiện fact Đáp đất (nếu đo được) hoặc Nhịp bước.
 * Đầu vào: get(k) => [{ v, lv }] các giá trị dùng được của chỉ số k (lv = 'ok' | 'mid' | 'bad' | null), lo(k) = cận dưới tham chiếu.
 */
(function (root) {
  'use strict';
  var FACTS = {
    cadence: { t: 'Tăng nhịp bước thêm 10% giúp gối phải hấp thụ ít năng lượng hơn khoảng 34% mỗi bước.', src: 'Heiderscheit 2011', when: 'low' },
    vert_osc: { t: 'Tăng nhịp bước thêm 10% giúp cơ thể nhấp nhô ít hơn, từ 8,7 cm còn 7,3 cm mỗi bước.', src: 'Heiderscheit 2011', when: 'high' },
    shank_ic: { t: 'Người chạy bị chấn thương thường chạm đất với cổ chân gập lên nhiều hơn, kiểu đáp gót mạnh với cẳng chân chìa ra trước.', src: 'Bramah 2018', when: 'high' },
    overstride: { t: 'Tăng nhịp bước 10% kéo điểm chạm đất lại gần thân hơn, từ khoảng 9 cm còn 7 cm phía trước trọng tâm.', src: 'Heiderscheit 2011', when: 'high' },
    knee_ic: { t: 'Người chạy bị chấn thương thường chạm đất với gối duỗi thẳng hơn so với người không chấn thương.', src: 'Bramah 2018', when: 'low' },
    trunk: { t: 'Nghiêng thân về trước thêm khoảng 10° làm giảm 13% áp lực lên khớp chè–đùi khi chạy.', src: 'Teng & Powers 2014', when: 'low' },
    pelvic_drop: { t: 'Mỗi 1° sụt hông thêm làm khả năng thuộc nhóm chấn thương tăng khoảng 80%.', src: 'Bramah 2018', when: 'high' },
    strike: { t: 'Khoảng 89% người chạy phong trào đáp gót ở km thứ 10, và chưa có bằng chứng rằng đổi sang đáp mũi giúp giảm chấn thương.', src: 'Larson 2011; Anderson 2020', when: null }
  };
  var ORDER = ['cadence', 'vert_osc', 'shank_ic', 'overstride', 'knee_ic', 'trunk', 'pelvic_drop'];
  var RANK = { bad: 2, mid: 1 };
  var VISIBLE = ['cadence', 'vert_osc', 'shank_ic'];   // chỉ số có fact nằm trong bảng chính màn kết quả (RV_TOP ở app/rview.js)

  function pick(get, lo, hasStrike) {
    var best = null;
    ORDER.forEach(function (k, i) {
      var f = FACTS[k], xs = get(k) || [];
      xs.forEach(function (x) {
        var r = RANK[x.lv]; if (!r) return;
        if (VISIBLE.indexOf(k) >= 0) r += 10;
        var side = x.v < lo(k) ? 'low' : 'high';
        if (f.when && f.when !== side) return;
        if (!best || r > best.r || (r === best.r && i < best.i)) best = { k: k, r: r, i: i };
      });
    });
    var k = best ? best.k : hasStrike ? 'strike' : 'cadence';
    return { k: k, t: FACTS[k].t, src: FACTS[k].src, why: best ? 'lech' : 'chung' };
  }

  var api = { FACTS: FACTS, ORDER: ORDER, pick: pick };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Facts = api;
})(typeof window !== 'undefined' ? window : globalThis);
